import { BaseScraper, ScrapedDeal, ScraperResultWithFallback, sleep } from './base';
import { extractDealsFromHtml } from './ai-extract';

/**
 * Insolvenzbekanntmachungen Scraper
 * German official insolvency announcements
 * URL: https://www.insolvenzbekanntmachungen.de
 */
export class InsolvenzScraper extends BaseScraper {
  source = 'insolvenz';
  country = 'de' as const;

  private baseUrl = 'https://www.insolvenzbekanntmachungen.de';

  async scrape(): Promise<ScrapedDeal[] | ScraperResultWithFallback> {
    const deals: ScrapedDeal[] = [];

    try {
      console.log(`[Insolvenz] Starting scrape...`);

      // The German insolvency portal has a specific search interface
      const response = await this.fetchWithHeaders(
        `${this.baseUrl}/cgi-bin/bl_suche.pl`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            'Ession_ID': '',
            'such_art': 'einfach',
            'neu': '1',
            'aktenzeichen': '',
            'gericht': '',
            'name': '',
            'vorname': '',
            'geburtsname': '',
            'plz': '',
            'ort': '',
            'strasse': '',
            'land': '',
          }).toString(),
        }
      );

      if (!response.ok) {
        // Try alternative URL
        const altResponse = await this.fetchWithHeaders(
          `${this.baseUrl}/cgi-bin/bl_suche.pl?neu=1`,
          { method: 'GET' }
        );

        if (!altResponse.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      const html = await response.text();

      // Parse results - German insolvency portal specific structure
      const resultRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      const rows = html.matchAll(resultRegex);

      for (const row of rows) {
        try {
          const rowHtml = row[1];

          // Skip header rows
          if (rowHtml.includes('<th')) continue;

          // Extract data from table cells
          const cells = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
          if (cells.length < 3) continue;

          const cleanCell = (cell: string) => this.cleanText(cell.replace(/<[^>]*>/g, ''));

          // Typical structure: Court, Case Number, Name/Company, Type, Date
          const court = cells[0] ? cleanCell(cells[0]) : '';
          const caseNumber = cells[1] ? cleanCell(cells[1]) : '';
          const name = cells[2] ? cleanCell(cells[2]) : '';
          const type = cells[3] ? cleanCell(cells[3]) : '';
          const dateStr = cells[4] ? cleanCell(cells[4]) : '';

          // Extract link
          const linkMatch = rowHtml.match(/href="([^"]*bekanntmachung[^"]*)"/i);
          const relativeUrl = linkMatch ? linkMatch[1] : null;

          if (name && (caseNumber || relativeUrl)) {
            const title = `${type}: ${name}`.trim();
            const fullUrl = relativeUrl
              ? (relativeUrl.startsWith('http') ? relativeUrl : `${this.baseUrl}${relativeUrl}`)
              : `${this.baseUrl}/cgi-bin/bl_suche.pl?aktenzeichen=${encodeURIComponent(caseNumber)}`;

            deals.push({
              source: this.source,
              source_id: caseNumber || this.generateSourceId(fullUrl),
              title_original: title || name,
              description_original: `Gericht: ${court}, Aktenzeichen: ${caseNumber}`,
              url: fullUrl,
              deadline: dateStr ? this.parseDate(dateStr) : undefined,
              country: this.country,
              raw_data: { court, caseNumber, type },
            });
          }

          await sleep(50);
        } catch (itemError) {
          console.error('[Insolvenz] Error parsing row:', itemError);
          continue;
        }
      }

      // AI fallback when regex found nothing (possible HTML change)
      if (deals.length === 0) {
        const aiDeals = await extractDealsFromHtml(html, this.source, this.baseUrl, this.country);
        if (aiDeals.length > 0) {
          console.log(`[Insolvenz] Found ${aiDeals.length} deals (AI fallback)`);
          return { deals: aiDeals, usedAiFallback: true };
        }
      }

      console.log(`[Insolvenz] Found ${deals.length} deals`);
      return deals;
    } catch (error) {
      console.error('[Insolvenz] Scrape failed:', error);
      return [];
    }
  }
}

export default InsolvenzScraper;
