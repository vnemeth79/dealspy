import { NextRequest, NextResponse } from 'next/server';
import { getCheckoutSession } from '@/lib/stripe';
import { getUserById } from '@/lib/db/users';

/**
 * GET /api/billing/session?session_id=xxx
 * After Stripe checkout success: resolve session to user token for redirect to settings
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'session_id is required' },
      { status: 400 }
    );
  }

  try {
    const session = await getCheckoutSession(sessionId);
    if (!session || !session.metadata?.userId) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 404 }
      );
    }

    const user = await getUserById(session.metadata.userId as string);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ token: user.token });
  } catch (e) {
    console.error('[Billing Session]', e);
    return NextResponse.json(
      { error: 'Failed to resolve session' },
      { status: 500 }
    );
  }
}
