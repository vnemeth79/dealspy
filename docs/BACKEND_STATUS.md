# Backend és háttérszolgáltatások – állapot

A projekt ezekre a háttérszolgáltatásokra épül. A **kód és a séma készen van**; a tényleges **fiókokat és környezeti változókat neked kell létrehozni/beállítani**.

---

## Jelenlegi állapot (health API alapján)

Ha fut a dev szerver, az `GET /api/health` visszaadja, mi van beállítva:

| Szolgáltatás    | Kell | Jelenlegi állapot |
|-----------------|------|-------------------|
| **Supabase**    | Igen | ⚠️ Ha „error”: nincs projekt, vagy rossz URL/kulcs a `.env`-ben |
| **Stripe**      | Igen | ✅ Ha „configured”: `STRIPE_SECRET_KEY` be van állítva |
| **Anthropic**   | Igen | ⚠️ Fordítás + kategória AI-hoz |
| **SendGrid**    | Igen | ⚠️ Üdvözlő email, digest, admin alert |
| **OneSignal**   | Igen | ⚠️ Web push értesítések |
| **Telegram**    | Igen | ⚠️ Bot + webhook (deploy után) |
| **Szamlazz.hu** | Igen | ⚠️ Progile Kft számlázás (Stripe fizetés után) |

---

## Mit kell beállítanod (rövid checklist)

### 1. Supabase (adatbázis)

- [ ] [supabase.com](https://supabase.com) → új projekt.
- [ ] **SQL Editor** → bemásolod és lefuttatod a **`docs/schema.sql`** teljes tartalmát (users, deals, notifications, payments, indexek, trigger).
- [ ] **Settings → API** → kimásolod: **Project URL**, **anon key**, **service_role key**.
- [ ] Ezeket beírod a `.env` / `.env.local` / Vercel env-be:
  - `SUPABASE_URL=`
  - `SUPABASE_ANON_KEY=`
  - `SUPABASE_SERVICE_ROLE_KEY=`

**Nélküle:** regisztráció, beállítások, értesítések, digest nem működnek (DB hiba).

---

### 2. Környezeti változók (összesen)

Másold a **`.env.local.example`**-t **`.env.local`**-ra (vagy használd a meglévő `.env`-t), és töltsd ki a valódi értékekkel. Ugyanezek kellenek a **Vercel → Environment Variables**-ba is éleshez.

- **Supabase:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Stripe:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` (lásd `docs/STRIPE_SETUP.md`)
- **Anthropic:** `ANTHROPIC_API_KEY` (Claude – fordítás, kategória)
- **SendGrid:** `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`
- **OneSignal:** `NEXT_PUBLIC_ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY`
- **Telegram:** `TELEGRAM_BOT_TOKEN`
- **App:** `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`
- **Szamlazz:** `SZAMLazz_AGENT_KEY`, `SZAMLazz_SELLER_*`, `EUR_TO_HUF`
- **Admin:** `ADMIN_EMAIL`

---

### 3. Stripe

- Árak (Products & Prices) + **Price ID**-k a `.env`-be (lásd **`docs/STRIPE_SETUP.md`**).
- Webhook: **Developers → Webhooks** → endpoint `https://dealspy.eu/api/stripe/webhook` (éles), események: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_succeeded`, `invoice.payment_failed` → **Signing secret** → `STRIPE_WEBHOOK_SECRET`.

---

### 4. Szamlazz.hu (Progile Tanácsadó Kft)

- Bejelentkezés szamlazz.hu-n → **Agent (API) kulcs** → `SZAMLazz_AGENT_KEY`.
- Eladó adatok (név, adószám, cím, bankszámla) → `SZAMLazz_SELLER_*` (részletek: **`docs/DEPLOYMENT.md`**).

---

### 5. Telegram (deploy után)

- Bot a @BotFather-tól → `TELEGRAM_BOT_TOKEN`.
- Webhook beállítás:  
  `POST https://api.telegram.org/bot<TOKEN>/setWebhook` body: `{"url": "https://dealspy.eu/api/telegram/webhook"}`.

---

### 6. OneSignal

- OneSignal projekt → **Site URL** = éles domain, **App ID** + **API key** → `NEXT_PUBLIC_ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY`.

---

## Összefoglalva

| Mi van kész a kódban/sémában | Mi nincs automatikusan beállítva |
|------------------------------|-----------------------------------|
| Supabase séma (`docs/schema.sql`) | Supabase projekt + URL és kulcsok a `.env`-ben |
| Stripe Checkout, webhook, Billing Portal | Stripe fiók, árak, webhook URL, signing secret |
| Szamlazz integráció (lib/szamlazz.ts) | Szamlazz fiók + Agent key + eladó adatok |
| SendGrid küldés (email.ts) | SendGrid API key + from email |
| OneSignal provider (frontend) | OneSignal App ID + API key |
| Telegram webhook API | Telegram bot token + setWebhook hívás |
| Cron (scrape, notify, digest) | Vercel Cron + `CRON_SECRET` |

**Tehát:** a backend és háttér **logika és konfigurációs sablon** mind be van építve; a **tényleges fiókok és környezeti változók** a te feladatod. A `/api/health` mindig megmondja, melyik szolgáltatás van éppen „configured” / „ok” vagy „error” / „not configured”.
