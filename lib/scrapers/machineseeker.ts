import { BaseScraper, ScrapedDeal, sleep } from './base';
import { extractDealsFromHtml } from './ai-extract';

/**
 * Machineseeker Scraper
 * Europe's largest used machinery marketplace
 * URL: https://www.machineseeker.com
 */
export class MachineseekerScraper extends BaseScraper {
  source = 'machineseeker';
  country = 'de' as const;

  private baseUrl = 'https://www.machineseeker.com';

  async scrape(): Promise<ScrapedDeal[] | { deals: ScrapedDeal[]; usedAiFallback: true }> {
    const deals: ScrapedDeal[] = [];
    let usedAiFallback = false;

    try {
      console.log(`[Machineseeker] Starting scrape...`);

      const categories = [
        'server',
        'cnc',
        'laser',
        'forklift',
        'industrial-robot',
      ];

      for (const category of categories) {
        try {
          const result = await this.scrapeCategory(category);
          const categoryDeals = result.deals;
          if (result.usedAiFallback) usedAiFallback = true;
          deals.push(...categoryDeals);
          await sleep(2000);
        } catch (categoryError) {
          console.error(`[Machineseeker] Error scraping category ${category}:`, categoryError);
          continue;
        }
      }

      console.log(`[Machineseeker] Found ${deals.length} total deals`);
      if (usedAiFallback) return { deals, usedAiFallback: true };
      return deals;
    } catch (error) {
      console.error('[Machineseeker] Scrape failed:', error);
      return [];
    }
  }

  private async scrapeCategory(category: string): Promise<{ deals: ScrapedDeal[]; usedAiFallback?: boolean }> {
    const deals: ScrapedDeal[] = [];

    const response = await this.fetchWithHeaders(
      `${this.baseUrl}/en/${category}/`,
      { method: 'GET' }
    );

    if (!response.ok) {
      console.error(`[Machineseeker] Failed to fetch category ${category}: ${response.status}`);
      return { deals: [] };
    }

    const html = await response.text();

    // Parse machine listings
    const listingRegex = /<div[^>]*class="[^"]*machine-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
    const listings = html.matchAll(listingRegex);

    for (const listing of listings) {
      try {
        const itemHtml = listing[1];

        // Extract title
        const titleMatch = itemHtml.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i);
        const title = titleMatch ? this.cleanText(titleMatch[1]) : null;

        // Extract URL
        const urlMatch = itemHtml.match(/href="([^"]*machine[^"]*)"/i);
        const relativeUrl = urlMatch ? urlMatch[1] : null;

        // Extract price
        const priceMatch = itemHtml.match(/(\d[\d\s.,]*)\s*(€|EUR)/i);
        const price = priceMatch ? this.parsePrice(priceMatch[1]) : undefined;

        // Extract year/description
        const yearMatch = itemHtml.match(/(\d{4})/);
        const year = yearMatch ? yearMatch[1] : null;

        // Extract location (often indicates country)
        const locationMatch = itemHtml.match(/location[^>]*>([^<]*)</i);
        const location = locationMatch ? this.cleanText(locationMatch[1]) : null;

        // Determine country from location
        let itemCountry: 'hu' | 'at' | 'de' = this.country;
        if (location) {
          if (location.toLowerCase().includes('austria') || location.includes('AT')) {
            itemCountry = 'at';
          } else if (location.toLowerCase().includes('hungary') || location.includes('HU')) {
            itemCountry = 'hu';
          }
        }

        // Extract image
        const imgMatch = itemHtml.match(/src="([^"]*\.(jpg|jpeg|png|webp)[^"]*)"/i);
        const imageUrl = imgMatch ? imgMatch[1] : undefined;

        if (title && relativeUrl) {
          const fullUrl = relativeUrl.startsWith('http')
            ? relativeUrl
            : `${this.baseUrl}${relativeUrl}`;

          deals.push({
            source: this.source,
            source_id: this.generateSourceId(fullUrl),
            title_original: title,
            description_original: year ? `Year: ${year}` : undefined,
            url: fullUrl,
            price,
            currency: 'EUR',
            image_url: imageUrl,
            country: itemCountry,
            raw_data: { category, year, location },
          });
        }

        await sleep(50);
      } catch (itemError) {
        console.error('[Machineseeker] Error parsing item:', itemError);
        continue;
      }
    }

    // AI fallback when regex found nothing for this category (possible HTML change)
    if (deals.length === 0) {
      const aiDeals = await extractDealsFromHtml(html, this.source, this.baseUrl, this.country);
      if (aiDeals.length > 0) {
        console.log(`[Machineseeker] Category ${category}: ${aiDeals.length} deals (AI fallback)`);
        return { deals: aiDeals, usedAiFallback: true };
      }
    }

    return { deals };
  }
}

export default MachineseekerScraper;
