import Anthropic from '@anthropic-ai/sdk';
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

/**
 * Translate text using Claude Haiku
 */
export async function translateText(
  text: string,
  targetLang: 'hu' | 'en',
  sourceLang?: string
): Promise<string> {
  if (!text || text.trim().length === 0) {
    return text;
  }

  // Skip if text is already likely in target language
  if (targetLang === 'hu' && /^[a-záéíóöőúüű\s\d.,!?-]+$/i.test(text)) {
    // Check for Hungarian-specific characters
    if (/[áéíóöőúüű]/i.test(text)) {
      return text;
    }
  }

  try {
    const targetLanguage = targetLang === 'hu' ? 'Hungarian' : 'English';
    const sourceInfo = sourceLang ? ` from ${sourceLang}` : '';

    const message = await getAnthropic().messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      temperature: 0,
      system: `You are a translator. Translate the given text${sourceInfo} to ${targetLanguage}. 
Keep technical terms accurate (machine names, model numbers, etc.).
If the text is already in the target language, return it as-is.
Only return the translation, nothing else. No explanations.`,
      messages: [
        {
          role: 'user',
          content: text,
        },
      ],
    });

    if (message.content[0].type === 'text') {
      return message.content[0].text.trim();
    }

    return text;
  } catch (error) {
    console.error('[Translate] Error:', error);
    return text; // Return original on error
  }
}

/**
 * Translate a deal's title and description
 */
export async function translateDeal(deal: ScrapedDeal): Promise<{
  title_hu: string;
  title_en: string;
  description_hu?: string;
  description_en?: string;
}> {
  const result = {
    title_hu: deal.title_original,
    title_en: deal.title_original,
    description_hu: deal.description_original,
    description_en: deal.description_original,
  };

  // If Hungarian source, title is already in Hungarian
  if (deal.country === 'hu') {
    // Translate to English
    result.title_en = await translateText(deal.title_original, 'en', 'Hungarian');
    if (deal.description_original) {
      // Only translate first 200 chars for cost optimization
      const shortDesc = deal.description_original.substring(0, 200);
      result.description_en = await translateText(shortDesc, 'en', 'Hungarian');
    }
  }
  // If German/Austrian source, translate to both HU and EN
  else if (deal.country === 'de' || deal.country === 'at') {
    // Translate title
    result.title_hu = await translateText(deal.title_original, 'hu', 'German');
    result.title_en = await translateText(deal.title_original, 'en', 'German');

    // Translate description (first 200 chars)
    if (deal.description_original) {
      const shortDesc = deal.description_original.substring(0, 200);
      result.description_hu = await translateText(shortDesc, 'hu', 'German');
      result.description_en = await translateText(shortDesc, 'en', 'German');
    }
  }

  return result;
}

/**
 * Batch translate multiple deals
 */
export async function translateDeals(deals: ScrapedDeal[]): Promise<
  Map<string, {
    title_hu: string;
    title_en: string;
    description_hu?: string;
    description_en?: string;
  }>
> {
  const translations = new Map();

  for (const deal of deals) {
    try {
      const translation = await translateDeal(deal);
      translations.set(deal.source_id, translation);
    } catch (error) {
      console.error(`[Translate] Failed for deal ${deal.source_id}:`, error);
      // Use original as fallback
      translations.set(deal.source_id, {
        title_hu: deal.title_original,
        title_en: deal.title_original,
        description_hu: deal.description_original,
        description_en: deal.description_original,
      });
    }
  }

  return translations;
}
