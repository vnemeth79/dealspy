import { NextRequest, NextResponse } from 'next/server';
import { getUserByToken } from '@/lib/db/users';
import { createCheckoutSession, type PricingTier, type BillingCycle } from '@/lib/stripe';

/**
 * POST /api/billing/checkout
 * Create Stripe Checkout session for existing user (upgrade / renew).
 * Body: { token, tier?, billingCycle? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = body.token;
    const tier = (body.tier as PricingTier) || 'pro';
    const billingCycle = (body.billingCycle as BillingCycle) || 'yearly';

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

    const url = await createCheckoutSession(
      user.id,
      user.email,
      tier,
      billingCycle,
      user.language,
      {
        customerId: user.stripe_customer_id || undefined,
        skipTrial: true, // upgrade: no new trial
      }
    );

    return NextResponse.json({ url });
  } catch (error) {
    console.error('[Billing Checkout]', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
