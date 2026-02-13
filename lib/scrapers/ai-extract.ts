import Anthropic from '@anthropic-ai/sdk';
import type { ScrapedDeal } from './base';
import type { Country } from '../db/supabase';

const MAX_HTML_CHARS = 80_000;

function generateSourceId(url: string): string {
  const patterns = [
    /\/(\d+)\/?$/,
    /[?&]id=(\d+)/,
    /[?&]lot=(\d+)/,
    /\/lot\/(\d+)/,
    /\/auction\/(\d+)/,
    /\/item\/(\d+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString();
}

/**
 * Use AI to extract listing/auction deals from HTML when regex parsing returns 0.
 * Enables automatic adaptation to HTML structure changes.
 * Returns [] if AI is not configured or extraction fails.
 */
export async function extractDealsFromHtml(
  html: string,
  source: string,
  baseUrl: string,
  country: Country
): Promise<ScrapedDeal[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const disabled = process.env.ENABLE_AI_SCRAPER_FALLBACK === '0' || process.env.ENABLE_AI_SCRAPER_FALLBACK === 'false';
  if (!apiKey || disabled) return [];

  const truncated = html.length > MAX_HTML_CHARS ? html.slice(0, MAX_HTML_CHARS) + '\n...[truncated]' : html;

  const prompt = `You are extracting auction/listing items from a scraped HTML page. The page is from source "${source}" (base URL: ${baseUrl}).

Extract every listing or auction item you can find. For each item provide:
- title: short title (required)
- url: full URL to the detail page (required). If the HTML has relative URLs, prepend base URL: ${baseUrl}
- price: number only if visible (optional)
- currency: e.g. EUR, HUF (optional)
- deadline: ISO date string YYYY-MM-DD if visible (optional)

Respond with a valid JSON array only, no other text. Example:
[{"title":"Auction item 1","url":"https://...","price":1000,"currency":"EUR","deadline":"2026-03-01"},{"title":"Item 2","url":"https://..."}]

HTML (may be truncated):
${truncated}`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4096,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find((c) => c.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text : null;
    if (!text) return [];

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    const raw = JSON.parse(jsonStr) as Array<{ title?: string; url?: string; price?: number; currency?: string; deadline?: string }>;

    const deals: ScrapedDeal[] = [];
    for (const item of raw) {
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      let url = typeof item.url === 'string' ? item.url.trim() : '';
      if (!title || !url) continue;
      if (!url.startsWith('http')) url = `${baseUrl.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;

      const deadline = item.deadline ? (() => {
        const d = new Date(item.deadline);
        return isNaN(d.getTime()) ? undefined : d;
      })() : undefined;

      deals.push({
        source,
        source_id: generateSourceId(url),
        title_original: title.slice(0, 500),
        url,
        price: typeof item.price === 'number' && !isNaN(item.price) ? item.price : undefined,
        currency: typeof item.currency === 'string' ? item.currency : 'EUR',
        deadline,
        country,
      });
    }

    if (deals.length > 0) {
      console.log(`[AI Extract] ${source}: extracted ${deals.length} deals (HTML fallback)`);
    }
    return deals;
  } catch (err) {
    console.error(`[AI Extract] ${source} failed:`, err);
    return [];
  }
}
