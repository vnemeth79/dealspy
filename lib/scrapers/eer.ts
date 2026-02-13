import { BaseScraper, ScrapedDeal, ScraperResultWithFallback, sleep } from './base';
import { extractDealsFromHtml } from './ai-extract';

/**
 * EÉR (Elektronikus Értékesítési Rendszer) Scraper
 * Hungarian official insolvency asset sales platform
 * URL: https://eer.sztfh.hu
 */
export class EerScraper extends BaseScraper {
  source = 'eer';
  country = 'hu' as const;

  private baseUrl = 'https://eer.sztfh.hu';

  async scrape(): Promise<ScrapedDeal[] | ScraperResultWithFallback> {
    const deals: ScrapedDeal[] = [];

    try {
      console.log(`[EER] Starting scrape...`);

      // Fetch the main listing page
      const response = await this.fetchWithHeaders(
        `${this.baseUrl}/palyazat/kereses`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // Parse the HTML to extract deals
      // Note: This is a simplified parser - may need adjustment based on actual HTML structure
      const dealMatches = html.matchAll(
        /<div[^>]*class="[^"]*palyazat-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi
      );

      for (const match of dealMatches) {
        try {
          const itemHtml = match[1];

          // Extract title
          const titleMatch = itemHtml.match(/<h[23][^>]*>(.*?)<\/h[23]>/i);
          const title = titleMatch ? this.cleanText(titleMatch[1]) : null;

          // Extract URL
          const urlMatch = itemHtml.match(/href="([^"]*palyazat[^"]*)"/i);
          const relativeUrl = urlMatch ? urlMatch[1] : null;

          // Extract price
          const priceMatch = itemHtml.match(/(\d[\d\s.,]*)\s*(Ft|HUF|EUR|€)/i);
          const price = priceMatch ? this.parsePrice(priceMatch[1]) : undefined;
          const currency = priceMatch 
            ? (priceMatch[2].toUpperCase() === 'FT' ? 'HUF' : priceMatch[2].toUpperCase())
            : 'HUF';

          // Extract deadline
          const deadlineMatch = itemHtml.match(/határidő[:\s]*(\d{4}[-./]\d{2}[-./]\d{2})/i);
          const deadline = deadlineMatch ? this.parseDate(deadlineMatch[1]) : undefined;

          if (title && relativeUrl) {
            const fullUrl = relativeUrl.startsWith('http') 
              ? relativeUrl 
              : `${this.baseUrl}${relativeUrl}`;

            deals.push({
              source: this.source,
              source_id: this.generateSourceId(fullUrl),
              title_original: title,
              url: fullUrl,
              price,
              currency,
              deadline,
              country: this.country,
            });
          }

          // Rate limiting
          await sleep(100);
        } catch (itemError) {
          console.error('[EER] Error parsing item:', itemError);
          continue;
        }
      }

      // Alternative: Try to parse from JSON API if available
      if (deals.length === 0) {
        const apiDeals = await this.tryApiScrape();
        deals.push(...apiDeals);
      }

      // AI fallback when regex/API found nothing (possible HTML change)
      if (deals.length === 0) {
        const aiDeals = await extractDealsFromHtml(html, this.source, this.baseUrl, this.country);
        if (aiDeals.length > 0) {
          console.log(`[EER] Found ${aiDeals.length} deals (AI fallback)`);
          return { deals: aiDeals, usedAiFallback: true };
        }
      }

      console.log(`[EER] Found ${deals.length} deals`);
      return deals;
    } catch (error) {
      console.error('[EER] Scrape failed:', error);
      return [];
    }
  }

  /**
   * Try to scrape from API endpoint if HTML parsing fails
   */
  private async tryApiScrape(): Promise<ScrapedDeal[]> {
    try {
      // Try common API patterns
      const apiEndpoints = [
        `${this.baseUrl}/api/palyazatok`,
        `${this.baseUrl}/api/v1/listings`,
        `${this.baseUrl}/palyazat/lista/json`,
      ];

      for (const endpoint of apiEndpoints) {
        try {
          const response = await this.fetchWithHeaders(endpoint, {
            headers: {
              'Accept': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            const apiDeals = this.parseApiDeals(data);
            if (apiDeals.length > 0) {
              console.log(`[EER] API endpoint found: ${endpoint}, ${apiDeals.length} deals`);
              return apiDeals;
            }
          }
        } catch {
          continue;
        }
      }

      return [];
    } catch {
      return [];
    }
  }

  /**
   * Parse API JSON response into ScrapedDeal[].
   * Handles common shapes: array, { items: [] }, { palyazatok: [] }, { data: [] }, { listings: [] }.
   */
  private parseApiDeals(data: unknown): ScrapedDeal[] {
    const deals: ScrapedDeal[] = [];
    let items: unknown[] = [];

    if (Array.isArray(data)) {
      items = data;
    } else if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      const arr = obj.items ?? obj.palyazatok ?? obj.data ?? obj.listings ?? obj.results;
      if (Array.isArray(arr)) items = arr;
    }

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const title = this.optStr(o.title ?? o.cim ?? o.name ?? o.nev);
      const urlRaw = this.optStr(o.url ?? o.link ?? o.href ?? o.detailUrl ?? o.detail_url ?? o.permalink);
      if (!title) continue;

      let url = urlRaw;
      if (!url && (o.id || o.palyazat_id)) {
        const id = String(o.id ?? o.palyazat_id);
        url = `${this.baseUrl}/palyazat/${id}`;
      }
      if (!url) continue;

      const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
      const price = this.optPrice(o.price ?? o.ar ?? o.starting_price);
      const currency = this.optStr(o.currency ?? o.valuta)?.toUpperCase() || 'HUF';
      const deadline = this.optDate(o.deadline ?? o.hatarido ?? o.hatar_ido ?? o.ends_at);

      deals.push({
        source: this.source,
        source_id: this.generateSourceId(fullUrl),
        title_original: title,
        url: fullUrl,
        price,
        currency: currency || undefined,
        deadline,
        country: this.country,
      });
    }

    return deals;
  }

  private optStr(v: unknown): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s || undefined;
  }

  private optPrice(v: unknown): number | undefined {
    if (v == null) return undefined;
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
    return Number.isNaN(n) ? undefined : n;
  }

  private optDate(v: unknown): Date | undefined {
    if (v == null) return undefined;
    if (v instanceof Date) return v;
    const s = String(v).trim();
    return s ? this.parseDate(s) : undefined;
  }
}

export default EerScraper;
