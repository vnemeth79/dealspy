import { createClient } from '@supabase/supabase-js';

// TypeScript types for database tables

export type SubscriptionTier = 'trial' | 'starter' | 'pro' | 'enterprise' | 'cancelled';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'unpaid';
export type BillingCycle = 'monthly' | 'yearly';
export type Language = 'hu' | 'en' | 'de';
export type Country = 'hu' | 'at' | 'de';
export type Category = 'it' | 'machines' | 'vehicles' | 'property' | 'other';
export type Source = 'eer' | 'netbid' | 'ediktsdatei' | 'proventura' | 'machineseeker' | 'insolvenz';
export type NotificationChannel = 'push' | 'email' | 'telegram';

export interface User {
  id: string;
  email: string;
  password_hash?: string;
  token: string;
  language: Language;
  created_at: string;
  updated_at: string;

  // Notification channels
  notify_push: boolean;
  notify_email: boolean;
  notify_telegram: boolean;
  telegram_chat_id: string | null;
  onesignal_player_id: string | null;

  // Filters
  categories: Category[];
  countries: Country[];
  keywords: string[];
  sources: Source[];

  // Subscription
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;

  billing_company_name: string | null;
  billing_tax_id: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_address_city: string | null;
  billing_address_postal_code: string | null;
  billing_address_country: string | null;

  /** Set when trial expired without payment; access revoked, user kept for email identification */
  access_revoked_at: string | null;
}

export interface Deal {
  id: string;
  source: Source;
  source_id: string;

  // Content
  title_original: string;
  title_hu: string | null;
  title_en: string | null;
  title_de: string | null;
  description_original: string | null;
  description_hu: string | null;
  description_en: string | null;

  // Classification
  category: Category | null;
  country: Country;

  // Details
  price: number | null;
  currency: string;
  deadline: string | null;
  url: string;
  image_url: string | null;

  // Metadata
  created_at: string;
  notified_at: string | null;
  raw_data?: Record<string, unknown>;
}

export interface Notification {
  id: string;
  user_id: string;
  deal_id: string;
  channel: NotificationChannel;
  sent_at: string;
  status: 'sent' | 'failed' | 'pending';
  error_message?: string;
}

export interface Payment {
  id: string;
  user_id: string;
  stripe_payment_intent_id?: string;
  stripe_invoice_id?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  tier: SubscriptionTier;
  billing_cycle: BillingCycle;
  szamlazz_invoice_number?: string | null;
  created_at: string;
}

// Input types for creating/updating
export type CreateUserInput = Omit<User, 'id' | 'created_at' | 'updated_at' | 'token'> & {
  token?: string;
};

export type UpdateUserInput = Partial<Omit<User, 'id' | 'email' | 'created_at' | 'updated_at'>>;

export type CreateDealInput = Omit<Deal, 'id' | 'created_at' | 'notified_at'>;

// Supabase clients
// During build, these may be empty - that's okay
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key';

// Server-side client with service role (full access)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Client-side client with anon key (limited access)
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default supabaseAdmin;
