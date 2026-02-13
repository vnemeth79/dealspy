# Éles üzem – állapot és hiányzó lépések

## Mi kész a kódban

| Terület | Állapot |
|--------|--------|
| **Adatbázis** | `docs/schema.sql` – users, deals, notifications, payments, indexek, trigger |
| **Auth** | Regisztráció, bejelentkezés, token, jelszó hash |
| **Stripe** | Checkout, Billing Portal, webhook (subscription + invoice), 3 napos próba |
| **Számlázás** | Szamlazz.hu integráció (Progile Kft) – invoice.payment_succeeded után |
| **Scraperek** | 6 forrás (EER, NetBid, Ediktsdatei, Insolvenz, Proventura, Machineseeker), fetch-alapú, AI fallback minden portálon |
| **Cron** | scrape 08:30 UTC, notify 09:00 UTC, digest 14:00 UTC (naponta 1x, Hobby) – `vercel.json` |
| **Értesítések** | Email (SendGrid), Push (OneSignal), Telegram; digest, admin alert (scraper hiba + AI fallback) |
| **Fordítás / kategória** | Anthropic Claude (cím, leírás, kategória) |
| **Frontend** | Landing (hu/en/de), regisztráció, beállítások, árazás, FAQ; AI marketing szöveg |
| **Health** | `GET /api/health` – DB, Anthropic, Stripe, SendGrid, OneSignal, Telegram konfig állapota |

---

## Mi kell a hibátlan éleshez (teendők)

### 1. Külső fiókok és kulcsok

- [ ] **Supabase** – projekt, majd `docs/schema.sql` lefuttatása; URL + anon + service_role key → `SUPABASE_*`
- [ ] **Stripe** – Products/Prices (Starter, Pro, Enterprise, havi/éves), Price ID-k → `STRIPE_PRICE_*`; live kulcsok + `STRIPE_WEBHOOK_SECRET`
- [ ] **Stripe webhook** – endpoint: `https://dealspy.eu/api/stripe/webhook`, események: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
- [ ] **Anthropic** – `ANTHROPIC_API_KEY` (fordítás, kategória, scraper AI fallback)
- [ ] **SendGrid** – API key, from email (domain verifikált) → `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`
- [ ] **OneSignal** – App ID + API key, Site URL = éles domain → `NEXT_PUBLIC_ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY`
- [ ] **Telegram** – Bot (@BotFather) → `TELEGRAM_BOT_TOKEN`; deploy után webhook: `POST setWebhook` → `https://dealspy.eu/api/telegram/webhook`
- [ ] **Szamlazz.hu** – Progile Tanácsadó Kft, Agent key + eladó adatok → `SZAMLazz_AGENT_KEY`, `SZAMLazz_SELLER_*`, `EUR_TO_HUF`

- [ ] **Supabase migráció:** Ha a `users` tábla már létezik, futtasd a **`docs/migrations/002_billing_address.sql`**-t (céges számlázási mezők).

### 2. Környezeti változók (Vercel + lokál teszt)

Az összes változó a `.env.local.example`-ban felsorolva. Éleshez mindegyik **valódi értékkel** kell legyen a Vercel **Environment Variables**-nál (Production). Különösen:

- `ADMIN_EMAIL` – ide érkeznek a scraper hibák és az AI fallback értesítések
- `CRON_SECRET` – erős, egyedi string (cron védelem)
- `NEXT_PUBLIC_APP_URL` – éles: `https://dealspy.eu`

### 3. Egyéni beállítások (egyszer)

- [ ] **Domain** – dealspy.eu → Vercel projekt (DNS: A/CNAME)
- [ ] **OneSignal** – Path to service worker: `/onesignal/OneSignalSDKWorker.js` (public mappában van)

---

## Ellenőrzés éles előtt / után

1. **Health:** `GET https://dealspy.eu/api/health` – minden szolgáltatás „ok” vagy „configured”.
2. **Regisztráció:** új user → email megerősítés (ha van) → bejelentkezés.
3. **Cron (kézi):**  
   `curl -X POST "https://dealspy.eu/api/cron/scrape" -H "Authorization: Bearer <CRON_SECRET>"`  
   Válasz: `stats.bySource`, `stats.errors`, `stats.aiFallbackSources`; logokban deal számok.
4. **Fizetés (Stripe test/live):** reg → válassz csomagot → Checkout → sikeres fizetés után Billing Portal, majd Szamlazz számla (ha be van állítva).
5. **Admin e-mail:** ha egy scraper hibázik vagy AI fallback történik, az `ADMIN_EMAIL`-re kell kapjon értesítést.

---

## Összefoglalva

- **Kód és séma:** készen állnak az éles üzemre (scraperek, AI fallback, admin alert, cron, Stripe, Szamlazz, értesítések).
- **Hiányzik:** csak a **külső fiókok**, a **környezeti változók kitöltése** (Vercel + lokál), a **webhook/domain/OneSignal** egyszeri beállítása. Ha ezek megvannak, az app hibátlan éles üzemre alkalmas.
