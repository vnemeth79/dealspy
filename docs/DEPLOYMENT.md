# DealSpy.eu – Élesítési checklist

## 1. Adatbázis (Supabase)

1. [Supabase](https://supabase.com) projekt létrehozása.
2. **SQL Editor** → futtasd a `docs/schema.sql` tartalmát (users, deals, notifications, payments + indexek, trigger).
3. **Settings → API**: másold ki az URL-t és a kulcsokat (anon, service_role).

## 2. Környezeti változók

Másold a `.env.local.example`-t `.env.local`-ra (lokál) vagy add meg őket a Vercel **Environment Variables** alatt.

| Változó | Hol szerzed | Megjegyzés |
|--------|-------------|------------|
| `SUPABASE_*` | Supabase → Settings → API | URL + anon + service_role key |
| `ANTHROPIC_API_KEY` | console.anthropic.com | Claude (fordítás, kategória) |
| `NEXT_PUBLIC_ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY` | onesignal.com | Web push |
| `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` | sendgrid.com | Sender domain verifikált legyen |
| `TELEGRAM_BOT_TOKEN` | @BotFather | Bot létrehozása után |
| `STRIPE_*` | dashboard.stripe.com | Live/Test kulcsok, Price ID-k, Webhook secret |
| `NEXT_PUBLIC_APP_URL` | - | Éles: `https://dealspy.eu` |
| `CRON_SECRET` | - | Tetszőleges titkos string (cron védelem) |
## 3. Számlázás

Csak **Stripe** számla: a Stripe automatikusan küldi a számlát a vevőnek e-mailben, és a Stripe Dashboardon (Billing → Invoices) te is letöltheted. Nincs szamlazz.hu integráció.

## 4. Stripe

1. **Products & Prices**: hozz létre árakat (Starter/Pro/Enterprise, havi/éves), másold a Price ID-kat a `STRIPE_PRICE_*` változókba.
2. **Webhooks**: Add hozzá az endpointot:  
   `https://dealspy.eu/api/stripe/webhook`  
   Események: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.  
   A **Signing secret** → `STRIPE_WEBHOOK_SECRET`.

## 5. Telegram

Deploy után állítsd be a webhookot:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://dealspy.eu/api/telegram/webhook"}'
```

## 6. OneSignal

- OneSignal dashboard: **Site URL** = `https://dealspy.eu`.
- **Path to service worker**: a projektben a worker itt van: `/onesignal/OneSignalSDKWorker.js` (public mappa). Ha a dashboard mást vár, állítsd át úgy, hogy ez az útvonal legyen használatban.

## 7. Vercel deploy

1. Repo összekapcsolása (GitHub/GitLab).
2. **Root Directory**: projekt gyökér (ahol a `package.json` van).
3. **Environment Variables**: az összes fenti változó beállítása.
4. Deploy. A `vercel.json` cront automatikusan beállítja a scrape/notify/digest időzítését.

## 8. Tesztelés éles környezetben

- Regisztráció → email → beállítások link → számla (próba vásárlás Stripe test módban).
- Cron: manuálisan hívd meg a cron endpointokat a `CRON_SECRET` headerrel, és nézd a logokat.
- Számla: Stripe **invoice.payment_succeeded** (test) → a Stripe küldi a vevőnek a számlát; a Dashboardon is megtekinthető.

## 9. Domain

- **dealspy.eu** mutasson a Vercel projektre (DNS: A/CNAME a Vercel instrukciói szerint).

---

**Összefoglalva:** Adatbázis (schema.sql) → env → Stripe webhook (számla: csak Stripe) → Telegram webhook → OneSignal → Vercel deploy → teszt és domain.
