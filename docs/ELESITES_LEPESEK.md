# DealSpy élesítés – lépésről lépésre

Egyetlen, sorrendben követett út. A domain és a környezeti változók **miért** kellenek és **hol** állítod be.

---

## Fázis 1: Saját domain a Vercelben

Ha van foglalt domain (pl. dealspy.eu), így adod hozzá:

1. **Vercel** → a projekted (pl. dealspy-fqbw) → **Settings** → bal oldalon **Domains**.
2. **Add** (vagy „Add domain”) → beírod a domain nevet, pl. `dealspy.eu`.
3. A Vercel megmondja, mit állíts be a **DNS**-nél:
   - Általában egy **A** rekord: `76.76.21.21` (vagy amit a Vercel mutat),
   - VAGY egy **CNAME** rekord: `cname.vercel-dns.com` (vagy a Vercel által megadott cél).
4. A **domain szolgáltatónál** (ahol a dealspy.eu regisztrálva van – pl. Gransy, Cloudflare, GoDaddy):
   - Nyisd meg a DNS / névszerver beállításokat.
   - Add hozzá a Vercel által kért rekordot (A vagy CNAME).
   - Ha a Vercel „www” változatot is kéri (pl. www.dealspy.eu), add hozzá azt is, ahogy írja.
5. Várj **5–30 percet** (néha több). A Vercel **Domains** oldalon jelezni fogja, ha érvényes a domain (**Verified**).
6. Ha kész: a **NEXT_PUBLIC_APP_URL** környezeti változót állítsd erre: `https://dealspy.eu` (és ha használod a www-ot: a fő domain legyen az, amit az app használ).

**Fontos:** A domain nélkül is működik az app a `https://dealspy-fqbw.vercel.app` címen. A saját domain csak a szép URL és a branding miatt kell.

---

## Fázis 2: Kötelező dolgok (működéshez kell)

Ezek nélkül az app nem tud regisztrálni, fizetni, értesítést küldeni.

| Mi | Hol | Környezeti változók |
|----|-----|----------------------|
| **Adatbázis** | Supabase (már használod) | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Fizetés** | Stripe (már használod) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` (6 db) |
| **App URL** | Vercel | `NEXT_PUBLIC_APP_URL` = `https://dealspy.eu` vagy `https://dealspy-fqbw.vercel.app` |
| **Cron védelem** | Te generálod | `CRON_SECRET` = egy hosszú véletlen string (pl. jelszógenerátor) |
| **Admin e-mail** | A te címed | `ADMIN_EMAIL` – ide jönnek a rendszer értesítések (scraper hiba, fizetés, stb.) |
| **E-mail küldés** | SendGrid **vagy** Resend (lásd Fázis 4) | SendGrid: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` **VAGY** Resend: `RESEND_API_KEY`, `FROM_EMAIL` |
| **Push értesítés** | OneSignal | `NEXT_PUBLIC_ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY` |
| **AI (fordítás, kategória, fallback)** | Anthropic | `ANTHROPIC_API_KEY` |

A **Stripe webhook** URL-je: `https://<NEXT_PUBLIC_APP_URL domain>/api/stripe/webhook`  
Pl. domain után: `https://dealspy.eu/api/stripe/webhook`.

---

## Fázis 3: Opcionális – Telegram

**Mi a Telegram bot?**  
Egy **opcionális** értesítési csatorna: a felhasználók beállíthatják, hogy deal alerteket Telegram üzenetben is kapjanak (a push és e-mail mellett). Ha **nem** adod meg a `TELEGRAM_BOT_TOKEN`-t, az app ugyanúgy fut: csak a „Telegram” opció nem lesz elérhető a beállításokban, a többi (e-mail, push) működik.

**Ha használni akarod:**
- Telegram → @BotFather → `/newbot` → kapod a tokent.
- Vercel env: `TELEGRAM_BOT_TOKEN` = a token.
- Deploy után a webhook beállítása:  
  `POST https://api.telegram.org/bot<TOKEN>/setWebhook`  
  body: `{"url": "https://dealspy.eu/api/telegram/webhook"}`  
  (cURL-lal vagy Postman-nel.)

**Ha nem kell:** ne add hozzá a `TELEGRAM_BOT_TOKEN`-t, hagyd üresen. A health endpoint „not configured”-ot mutat a Telegramnál, ez rendben van.

---

## Fázis 4: E-mail – SendGrid vagy Resend

Az appnak **valamilyen** e-mail szolgáltató kell: üdvözlő e-mail, digest, admin értesítések, fizetés/számla e-mail.

### A) SendGrid (eredeti)

- Regisztráció: [sendgrid.com](https://sendgrid.com).
- API Key + verifikált feladó domain/cím.
- Env: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`.

### B) Resend (alternatíva, egyszerűbb)

- Regisztráció: [resend.com](https://resend.com).
- API Key + domain vagy their sending domain.
- Env: `RESEND_API_KEY`, `FROM_EMAIL` (pl. `onboarding@resend.dev` teszthez, vagy saját domain).

A kód **mindkettőt** támogatja: ha megvan a `RESEND_API_KEY`, a Resend-et használja; ha nincs, de van `SENDGRID_API_KEY`, akkor a SendGrid-et. **Egyik elég.**

---

## Fázis 5: Környezeti változók összesen (egy helyen)

Vercel → Project → **Settings** → **Environment Variables**. Production (és ha akarod, Preview) kijelölve.

**Kötelező:**

- `NEXT_PUBLIC_APP_URL` – végén perjel nélkül (pl. `https://dealspy.eu`)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER_MONTHLY`, `STRIPE_PRICE_STARTER_YEARLY`
- `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`
- `STRIPE_PRICE_ENTERPRISE_MONTHLY`, `STRIPE_PRICE_ENTERPRISE_YEARLY`
- **E-mail (egyik):**  
  - SendGrid: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`  
  - VAGY Resend: `RESEND_API_KEY`, `FROM_EMAIL`
- `ADMIN_EMAIL`
- `NEXT_PUBLIC_ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY`
- `ANTHROPIC_API_KEY`
- `CRON_SECRET`

**Opcionális:**

- `TELEGRAM_BOT_TOKEN` – csak ha a Telegram értesítési csatornát is használod
- `ENABLE_AI_SCRAPER_FALLBACK` – `1` vagy üres = be, `0` = ki

---

## Rövid sorrend (teendők)

1. **Domain (ha van):** Vercel → Settings → Domains → Add → DNS beállítás a domain szolgáltatónál → NEXT_PUBLIC_APP_URL frissítése.
2. **Környezeti változók:** Fázis 5 szerint minden kötelező (Supabase, Stripe, e-mail *vagy* Resend, OneSignal, Anthropic, CRON_SECRET, ADMIN_EMAIL).
3. **Stripe webhook:** URL = `https://<te-domained>/api/stripe/webhook`, események: checkout.session.completed, customer.subscription.*, invoice.payment_succeeded, invoice.payment_failed.
4. **Telegram (opcionális):** Bot + token + setWebhook, ha szeretnéd a Telegram csatornát.
5. **OneSignal:** Dashboardon a Site URL = NEXT_PUBLIC_APP_URL.

Ha ezt a sorrendet követed, nem kell „bohóckodni”: először domain (vagy Vercel URL), aztán env, végül webhookok a végleges URL-lel.
