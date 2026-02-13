import { User, Deal } from '../db/supabase';
import { formatPrice, getCountryFlag } from './matcher';

const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY!;

interface PushResult {
  success: boolean;
  error?: string;
}

/**
 * Get localized notification title
 */
function getLocalizedTitle(lang: 'hu' | 'en' | 'de'): string {
  const titles = {
    hu: '🔍 DealSpy | Új deal',
    en: '🔍 DealSpy | New deal',
    de: '🔍 DealSpy | Neues Angebot',
  };
  return titles[lang];
}

/**
 * Get localized deal title
 */
function getLocalizedDealTitle(deal: Deal, lang: 'hu' | 'en' | 'de'): string {
  if (lang === 'hu' && deal.title_hu) return deal.title_hu;
  if (lang === 'en' && deal.title_en) return deal.title_en;
  if (lang === 'de' && deal.title_de) return deal.title_de;
  return deal.title_original;
}

/**
 * Send push notification to a single user
 */
export async function sendPushNotification(
  user: User,
  deal: Deal
): Promise<PushResult> {
  if (!user.onesignal_player_id) {
    return { success: false, error: 'No OneSignal player ID' };
  }

  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    return { success: false, error: 'OneSignal not configured' };
  }

  const title = getLocalizedTitle(user.language);
  const dealTitle = getLocalizedDealTitle(deal, user.language);
  const flag = getCountryFlag(deal.country);
  const price = formatPrice(deal.price, deal.currency);

  const body = `${dealTitle} | ${deal.source} ${flag} | ${price}`;

  try {
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${ONESIGNAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_player_ids: [user.onesignal_player_id],
        headings: { en: title },
        contents: { en: body },
        url: deal.url,
        chrome_web_icon: 'https://dealspy.eu/icon-192.png',
        chrome_web_badge: 'https://dealspy.eu/badge-72.png',
        ttl: 86400, // 24 hours
        priority: 10,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `OneSignal API error: ${errorText}` };
    }

    const result = await response.json();

    if (result.errors && result.errors.length > 0) {
      return { success: false, error: result.errors.join(', ') };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Send push notification to multiple users
 */
export async function sendBulkPush(
  users: User[],
  deal: Deal
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  // Filter users with valid player IDs
  const validUsers = users.filter(
    (u) => u.notify_push && u.onesignal_player_id
  );

  // OneSignal allows max 2000 player IDs per request
  const batchSize = 2000;

  for (let i = 0; i < validUsers.length; i += batchSize) {
    const batch = validUsers.slice(i, i + batchSize);
    const playerIds = batch.map((u) => u.onesignal_player_id!);

    // Group by language for localized notifications
    const byLanguage = batch.reduce((acc, user) => {
      if (!acc[user.language]) acc[user.language] = [];
      acc[user.language].push(user.onesignal_player_id!);
      return acc;
    }, {} as Record<string, string[]>);

    for (const [lang, ids] of Object.entries(byLanguage)) {
      try {
        const title = getLocalizedTitle(lang as 'hu' | 'en' | 'de');
        const dealTitle = getLocalizedDealTitle(deal, lang as 'hu' | 'en' | 'de');
        const flag = getCountryFlag(deal.country);
        const price = formatPrice(deal.price, deal.currency);
        const body = `${dealTitle} | ${deal.source} ${flag} | ${price}`;

        const response = await fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${ONESIGNAL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            include_player_ids: ids,
            headings: { en: title },
            contents: { en: body },
            url: deal.url,
          }),
        });

        if (response.ok) {
          sent += ids.length;
        } else {
          failed += ids.length;
        }
      } catch {
        failed += playerIds.length;
      }
    }
  }

  return { sent, failed };
}
