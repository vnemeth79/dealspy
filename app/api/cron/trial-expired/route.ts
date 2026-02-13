import { NextRequest, NextResponse } from 'next/server';
import { getTrialExpiredUnpaidUsers, revokeAccessForUser } from '@/lib/db/users';
import { sendTrialExpiredEmail } from '@/lib/notifications/email';

/**
 * POST /api/cron/trial-expired
 * Find users whose trial ended and who never paid; send "access revoked" email, then revoke access
 * (set access_revoked_at, clear token). User record is kept so we can identify by email on re-register.
 * Called by Vercel Cron daily (e.g. 02:00 CET) or manually with CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log('[Cron/TrialExpired] Starting trial-expired cleanup...');

  try {
    const users = await getTrialExpiredUnpaidUsers();
    console.log(`[Cron/TrialExpired] Found ${users.length} trial-expired unpaid user(s)`);

    let emailsSent = 0;
    let revoked = 0;

    for (const user of users) {
      try {
        const lang = (user.language || 'hu') as 'hu' | 'en' | 'de';
        const result = await sendTrialExpiredEmail(user.email, lang);
        if (result.success) emailsSent++;
      } catch (e) {
        console.error(`[Cron/TrialExpired] Email failed for ${user.id}:`, e);
      }

      try {
        await revokeAccessForUser(user.id);
        revoked++;
      } catch (e) {
        console.error(`[Cron/TrialExpired] Revoke failed for ${user.id}:`, e);
      }
    }

    console.log(`[Cron/TrialExpired] Done. Emails: ${emailsSent}, revoked: ${revoked}`);

    return NextResponse.json({
      success: true,
      processed: users.length,
      emailsSent,
      revoked,
    });
  } catch (error) {
    console.error('[Cron/TrialExpired] Job failed:', error);
    return NextResponse.json(
      { error: 'Trial-expired job failed', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
