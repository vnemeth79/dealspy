# DealSpy.eu - Complete Development Guide for Cursor

> **Ez a fájl tartalmazza az összes szükséges információt a DealSpy.eu MVP fejlesztéséhez.**
> **Töltsd be ezt a fájlt a Cursor kontextusába, majd kövesd a promptokat sorrendben.**

---

# RÉSZ 1: PROJEKT ÁTTEKINTÉS

## Mi ez?

**DealSpy.eu** - EU csődvagyon és aukció monitoring platform

### Fő funkciók:
- 6 forrás automatikus scraping (EÉR, NetBid, Ediktsdatei, Insolvenzbekanntmachungen, Proventura, Machineseeker)
- AI fordítás német→magyar/angol (Claude Haiku)
- AI kategorizálás (IT, gépek, járművek, ingatlan)
- Értesítések: Web Push, Email, Telegram
- Naponta 1x futás (Vercel Hobby): scrape 09:30 CET, értesítés 10:00 CET, digest 15:00 CET
- Többnyelvű UI: magyar, angol, német

### Tech Stack:
- Frontend: Next.js 14 + Tailwind CSS
- Backend: Next.js API Routes
- Database: Supabase (PostgreSQL)
- AI: Claude Haiku (Anthropic)
- Push: OneSignal
- Email: SendGrid
- Hosting: Vercel

---

# RÉSZ 2: ADATBÁZIS SÉMA

```sql
-- Supabase SQL - futtasd ezt a SQL Editor-ban

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users tábla
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
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
  sources TEXT[] DEFAULT '{}'
);

CREATE INDEX idx_users_token ON users(token);
CREATE INDEX idx_users_email ON users(email);

-- Deals tábla
CREATE TABLE deals (
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
  country TEXT CHECK (country IN ('hu', 'at', 'de')),
  
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

CREATE INDEX idx_deals_source ON deals(source);
CREATE INDEX idx_deals_category ON deals(category);
CREATE INDEX idx_deals_country ON deals(country);
CREATE INDEX idx_deals_created_at ON deals(created_at DESC);

-- Notifications tábla
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('push', 'email', 'telegram')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'sent'
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

# RÉSZ 3: FEJLESZTÉSI PROMPTOK

## PROMPT 1: Projekt létrehozása

```
Hozz létre egy új Next.js 14 projektet "dealspy" néven a következő konfigurációval:

- TypeScript enabled
- App Router (app/ mappa)
- Tailwind CSS
- ESLint

Dependencies (package.json):
{
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "@anthropic-ai/sdk": "^0.14.0",
    "@sendgrid/mail": "^8.1.0",
    "node-telegram-bot-api": "^0.64.0"
  },
  "devDependencies": {
    "playwright": "^1.40.0",
    "@types/node-telegram-bot-api": "^0.64.0"
  }
}

Mappastruktúra:
dealspy/
├── app/
│   ├── api/
│   │   ├── register/route.ts
│   │   ├── settings/route.ts
│   │   ├── unsubscribe/route.ts
│   │   ├── telegram/webhook/route.ts
│   │   └── cron/
│   │       ├── scrape/route.ts
│   │       ├── notify/route.ts
│   │       └── digest/route.ts
│   ├── settings/page.tsx
│   ├── unsubscribe/page.tsx
│   ├── impressum/page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── db/
│   │   ├── supabase.ts
│   │   ├── users.ts
│   │   └── deals.ts
│   ├── scrapers/
│   │   ├── base.ts
│   │   ├── eer.ts
│   │   ├── netbid.ts
│   │   ├── ediktsdatei.ts
│   │   ├── insolvenz.ts
│   │   ├── proventura.ts
│   │   ├── machineseeker.ts
│   │   └── index.ts
│   ├── ai/
│   │   ├── translate.ts
│   │   └── categorize.ts
│   ├── notifications/
│   │   ├── push.ts
│   │   ├── email.ts
│   │   ├── telegram.ts
│   │   └── matcher.ts
│   └── i18n/
│       ├── config.ts
│       └── translations/
│           ├── hu.json
│           ├── en.json
│           └── de.json
├── components/
├── public/
│   └── onesignal/
├── .env.local
├── vercel.json
└── package.json

.env.local template:
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
NEXT_PUBLIC_ONESIGNAL_APP_ID=
ONESIGNAL_API_KEY=
SENDGRID_API_KEY=
TELEGRAM_BOT_TOKEN=
NEXT_PUBLIC_APP_URL=https://dealspy.eu
CRON_SECRET=

vercel.json:
{
  "crons": [
    { "path": "/api/cron/scrape", "schedule": "30 8,13 * * *" },
    { "path": "/api/cron/notify", "schedule": "0 9,14 * * *" },
    { "path": "/api/cron/digest", "schedule": "0 14 * * *" }
  ]
}

Hozd létre az alapstruktúrát placeholder kommentekkel minden fájlban.
```

---

## PROMPT 2: Supabase és TypeScript típusok

```
Készítsd el a lib/db/supabase.ts fájlt:

1. TypeScript típusok:

type User = {
  id: string;
  email: string;
  token: string;
  language: 'hu' | 'en' | 'de';
  created_at: string;
  updated_at: string;
  notify_push: boolean;
  notify_email: boolean;
  notify_telegram: boolean;
  telegram_chat_id: string | null;
  onesignal_player_id: string | null;
  categories: string[];
  countries: string[];
  keywords: string[];
  sources: string[];
}

type Deal = {
  id: string;
  source: 'eer' | 'netbid' | 'ediktsdatei' | 'proventura' | 'machineseeker' | 'insolvenz';
  source_id: string;
  title_original: string;
  title_hu: string | null;
  title_en: string | null;
  title_de: string | null;
  description_original: string | null;
  description_hu: string | null;
  description_en: string | null;
  category: 'it' | 'machines' | 'vehicles' | 'property' | 'other' | null;
  country: 'hu' | 'at' | 'de';
  price: number | null;
  currency: string;
  deadline: string | null;
  url: string;
  image_url: string | null;
  created_at: string;
  notified_at: string | null;
}

2. Supabase client:
- supabaseAdmin: service role key-vel (server-side)
- supabaseClient: anon key-vel (client-side, ha kell)

Exportáld a típusokat és client-eket.
```

---

## PROMPT 3: User és Deal CRUD műveletek

```
Készítsd el a lib/db/users.ts és lib/db/deals.ts fájlokat:

lib/db/users.ts:
- createUser(data): Promise<User> - új user létrehozása
- getUserByToken(token): Promise<User | null>
- getUserByEmail(email): Promise<User | null>
- updateUser(token, data): Promise<User>
- deleteUser(token): Promise<void>
- getAllActiveUsers(): Promise<User[]>

lib/db/deals.ts:
- createDeal(data): Promise<Deal> - upsert source+source_id alapján
- getDealById(id): Promise<Deal | null>
- getUnnotifiedDeals(): Promise<Deal[]> - ahol notified_at NULL
- markDealsAsNotified(dealIds): Promise<void>
- checkDealExists(source, sourceId): Promise<boolean>
```

---

## PROMPT 4: Base Scraper

```
Készítsd el a lib/scrapers/base.ts fájlt:

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

abstract class BaseScraper {
  abstract source: string;
  abstract country: 'hu' | 'at' | 'de';
  abstract scrape(): Promise<ScrapedDeal[]>;
  
  protected parsePrice(text: string): number | undefined {
    // Kezelje: "€ 1.234,56", "1234 EUR", "EUR 1,234.56"
  }
  
  protected parseDate(text: string): Date | undefined {
    // Kezelje: "2026-02-15", "15.02.2026", "15/02/2026"
  }
  
  protected cleanText(text: string): string {
    // Trim, collapse whitespace, remove HTML
  }
}

function sleep(ms: number): Promise<void>

Exportáld az interface-t, class-t és sleep függvényt.
```

---

## PROMPT 5: EÉR Scraper (Magyar)

```
Készítsd el a lib/scrapers/eer.ts fájlt:

Az EÉR (eer.sztfh.hu) a magyar csődvagyon platform.

class EerScraper extends BaseScraper {
  source = 'eer';
  country = 'hu' as const;
  
  async scrape(): Promise<ScrapedDeal[]> {
    // 1. Fetch a pályázat kereső oldal
    // 2. Parse HTML (regex vagy cheerio)
    // 3. Kinyerni: cím, irányár, határidő, link
    // 4. Return ScrapedDeal[]
  }
}

Fontos:
- User-Agent header beállítása
- Timeout: 30 sec
- Try-catch error handling
- Ha hiba: return [] és logolj

Exportáld az EerScraper class-t.
```

---

## PROMPT 6: NetBid Scraper (Playwright)

```
Készítsd el a lib/scrapers/netbid.ts fájlt:

A NetBid (netbid.com) JS renderelést igényel, használj Playwright-ot.

class NetBidScraper extends BaseScraper {
  source = 'netbid';
  country = 'de' as const;
  
  async scrape(): Promise<ScrapedDeal[]> {
    const browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
      await page.goto('https://www.netbid.com/en/auctions/', { timeout: 60000 });
      await page.waitForSelector('.auction-item', { timeout: 30000 });
      
      // Parse auction items
      // Kinyerni: title, price, deadline, url, image
      
      return deals;
    } finally {
      await browser.close();
    }
  }
}

Exportáld a NetBidScraper class-t.
```

---

## PROMPT 7: További scraperek

```
Készítsd el a maradék scraper fájlokat:

lib/scrapers/ediktsdatei.ts:
- URL: edikte.justiz.gv.at
- source = 'ediktsdatei', country = 'at'
- HTTP + HTML parsing

lib/scrapers/insolvenz.ts:
- URL: insolvenzbekanntmachungen.de
- source = 'insolvenz', country = 'de'
- HTTP + HTML parsing

lib/scrapers/proventura.ts:
- URL: proventura.de
- source = 'proventura', country = 'de'
- Playwright (JS rendering)

lib/scrapers/machineseeker.ts:
- URL: machineseeker.com
- source = 'machineseeker', country = 'de'
- HTTP request

Minden scraper kövesse a BaseScraper mintát, legyen robust error handling.
```

---

## PROMPT 8: Scraper orchestrátor

```
Készítsd el a lib/scrapers/index.ts fájlt:

import { EerScraper } from './eer';
import { NetBidScraper } from './netbid';
// ... többi import

const scrapers = [
  new EerScraper(),
  new NetBidScraper(),
  // ... többi
];

type ScraperStats = {
  totalDeals: number;
  bySource: Record<string, number>;
  errors: { source: string; error: string }[];
  duration: number;
}

async function runAllScrapers(): Promise<{ deals: ScrapedDeal[]; stats: ScraperStats }> {
  const startTime = Date.now();
  const allDeals: ScrapedDeal[] = [];
  const stats: ScraperStats = { totalDeals: 0, bySource: {}, errors: [], duration: 0 };
  
  for (const scraper of scrapers) {
    try {
      const deals = await scraper.scrape();
      allDeals.push(...deals);
      stats.bySource[scraper.source] = deals.length;
    } catch (error) {
      stats.errors.push({ source: scraper.source, error: String(error) });
    }
  }
  
  stats.totalDeals = allDeals.length;
  stats.duration = Date.now() - startTime;
  
  return { deals: allDeals, stats };
}

Exportáld a runAllScrapers függvényt.
```

---

## PROMPT 9: AI Translation

```
Készítsd el a lib/ai/translate.ts fájlt:

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function translateText(
  text: string,
  targetLang: 'hu' | 'en'
): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 500,
    temperature: 0,
    system: 'You are a translator. Translate accurately, keep technical terms. Only return the translation.',
    messages: [{ role: 'user', content: `Translate to ${targetLang === 'hu' ? 'Hungarian' : 'English'}: ${text}` }]
  });
  
  return message.content[0].type === 'text' ? message.content[0].text : text;
}

async function translateDeal(deal: ScrapedDeal): Promise<{
  title_hu: string;
  title_en: string;
  description_hu?: string;
  description_en?: string;
}> {
  // Ha magyar, ne fordítsd
  // Ha német/osztrák, fordítsd HU és EN-re
  // Description: csak első 200 karakter
}

Exportáld a translateDeal függvényt.
```

---

## PROMPT 10: AI Categorization

```
Készítsd el a lib/ai/categorize.ts fájlt:

async function categorizeText(
  title: string,
  description?: string
): Promise<'it' | 'machines' | 'vehicles' | 'property' | 'other'> {
  const prompt = `Categorize this item into one category:
- it: Servers, computers, IT, GPUs, networking
- machines: Industrial machines, CNC, manufacturing
- vehicles: Cars, trucks, forklifts
- property: Real estate, buildings
- other: Everything else

Title: ${title}
${description ? `Description: ${description}` : ''}

Respond with only: it, machines, vehicles, property, or other`;

  const message = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 20,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }]
  });
  
  const response = message.content[0].type === 'text' ? message.content[0].text.trim().toLowerCase() : 'other';
  
  if (['it', 'machines', 'vehicles', 'property', 'other'].includes(response)) {
    return response as any;
  }
  return 'other';
}

Exportáld.
```

---

## PROMPT 11: User-Deal Matcher

```
Készítsd el a lib/notifications/matcher.ts fájlt:

function matchUserToDeal(user: User, deal: Deal): boolean {
  // Country match (üres = minden)
  if (user.countries.length > 0 && !user.countries.includes(deal.country)) {
    return false;
  }
  
  // Category match (üres = minden)
  if (user.categories.length > 0 && !user.categories.includes(deal.category || 'other')) {
    return false;
  }
  
  // Source match (üres = minden)
  if (user.sources.length > 0 && !user.sources.includes(deal.source)) {
    return false;
  }
  
  // Keyword match (üres = minden, OR logika)
  if (user.keywords.length > 0) {
    const text = `${deal.title_original} ${deal.title_hu} ${deal.description_original}`.toLowerCase();
    const hasMatch = user.keywords.some(kw => text.includes(kw.toLowerCase()));
    if (!hasMatch) return false;
  }
  
  return true;
}

async function findMatchingUsers(deal: Deal): Promise<User[]> {
  const users = await getAllActiveUsers();
  return users.filter(u => matchUserToDeal(u, deal));
}

Exportáld.
```

---

## PROMPT 12: Push Notifications (OneSignal)

```
Készítsd el a lib/notifications/push.ts fájlt:

async function sendPushNotification(user: User, deal: Deal): Promise<{ success: boolean; error?: string }> {
  if (!user.onesignal_player_id) {
    return { success: false, error: 'No player ID' };
  }
  
  const title = user.language === 'hu' ? '🔍 DealSpy | Új deal' :
                user.language === 'de' ? '🔍 DealSpy | Neues Angebot' :
                '🔍 DealSpy | New deal';
  
  const dealTitle = user.language === 'hu' ? (deal.title_hu || deal.title_original) :
                    user.language === 'en' ? (deal.title_en || deal.title_original) :
                    deal.title_original;
  
  const body = `${dealTitle} | ${deal.source} | €${deal.price || '?'}`;
  
  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${process.env.ONESIGNAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
      include_player_ids: [user.onesignal_player_id],
      headings: { en: title },
      contents: { en: body },
      url: deal.url,
    }),
  });
  
  if (!response.ok) {
    return { success: false, error: await response.text() };
  }
  
  return { success: true };
}

Exportáld.
```

---

## PROMPT 13: Email (SendGrid)

```
Készítsd el a lib/notifications/email.ts fájlt:

import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

async function sendDigestEmail(user: User, deals: Deal[]): Promise<{ success: boolean }> {
  const subject = user.language === 'hu' 
    ? `🔍 DealSpy | ${deals.length} új deal - ${new Date().toLocaleDateString('hu')}`
    : `🔍 DealSpy | ${deals.length} new deals - ${new Date().toLocaleDateString('en')}`;
  
  const html = generateDigestHtml(user, deals);
  
  await sgMail.send({
    to: user.email,
    from: 'alerts@dealspy.eu',
    subject,
    html,
  });
  
  return { success: true };
}

function generateDigestHtml(user: User, deals: Deal[]): string {
  // Responsive HTML email template
  // Deal-ek listázva: title, price, source, deadline, link
  // Footer: settings link, unsubscribe link
}

Exportáld.
```

---

## PROMPT 14: Telegram Bot

```
Készítsd el a lib/notifications/telegram.ts fájlt:

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

async function sendTelegramMessage(chatId: string, text: string): Promise<{ success: boolean }> {
  const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  
  return { success: response.ok };
}

async function sendDealNotification(user: User, deal: Deal): Promise<{ success: boolean }> {
  if (!user.telegram_chat_id) return { success: false };
  
  const flag = deal.country === 'hu' ? '🇭🇺' : deal.country === 'at' ? '🇦🇹' : '🇩🇪';
  const title = user.language === 'hu' ? (deal.title_hu || deal.title_original) : deal.title_original;
  
  const text = `🔍 <b>DealSpy</b> | ${deal.category}

📦 ${title}

📍 ${deal.source} | ${flag}
💰 €${deal.price || '?'}
⏰ ${deal.deadline || 'N/A'}

🔗 ${deal.url}`;

  return sendTelegramMessage(user.telegram_chat_id, text);
}

async function handleWebhook(update: any): Promise<string> {
  const chatId = update.message?.chat?.id;
  const text = update.message?.text || '';
  
  if (text.startsWith('/start')) {
    const token = text.split(' ')[1];
    if (token) {
      // Link user: UPDATE users SET telegram_chat_id = chatId WHERE token = token
      return 'Sikeresen összekapcsolva!';
    }
    return 'Használd a weboldalon kapott linket a csatlakozáshoz.';
  }
  
  if (text === '/stop') {
    // Unlink: UPDATE users SET telegram_chat_id = NULL WHERE telegram_chat_id = chatId
    return 'Értesítések leállítva.';
  }
  
  return 'Parancsok: /start, /stop, /help';
}

Exportáld.
```

---

## PROMPT 15: API Routes

```
Készítsd el az API route-okat:

app/api/register/route.ts:
POST - Új user regisztráció
- Validálás, createUser(), welcome email
- Return: { success, token, telegram_link }

app/api/settings/route.ts:
GET ?token=xxx - User beállítások lekérése
PUT ?token=xxx - User beállítások módosítása

app/api/unsubscribe/route.ts:
POST ?token=xxx - User törlése

app/api/telegram/webhook/route.ts:
POST - Telegram webhook handler
- handleWebhook(update)
- Return 200 OK

app/api/cron/scrape/route.ts:
POST - Scraping (cron védett)
- runAllScrapers()
- translateDeal, categorizeDeal minden új deal-re
- Mentés DB-be

app/api/cron/notify/route.ts:
POST - Notifications (cron védett)
- getUnnotifiedDeals()
- findMatchingUsers()
- sendPushNotification, sendDealNotification
- markDealsAsNotified()

app/api/cron/digest/route.ts:
POST - Email digest (cron védett)
- getAllActiveUsers where notify_email
- sendDigestEmail()

Minden cron route ellenőrizze:
- x-vercel-cron header VAGY
- Authorization: Bearer {CRON_SECRET}
```

---

## PROMPT 16: Landing Page (Registration Form)

```
Készítsd el az app/page.tsx fájlt:

'use client';

Responsive registration form:
1. Header: 🔍 DealSpy.eu + tagline + language switcher
2. Form mezők:
   - Email (required)
   - Categories: checkbox group (IT/Server, Gépek, Járművek, Ingatlan)
   - Countries: checkbox group (🇭🇺 HU, 🇦🇹 AT, 🇩🇪 DE)
   - Keywords: text input (comma separated)
   - Channels: checkbox group (Push, Email, Telegram)
3. Submit button

Submit logic:
1. Ha push enabled: requestPushPermission(), getPlayerId()
2. POST /api/register
3. Success: mutass success message + telegram link
4. Error: mutass error message

Tailwind styling: clean, modern, max-w-xl centered card
```

---

## PROMPT 17: Settings Page

```
Készítsd el az app/settings/page.tsx fájlt:

'use client';

1. useSearchParams() -> token
2. useEffect: GET /api/settings?token={token}
3. Ha error: "Invalid link" message
4. Form: pre-filled current settings (email disabled)
5. Save: PUT /api/settings?token={token}
6. Footer: Unsubscribe link

Tailwind styling, same design as landing page.
```

---

## PROMPT 18: OneSignal Frontend Integration

```
Készítsd el:

1. public/onesignal/OneSignalSDKWorker.js:
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

2. components/OneSignalProvider.tsx:
'use client';
- useEffect: OneSignal.init({ appId })

3. lib/onesignal-client.ts:
export async function requestPushPermission(): Promise<boolean>
export async function getPlayerId(): Promise<string | null>

4. app/layout.tsx: Add OneSignalProvider wrapper
```

---

## PROMPT 19: i18n Translations

```
Készítsd el a fordítás fájlokat:

lib/i18n/translations/hu.json:
{
  "title": "DealSpy.eu",
  "tagline": "EU csődvagyon monitoring – mi figyeljük, te vásárolsz",
  "form": {
    "email": "Email cím",
    "categories": "Kategóriák",
    "countries": "Országok",
    "keywords": "Kulcsszavak",
    "channels": "Értesítési csatornák",
    "submit": "Feliratkozás"
  },
  "categories": {
    "it": "IT / Szerverek",
    "machines": "Gépek",
    "vehicles": "Járművek",
    "property": "Ingatlan"
  },
  "success": "Sikeres feliratkozás!"
}

Hasonlóan en.json és de.json.

lib/i18n/config.ts:
- getTranslation(key, lang) függvény
- useTranslation hook (client)
```

---

# RÉSZ 4: DEPLOY CHECKLIST

## Előfeltételek:
- [ ] Supabase projekt + SQL futtatva
- [ ] Anthropic API key
- [ ] OneSignal app létrehozva
- [ ] SendGrid API key + sender verification
- [ ] Telegram bot (@BotFather)
- [ ] Domain (dealspy.eu) + DNS

## Vercel Deploy:
1. Push GitHub-ra
2. Vercel: Import repo
3. Environment variables beállítása
4. Deploy
5. Telegram webhook beállítása:
   ```
   curl -X POST "https://api.telegram.org/bot{TOKEN}/setWebhook" \
     -d '{"url": "https://dealspy.eu/api/telegram/webhook"}'
   ```

## Tesztelés:
1. Regisztrálj teszt user-t
2. Manuálisan hívd meg: POST /api/cron/scrape
3. Manuálisan hívd meg: POST /api/cron/notify
4. Ellenőrizd az értesítéseket

---

**Ez a teljes specifikáció. Kövesd a promptokat sorrendben, és kérdezz, ha elakadsz!**
