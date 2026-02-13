import Anthropic from '@anthropic-ai/sdk';
import { Category } from '../db/supabase';
import { ScrapedDeal } from '../scrapers/base';

// Lazy initialization
let _anthropic: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    _anthropic = new Anthropic({ apiKey });
  }
  return _anthropic;
}

const VALID_CATEGORIES: Category[] = ['it', 'machines', 'vehicles', 'property', 'other'];

/**
 * Categorize text using Claude Haiku
 */
export async function categorizeText(
  title: string,
  description?: string
): Promise<Category> {
  if (!title || title.trim().length === 0) {
    return 'other';
  }

  try {
    const prompt = `Categorize this auction/insolvency item into exactly one category.

Categories:
- it: Servers, computers, IT equipment, networking hardware, GPUs, data center equipment, storage systems
- machines: Industrial machines, CNC, manufacturing equipment, tools, production lines, factory equipment
- vehicles: Cars, trucks, forklifts, construction vehicles, trailers, boats, motorcycles
- property: Real estate, buildings, land, warehouses, offices, apartments
- other: Everything else (furniture, inventory, office equipment, miscellaneous)

Item:
Title: ${title}
${description ? `Description: ${description}` : ''}

Respond with only the category name (it/machines/vehicles/property/other). Nothing else.`;

    const message = await getAnthropic().messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 20,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    if (message.content[0].type === 'text') {
      const response = message.content[0].text.trim().toLowerCase();

      // Validate response is a valid category
      if (VALID_CATEGORIES.includes(response as Category)) {
        return response as Category;
      }

      // Try to extract category from response
      for (const cat of VALID_CATEGORIES) {
        if (response.includes(cat)) {
          return cat;
        }
      }
    }

    return 'other';
  } catch (error) {
    console.error('[Categorize] Error:', error);
    return 'other';
  }
}

/**
 * Categorize a deal
 */
export async function categorizeDeal(deal: ScrapedDeal): Promise<Category> {
  return categorizeText(deal.title_original, deal.description_original);
}

/**
 * Batch categorize multiple items
 * Uses a single API call for efficiency
 */
export async function categorizeDeals(
  deals: ScrapedDeal[]
): Promise<Map<string, Category>> {
  const categories = new Map<string, Category>();

  // Process in batches to avoid rate limits
  const batchSize = 10;

  for (let i = 0; i < deals.length; i += batchSize) {
    const batch = deals.slice(i, i + batchSize);

    // Try batch categorization first
    try {
      const batchResult = await categorizeBatch(batch);
      batchResult.forEach((cat, id) => categories.set(id, cat));
    } catch {
      // Fall back to individual categorization
      for (const deal of batch) {
        try {
          const category = await categorizeDeal(deal);
          categories.set(deal.source_id, category);
        } catch {
          categories.set(deal.source_id, 'other');
        }
      }
    }
  }

  return categories;
}

/**
 * Batch categorize using a single API call
 */
async function categorizeBatch(deals: ScrapedDeal[]): Promise<Map<string, Category>> {
  const categories = new Map<string, Category>();

  const itemList = deals
    .map((d, i) => `${i + 1}. "${d.title_original}"`)
    .join('\n');

  const prompt = `Categorize each item into one of: it, machines, vehicles, property, other

Categories:
- it: Servers, computers, IT equipment, networking, GPUs
- machines: Industrial machines, CNC, manufacturing equipment
- vehicles: Cars, trucks, forklifts, construction vehicles
- property: Real estate, buildings, land
- other: Everything else

Items:
${itemList}

Respond with only numbers and categories, one per line. Example:
1. it
2. machines
3. other`;

  try {
    const message = await getAnthropic().messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });

    if (message.content[0].type === 'text') {
      const lines = message.content[0].text.trim().split('\n');

      lines.forEach((line) => {
        const match = line.match(/(\d+)\.\s*(\w+)/);
        if (match) {
          const index = parseInt(match[1]) - 1;
          const category = match[2].toLowerCase();

          if (index >= 0 && index < deals.length) {
            if (VALID_CATEGORIES.includes(category as Category)) {
              categories.set(deals[index].source_id, category as Category);
            } else {
              categories.set(deals[index].source_id, 'other');
            }
          }
        }
      });
    }
  } catch (error) {
    console.error('[Categorize] Batch error:', error);
    // Fall back to 'other' for all
    deals.forEach((d) => categories.set(d.source_id, 'other'));
  }

  // Ensure all deals have a category
  deals.forEach((d) => {
    if (!categories.has(d.source_id)) {
      categories.set(d.source_id, 'other');
    }
  });

  return categories;
}
