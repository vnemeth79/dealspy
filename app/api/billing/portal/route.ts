import { NextRequest, NextResponse } from 'next/server';
import { getUserByToken } from '@/lib/db/users';
import { createBillingPortalSession } from '@/lib/stripe';

/**
 * POST /api/billing/portal
 * Create a Stripe Billing Portal session for managing subscription
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const user = await getUserByToken(token);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing information found. Please complete checkout first.' },
        { status: 400 }
      );
    }

    const returnUrl = `/settings?token=${encodeURIComponent(token)}`;
    const portalUrl = await createBillingPortalSession(user.stripe_customer_id, returnUrl);

    return NextResponse.json({ url: portalUrl });
  } catch (error) {
    console.error('[Billing Portal] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create billing portal session' },
      { status: 500 }
    );
  }
}
