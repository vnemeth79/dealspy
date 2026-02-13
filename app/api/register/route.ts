import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import {
  createUser,
  getUserByEmail,
  findRevokedUserMatchingRegistration,
  updateRevokedUserForReRegister,
  isAccessRevoked,
} from '@/lib/db/users';
import { createCheckoutSession } from '@/lib/stripe';
import { sendWelcomeEmail } from '@/lib/notifications/email';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      email,
      password,
      language = 'hu',
      categories = [],
      countries = [],
      keywords = [],
      sources = [],
      notify_push = true,
      notify_email = true,
      notify_telegram = false,
      onesignal_player_id,
      tier = 'pro',
      billingCycle = 'monthly',
      payNow = false,
      billing_company_name,
      billing_tax_id,
      billing_address_line1,
      billing_address_line2,
      billing_address_city,
      billing_address_postal_code,
      billing_address_country,
    } = body;

    // Validation
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    if (categories.length === 0) {
      return NextResponse.json(
        { error: 'At least one category is required' },
        { status: 400 }
      );
    }

    if (countries.length === 0) {
      return NextResponse.json(
        { error: 'At least one country is required' },
        { status: 400 }
      );
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser && !isAccessRevoked(existingUser)) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    const password_hash = await bcrypt.hash(password, 12);
    const newToken = randomUUID();

    const billingUpdates = {
      billing_company_name: billing_company_name?.trim() || null,
      billing_tax_id: billing_tax_id?.trim() || null,
      billing_address_line1: billing_address_line1?.trim() || null,
      billing_address_line2: billing_address_line2?.trim() || null,
      billing_address_city: billing_address_city?.trim() || null,
      billing_address_postal_code: billing_address_postal_code?.trim() || null,
      billing_address_country: billing_address_country?.trim() || null,
    };

    const revokedMatch =
      existingUser && isAccessRevoked(existingUser)
        ? existingUser
        : await findRevokedUserMatchingRegistration({
            email,
            ...billingUpdates,
          });

    if (revokedMatch) {
      const user = await updateRevokedUserForReRegister(revokedMatch.id, {
        email: email.toLowerCase(),
        password_hash,
        token: newToken,
        language,
        categories,
        countries,
        keywords: keywords.filter((k: string) => k.trim() !== ''),
        sources,
        notify_push: !!notify_push,
        notify_email: !!notify_email,
        notify_telegram: !!notify_telegram,
        onesignal_player_id: onesignal_player_id || null,
        billing_cycle: billingCycle,
        trial_ends_at: null,
        ...billingUpdates,
      });

      let checkoutUrl: string | null = null;
      try {
        checkoutUrl = await createCheckoutSession(
          user.id,
          user.email,
          tier as 'starter' | 'pro' | 'enterprise',
          billingCycle as 'monthly' | 'yearly',
          language,
          {
            skipTrial: true,
            billing:
              user.billing_company_name || user.billing_tax_id || user.billing_address_line1
                ? {
                    company_name: user.billing_company_name ?? undefined,
                    tax_id: user.billing_tax_id ?? undefined,
                    address: {
                      line1: user.billing_address_line1 ?? undefined,
                      line2: user.billing_address_line2 ?? undefined,
                      city: user.billing_address_city ?? undefined,
                      postal_code: user.billing_address_postal_code ?? undefined,
                      country: user.billing_address_country ?? undefined,
                    },
                  }
                : undefined,
          }
        );
      } catch (stripeError) {
        console.error('Stripe checkout error (re-register):', stripeError);
      }
      sendWelcomeEmail(user).catch((err) => console.error('Welcome email error:', err));
      const telegramLink = notify_telegram
        ? `https://t.me/DealSpyBot?start=${user.token}`
        : null;
      return NextResponse.json({
        success: true,
        token: user.token,
        checkoutUrl,
        telegramLink,
      });
    }

    // Create user (new registration with trial)
    const user = await createUser({
      email: email.toLowerCase(),
      password_hash,
      language,
      categories,
      countries,
      keywords: keywords.filter((k: string) => k.trim() !== ''),
      sources,
      notify_push,
      notify_email,
      notify_telegram,
      onesignal_player_id: onesignal_player_id || null,
      telegram_chat_id: null,
      subscription_tier: 'trial',
      subscription_status: 'trialing',
      billing_cycle: billingCycle,
      trial_ends_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      subscription_ends_at: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      billing_company_name: billing_company_name?.trim() || null,
      billing_tax_id: billing_tax_id?.trim() || null,
      billing_address_line1: billing_address_line1?.trim() || null,
      billing_address_line2: billing_address_line2?.trim() || null,
      billing_address_city: billing_address_city?.trim() || null,
      billing_address_postal_code: billing_address_postal_code?.trim() || null,
      billing_address_country: billing_address_country?.trim() || null,
      access_revoked_at: null,
    });

    // Create Stripe checkout session
    let checkoutUrl: string | null = null;
    try {
      checkoutUrl = await createCheckoutSession(
        user.id,
        email,
        tier as 'starter' | 'pro' | 'enterprise',
        billingCycle as 'monthly' | 'yearly',
        language,
        {
          skipTrial: !!payNow,
          billing: user.billing_company_name || user.billing_tax_id || user.billing_address_line1
            ? {
                company_name: user.billing_company_name ?? undefined,
                tax_id: user.billing_tax_id ?? undefined,
                address: {
                  line1: user.billing_address_line1 ?? undefined,
                  line2: user.billing_address_line2 ?? undefined,
                  city: user.billing_address_city ?? undefined,
                  postal_code: user.billing_address_postal_code ?? undefined,
                  country: user.billing_address_country ?? undefined,
                },
              }
            : undefined,
        }
      );
    } catch (stripeError) {
      console.error('Stripe checkout error:', stripeError);
      // Continue without Stripe - user can add payment later
    }

    // Send welcome email (don't await to speed up response)
    sendWelcomeEmail(user).catch((err) =>
      console.error('Welcome email error:', err)
    );

    // Generate Telegram link if enabled
    const telegramLink = notify_telegram
      ? `https://t.me/DealSpyBot?start=${user.token}`
      : null;

    return NextResponse.json({
      success: true,
      token: user.token,
      checkoutUrl,
      telegramLink,
    });
  } catch (error) {
    console.error('Registration error:', error);

    if (error instanceof Error && error.message.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}
