import Stripe from 'stripe';

// Lazy initialization to avoid build errors
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    _stripe = new Stripe(key);
  }
  return _stripe;
}

// For backward compatibility
const stripe = {
  get checkout() { return getStripe().checkout; },
  get billingPortal() { return getStripe().billingPortal; },
  get subscriptions() { return getStripe().subscriptions; },
  get webhooks() { return getStripe().webhooks; },
};

export type PricingTier = 'starter' | 'pro' | 'enterprise';
export type BillingCycle = 'monthly' | 'yearly';

const PRICE_IDS: Record<PricingTier, Record<BillingCycle, string>> = {
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_STARTER_YEARLY!,
  },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY!,
  },
  enterprise: {
    monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY!,
    yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY!,
  },
};

export const PRICING = {
  starter: {
    monthly: 19,
    yearly: 15, // per month when paid yearly
    limits: {
      countries: 1,
      platforms: 3,
      categories: 2,
      keywords: 5,
      channels: ['email'],
    },
  },
  pro: {
    monthly: 49,
    yearly: 39,
    limits: {
      countries: 3,
      platforms: -1, // unlimited
      categories: -1,
      keywords: 20,
      channels: ['email', 'push', 'telegram'],
    },
  },
  enterprise: {
    monthly: 149,
    yearly: 119,
    limits: {
      countries: -1,
      platforms: -1,
      categories: -1,
      keywords: -1,
      channels: ['email', 'push', 'telegram', 'slack', 'api'],
    },
  },
};

export interface BillingAddress {
  line1?: string;
  line2?: string;
  city?: string;
  postal_code?: string;
  country?: string;
}

export interface CreateCheckoutBilling {
  company_name?: string;
  tax_id?: string;
  address?: BillingAddress;
}

export interface CreateCheckoutOptions {
  /** Ha megadva, ezt a Stripe customert használjuk (visszatérő user) */
  customerId?: string;
  /** true = nincs próbaidő (pl. upgrade) */
  skipTrial?: boolean;
  /** Céges számlázási adatok – Stripe számlára kerülnek */
  billing?: CreateCheckoutBilling;
}

/**
 * Create a Stripe Checkout Session for subscription
 */
/** EU VAT: 2 letters + digits → type eu_vat; only digits (8–9) → hu_tin */
function stripeTaxIdType(value: string): 'eu_vat' | 'hu_tin' {
  const v = value.replace(/\s/g, '');
  if (/^[A-Z]{2}[0-9A-Z]{6,12}$/i.test(v)) return 'eu_vat';
  if (/^\d{8,9}$/.test(v)) return 'hu_tin';
  return 'eu_vat';
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  tier: PricingTier,
  billingCycle: BillingCycle,
  locale: 'hu' | 'en' | 'de' = 'hu',
  options: CreateCheckoutOptions = {}
): Promise<string> {
  const priceId = PRICE_IDS[tier][billingCycle];

  if (!priceId) {
    throw new Error(`No price ID configured for ${tier} ${billingCycle}`);
  }

  let customerId: string | undefined = options.customerId;

  if (!customerId && options.billing && (options.billing.company_name || options.billing.tax_id || options.billing.address?.line1)) {
    const stripe = getStripe();
    const addr = options.billing.address;
    const customer = await stripe.customers.create({
      email,
      name: options.billing.company_name || undefined,
      address: addr?.line1
        ? {
            line1: addr.line1,
            line2: addr.line2 || undefined,
            city: addr.city || undefined,
            postal_code: addr.postal_code || undefined,
            country: addr.country || undefined,
          }
        : undefined,
      metadata: { userId },
    });
    customerId = customer.id;

    if (options.billing.tax_id && options.billing.tax_id.trim()) {
      const taxValue = options.billing.tax_id.replace(/\s/g, '');
      const type = stripeTaxIdType(taxValue);
      try {
        await stripe.customers.createTaxId(customerId, { type, value: taxValue });
      } catch (e) {
        console.warn('[Stripe] Tax ID could not be set:', e);
      }
    }
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      metadata: {
        userId,
        tier,
        billingCycle,
      },
    },
    metadata: {
      userId,
      tier,
      billingCycle,
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/register?cancelled=true`,
    locale: locale === 'hu' ? 'hu' : locale === 'de' ? 'de' : 'en',
    allow_promotion_codes: true,
  };

  if (customerId) {
    sessionParams.customer = customerId;
  } else {
    sessionParams.customer_email = email;
  }

  if (!options.skipTrial) {
    (sessionParams.subscription_data as { trial_period_days?: number }).trial_period_days = 3;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return session.url!;
}

/**
 * Retrieve checkout session (e.g. to get user after success)
 */
export async function getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });
    return session;
  } catch {
    return null;
  }
}

/**
 * Create a Stripe Billing Portal session for managing subscription
 * @param customerId Stripe customer ID
 * @param returnUrl Optional; e.g. /settings?token=xxx so user returns to settings with token
 */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl?: string
): Promise<string> {
  const base = process.env.NEXT_PUBLIC_APP_URL || '';
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl ? `${base}${returnUrl.startsWith('/') ? returnUrl : `/${returnUrl}`}` : `${base}/settings`,
  });

  return session.url;
}

/**
 * Get Stripe subscription details
 */
export async function getSubscription(subscriptionId: string) {
  return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string) {
  return stripe.subscriptions.cancel(subscriptionId);
}

/**
 * Verify Stripe webhook signature
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}

export default stripe;
