import { NextRequest, NextResponse } from 'next/server';
import { getUnnotifiedDeals, markDealsAsNotified } from '@/lib/db/deals';
import { findMatchingUsers } from '@/lib/notifications/matcher';
import { sendPushNotification } from '@/lib/notifications/push';
import { sendDealNotification } from '@/lib/notifications/telegram';
import { canUserAccessFeature } from '@/lib/subscription';

/**
 * POST /api/cron/notify
 * Send notifications for new deals
 * Called by Vercel Cron at 10:00 and 15:00 CET
 */
export async function POST(request: NextRequest) {
  // Verify cron authentication
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log('[Cron/Notify] Starting notification job...');

  try {
    // Get deals that haven't been notified yet
    const unnotifiedDeals = await getUnnotifiedDeals();

    console.log(`[Cron/Notify] Found ${unnotifiedDeals.length} unnotified deals`);

    if (unnotifiedDeals.length === 0) {
      return NextResponse.json({
        success: true,
        dealsProcessed: 0,
        notificationsSent: { push: 0, telegram: 0 },
      });
    }

    let pushSent = 0;
    let pushFailed = 0;
    let telegramSent = 0;
    let telegramFailed = 0;
    const notifiedDealIds: string[] = [];

    // Process each deal
    for (const deal of unnotifiedDeals) {
      try {
        // Find users who should be notified about this deal
        const matchingUsers = await findMatchingUsers(deal);

        console.log(`[Cron/Notify] Deal ${deal.id}: ${matchingUsers.length} matching users`);

        for (const user of matchingUsers) {
          // Send push notification
          if (user.notify_push && user.onesignal_player_id && canUserAccessFeature(user, 'push')) {
            try {
              const result = await sendPushNotification(user, deal);
              if (result.success) {
                pushSent++;
              } else {
                pushFailed++;
                console.error(`[Cron/Notify] Push failed for user ${user.id}:`, result.error);
              }
            } catch (pushError) {
              pushFailed++;
              console.error('[Cron/Notify] Push error:', pushError);
            }
          }

          // Send Telegram notification
          if (user.notify_telegram && user.telegram_chat_id && canUserAccessFeature(user, 'telegram')) {
            try {
              const result = await sendDealNotification(user, deal);
              if (result.success) {
                telegramSent++;
              } else {
                telegramFailed++;
                console.error(`[Cron/Notify] Telegram failed for user ${user.id}:`, result.error);
              }
            } catch (telegramError) {
              telegramFailed++;
              console.error('[Cron/Notify] Telegram error:', telegramError);
            }
          }
        }

        notifiedDealIds.push(deal.id);
      } catch (dealError) {
        console.error(`[Cron/Notify] Error processing deal ${deal.id}:`, dealError);
      }
    }

    // Mark deals as notified
    if (notifiedDealIds.length > 0) {
      await markDealsAsNotified(notifiedDealIds);
    }

    console.log(`[Cron/Notify] Complete. Push: ${pushSent}/${pushSent + pushFailed}, Telegram: ${telegramSent}/${telegramSent + telegramFailed}`);

    return NextResponse.json({
      success: true,
      dealsProcessed: notifiedDealIds.length,
      notificationsSent: {
        push: pushSent,
        pushFailed,
        telegram: telegramSent,
        telegramFailed,
      },
    });
  } catch (error) {
    console.error('[Cron/Notify] Job failed:', error);
    return NextResponse.json(
      { error: 'Notification job failed', details: String(error) },
      { status: 500 }
    );
  }
}

// Also allow GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request);
}
