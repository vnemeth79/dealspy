import { BaseScraper, ScrapedDeal, ScraperResultWithFallback, sleep } from './base';
import { extractDealsFromHtml } from './ai-extract';

/**
 * Ediktsdatei Scraper
 * Austrian official court announcements (insolvency, auctions)
 * URL: https://edikte.justiz.gv.at
 */
export class EdiktsdateiScraper extends BaseScraper {
  source = 'ediktsdatei';
  country = 'at' as const;

  private baseUrl = 'https://edikte.justiz.gv.at';

  async scrape(): Promise<ScrapedDeal[] | ScraperResultWithFallback> {
    const deals: ScrapedDeal[] = [];

    try {
      console.log(`[Ediktsdatei] Starting scrape...`);

      // Fetch insolvency announcements
      const response = await this.fetchWithHeaders(
        `${this.baseUrl}/edikte/ex/exedi3.nsf/suchedi?OpenForm`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // Parse the HTML - Austrian court system uses specific structure
      // Look for auction/insolvency entries
      const entryRegex = /<tr[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
      const entries = html.matchAll(entryRegex);

      for (const entry of entries) {
        try {
          const rowHtml = entry[1];

          // Extract link and title
          const linkMatch = rowHtml.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
          if (!linkMatch) continue;

          const relativeUrl = linkMatch[1];
          const title = this.cleanText(linkMatch[2]);

          // Extract date
          const dateMatch = rowHtml.match(/(\d{2}\.\d{2}\.\d{4})/);
          const deadline = dateMatch ? this.parseDate(dateMatch[1]) : undefined;

          // Extract type/category
          const typeMatch = rowHtml.match(/Versteigerung|Insolvenz|Exekution/i);
          const type = typeMatch ? typeMatch[0] : 'other';

          // Only include if relevant (auctions, insolvencies)
          if (title && relativeUrl) {
            const fullUrl = relativeUrl.startsWith('http')
              ? relativeUrl
              : `${this.baseUrl}${relativeUrl}`;

            deals.push({
              source: this.source,
              source_id: this.generateSourceId(fullUrl),
              title_original: title,
              description_original: `Type: ${type}`,
              url: fullUrl,
              deadline,
              country: this.country,
              raw_data: { type },
            });
          }

          await sleep(50);
        } catch (itemError) {
          console.error('[Ediktsdatei] Error parsing entry:', itemError);
          continue;
        }
      }

      // AI fallback when regex found nothing (possible HTML change)
      if (deals.length === 0) {
        const aiDeals = await extractDealsFromHtml(html, this.source, this.baseUrl, this.country);
        if (aiDeals.length > 0) {
          console.log(`[Ediktsdatei] Found ${aiDeals.length} deals (AI fallback)`);
          return { deals: aiDeals, usedAiFallback: true };
        }
      }

      console.log(`[Ediktsdatei] Found ${deals.length} deals`);
      return deals;
    } catch (error) {
      console.error('[Ediktsdatei] Scrape failed:', error);
      return [];
    }
  }
}

export default EdiktsdateiScraper;
