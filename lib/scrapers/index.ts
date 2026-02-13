import { BaseScraper, ScrapedDeal, withRetry } from './base';
import { EerScraper } from './eer';
import { NetBidScraper } from './netbid';
import { EdiktsdateiScraper } from './ediktsdatei';
import { InsolvenzScraper } from './insolvenz';
import { ProventuraScraper } from './proventura';
import { MachineseekerScraper } from './machineseeker';

export interface ScraperStats {
  totalDeals: number;
  bySource: Record<string, number>;
  errors: Array<{ source: string; error: string }>;
  /** Sources that returned 0 from regex but got deals via AI fallback (possible HTML change) */
  aiFallbackSources: string[];
  duration: number;
}

export interface ScraperResult {
  deals: ScrapedDeal[];
  stats: ScraperStats;
}

// All available scrapers (all fetch-based; no Playwright required)
const scrapers: BaseScraper[] = [
  new EerScraper(),
  new NetBidScraper(),
  new EdiktsdateiScraper(),
  new InsolvenzScraper(),
  new ProventuraScraper(),
  new MachineseekerScraper(),
];

/**
 * Run all scrapers and collect results
 */
export async function runAllScrapers(): Promise<ScraperResult> {
  const startTime = Date.now();
  const allDeals: ScrapedDeal[] = [];
  const stats: ScraperStats = {
    totalDeals: 0,
    bySource: {},
    errors: [],
    aiFallbackSources: [],
    duration: 0,
  };

  console.log(`[Scraper] Starting scrape of ${scrapers.length} sources...`);

  for (const scraper of scrapers) {
    try {
      console.log(`[Scraper] Running ${scraper.source}...`);

      const result = await withRetry(
        () => scraper.scrape(),
        3, // retries (PRD: 3x then admin alert)
        10000 // delay between retries
      );

      const deals = Array.isArray(result) ? result : result.deals;
      const usedAiFallback = !Array.isArray(result) && result.usedAiFallback;

      allDeals.push(...deals);
      stats.bySource[scraper.source] = deals.length;
      if (usedAiFallback) stats.aiFallbackSources.push(scraper.source);

      console.log(`[Scraper] ${scraper.source}: ${deals.length} deals found`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      stats.errors.push({
        source: scraper.source,
        error: errorMessage,
      });
      stats.bySource[scraper.source] = 0;
      console.error(`[Scraper] ${scraper.source} failed:`, errorMessage);
    }
  }

  stats.totalDeals = allDeals.length;
  stats.duration = Date.now() - startTime;

  console.log(`[Scraper] Complete. Total: ${stats.totalDeals} deals in ${stats.duration}ms`);
  console.log(`[Scraper] By source:`, stats.bySource);
  if (stats.errors.length > 0) {
    console.log(`[Scraper] Errors:`, stats.errors);
  }

  return { deals: allDeals, stats };
}

/**
 * Run a specific scraper by source name
 */
export async function runScraper(source: string): Promise<ScraperResult> {
  const startTime = Date.now();
  const scraper = scrapers.find((s) => s.source === source);

  if (!scraper) {
    throw new Error(`Unknown scraper source: ${source}`);
  }

  const stats: ScraperStats = {
    totalDeals: 0,
    bySource: {},
    errors: [],
    aiFallbackSources: [],
    duration: 0,
  };

  try {
    const result = await withRetry(() => scraper.scrape(), 3, 5000);
    const deals = Array.isArray(result) ? result : result.deals;
    if (!Array.isArray(result) && result.usedAiFallback) stats.aiFallbackSources.push(source);
    stats.totalDeals = deals.length;
    stats.bySource[source] = deals.length;
    stats.duration = Date.now() - startTime;

    return { deals, stats };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    stats.errors.push({ source, error: errorMessage });
    stats.duration = Date.now() - startTime;

    return { deals: [], stats };
  }
}

/**
 * Get list of available scraper sources
 */
export function getAvailableSources(): string[] {
  return scrapers.map((s) => s.source);
}

// Re-export types and utilities
export type { ScrapedDeal } from './base';
export { sleep, withRetry } from './base';
