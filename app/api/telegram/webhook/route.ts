import { NextRequest, NextResponse } from 'next/server';
import { handleWebhook, TelegramUpdate } from '@/lib/notifications/telegram';

/**
 * POST /api/telegram/webhook
 * Handle incoming Telegram bot updates
 */
export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json();

    console.log('[Telegram Webhook] Received update:', update.update_id);

    // Handle the update
    const response = await handleWebhook(update);

    console.log('[Telegram Webhook] Response:', response);

    // Telegram expects 200 OK, otherwise it will retry
    return NextResponse.json({ ok: true, response });
  } catch (error) {
    console.error('[Telegram Webhook] Error:', error);

    // Still return 200 to prevent Telegram from retrying
    return NextResponse.json({ ok: true, error: 'Internal error' });
  }
}

/**
 * GET /api/telegram/webhook
 * Verify webhook is set up correctly
 */
export async function GET() {
  return NextResponse.json({
    status: 'Telegram webhook endpoint active',
    bot: '@DealSpyBot',
  });
}
