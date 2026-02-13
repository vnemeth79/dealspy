import { User, Deal } from '../db/supabase';
import { getAllActiveUsers } from '../db/users';

/**
 * Check if a user matches a deal based on their preferences
 */
export function matchUserToDeal(user: User, deal: Deal): boolean {
  // Country match (empty = all countries)
  if (user.countries.length > 0 && !user.countries.includes(deal.country)) {
    return false;
  }

  // Category match (empty = all categories)
  if (user.categories.length > 0) {
    const dealCategory = deal.category || 'other';
    if (!user.categories.includes(dealCategory)) {
      return false;
    }
  }

  // Source match (empty = all sources)
  if (user.sources.length > 0 && !user.sources.includes(deal.source)) {
    return false;
  }

  // Keyword match (empty = all, OR logic)
  if (user.keywords.length > 0) {
    const dealText = [
      deal.title_original,
      deal.title_hu,
      deal.title_en,
      deal.description_original,
      deal.description_hu,
      deal.description_en,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const hasKeyword = user.keywords.some((keyword) =>
      dealText.includes(keyword.toLowerCase())
    );

    if (!hasKeyword) {
      return false;
    }
  }

  return true;
}

/**
 * Find all users that should be notified about a deal
 */
export async function findMatchingUsers(deal: Deal): Promise<User[]> {
  const activeUsers = await getAllActiveUsers();
  return activeUsers.filter((user) => matchUserToDeal(user, deal));
}

/**
 * Find all deals that match a user's preferences
 */
export function findMatchingDeals(user: User, deals: Deal[]): Deal[] {
  return deals.filter((deal) => matchUserToDeal(user, deal));
}

/**
 * Group deals by category for digest emails
 */
export function groupDealsByCategory(deals: Deal[]): Record<string, Deal[]> {
  const grouped: Record<string, Deal[]> = {};

  for (const deal of deals) {
    const category = deal.category || 'other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(deal);
  }

  return grouped;
}

/**
 * Get category display name based on language
 */
export function getCategoryName(category: string, lang: 'hu' | 'en' | 'de'): string {
  const names: Record<string, Record<string, string>> = {
    it: { hu: 'IT / Szerverek', en: 'IT / Servers', de: 'IT / Server' },
    machines: { hu: 'Gépek', en: 'Machines', de: 'Maschinen' },
    vehicles: { hu: 'Járművek', en: 'Vehicles', de: 'Fahrzeuge' },
    property: { hu: 'Ingatlan', en: 'Property', de: 'Immobilien' },
    other: { hu: 'Egyéb', en: 'Other', de: 'Sonstiges' },
  };

  return names[category]?.[lang] || category;
}

/**
 * Get country flag emoji
 */
export function getCountryFlag(country: string): string {
  const flags: Record<string, string> = {
    hu: '🇭🇺',
    at: '🇦🇹',
    de: '🇩🇪',
  };
  return flags[country] || '🏳️';
}

/**
 * Get country display name
 */
export function getCountryName(country: string, lang: 'hu' | 'en' | 'de'): string {
  const names: Record<string, Record<string, string>> = {
    hu: { hu: 'Magyarország', en: 'Hungary', de: 'Ungarn' },
    at: { hu: 'Ausztria', en: 'Austria', de: 'Österreich' },
    de: { hu: 'Németország', en: 'Germany', de: 'Deutschland' },
  };

  return names[country]?.[lang] || country;
}

/**
 * Format price with currency
 */
export function formatPrice(price: number | null, currency: string = 'EUR'): string {
  if (price === null || price === undefined) {
    return '?';
  }

  const formatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return formatter.format(price);
}

/**
 * Format deadline date
 */
export function formatDeadline(
  deadline: string | null,
  lang: 'hu' | 'en' | 'de'
): string {
  if (!deadline) {
    return 'N/A';
  }

  const date = new Date(deadline);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const locale = lang === 'hu' ? 'hu-HU' : lang === 'de' ? 'de-DE' : 'en-GB';
  const formatted = date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  });

  if (diffDays <= 0) {
    const expiredText = { hu: 'Lejárt', en: 'Expired', de: 'Abgelaufen' };
    return `${formatted} (${expiredText[lang]})`;
  }

  if (diffDays === 1) {
    const dayText = { hu: 'nap', en: 'day', de: 'Tag' };
    return `${formatted} (1 ${dayText[lang]})`;
  }

  const daysText = { hu: 'nap', en: 'days', de: 'Tage' };
  return `${formatted} (${diffDays} ${daysText[lang]})`;
}
