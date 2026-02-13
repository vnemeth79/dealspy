import { NextRequest, NextResponse } from 'next/server';
import { getAllActiveUsers } from '@/lib/db/users';
import { getTodaysDeals } from '@/lib/db/deals';
import { sendDigestEmail } from '@/lib/notifications/email';
import { findMatchingDeals } from '@/lib/notifications/matcher';
import { isSubscriptionActive } from '@/lib/subscription';

/**
 * POST /api/cron/digest
 * Send daily email digest to users
 * Called by Vercel Cron at 15:00 CET
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

  console.log('[Cron/Digest] Starting digest job...');

  try {
    // Get all users who want email notifications and are still active (trial not expired / paid)
    const allUsers = await getAllActiveUsers();
    const emailUsers = allUsers.filter(
      (u) => u.notify_email && isSubscriptionActive(u)
    );

    console.log(`[Cron/Digest] Found ${emailUsers.length} users with email notifications enabled`);

    // Get today's deals
    const todaysDeals = await getTodaysDeals();

    console.log(`[Cron/Digest] Found ${todaysDeals.length} deals from today`);

    if (todaysDeals.length === 0) {
      return NextResponse.json({
        success: true,
        emailsSent: 0,
        message: 'No deals to send',
      });
    }

    let emailsSent = 0;
    let emailsFailed = 0;

    // Send digest to each user
    for (const user of emailUsers) {
      try {
        // Find deals matching user's preferences
        const matchingDeals = findMatchingDeals(user, todaysDeals);

        // Skip if no matching deals
        if (matchingDeals.length === 0) {
          continue;
        }

        // Send digest email
        const result = await sendDigestEmail(user, matchingDeals);

        if (result.success) {
          emailsSent++;
          console.log(`[Cron/Digest] Sent digest to ${user.email}: ${matchingDeals.length} deals`);
        } else {
          emailsFailed++;
          console.error(`[Cron/Digest] Failed to send to ${user.email}:`, result.error);
        }
      } catch (userError) {
        emailsFailed++;
        console.error(`[Cron/Digest] Error processing user ${user.id}:`, userError);
      }
    }

    console.log(`[Cron/Digest] Complete. Sent: ${emailsSent}, Failed: ${emailsFailed}`);

    return NextResponse.json({
      success: true,
      emailsSent,
      emailsFailed,
      totalDeals: todaysDeals.length,
    });
  } catch (error) {
    console.error('[Cron/Digest] Job failed:', error);
    return NextResponse.json(
      { error: 'Digest job failed', details: String(error) },
      { status: 500 }
    );
  }
}

// Also allow GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request);
}
