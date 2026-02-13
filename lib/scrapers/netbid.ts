import { BaseScraper, ScrapedDeal, ScraperResultWithFallback, sleep } from './base';
import { extractDealsFromHtml } from './ai-extract';

/**
 * NetBid Scraper
 * European industrial auction platform
 * URL: https://www.netbid.com
 * Fetch-based: works on Vercel serverless. Parses listing HTML for links and titles.
 */
export class NetBidScraper extends BaseScraper {
  source = 'netbid';
  country = 'de' as const;

  private baseUrl = 'https://www.netbid.com';

  async scrape(): Promise<ScrapedDeal[] | ScraperResultWithFallback> {
    const deals: ScrapedDeal[] = [];

    try {
      console.log(`[NetBid] Starting scrape (fetch)...`);

      const response = await this.fetchWithHeaders(
        `${this.baseUrl}/en/auctions/`,
        { method: 'GET' }
      );

      if (!response.ok) {
        console.error(`[NetBid] HTTP ${response.status}`);
        return [];
      }

      const html = await response.text();

      // Flexible: find links that look like auction/lot detail pages
      const linkRegex = /<a[^>]+href="(\/(?:en|de)\/[^"]*?(?:auction|lot|item)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      const seen = new Set<string>();

      let match: RegExpExecArray | null;
      while ((match = linkRegex.exec(html)) !== null) {
        try {
          const href = match[1].trim();
          const linkText = this.cleanText(match[2]);
          const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

          if (seen.has(fullUrl) || fullUrl === `${this.baseUrl}/en/auctions/`) continue;
          seen.add(fullUrl);

          if (linkText.length < 3) continue;

          deals.push({
            source: this.source,
            source_id: this.generateSourceId(fullUrl),
            title_original: linkText.slice(0, 500),
            url: fullUrl,
            currency: 'EUR',
            country: this.country,
          });

          await sleep(50);
        } catch (itemError) {
          continue;
        }
      }

      // Fallback: any link containing /auction/ or /lot/ with meaningful text
      if (deals.length === 0) {
        const fallbackRegex = /<a[^>]+href="([^"]*(?:auction|lot)[^"]*)"[^>]*>([^<]{5,200})<\/a>/gi;
        while ((match = fallbackRegex.exec(html)) !== null) {
          const href = match[1].trim();
          const linkText = this.cleanText(match[2]);
          const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
          if (seen.has(fullUrl)) continue;
          seen.add(fullUrl);

          deals.push({
            source: this.source,
            source_id: this.generateSourceId(fullUrl),
            title_original: linkText,
            url: fullUrl,
            currency: 'EUR',
            country: this.country,
          });
        }
      }

      // AI fallback when regex found nothing (possible HTML change)
      if (deals.length === 0) {
        const aiDeals = await extractDealsFromHtml(html, this.source, this.baseUrl, this.country);
        if (aiDeals.length > 0) {
          console.log(`[NetBid] Found ${aiDeals.length} deals (AI fallback)`);
          return { deals: aiDeals, usedAiFallback: true };
        }
      }

      console.log(`[NetBid] Found ${deals.length} deals`);
      return deals;
    } catch (error) {
      console.error('[NetBid] Scrape failed:', error);
      return [];
    }
  }
}

export default NetBidScraper;
