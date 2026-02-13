import { BaseScraper, ScrapedDeal, ScraperResultWithFallback, sleep } from './base';
import { extractDealsFromHtml } from './ai-extract';

/**
 * Proventura Scraper
 * German auction platform for machinery, IT, vehicles
 * URL: https://www.proventura.de
 * Fetch-based: works on Vercel serverless. Parses listing HTML for links and titles.
 */
export class ProventuraScraper extends BaseScraper {
  source = 'proventura';
  country = 'de' as const;

  private baseUrl = 'https://www.proventura.de';

  async scrape(): Promise<ScrapedDeal[] | ScraperResultWithFallback> {
    const deals: ScrapedDeal[] = [];

    try {
      console.log(`[Proventura] Starting scrape (fetch)...`);

      const response = await this.fetchWithHeaders(
        `${this.baseUrl}/de/auktionen`,
        { method: 'GET' }
      );

      if (!response.ok) {
        console.error(`[Proventura] HTTP ${response.status}`);
        return [];
      }

      const html = await response.text();

      // Links to auction/lot pages
      const linkRegex = /<a[^>]+href="(\/[^"]*?(?:auktion|lot|los|item)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      const seen = new Set<string>();

      let match: RegExpExecArray | null;
      while ((match = linkRegex.exec(html)) !== null) {
        try {
          const href = match[1].trim();
          const linkText = this.cleanText(match[2]);
          const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

          if (seen.has(fullUrl) || fullUrl === `${this.baseUrl}/de/auktionen`) continue;
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
        } catch {
          continue;
        }
      }

      // Fallback: any link with /auktion/ or /lot/ in path
      if (deals.length === 0) {
        const fallbackRegex = /<a[^>]+href="([^"]*(?:auktion|lot|los)[^"]*)"[^>]*>([^<]{5,200})<\/a>/gi;
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
          console.log(`[Proventura] Found ${aiDeals.length} deals (AI fallback)`);
          return { deals: aiDeals, usedAiFallback: true };
        }
      }

      console.log(`[Proventura] Found ${deals.length} deals`);
      return deals;
    } catch (error) {
      console.error('[Proventura] Scrape failed:', error);
      return [];
    }
  }
}

export default ProventuraScraper;
