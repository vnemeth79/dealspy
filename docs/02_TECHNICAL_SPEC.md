# DealSpy.eu - Technical Specification

## 1. Projekt Struktúra

```
dealspy/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout (i18n, fonts)
│   ├── page.tsx                 # Landing + Registration form
│   ├── settings/
│   │   └── page.tsx            # Settings modification
│   ├── unsubscribe/
│   │   └── page.tsx            # Unsubscribe
│   ├── impressum/
│   │   └── page.tsx            # Legal info
│   └── api/
│       ├── register/
│       │   └── route.ts        # POST /api/register
│       ├── settings/
│       │   └── route.ts        # GET/PUT /api/settings
│       ├── unsubscribe/
│       │   └── route.ts        # POST /api/unsubscribe
│       ├── telegram/
│       │   └── webhook/
│       │       └── route.ts    # Telegram webhook
│       ├── cron/
│       │   ├── scrape/
│       │   │   └── route.ts    # Scraping trigger
│       │   └── notify/
│       │       └── route.ts    # Notification trigger
│       └── health/
│           └── route.ts        # Health check
├── lib/
│   ├── db/
│   │   ├── supabase.ts         # Supabase client
│   │   ├── users.ts            # User CRUD
│   │   └── deals.ts            # Deals CRUD
│   ├── scrapers/
│   │   ├── base.ts             # Base scraper class
│   │   ├── eer.ts              # EÉR scraper
│   │   ├── netbid.ts           # NetBid scraper
│   │   ├── ediktsdatei.ts      # Ediktsdatei scraper
│   │   ├── insolvenz.ts        # Insolvenzbekanntmachungen
│   │   ├── proventura.ts       # Proventura scraper
│   │   ├── machineseeker.ts    # Machineseeker scraper
│   │   └── index.ts            # Scraper orchestrator
│   ├── ai/
│   │   ├── translate.ts        # Claude translation
│   │   └── categorize.ts       # Claude categorization
│   ├── notifications/
│   │   ├── push.ts             # OneSignal
│   │   ├── email.ts            # SendGrid
│   │   ├── telegram.ts         # Telegram Bot
│   │   └── matcher.ts          # User-deal matching
│   ├── i18n/
│   │   ├── config.ts           # i18n configuration
│   │   └── translations/
│   │       ├── hu.json
│   │       ├── en.json
│   │       └── de.json
│   └── utils/
│       ├── logger.ts           # Logging
│       └── constants.ts        # Constants
├── components/
│   ├── RegistrationForm.tsx
│   ├── LanguageSwitcher.tsx
│   ├── CategorySelector.tsx
│   ├── CountrySelector.tsx
│   └── ChannelSelector.tsx
├── public/
│   ├── favicon.ico
│   └── onesignal/             # OneSignal service worker
├── .env.local                  # Environment variables
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vercel.json                 # Cron jobs config
```

---

## 2. Environment Variables

```env
# Database
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# AI
ANTHROPIC_API_KEY=xxx

# Notifications
ONESIGNAL_APP_ID=xxx
ONESIGNAL_API_KEY=xxx
SENDGRID_API_KEY=xxx
TELEGRAM_BOT_TOKEN=xxx

# App
NEXT_PUBLIC_APP_URL=https://dealspy.eu
CRON_SECRET=xxx  # Vercel cron security

# Optional
ADMIN_EMAIL=admin@dealspy.eu
```

---

## 3. Database Schema (Supabase SQL)

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  token TEXT UNIQUE DEFAULT uuid_generate_v4()::text,
  language TEXT DEFAULT 'hu' CHECK (language IN ('hu', 'en', 'de')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Notification channels
  notify_push BOOLEAN DEFAULT true,
  notify_email BOOLEAN DEFAULT true,
  notify_telegram BOOLEAN DEFAULT false,
  telegram_chat_id TEXT,
  onesignal_player_id TEXT,
  
  -- Filters
  categories TEXT[] DEFAULT '{}',
  countries TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  sources TEXT[] DEFAULT '{}'
);

-- Create index for token lookup
CREATE INDEX idx_users_token ON users(token);
CREATE INDEX idx_users_email ON users(email);

-- Deals table
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL CHECK (source IN ('eer', 'netbid', 'ediktsdatei', 'proventura', 'machineseeker', 'insolvenz')),
  source_id TEXT NOT NULL,
  
  -- Content
  title_original TEXT NOT NULL,
  title_hu TEXT,
  title_en TEXT,
  title_de TEXT,
  description_original TEXT,
  description_hu TEXT,
  description_en TEXT,
  
  -- Classification
  category TEXT CHECK (category IN ('it', 'machines', 'vehicles', 'property', 'other')),
  country TEXT CHECK (country IN ('hu', 'at', 'de')),
  
  -- Details
  price DECIMAL,
  currency TEXT DEFAULT 'EUR',
  deadline TIMESTAMP WITH TIME ZONE,
  url TEXT NOT NULL,
  image_url TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notified_at TIMESTAMP WITH TIME ZONE,
  raw_data JSONB,
  
  UNIQUE(source, source_id)
);

-- Create indexes for filtering
CREATE INDEX idx_deals_source ON deals(source);
CREATE INDEX idx_deals_category ON deals(category);
CREATE INDEX idx_deals_country ON deals(country);
CREATE INDEX idx_deals_created_at ON deals(created_at DESC);
CREATE INDEX idx_deals_notified_at ON deals(notified_at);

-- Notifications log table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('push', 'email', 'telegram')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_deal_id ON notifications(deal_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to users table
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies (optional for MVP, but good practice)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access on users" ON users
  FOR ALL USING (true);
  
CREATE POLICY "Service role full access on deals" ON deals
  FOR ALL USING (true);
  
CREATE POLICY "Service role full access on notifications" ON notifications
  FOR ALL USING (true);
```

---

## 4. API Endpoints

### 4.1 POST /api/register
Új felhasználó regisztrációja.

**Request:**
```typescript
{
  email: string;
  language: 'hu' | 'en' | 'de';
  categories: ('it' | 'machines' | 'vehicles' | 'property')[];
  countries: ('hu' | 'at' | 'de')[];
  keywords?: string[];
  sources?: string[];
  notify_push: boolean;
  notify_email: boolean;
  notify_telegram: boolean;
  onesignal_player_id?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  token: string;  // Settings link token
  telegram_link?: string;  // If telegram enabled
}
```

### 4.2 GET /api/settings?token=xxx
Felhasználó beállításainak lekérése.

**Response:**
```typescript
{
  email: string;
  language: string;
  categories: string[];
  countries: string[];
  keywords: string[];
  sources: string[];
  notify_push: boolean;
  notify_email: boolean;
  notify_telegram: boolean;
  telegram_connected: boolean;
}
```

### 4.3 PUT /api/settings?token=xxx
Felhasználó beállításainak módosítása.

**Request:** Same as POST /api/register (minus email)

### 4.4 POST /api/unsubscribe?token=xxx
Felhasználó leiratkoztatása.

### 4.5 POST /api/telegram/webhook
Telegram bot webhook.

### 4.6 POST /api/cron/scrape
Scraping trigger (Vercel Cron).

**Headers:**
```
Authorization: Bearer {CRON_SECRET}
```

### 4.7 POST /api/cron/notify
Notification trigger (Vercel Cron).

---

## 5. Scraper Specifications

### 5.1 Base Interface

```typescript
interface ScrapedDeal {
  source: string;
  source_id: string;
  title_original: string;
  description_original?: string;
  price?: number;
  currency?: string;
  deadline?: Date;
  url: string;
  image_url?: string;
  country: 'hu' | 'at' | 'de';
  raw_data?: Record<string, any>;
}

interface Scraper {
  source: string;
  scrape(): Promise<ScrapedDeal[]>;
}
```

### 5.2 EÉR Scraper (eer.sztfh.hu)

- **URL:** https://eer.sztfh.hu/pályázat/kereső
- **Metódus:** HTTP requests + HTML parsing
- **Szűrés:** Aktív pályázatok
- **Mezők:** 
  - title: Pályázat neve
  - price: Irányár
  - deadline: Pályázat vége
  - url: Pályázat link

### 5.3 NetBid Scraper (netbid.com)

- **URL:** https://www.netbid.com/en/auctions/
- **Metódus:** Playwright (JS rendering)
- **Szűrés:** Current auctions
- **Mezők:**
  - title: Auction title
  - price: Starting bid
  - deadline: Auction end
  - image_url: Thumbnail

### 5.4 Ediktsdatei Scraper (edikte.justiz.gv.at)

- **URL:** https://edikte.justiz.gv.at/edikte/
- **Metódus:** HTTP + HTML parsing
- **Szűrés:** Insolvenz, Versteigerungen
- **Country:** at

### 5.5 Insolvenzbekanntmachungen Scraper

- **URL:** https://www.insolvenzbekanntmachungen.de/
- **Metódus:** HTTP + HTML parsing
- **Country:** de

### 5.6 Proventura Scraper (proventura.de)

- **URL:** https://www.proventura.de/
- **Metódus:** Playwright
- **Szűrés:** Laufende Auktionen
- **Country:** de

### 5.7 Machineseeker Scraper (machineseeker.com)

- **URL:** https://www.machineseeker.com/
- **Metódus:** HTTP + API (ha van)
- **Country:** de/at (based on seller location)

---

## 6. AI Processing

### 6.1 Translation Prompt

```typescript
const translatePrompt = (text: string, targetLang: 'hu' | 'en') => `
Translate the following German text to ${targetLang === 'hu' ? 'Hungarian' : 'English'}.
Keep technical terms accurate. If the text is already in the target language, return it as-is.
Only return the translation, nothing else.

Text: ${text}
`;
```

### 6.2 Categorization Prompt

```typescript
const categorizePrompt = (title: string, description?: string) => `
Categorize this auction/insolvency item into exactly one category.

Categories:
- it: Servers, computers, IT equipment, networking, GPUs
- machines: Industrial machines, CNC, manufacturing equipment
- vehicles: Cars, trucks, forklifts, construction vehicles
- property: Real estate, buildings, land
- other: Everything else

Item:
Title: ${title}
${description ? `Description: ${description}` : ''}

Respond with only the category name (it/machines/vehicles/property/other).
`;
```

---

## 7. Notification Logic

### 7.1 User-Deal Matching

```typescript
function matchUserToDeal(user: User, deal: Deal): boolean {
  // Country match
  if (user.countries.length > 0 && !user.countries.includes(deal.country)) {
    return false;
  }
  
  // Category match
  if (user.categories.length > 0 && !user.categories.includes(deal.category)) {
    return false;
  }
  
  // Source match (empty = all sources)
  if (user.sources.length > 0 && !user.sources.includes(deal.source)) {
    return false;
  }
  
  // Keyword match (empty = all, OR logic)
  if (user.keywords.length > 0) {
    const dealText = `${deal.title_original} ${deal.description_original}`.toLowerCase();
    const hasKeyword = user.keywords.some(kw => 
      dealText.includes(kw.toLowerCase())
    );
    if (!hasKeyword) return false;
  }
  
  return true;
}
```

### 7.2 Notification Flow

```typescript
async function notifyUsers(newDeals: Deal[]) {
  const users = await getAllActiveUsers();
  
  for (const deal of newDeals) {
    const matchingUsers = users.filter(u => matchUserToDeal(u, deal));
    
    for (const user of matchingUsers) {
      // Send push notification
      if (user.notify_push && user.onesignal_player_id) {
        await sendPushNotification(user, deal);
      }
      
      // Send telegram
      if (user.notify_telegram && user.telegram_chat_id) {
        await sendTelegramNotification(user, deal);
      }
      
      // Mark for email digest (don't send immediately)
      if (user.notify_email) {
        await markForEmailDigest(user.id, deal.id);
      }
    }
    
    // Mark deal as notified
    await markDealNotified(deal.id);
  }
}
```

---

## 8. Vercel Cron Configuration

```json
// vercel.json (Hobby: naponta 1x; Pro tervval 2x is beállítható)
{
  "crons": [
    {
      "path": "/api/cron/scrape",
      "schedule": "30 8 * * *"     // 09:30 CET
    },
    {
      "path": "/api/cron/notify",
      "schedule": "0 9 * * *"      // 10:00 CET
    },
    {
      "path": "/api/cron/digest",
      "schedule": "0 14 * * *"     // 15:00 CET - Email digest
    }
  ]
}
```

---

## 9. OneSignal Setup

### 9.1 Service Worker (public/onesignal/OneSignalSDKWorker.js)

```javascript
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
```

### 9.2 Frontend Integration

```typescript
// lib/onesignal.ts
export async function initOneSignal() {
  if (typeof window === 'undefined') return;
  
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal) => {
    await OneSignal.init({
      appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!,
      allowLocalhostAsSecureOrigin: process.env.NODE_ENV === 'development',
    });
  });
}

export async function getPlayerId(): Promise<string | null> {
  return new Promise((resolve) => {
    window.OneSignalDeferred.push(async (OneSignal) => {
      const id = await OneSignal.User.PushSubscription.id;
      resolve(id || null);
    });
  });
}
```

### 9.3 Backend Notification

```typescript
// lib/notifications/push.ts
export async function sendPushNotification(user: User, deal: Deal) {
  const title = getLocalizedTitle(deal, user.language);
  const body = formatPushBody(deal, user.language);
  
  await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${process.env.ONESIGNAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: process.env.ONESIGNAL_APP_ID,
      include_player_ids: [user.onesignal_player_id],
      headings: { en: title },
      contents: { en: body },
      url: deal.url,
      chrome_web_icon: 'https://dealspy.eu/icon.png',
    }),
  });
}
```

---

## 10. Telegram Bot Setup

### 10.1 Bot Creation
1. Message @BotFather
2. /newbot → @DealSpyBot
3. Get token → TELEGRAM_BOT_TOKEN

### 10.2 Webhook Setup
```bash
curl -X POST "https://api.telegram.org/bot{TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://dealspy.eu/api/telegram/webhook"}'
```

### 10.3 Bot Commands
```typescript
// lib/notifications/telegram.ts
const commands = {
  start: async (chatId: string, userId?: string) => {
    // Link telegram account to user
    if (userId) {
      await linkTelegramToUser(userId, chatId);
      return 'Sikeresen összekapcsoltad a fiókodat! Mostantól itt kapod az értesítéseket.';
    }
    return 'Üdv! A fiókod összekapcsolásához használd a weboldalon kapott linket.';
  },
  stop: async (chatId: string) => {
    await unlinkTelegram(chatId);
    return 'Leállítottad az értesítéseket. Bármikor újra aktiválhatod a weboldalon.';
  },
  help: () => {
    return `
🔍 DealSpy Bot

Parancsok:
/start - Fiók összekapcsolása
/stop - Értesítések leállítása
/help - Súgó

Beállítások: https://dealspy.eu
    `;
  },
};
```

---

## 11. i18n Configuration

### 11.1 Translations (lib/i18n/translations/hu.json)

```json
{
  "common": {
    "title": "DealSpy.eu",
    "tagline": "EU csődvagyon monitoring – mi figyeljük, te vásárolsz",
    "save": "Mentés",
    "cancel": "Mégse",
    "success": "Sikeres!",
    "error": "Hiba történt"
  },
  "form": {
    "email": "Email cím",
    "email_placeholder": "pelda@email.com",
    "categories": "Kategóriák",
    "categories_help": "Válaszd ki, milyen típusú deal-eket keresel",
    "countries": "Országok",
    "countries_help": "Mely országok érdekelnek",
    "keywords": "Kulcsszavak (opcionális)",
    "keywords_placeholder": "szerver, GPU, CNC",
    "keywords_help": "Vesszővel elválasztva. Üres = minden releváns deal",
    "channels": "Értesítési csatornák",
    "submit": "Feliratkozás"
  },
  "categories": {
    "it": "IT / Szerverek",
    "machines": "Gépek",
    "vehicles": "Járművek",
    "property": "Ingatlan"
  },
  "countries": {
    "hu": "🇭🇺 Magyarország",
    "at": "🇦🇹 Ausztria",
    "de": "🇩🇪 Németország"
  },
  "channels": {
    "push": "Böngésző értesítés (azonnal)",
    "email": "Email összefoglaló (naponta 15:00)",
    "telegram": "Telegram (azonnal)"
  },
  "messages": {
    "registration_success": "Sikeres feliratkozás! Ellenőrizd az email fiókodat.",
    "settings_saved": "Beállítások mentve!",
    "unsubscribed": "Sikeresen leiratkoztál."
  }
}
```

---

## 12. Error Handling

### 12.1 Scraper Errors

```typescript
async function runScraperWithRetry(scraper: Scraper, retries = 3): Promise<ScrapedDeal[]> {
  for (let i = 0; i < retries; i++) {
    try {
      return await scraper.scrape();
    } catch (error) {
      console.error(`Scraper ${scraper.source} failed (attempt ${i + 1}):`, error);
      if (i === retries - 1) {
        await sendAdminAlert(`Scraper ${scraper.source} failed after ${retries} attempts`);
        return [];
      }
      await sleep(5000 * (i + 1)); // Exponential backoff
    }
  }
  return [];
}
```

### 12.2 Notification Errors

```typescript
async function sendNotificationWithFallback(user: User, deal: Deal) {
  const results = {
    push: { success: false, error: null },
    telegram: { success: false, error: null },
    email: { success: false, error: null },
  };
  
  // Try each channel, log failures
  if (user.notify_push) {
    try {
      await sendPushNotification(user, deal);
      results.push.success = true;
    } catch (e) {
      results.push.error = e;
    }
  }
  
  // ... similar for other channels
  
  // Log to notifications table
  await logNotificationResults(user.id, deal.id, results);
}
```

---

## 13. Security Considerations

### 13.1 Cron Authentication

```typescript
// middleware.ts or in route handler
export function validateCronRequest(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // Vercel cron requests include this header
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  
  return isVercelCron || authHeader === `Bearer ${cronSecret}`;
}
```

### 13.2 Token Validation

```typescript
export async function validateUserToken(token: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('token', token)
    .single();
    
  if (error || !data) return null;
  return data;
}
```

### 13.3 Rate Limiting

```typescript
// Simple in-memory rate limiting for MVP
const rateLimits = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string, limit = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimits.get(ip);
  
  if (!record || record.resetAt < now) {
    rateLimits.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (record.count >= limit) return false;
  record.count++;
  return true;
}
```
