import { Country } from '../db/supabase';

/**
 * Interface for scraped deal data
 */
export interface ScrapedDeal {
  source: string;
  source_id: string;
  title_original: string;
  description_original?: string;
  price?: number;
  currency?: string;
  deadline?: Date;
  url: string;
  image_url?: string;
  country: Country;
  raw_data?: Record<string, unknown>;
}

/** Result when scraper uses AI fallback (HTML structure likely changed) */
export interface ScraperResultWithFallback {
  deals: ScrapedDeal[];
  usedAiFallback: true;
}

/**
 * Base scraper class with common utilities
 * scrape() may return either deals array or { deals, usedAiFallback: true } when AI fallback was used
 */
export abstract class BaseScraper {
  abstract source: string;
  abstract country: Country;
  abstract scrape(): Promise<ScrapedDeal[] | ScraperResultWithFallback>;

  /**
   * Parse price from various formats
   * Handles: "€ 1.234,56", "1234 EUR", "EUR 1,234.56", "1.234 €"
   */
  protected parsePrice(text: string): number | undefined {
    if (!text) return undefined;

    // Remove currency symbols and whitespace
    let cleaned = text
      .replace(/[€$£]/g, '')
      .replace(/EUR|USD|GBP|HUF|CHF/gi, '')
      .trim();

    // Handle German format (1.234,56) - dots as thousand separators, comma as decimal
    if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(cleaned)) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
    // Handle format with comma as thousand separator (1,234.56)
    else if (/^\d{1,3}(,\d{3})*\.\d{2}$/.test(cleaned)) {
      cleaned = cleaned.replace(/,/g, '');
    }
    // Handle simple comma decimal (1234,56)
    else if (/^\d+,\d{2}$/.test(cleaned)) {
      cleaned = cleaned.replace(',', '.');
    }

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? undefined : parsed;
  }

  /**
   * Parse date from various formats
   * Handles: "2026-02-15", "15.02.2026", "15/02/2026", "Feb 15, 2026"
   */
  protected parseDate(text: string): Date | undefined {
    if (!text) return undefined;

    const cleaned = text.trim();

    // ISO format: 2026-02-15
    if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
      const date = new Date(cleaned);
      return isNaN(date.getTime()) ? undefined : date;
    }

    // German/European format: 15.02.2026
    const dotMatch = cleaned.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (dotMatch) {
      const [, day, month, year] = dotMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return isNaN(date.getTime()) ? undefined : date;
    }

    // Slash format: 15/02/2026
    const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
      const [, day, month, year] = slashMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return isNaN(date.getTime()) ? undefined : date;
    }

    // Try native parsing as fallback
    const date = new Date(cleaned);
    return isNaN(date.getTime()) ? undefined : date;
  }

  /**
   * Clean text: trim, collapse whitespace, remove HTML tags
   */
  protected cleanText(text: string): string {
    if (!text) return '';

    return text
      // Remove HTML tags
      .replace(/<[^>]*>/g, '')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Generate a unique source ID from URL
   */
  protected generateSourceId(url: string): string {
    // Extract ID from URL patterns
    const patterns = [
      /\/(\d+)\/?$/,           // /12345/
      /[?&]id=(\d+)/,          // ?id=12345
      /[?&]lot=(\d+)/,         // ?lot=12345
      /\/lot\/(\d+)/,          // /lot/12345
      /\/auction\/(\d+)/,      // /auction/12345
      /\/item\/(\d+)/,         // /item/12345
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    // Fallback: hash the URL
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString();
  }

  /**
   * Make HTTP request with standard headers
   */
  protected async fetchWithHeaders(url: string, options: RequestInit = {}): Promise<Response> {
    const defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5,de;q=0.3,hu;q=0.2',
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Sleep utility for rate limiting
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry wrapper for scraper operations
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 5000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Attempt ${i + 1} failed:`, lastError.message);

      if (i < retries - 1) {
        await sleep(delay * (i + 1)); // Exponential backoff
      }
    }
  }

  throw lastError;
}
