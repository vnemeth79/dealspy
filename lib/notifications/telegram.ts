import { User, Deal } from '../db/supabase';
import { supabaseAdmin } from '../db/supabase';
import {
  formatPrice,
  formatDeadline,
  getCountryFlag,
  getCountryName,
  getCategoryName,
} from './matcher';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

interface TelegramResult {
  success: boolean;
  error?: string;
}

/**
 * Send a message via Telegram
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  options: { parse_mode?: 'HTML' | 'Markdown' } = { parse_mode: 'HTML' }
): Promise<TelegramResult> {
  if (!TELEGRAM_BOT_TOKEN) {
    return { success: false, error: 'Telegram bot not configured' };
  }

  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options.parse_mode,
        disable_web_page_preview: false,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.description || 'Telegram API error' };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Format deal notification message for Telegram
 */
function formatDealMessage(deal: Deal, lang: 'hu' | 'en' | 'de'): string {
  const title = lang === 'hu' && deal.title_hu
    ? deal.title_hu
    : lang === 'en' && deal.title_en
      ? deal.title_en
      : deal.title_original;

  const flag = getCountryFlag(deal.country);
  const countryName = getCountryName(deal.country, lang);
  const categoryName = getCategoryName(deal.category || 'other', lang);
  const price = formatPrice(deal.price, deal.currency);
  const deadline = formatDeadline(deal.deadline, lang);

  const priceLabel = { hu: 'Ár', en: 'Price', de: 'Preis' };
  const deadlineLabel = { hu: 'Határidő', en: 'Deadline', de: 'Frist' };

  return `🔍 <b>DealSpy</b> | ${categoryName}

📦 <b>${title}</b>
${deal.title_original !== title ? `   <i>(${deal.title_original})</i>` : ''}

📍 ${deal.source} | ${flag} ${countryName}
💰 ${priceLabel[lang]}: ${price}
⏰ ${deadlineLabel[lang]}: ${deadline}
🏷️ #${deal.category || 'other'} #${deal.source}

🔗 ${deal.url}`;
}

/**
 * Send deal notification to a user via Telegram
 */
export async function sendDealNotification(
  user: User,
  deal: Deal
): Promise<TelegramResult> {
  if (!user.telegram_chat_id) {
    return { success: false, error: 'No Telegram chat ID' };
  }

  const message = formatDealMessage(deal, user.language);
  return sendTelegramMessage(user.telegram_chat_id, message);
}

/**
 * Handle incoming Telegram webhook updates
 */
export async function handleWebhook(update: TelegramUpdate): Promise<string> {
  const chatId = update.message?.chat?.id?.toString();
  const text = update.message?.text || '';
  const userId = update.message?.from?.id?.toString();

  if (!chatId) {
    return 'No chat ID';
  }

  // Handle /start command
  if (text.startsWith('/start')) {
    const parts = text.split(' ');
    const token = parts[1];

    if (token) {
      // Link Telegram to user account
      const success = await linkTelegramToUser(token, chatId);
      if (success) {
        const messages = {
          hu: '✅ Sikeresen összekapcsoltad a fiókodat!\n\nMostantól itt kapod az értesítéseket az új deal-ekről.',
          en: '✅ Successfully linked your account!\n\nYou will now receive deal notifications here.',
          de: '✅ Konto erfolgreich verknüpft!\n\nSie erhalten jetzt Deal-Benachrichtigungen hier.',
        };
        await sendTelegramMessage(chatId, messages.hu); // Default to Hungarian
        return 'Account linked';
      } else {
        await sendTelegramMessage(
          chatId,
          '❌ Érvénytelen vagy lejárt link. Kérlek próbáld újra a weboldalon.'
        );
        return 'Invalid token';
      }
    } else {
      // No token provided
      const welcomeMessage = `👋 Üdvözöllek a DealSpy Bot-ban!

A fiókod összekapcsolásához használd a weboldalon (dealspy.eu) kapott linket.

🔗 https://dealspy.eu

Parancsok:
/help - Súgó
/stop - Értesítések leállítása`;
      await sendTelegramMessage(chatId, welcomeMessage);
      return 'Welcome sent';
    }
  }

  // Handle /stop command
  if (text === '/stop') {
    await unlinkTelegram(chatId);
    await sendTelegramMessage(
      chatId,
      '✅ Leállítottad az értesítéseket.\n\nBármikor újra aktiválhatod a weboldalon: https://dealspy.eu'
    );
    return 'Notifications stopped';
  }

  // Handle /help command
  if (text === '/help') {
    const helpMessage = `🔍 <b>DealSpy Bot</b>

EU csődvagyon és aukció monitoring.

<b>Parancsok:</b>
/start - Fiók összekapcsolása
/stop - Értesítések leállítása
/help - Ez a súgó

<b>Beállítások:</b>
https://dealspy.eu

<b>Kapcsolat:</b>
info@dealspy.eu`;
    await sendTelegramMessage(chatId, helpMessage);
    return 'Help sent';
  }

  // Default response for unknown commands
  await sendTelegramMessage(
    chatId,
    'Ismeretlen parancs. Írd be /help a súgóhoz.'
  );
  return 'Unknown command';
}

/**
 * Link Telegram chat to user account
 */
async function linkTelegramToUser(token: string, chatId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .update({
      telegram_chat_id: chatId,
      notify_telegram: true,
    })
    .eq('token', token)
    .select()
    .single();

  return !error && !!data;
}

/**
 * Unlink Telegram from user account
 */
async function unlinkTelegram(chatId: string): Promise<void> {
  await supabaseAdmin
    .from('users')
    .update({
      telegram_chat_id: null,
      notify_telegram: false,
    })
    .eq('telegram_chat_id', chatId);
}

// Telegram webhook types
interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
  };
}

export type { TelegramUpdate };
