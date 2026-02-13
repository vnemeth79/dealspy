-- DealSpy.eu – Supabase schema (teljes éles séma)
-- Futtasd a Supabase SQL Editor-ban. Ha már léteznek táblák, csak a hiányzó oszlopokat/migrációt add hozzá.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========== USERS ==========
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  token TEXT UNIQUE DEFAULT uuid_generate_v4()::text,
  language TEXT DEFAULT 'hu' CHECK (language IN ('hu', 'en', 'de')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  notify_push BOOLEAN DEFAULT true,
  notify_email BOOLEAN DEFAULT true,
  notify_telegram BOOLEAN DEFAULT false,
  telegram_chat_id TEXT,
  onesignal_player_id TEXT,

  categories TEXT[] DEFAULT '{}',
  countries TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  sources TEXT[] DEFAULT '{}',

  subscription_tier TEXT DEFAULT 'trial' CHECK (subscription_tier IN ('trial', 'starter', 'pro', 'enterprise', 'cancelled')),
  subscription_status TEXT DEFAULT 'trialing' CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'cancelled', 'unpaid')),
  billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  subscription_ends_at TIMESTAMP WITH TIME ZONE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  billing_company_name TEXT,
  billing_tax_id TEXT,
  billing_address_line1 TEXT,
  billing_address_line2 TEXT,
  billing_address_city TEXT,
  billing_address_postal_code TEXT,
  billing_address_country TEXT,

  access_revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_access_revoked ON users(access_revoked_at) WHERE access_revoked_at IS NOT NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- ========== DEALS ==========
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL CHECK (source IN ('eer', 'netbid', 'ediktsdatei', 'proventura', 'machineseeker', 'insolvenz')),
  source_id TEXT NOT NULL,
  title_original TEXT NOT NULL,
  title_hu TEXT,
  title_en TEXT,
  title_de TEXT,
  description_original TEXT,
  description_hu TEXT,
  description_en TEXT,
  category TEXT CHECK (category IN ('it', 'machines', 'vehicles', 'property', 'other')),
  country TEXT NOT NULL CHECK (country IN ('hu', 'at', 'de')),
  price DECIMAL,
  currency TEXT DEFAULT 'EUR',
  deadline TIMESTAMP WITH TIME ZONE,
  url TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notified_at TIMESTAMP WITH TIME ZONE,
  raw_data JSONB,
  UNIQUE(source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_deals_source ON deals(source);
CREATE INDEX IF NOT EXISTS idx_deals_category ON deals(category);
CREATE INDEX IF NOT EXISTS idx_deals_country ON deals(country);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_notified_at ON deals(notified_at);

-- ========== NOTIFICATIONS (log) ==========
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('push', 'email', 'telegram')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_deal_id ON notifications(deal_id);

-- ========== PAYMENTS (Stripe + számla log) ==========
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  amount DECIMAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'succeeded' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  tier TEXT,
  billing_cycle TEXT,
  szamlazz_invoice_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_invoice ON payments(stripe_invoice_id);

-- ========== RLS (opcionális, MVP-nél service role-t használunk) ==========
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
