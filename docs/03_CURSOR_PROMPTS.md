# DealSpy.eu - Cursor Development Prompts

## Használati útmutató

Ez a dokumentum lépésről lépésre tartalmazza a promptokat, amelyeket Cursor-ba kell beilleszteni a DealSpy.eu MVP fejlesztéséhez. Minden prompt önálló feladatot fed le.

**Fontos:** A promptokat sorrendben kövesd, mert egymásra épülnek.

---

## FÁZIS 1: Projekt Setup

### Prompt 1.1 - Projekt inicializálás

```
Hozz létre egy új Next.js 14 projektet a következő specifikációkkal:

Projekt neve: dealspy
Konfiguráció:
- TypeScript
- App Router
- Tailwind CSS
- ESLint
- src/ mappa NEM kell (app/ legyen a root-ban)

Package.json dependencies:
- @supabase/supabase-js
- @anthropic-ai/sdk
- playwright (dev dependency)
- @sendgrid/mail
- node-telegram-bot-api
- @types/node-telegram-bot-api (dev)

Hozd létre a következő mappastruktúrát:
/app
  /api
    /register/route.ts
    /settings/route.ts
    /unsubscribe/route.ts
    /telegram/webhook/route.ts
    /cron/scrape/route.ts
    /cron/notify/route.ts
    /cron/digest/route.ts
  /settings/page.tsx
  /unsubscribe/page.tsx
  /impressum/page.tsx
  layout.tsx
  page.tsx
/lib
  /db
    supabase.ts
    users.ts
    deals.ts
  /scrapers
    base.ts
    index.ts
  /ai
    translate.ts
    categorize.ts
  /notifications
    push.ts
    email.ts
    telegram.ts
    matcher.ts
  /i18n
    config.ts
/components
/public
  /onesignal

Hozd létre a .env.example fájlt a szükséges környezeti változókkal:
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
ONESIGNAL_APP_ID=
ONESIGNAL_API_KEY=
SENDGRID_API_KEY=
TELEGRAM_BOT_TOKEN=
NEXT_PUBLIC_APP_URL=https://dealspy.eu
CRON_SECRET=

Minden fájlba írj placeholder kommentet, hogy mit fog tartalmazni.
```

### Prompt 1.2 - Supabase client setup

```
Készítsd el a lib/db/supabase.ts fájlt:

1. Hozz létre egy Supabase client-et a service role key-vel (server-side használatra)
2. Hozz létre egy Supabase client-et az anon key-vel (client-side használatra)
3. Definiáld a TypeScript típusokat a database táblákhoz:

User típus:
- id: string (UUID)
- email: string
- token: string
- language: 'hu' | 'en' | 'de'
- created_at: string
- updated_at: string
- notify_push: boolean
- notify_email: boolean
- notify_telegram: boolean
- telegram_chat_id: string | null
- onesignal_player_id: string | null
- categories: string[]
- countries: string[]
- keywords: string[]
- sources: string[]

Deal típus:
- id: string (UUID)
- source: 'eer' | 'netbid' | 'ediktsdatei' | 'proventura' | 'machineseeker' | 'insolvenz'
- source_id: string
- title_original: string
- title_hu: string | null
- title_en: string | null
- title_de: string | null
- description_original: string | null
- description_hu: string | null
- description_en: string | null
- category: 'it' | 'machines' | 'vehicles' | 'property' | 'other' | null
- country: 'hu' | 'at' | 'de'
- price: number | null
- currency: string
- deadline: string | null
- url: string
- image_url: string | null
- created_at: string
- notified_at: string | null

Exportáld a supabaseAdmin és supabaseClient instance-okat.
```

### Prompt 1.3 - Database CRUD műveletek

```
Készítsd el a lib/db/users.ts fájlt a következő funkciókkal:

1. createUser(userData: CreateUserInput): Promise<User>
   - Generáljon UUID token-t a settings linkhez
   - Validálja az email formátumot
   - Hiba esetén dobjon Error-t

2. getUserByToken(token: string): Promise<User | null>
   - Token alapján visszaadja a user-t
   
3. getUserByEmail(email: string): Promise<User | null>

4. getUserById(id: string): Promise<User | null>

5. updateUser(token: string, data: UpdateUserInput): Promise<User>
   - Frissíti a user adatait token alapján
   
6. deleteUser(token: string): Promise<void>
   - Soft delete vagy hard delete a token alapján

7. getAllActiveUsers(): Promise<User[]>
   - Visszaadja az összes aktív user-t
   
8. getUsersForNotification(deal: Deal): Promise<User[]>
   - Visszaadja azokat a user-eket, akiknek értesítést kell küldeni az adott deal-ről
   - Szűrés: categories, countries, keywords, sources alapján

---

Készítsd el a lib/db/deals.ts fájlt a következő funkciókkal:

1. createDeal(dealData: CreateDealInput): Promise<Deal>
   - Upsert: ha már létezik source+source_id kombináció, frissítse
   
2. getDealById(id: string): Promise<Deal | null>

3. getUnnotifiedDeals(): Promise<Deal[]>
   - Visszaadja azokat a deal-eket, ahol notified_at NULL
   
4. markDealsAsNotified(dealIds: string[]): Promise<void>
   - Beállítja a notified_at mezőt NOW()-ra

5. getRecentDeals(limit: number = 100): Promise<Deal[]>
   - Legfrissebb deal-ek, created_at DESC

6. getDealsBySource(source: string): Promise<Deal[]>

7. checkDealExists(source: string, sourceId: string): Promise<boolean>
```

---

## FÁZIS 2: Scraperek

### Prompt 2.1 - Base Scraper

```
Készítsd el a lib/scrapers/base.ts fájlt:

1. Definiáld a ScrapedDeal interface-t:
   - source: string
   - source_id: string
   - title_original: string
   - description_original?: string
   - price?: number
   - currency?: string
   - deadline?: Date
   - url: string
   - image_url?: string
   - country: 'hu' | 'at' | 'de'
   - raw_data?: Record<string, any>

2. Definiáld az abstract BaseScraper class-t:
   - abstract source: string
   - abstract country: 'hu' | 'at' | 'de'
   - abstract scrape(): Promise<ScrapedDeal[]>
   
   Protected helper metódusok:
   - parsePrice(text: string): number | undefined
     - Kezelje: "€ 1.234,56", "1234 EUR", "EUR 1,234.56" formátumokat
   - parseDate(text: string): Date | undefined
     - Kezelje: "2026-02-15", "15.02.2026", "15/02/2026" formátumokat
   - cleanText(text: string): string
     - Trim, collapse whitespace, remove HTML tags
   - generateSourceId(url: string): string
     - URL-ből egyedi ID generálás

3. Hozz létre egy sleep(ms: number) utility függvényt rate limiting-hez
```

### Prompt 2.2 - EÉR Scraper (Magyar)

```
Készítsd el a lib/scrapers/eer.ts fájlt:

Az EÉR (Elektronikus Értékesítési Rendszer) a magyar csődvagyon értékesítési platform.
URL: https://eer.sztfh.hu

A scraper feladata:
1. Lekérni az aktív pályázatokat/árveréseket
2. Kinyerni az adatokat (cím, ár, határidő, link)

Implementáld az EerScraper class-t:
- source = 'eer'
- country = 'hu'

A scrape() metódus:
1. Használj fetch-et a pályázat kereső oldal lekéréséhez
2. Parse-old a HTML-t (használj regex-et vagy cheerio-t)
3. Minden találatból hozd létre a ScrapedDeal objektumot
4. Kezelj hibákat gracefully (üres array visszaadása hiba esetén, log)

Megjegyzés: Ha az oldal JavaScript renderelést igényel, jelezd és használj Playwright-ot.

A scraper legyen robust:
- Try-catch minden hálózati hívás körül
- Rate limiting (1 másodperc requestek között)
- User-Agent header beállítása
- Timeout kezelés (30 másodperc)
```

### Prompt 2.3 - NetBid Scraper (Német/EU)

```
Készítsd el a lib/scrapers/netbid.ts fájlt:

A NetBid (netbid.com) egy európai ipari aukciós platform.
URL: https://www.netbid.com/en/auctions/

A scraper feladata:
1. Lekérni az aktuális aukciókat
2. Kinyerni: cím, induló ár, aukció vége, kép, link

Implementáld a NetBidScraper class-t:
- source = 'netbid'
- country = 'de' (default, de az aukció helyétől függően változhat)

Mivel a NetBid JavaScript-et használ, használj Playwright-ot:
1. Indíts headless browser-t
2. Navigálj az aukciók oldalra
3. Várj a tartalom betöltésére
4. Parse-old a DOM-ot
5. Zárd be a browser-t

A scrape() metódusban:
1. Playwright browser launch (headless: true)
2. page.goto('https://www.netbid.com/en/auctions/')
3. page.waitForSelector('.auction-item') // vagy ami releváns
4. Gyűjtsd össze az auction item-eket
5. Minden item-ből: title, price, deadline, url, image
6. browser.close()

Error handling:
- Browser timeout: 60 másodperc
- Ha nincs találat: üres array, no error
- Screenshot készítés debug módban (opcionális)
```

### Prompt 2.4 - További scraperek

```
Készítsd el a következő scraper fájlokat a lib/scrapers/ mappában:

1. ediktsdatei.ts (Osztrák hivatalos csődhirdetmények)
   - URL: https://edikte.justiz.gv.at/edikte/
   - source = 'ediktsdatei'
   - country = 'at'
   - HTTP request + HTML parsing
   - Szűrés: Insolvenz, Versteigerungen szekciók

2. insolvenz.ts (Német hivatalos csődhirdetmények)
   - URL: https://www.insolvenzbekanntmachungen.de/
   - source = 'insolvenz'
   - country = 'de'
   - HTTP request + HTML parsing
   - Szűrés: aktuális hirdetmények

3. proventura.ts (Német aukciók)
   - URL: https://www.proventura.de/
   - source = 'proventura'
   - country = 'de'
   - Playwright (JS rendering szükséges)
   - Szűrés: laufende Auktionen

4. machineseeker.ts (EU használt gép piac)
   - URL: https://www.machineseeker.com/
   - source = 'machineseeker'
   - country = 'de' // vagy 'at' az eladó alapján
   - HTTP request vagy API ha van
   - Keresés: Server, IT, CNC stb.

Minden scraper kövesse a BaseScraper mintát és legyen robust.
```

### Prompt 2.5 - Scraper orchestrátor

```
Készítsd el a lib/scrapers/index.ts fájlt:

1. Importáld az összes scraper-t

2. Hozz létre egy scrapers tömböt az összes scraper instance-szel

3. Implementáld a runAllScrapers() függvényt:
   - Futtassa végig az összes scraper-t
   - Minden scraper-t külön try-catch-ben
   - Ha egy scraper hibázik, folytassa a többivel
   - Gyűjtse össze az összes ScrapedDeal-t egy tömbbe
   - Loggolja a statisztikákat (source, count, errors)
   - Return: { deals: ScrapedDeal[], stats: ScraperStats }

4. Implementáld a runScraper(source: string) függvényt:
   - Csak egy adott scraper futtatása
   - Teszteléshez hasznos

5. ScraperStats típus:
   - totalDeals: number
   - bySource: Record<string, number>
   - errors: { source: string, error: string }[]
   - duration: number (ms)

Példa kimenet:
{
  deals: [...],
  stats: {
    totalDeals: 47,
    bySource: { eer: 12, netbid: 20, proventura: 15 },
    errors: [{ source: 'ediktsdatei', error: 'Timeout' }],
    duration: 45000
  }
}
```

---

## FÁZIS 3: AI Feldolgozás

### Prompt 3.1 - Claude Translation

```
Készítsd el a lib/ai/translate.ts fájlt:

Használd az Anthropic SDK-t (@anthropic-ai/sdk) a Claude Haiku modellel.

1. Inicializáld az Anthropic client-et az API key-vel

2. Implementáld a translateText() függvényt:
   
   async function translateText(
     text: string,
     targetLang: 'hu' | 'en',
     sourceLang?: string // optional, auto-detect if not provided
   ): Promise<string>

   - Használj Claude Haiku-t (claude-3-haiku-20240307)
   - System prompt: "You are a translator. Translate the given text accurately. Keep technical terms. Only return the translation, nothing else."
   - Max tokens: 500
   - Temperature: 0 (deterministic)

3. Implementáld a translateDeal() függvényt:

   async function translateDeal(deal: ScrapedDeal): Promise<{
     title_hu: string;
     title_en: string;
     description_hu?: string;
     description_en?: string;
   }>

   - Ha a deal.country === 'hu', a title_hu = title_original
   - Ha a deal.country === 'de' vagy 'at', fordítsd magyarra és angolra
   - Description: csak az első 200 karaktert fordítsd (költség optimalizálás)
   - Batch a fordításokat egy API hívásba ha lehetséges

4. Error handling:
   - API rate limit: exponential backoff retry
   - Ha a fordítás sikertelen, használd az eredetit fallback-ként

5. Cost tracking (opcionális):
   - Logold az input/output token számokat
```

### Prompt 3.2 - Claude Categorization

```
Készítsd el a lib/ai/categorize.ts fájlt:

1. Implementáld a categorizeText() függvényt:

   async function categorizeText(
     title: string,
     description?: string
   ): Promise<'it' | 'machines' | 'vehicles' | 'property' | 'other'>

   System prompt:
   "Categorize this auction/insolvency item into exactly one category.
   
   Categories:
   - it: Servers, computers, IT equipment, networking, GPUs, data center equipment
   - machines: Industrial machines, CNC, manufacturing equipment, tools
   - vehicles: Cars, trucks, forklifts, construction vehicles, trailers
   - property: Real estate, buildings, land, warehouses
   - other: Everything else (furniture, inventory, miscellaneous)
   
   Respond with only the category name (it/machines/vehicles/property/other)."

   User message: "Title: {title}\nDescription: {description}"

2. Implementáld a categorizeDeal() függvényt:

   async function categorizeDeal(deal: ScrapedDeal): Promise<string>
   
   - Hívja meg a categorizeText-et
   - Validálja, hogy a válasz valid kategória
   - Fallback: 'other'

3. Batch processing (opcionális optimalizáció):
   
   async function categorizeDeals(deals: ScrapedDeal[]): Promise<Map<string, string>>
   
   - Több deal kategorizálása egy API hívásban
   - JSON output format kérése
```

---

## FÁZIS 4: Értesítések

### Prompt 4.1 - User-Deal Matcher

```
Készítsd el a lib/notifications/matcher.ts fájlt:

1. Implementáld a matchUserToDeal() függvényt:

   function matchUserToDeal(user: User, deal: Deal): boolean
   
   Matching logika:
   a) Country match:
      - Ha user.countries üres → match minden country-ra
      - Ha user.countries nem üres → deal.country benne kell legyen
   
   b) Category match:
      - Ha user.categories üres → match minden category-ra
      - Ha user.categories nem üres → deal.category benne kell legyen
   
   c) Source match:
      - Ha user.sources üres → match minden source-ra
      - Ha user.sources nem üres → deal.source benne kell legyen
   
   d) Keyword match:
      - Ha user.keywords üres → match (nincs szűrés)
      - Ha user.keywords nem üres → OR logika
        - A deal title_original, title_hu, title_en, description_original
          bármelyikében szerepel bármelyik keyword (case insensitive)
   
   Return true ha MINDEN feltétel teljesül.

2. Implementáld a findMatchingUsers() függvényt:

   async function findMatchingUsers(deal: Deal): Promise<User[]>
   
   - Lekéri az összes aktív user-t
   - Szűri azokat, akik match-elnek a deal-re
   - Return a matching users lista

3. Implementáld a findMatchingDeals() függvényt:

   async function findMatchingDeals(user: User, deals: Deal[]): Promise<Deal[]>
   
   - Egy user-hez szűri a releváns deal-eket
```

### Prompt 4.2 - OneSignal Push

```
Készítsd el a lib/notifications/push.ts fájlt:

1. OneSignal API konfiguráció:
   - API endpoint: https://onesignal.com/api/v1/notifications
   - Headers: Authorization: Basic {ONESIGNAL_API_KEY}

2. Implementáld a sendPushNotification() függvényt:

   async function sendPushNotification(
     user: User,
     deal: Deal
   ): Promise<{ success: boolean; error?: string }>
   
   - Ellenőrizd, hogy user.onesignal_player_id létezik
   - Készítsd el a notification payload-ot:
     {
       app_id: ONESIGNAL_APP_ID,
       include_player_ids: [user.onesignal_player_id],
       headings: { en: getLocalizedTitle(deal, user.language) },
       contents: { en: getLocalizedBody(deal, user.language) },
       url: deal.url,
       chrome_web_icon: "https://dealspy.eu/icon-192.png"
     }
   - POST request az API-ra
   - Return success/error

3. Helper függvények:

   function getLocalizedTitle(deal: Deal, lang: string): string
   - "🔍 DealSpy | Új deal" (hu)
   - "🔍 DealSpy | New deal" (en)
   - "🔍 DealSpy | Neues Angebot" (de)

   function getLocalizedBody(deal: Deal, lang: string): string
   - Használd a megfelelő title_hu/title_en/title_de mezőt
   - Format: "{title} | {source} | €{price}"

4. Implementáld a sendBulkPush() függvényt (opcionális):

   async function sendBulkPush(
     userIds: string[],
     deal: Deal
   ): Promise<{ sent: number; failed: number }>
   
   - Több user-nek küldjön egy batch-ben
   - Max 2000 player_id per request (OneSignal limit)
```

### Prompt 4.3 - SendGrid Email

```
Készítsd el a lib/notifications/email.ts fájlt:

Használd a @sendgrid/mail package-t.

1. Inicializáld a SendGrid client-et:
   sgMail.setApiKey(process.env.SENDGRID_API_KEY)

2. Implementáld a sendDigestEmail() függvényt:

   async function sendDigestEmail(
     user: User,
     deals: Deal[]
   ): Promise<{ success: boolean; error?: string }>
   
   - From: "DealSpy" <alerts@dealspy.eu>
   - To: user.email
   - Subject: getDigestSubject(user.language, deals.length)
   - HTML body: generateDigestHtml(user, deals)

3. Helper függvények:

   function getDigestSubject(lang: string, count: number): string
   - hu: "🔍 DealSpy | {count} új deal - {date}"
   - en: "🔍 DealSpy | {count} new deals - {date}"
   - de: "🔍 DealSpy | {count} neue Angebote - {date}"

   function generateDigestHtml(user: User, deals: Deal[]): string
   - Responsive HTML email template
   - Deal-ek kategóriánként csoportosítva
   - Minden deal: title, price, source, deadline, link
   - Footer: settings link, unsubscribe link

4. Implementáld a sendWelcomeEmail() függvényt:

   async function sendWelcomeEmail(user: User): Promise<void>
   
   - Üdvözlő email regisztráció után
   - Tartalmazza a settings linket (dealspy.eu/settings?token={token})

5. Email template (HTML string):
   - Legyen mobile-responsive
   - Használj inline CSS-t
   - Maximum 600px széles
   - Egyszerű, tiszta design
```

### Prompt 4.4 - Telegram Bot

```
Készítsd el a lib/notifications/telegram.ts fájlt:

Használd a node-telegram-bot-api package-t vagy natív fetch-et.

1. Telegram API endpoint:
   https://api.telegram.org/bot{TOKEN}/sendMessage

2. Implementáld a sendTelegramMessage() függvényt:

   async function sendTelegramMessage(
     chatId: string,
     message: string,
     options?: { parse_mode?: 'HTML' | 'Markdown' }
   ): Promise<{ success: boolean; error?: string }>
   
   - POST request a Telegram API-ra
   - Body: { chat_id, text, parse_mode }

3. Implementáld a sendDealNotification() függvényt:

   async function sendDealNotification(
     user: User,
     deal: Deal
   ): Promise<{ success: boolean; error?: string }>
   
   - Ellenőrizd, hogy user.telegram_chat_id létezik
   - Formázd a deal-t Telegram üzenetté
   - Küldd el

4. Deal üzenet formátum (user.language alapján):

   HU verzió:
   ```
   🔍 DealSpy | {category}

   📦 {title_hu}
      ({title_original})

   📍 {source} | {country_flag} {country_name}
   💰 Ár: €{price}
   ⏰ Lejár: {deadline} ({days_left} nap)
   🏷️ #{category} #{source}

   🔗 {url}
   ```

5. Implementáld a handleWebhook() függvényt:

   async function handleWebhook(update: TelegramUpdate): Promise<void>
   
   Kezelendő események:
   - /start {token} → linkTelegramToUser(token, chatId)
   - /start (token nélkül) → küldj instrukciót
   - /stop → unlinkTelegram(chatId)
   - /help → küldj help szöveget

6. Helper függvények:

   async function linkTelegramToUser(token: string, chatId: string): Promise<boolean>
   - Frissítsd a user.telegram_chat_id mezőt

   async function unlinkTelegram(chatId: string): Promise<void>
   - Töröld a telegram_chat_id-t ahol megegyezik

   function getCountryFlag(country: string): string
   - hu → 🇭🇺
   - at → 🇦🇹
   - de → 🇩🇪
```

---

## FÁZIS 5: API Routes

### Prompt 5.1 - Registration API

```
Készítsd el az app/api/register/route.ts fájlt:

POST /api/register

Request body:
{
  email: string (required, valid email)
  language: 'hu' | 'en' | 'de' (default: 'hu')
  categories: string[] (required, min 1)
  countries: string[] (required, min 1)
  keywords: string[] (optional)
  sources: string[] (optional)
  notify_push: boolean (default: true)
  notify_email: boolean (default: true)
  notify_telegram: boolean (default: false)
  onesignal_player_id: string (optional, required if notify_push)
}

Logika:
1. Validáld a request body-t
2. Ellenőrizd, hogy az email nem létezik-e már
3. Ha létezik, küldj vissza hibát: "Email already registered"
4. Hozd létre a user-t a DB-ben
5. Küldj welcome email-t
6. Return:
   {
     success: true,
     token: string, // settings link-hez
     telegram_link: string | null // ha notify_telegram true
   }

Error responses:
- 400: Validation error
- 409: Email already exists
- 500: Server error

Telegram link format:
https://t.me/DealSpyBot?start={token}
```

### Prompt 5.2 - Settings API

```
Készítsd el az app/api/settings/route.ts fájlt:

GET /api/settings?token={token}

Response:
{
  email: string,
  language: string,
  categories: string[],
  countries: string[],
  keywords: string[],
  sources: string[],
  notify_push: boolean,
  notify_email: boolean,
  notify_telegram: boolean,
  telegram_connected: boolean
}

---

PUT /api/settings?token={token}

Request body (minden mező opcionális):
{
  language?: string,
  categories?: string[],
  countries?: string[],
  keywords?: string[],
  sources?: string[],
  notify_push?: boolean,
  notify_email?: boolean,
  notify_telegram?: boolean,
  onesignal_player_id?: string
}

Logika:
1. Validáld a token-t
2. Ha nem létezik: 404
3. Frissítsd a megadott mezőket
4. Return: { success: true }

Error responses:
- 400: Validation error
- 404: User not found
- 500: Server error
```

### Prompt 5.3 - Cron Routes

```
Készítsd el az app/api/cron/scrape/route.ts fájlt:

POST /api/cron/scrape
Headers: Authorization: Bearer {CRON_SECRET} VAGY x-vercel-cron: 1

Logika:
1. Validáld a cron authentikációt
2. Futtasd az összes scraper-t (runAllScrapers)
3. Minden új deal-re:
   a. Ellenőrizd, hogy létezik-e már (source + source_id)
   b. Ha új: fordítsd le (translateDeal)
   c. Kategorizáld (categorizeDeal)
   d. Mentsd a DB-be
4. Return: { 
     success: true, 
     stats: ScraperStats,
     newDeals: number,
     duplicates: number
   }

---

Készítsd el az app/api/cron/notify/route.ts fájlt:

POST /api/cron/notify
Headers: Authorization: Bearer {CRON_SECRET} VAGY x-vercel-cron: 1

Logika:
1. Validáld a cron authentikációt
2. Kérd le az unnotified deal-eket
3. Minden deal-re:
   a. Keresd meg a matching user-eket
   b. Küldj push notification-t (ha enabled)
   c. Küldj Telegram üzenetet (ha enabled)
   d. Jelöld meg a deal-t notified-nak
4. Return: {
     success: true,
     dealsProcessed: number,
     notificationsSent: { push: number, telegram: number }
   }

---

Készítsd el az app/api/cron/digest/route.ts fájlt:

POST /api/cron/digest
Headers: Authorization: Bearer {CRON_SECRET} VAGY x-vercel-cron: 1

Logika:
1. Validáld a cron authentikációt
2. Kérd le az összes user-t ahol notify_email = true
3. Minden user-re:
   a. Keresd meg a mai matching deal-eket
   b. Ha van deal: küldj digest email-t
4. Return: {
     success: true,
     emailsSent: number
   }
```

### Prompt 5.4 - Telegram Webhook

```
Készítsd el az app/api/telegram/webhook/route.ts fájlt:

POST /api/telegram/webhook

Telegram webhook payload feldolgozása.

Logika:
1. Parse-old a Telegram Update objektumot
2. Ha message.text létezik:
   a. /start {token} → linkTelegramToUser
   b. /start → küldj instrukciót
   c. /stop → unlinkTelegram
   d. /help → küldj help-et
   e. Egyéb → küldj "Use /help" választ
3. Return 200 OK (Telegram elvárja)

Fontos: Telegram webhook-nak mindig 200-at kell visszaadni, különben retry-ozik.

Telegram Update típus:
{
  update_id: number,
  message?: {
    message_id: number,
    from: { id: number, first_name: string, ... },
    chat: { id: number, type: string, ... },
    date: number,
    text?: string
  }
}
```

---

## FÁZIS 6: Frontend

### Prompt 6.1 - Layout és i18n

```
Készítsd el az app/layout.tsx fájlt:

1. Root layout Next.js App Router-rel
2. Metadata:
   - title: "DealSpy.eu - EU Insolvency Monitoring"
   - description (3 nyelven)
3. Fonts: Inter (Google Fonts)
4. Tailwind base styles
5. OneSignal SDK script betöltése

---

Készítsd el a lib/i18n/config.ts fájlt:

1. Nyelvek: hu, en, de
2. Default: hu
3. useTranslation hook implementálása
4. getTranslation(key: string, lang: string) függvény

---

Készítsd el a fordítás fájlokat:
- lib/i18n/translations/hu.json
- lib/i18n/translations/en.json
- lib/i18n/translations/de.json

Tartalom:
- common: title, tagline, save, cancel, success, error
- form: email, categories, countries, keywords, channels, submit
- categories: it, machines, vehicles, property
- countries: hu, at, de (zászlóval)
- channels: push, email, telegram (leírásokkal)
- messages: registration_success, settings_saved, unsubscribed
```

### Prompt 6.2 - Registration Form

```
Készítsd el az app/page.tsx fájlt (Landing + Registration):

1. Responsive layout:
   - Mobile: single column
   - Desktop: centered card (max-w-xl)

2. Header:
   - Logo/Title: "🔍 DealSpy.eu"
   - Tagline (nyelv alapján)
   - Language switcher (HU | EN | DE)

3. Registration Form:
   a. Email input (required)
   b. Categories (checkbox group, min 1)
      - IT/Server, Gépek, Járművek, Ingatlan
   c. Countries (checkbox group, min 1)
      - 🇭🇺 HU, 🇦🇹 AT, 🇩🇪 DE
   d. Keywords (text input, comma separated, optional)
   e. Notification channels (checkbox group, min 1)
      - Böngésző push (azonnal)
      - Email (napi 15:00)
      - Telegram (azonnal)
   f. Submit button

4. Form submission:
   - Ha push enabled: kérj OneSignal permission
   - POST /api/register
   - Success: mutass success üzenetet + telegram link (ha kell)
   - Error: mutass error üzenetet

5. Footer:
   - Források listája
   - Impressum link
   - GDPR mention

Használj useState és useForm hook-okat.
Tailwind styling: clean, modern, professional.
```

### Prompt 6.3 - Settings Page

```
Készítsd el az app/settings/page.tsx fájlt:

URL: /settings?token={token}

1. Token validálás:
   - useSearchParams() a token kiolvasásához
   - GET /api/settings?token={token}
   - Ha invalid: mutass error üzenetet

2. Form (pre-filled a jelenlegi beállításokkal):
   - Ugyanaz mint a registration, kivéve:
   - Email mező disabled (nem módosítható)
   - Telegram status megjelenítése (connected/not connected)

3. Save button:
   - PUT /api/settings?token={token}
   - Success: toast notification
   - Error: error message

4. Danger zone:
   - "Leiratkozás" link → /unsubscribe?token={token}

Responsive design, Tailwind styling.
```

### Prompt 6.4 - OneSignal Integration

```
Készítsd el a OneSignal frontend integrációt:

1. public/onesignal/OneSignalSDKWorker.js:
   importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

2. components/OneSignalProvider.tsx:
   - Client component ('use client')
   - useEffect-ben inicializálja a OneSignal SDK-t
   - OneSignal.init({ appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID })

3. lib/onesignal-client.ts:
   
   export async function requestPushPermission(): Promise<boolean>
   - OneSignal.Slidedown.promptPush()
   - Return true ha engedélyezve
   
   export async function getPlayerId(): Promise<string | null>
   - OneSignal.User.PushSubscription.id
   - Return player ID vagy null

4. Integráld a Registration form-ba:
   - Ha notify_push checked és submit:
     1. requestPushPermission()
     2. getPlayerId()
     3. Küldd el a player ID-t a register API-nak
```

---

## FÁZIS 7: Deploy és Konfiguráció

### Prompt 7.1 - Vercel konfiguráció

```
Készítsd el a vercel.json fájlt:

{
  "crons": [
    {
      "path": "/api/cron/scrape",
      "schedule": "30 8,13 * * *"
    },
    {
      "path": "/api/cron/notify",
      "schedule": "0 9,14 * * *"
    },
    {
      "path": "/api/cron/digest",
      "schedule": "0 14 * * *"
    }
  ]
}

Megjegyzés: 
- Az időpontok UTC-ben vannak
- CET = UTC+1, tehát (Hobby: naponta 1x):
  - 08:30 UTC = 09:30 CET (scraping)
  - 09:00 UTC = 10:00 CET (notify)
  - 14:00 UTC = 15:00 CET (digest)

---

Készítsd el a playwright.config.ts fájlt (ha szükséges):

export default {
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    timeout: 60000,
  },
};

---

Készíts README.md fájlt:

# DealSpy.eu

EU Insolvency & Auction Monitoring Platform

## Setup

1. Clone repo
2. npm install
3. Copy .env.example to .env.local
4. Fill in environment variables
5. npm run dev

## Environment Variables

[Lista a szükséges változókról]

## Deployment

1. Push to GitHub
2. Connect to Vercel
3. Set environment variables
4. Deploy

## Cron Jobs (Hobby: once per day)

- Scraping: 09:30 CET
- Notifications: 10:00 CET
- Email Digest: 15:00 CET
```

### Prompt 7.2 - Telegram Bot Setup

```
Telegram bot beállítási útmutató:

1. Bot létrehozása:
   - Nyisd meg: @BotFather a Telegram-on
   - Küldj: /newbot
   - Név: DealSpy
   - Username: DealSpyBot (vagy ami elérhető)
   - Mentsd el a kapott TOKEN-t

2. Webhook beállítása (deploy után):
   
   curl -X POST "https://api.telegram.org/bot{TOKEN}/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://dealspy.eu/api/telegram/webhook"}'

3. Bot parancsok beállítása:
   
   curl -X POST "https://api.telegram.org/bot{TOKEN}/setMyCommands" \
     -H "Content-Type: application/json" \
     -d '{
       "commands": [
         {"command": "start", "description": "Fiók összekapcsolása"},
         {"command": "stop", "description": "Értesítések leállítása"},
         {"command": "help", "description": "Súgó"}
       ]
     }'

4. Bot leírás beállítása (opcionális):
   @BotFather → /setdescription → @DealSpyBot
   "EU csődvagyon és aukció monitoring. Értesítések közvetlenül ide."
```

---

## Tesztelési Promptok

### Prompt T.1 - Scraper tesztelés

```
Írj egy teszt scriptet a scraperek ellenőrzésére:

scripts/test-scrapers.ts

1. Importáld az összes scraper-t
2. Minden scraper-re:
   - Futtasd
   - Logold: source, deal count, sample deal
   - Ellenőrizd: minden deal-nek van title, url, source_id
3. Summary: melyik működik, melyik nem

Futtatás: npx ts-node scripts/test-scrapers.ts
```

### Prompt T.2 - End-to-end teszt

```
Írj egy E2E teszt scriptet:

scripts/test-e2e.ts

1. Regisztrálj egy teszt user-t
2. Futtasd a scraper-eket
3. Futtasd a notification logikát
4. Ellenőrizd, hogy a user kapott-e értesítést (DB check)
5. Töröld a teszt user-t

Futtatás: npx ts-node scripts/test-e2e.ts
```

---

## Hibakeresési Tippek

### Ha a scraper nem működik:
1. Ellenőrizd a target oldal HTML struktúráját (változhatott)
2. Próbáld Playwright-tal headful módban
3. Ellenőrizd a rate limiting-et
4. Nézd meg a console.log outputokat

### Ha a notification nem megy:
1. Ellenőrizd az API key-eket
2. Ellenőrizd a OneSignal player ID-t
3. Ellenőrizd a Telegram chat ID-t
4. Nézd meg a Supabase logokat

### Ha a cron nem fut:
1. Ellenőrizd a vercel.json szintaxist
2. Ellenőrizd a CRON_SECRET-et
3. Nézd meg a Vercel function logokat
