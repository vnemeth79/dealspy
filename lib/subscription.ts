import { User, SubscriptionTier } from './db/supabase';
import { PRICING } from './stripe';

type TierLimits = {
  countries: number;
  platforms: number;
  categories: number;
  keywords: number;
};

const TIER_LIMITS: Record<string, TierLimits> = {
  trial: { countries: 3, platforms: -1, categories: -1, keywords: 20 },
  starter: { countries: 1, platforms: 3, categories: 2, keywords: 5 },
  pro: { countries: 3, platforms: -1, categories: -1, keywords: 20 },
  enterprise: { countries: -1, platforms: -1, categories: -1, keywords: -1 },
  cancelled: { countries: 0, platforms: 0, categories: 0, keywords: 0 },
};

/**
 * Check if user can access a specific feature
 */
export function canUserAccessFeature(
  user: User,
  feature: 'push' | 'telegram' | 'api' | 'slack'
): boolean {
  const tier = user.subscription_tier || 'trial';
  const status = user.subscription_status;

  // Check if subscription is active
  if (status === 'cancelled' || status === 'unpaid') {
    return false;
  }

  // Check trial expiry
  if (status === 'trialing' && user.trial_ends_at) {
    if (new Date(user.trial_ends_at) < new Date()) {
      return false;
    }
  }

  // Feature-specific checks
  switch (feature) {
    case 'push':
      return tier === 'pro' || tier === 'enterprise' || tier === 'trial';
    case 'telegram':
      return tier === 'pro' || tier === 'enterprise' || tier === 'trial';
    case 'api':
      return tier === 'enterprise';
    case 'slack':
      return tier === 'enterprise';
    default:
      return true;
  }
}

/**
 * Get user's subscription limits
 */
export function getUserLimits(tier: string): TierLimits {
  return TIER_LIMITS[tier] || TIER_LIMITS.trial;
}

/**
 * Check if user's subscription is active
 */
export function isSubscriptionActive(user: User): boolean {
  const status = user.subscription_status;

  if (status === 'cancelled' || status === 'unpaid') {
    return false;
  }

  // Check trial expiry
  if (status === 'trialing' && user.trial_ends_at) {
    if (new Date(user.trial_ends_at) < new Date()) {
      return false;
    }
  }

  // Check subscription end date
  if (status === 'active' && user.subscription_ends_at) {
    if (new Date(user.subscription_ends_at) < new Date()) {
      return false;
    }
  }

  return true;
}

/**
 * Validate user settings against subscription limits
 */
export function validateUserSettings(
  user: User,
  settings: {
    countries?: string[];
    categories?: string[];
    keywords?: string[];
    sources?: string[];
  }
): { valid: boolean; error?: string } {
  const limits = getUserLimits(user.subscription_tier || 'trial');

  // Check countries limit
  if (settings.countries && limits.countries !== -1) {
    if (settings.countries.length > limits.countries) {
      return {
        valid: false,
        error: getErrorMessage('countries', limits.countries, user.language),
      };
    }
  }

  // Check categories limit
  if (settings.categories && limits.categories !== -1) {
    if (settings.categories.length > limits.categories) {
      return {
        valid: false,
        error: getErrorMessage('categories', limits.categories, user.language),
      };
    }
  }

  // Check keywords limit
  if (settings.keywords && limits.keywords !== -1) {
    if (settings.keywords.length > limits.keywords) {
      return {
        valid: false,
        error: getErrorMessage('keywords', limits.keywords, user.language),
      };
    }
  }

  return { valid: true };
}

/**
 * Get localized error message for limit exceeded
 */
function getErrorMessage(
  field: string,
  limit: number,
  lang: 'hu' | 'en' | 'de'
): string {
  const messages: Record<string, Record<string, string>> = {
    countries: {
      hu: `Maximum ${limit} ország választható a csomagodban.`,
      en: `Maximum ${limit} countries allowed in your plan.`,
      de: `Maximal ${limit} Länder in Ihrem Plan erlaubt.`,
    },
    categories: {
      hu: `Maximum ${limit} kategória választható a csomagodban.`,
      en: `Maximum ${limit} categories allowed in your plan.`,
      de: `Maximal ${limit} Kategorien in Ihrem Plan erlaubt.`,
    },
    keywords: {
      hu: `Maximum ${limit} kulcsszó adható meg a csomagodban.`,
      en: `Maximum ${limit} keywords allowed in your plan.`,
      de: `Maximal ${limit} Schlüsselwörter in Ihrem Plan erlaubt.`,
    },
  };

  return messages[field]?.[lang] || messages[field]?.en || 'Limit exceeded';
}

/**
 * Get days remaining in trial
 */
export function getTrialDaysRemaining(user: User): number {
  if (user.subscription_status !== 'trialing' || !user.trial_ends_at) {
    return 0;
  }

  const now = new Date();
  const trialEnd = new Date(user.trial_ends_at);
  const diff = trialEnd.getTime() - now.getTime();

  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Get subscription display info
 */
export function getSubscriptionInfo(user: User, lang: 'hu' | 'en' | 'de'): {
  tierName: string;
  statusText: string;
  badgeColor: string;
} {
  const tierNames: Record<string, Record<string, string>> = {
    trial: { hu: 'Próba', en: 'Trial', de: 'Testversion' },
    starter: { hu: 'Starter', en: 'Starter', de: 'Starter' },
    pro: { hu: 'Pro', en: 'Pro', de: 'Pro' },
    enterprise: { hu: 'Enterprise', en: 'Enterprise', de: 'Enterprise' },
    cancelled: { hu: 'Lemondva', en: 'Cancelled', de: 'Gekündigt' },
  };

  const statusTexts: Record<string, Record<string, string>> = {
    trialing: { hu: 'Próbaidőszak', en: 'Trial period', de: 'Testphase' },
    active: { hu: 'Aktív', en: 'Active', de: 'Aktiv' },
    past_due: { hu: 'Fizetési hiba', en: 'Payment failed', de: 'Zahlung fehlgeschlagen' },
    cancelled: { hu: 'Lemondva', en: 'Cancelled', de: 'Gekündigt' },
    unpaid: { hu: 'Nem fizetett', en: 'Unpaid', de: 'Unbezahlt' },
  };

  const badgeColors: Record<string, string> = {
    trialing: 'bg-blue-100 text-blue-800',
    active: 'bg-green-100 text-green-800',
    past_due: 'bg-yellow-100 text-yellow-800',
    cancelled: 'bg-gray-100 text-gray-800',
    unpaid: 'bg-red-100 text-red-800',
  };

  const tier = user.subscription_tier || 'trial';
  const status = user.subscription_status || 'trialing';

  return {
    tierName: tierNames[tier]?.[lang] || tier,
    statusText: statusTexts[status]?.[lang] || status,
    badgeColor: badgeColors[status] || 'bg-gray-100 text-gray-800',
  };
}
