# Következő lépések – hibátlan élesítés felé

Ezt a listát sorban vedd végig. Ha minden pipálva van, az app élesen fut.

---

## 1. Supabase (adatbázis)

1. [ ] Nyisd meg a [Supabase](https://supabase.com) → **New project** (vagy használd a meglévőt).
2. [ ] **SQL Editor** → másold be és futtasd a **`docs/schema.sql`** teljes tartalmát.  
   - Ha a `users` tábla már létezett: futtasd utána a **`docs/migrations/002_billing_address.sql`**-t is.
3. [ ] **Settings → API** → másold ki: **Project URL**, **anon key**, **service_role key**.
4. [ ] Ezeket tedd be a **Vercel → Project → Settings → Environment Variables**-ba (Production):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

---

## 2. Stripe

1. [ ] [Stripe Dashboard](https://dashboard.stripe.com) → **Products** → hozz létre 3 terméket (Starter, Pro, Enterprise), mindegyikhez **havi** és **éves** árat. Másold ki a **Price ID**-kat.
2. [ ] **Environment Variables** (Vercel):
   - `STRIPE_SECRET_KEY` (live vagy test)
   - `STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_PRICE_STARTER_MONTHLY`, `STRIPE_PRICE_STARTER_YEARLY`
   - `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`
   - `STRIPE_PRICE_ENTERPRISE_MONTHLY`, `STRIPE_PRICE_ENTERPRISE_YEARLY`
3. [ ] **Developers → Webhooks** → **Add endpoint**:
   - URL: `https://dealspy.eu/api/stripe/webhook` (ha még nincs domain, előbb lépj a 7. pontra)
   - Események: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
   - Másold ki a **Signing secret**-et → `STRIPE_WEBHOOK_SECRET`

---

## 3. Anthropic (AI)

1. [ ] [Anthropic Console](https://console.anthropic.com) → API key létrehozása.
2. [ ] Vercel env: `ANTHROPIC_API_KEY`

---

## 4. E-mail (Resend vagy SendGrid)

1. [ ] **Resend** (ajánlott): [resend.com](https://resend.com) → API key, domain verify → Vercel env: `RESEND_API_KEY`, `FROM_EMAIL`
2. [ ] **Vagy SendGrid:** API key, sender (domain verifikált) → Vercel env: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`

---

## 5. OneSignal (push)

1. [ ] [OneSignal](https://onesignal.com) → új app (Web), **Site URL**: `https://dealspy.eu`.
2. [ ] Másold ki az **App ID** és az **API Key** (Settings → Keys & IDs).
3. [ ] Vercel env: `NEXT_PUBLIC_ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY`

---

## 6. Telegram (opcionális)

1. [ ] [@BotFather](https://t.me/BotFather) → új bot → token.
2. [ ] Vercel env: `TELEGRAM_BOT_TOKEN`
3. [ ] **Deploy után** (amikor már fut a dealspy.eu):  
   `curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" -H "Content-Type: application/json" -d '{"url":"https://dealspy.eu/api/telegram/webhook"}'`

---

## 7. App + admin + cron

1. [ ] Vercel env:
   - `NEXT_PUBLIC_APP_URL` = `https://dealspy.eu` (vagy a Vercel preview URL deploy teszthez)
   - `ADMIN_EMAIL` = a te e-mail címed (scraper hibák, AI fallback értesítések)
   - `CRON_SECRET` = egy hosszú, véletlen string (pl. jelszógenerátor)
2. Számla: csak Stripe – a vevő és te is a Stripe számlát kapod (e-mail + Dashboard).

---

## 8. Deploy + domain

1. [ ] Repo összekapcsolása Vercel-lel (ha még nincs), deploy.
2. [ ] **Domain:** dealspy.eu → Vercel projekt (DNS: A record vagy CNAME a Vercel instrukciói szerint).
3. [ ] Ha a Stripe webhookot még localhostra / preview URL-re állítottad: frissítsd éles URL-re (`https://dealspy.eu/api/stripe/webhook`).

---

## 9. Ellenőrzés

1. [ ] **Health:** nyisd meg `https://dealspy.eu/api/health` → minden szolgáltatás „ok” vagy „configured”.
2. [ ] **Regisztráció:** új fiók, bejelentkezés, beállítások link az e-mailből.
3. [ ] **Cron (kézi):**  
   `curl -X POST "https://dealspy.eu/api/cron/scrape" -H "Authorization: Bearer <CRON_SECRET>"`  
   → válaszban `stats.bySource`, nincs `errors`.
4. [ ] **Fizetés:** regisztráció → válaszd a fizetést → Stripe Checkout → sikeres fizetés után a Billing Portal és a Stripe számla működik.
5. [ ] **Admin e-mail:** ha tesztből hibát generálsz (pl. rossz scraper), az `ADMIN_EMAIL`-re érkezzen az értesítés.

---

**Összefoglalva:** Kezdd a Supabase-pel és a Stripe-pal, töltsd ki a Vercel env-et, deployolj, állítsd be a domaint és a webhookot, végül futtasd le a 9. pont ellenőrzéseit. Ha ezek rendben vannak, az élesítés kész.
