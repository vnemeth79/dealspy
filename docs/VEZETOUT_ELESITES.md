# Vezetőút – élesítés lépésről lépésre

**Becsült idő:**  
- Ha már van Supabase / Stripe / SendGrid stb. fiókod: **kb. 1–1,5 óra**.  
- Ha mindent most hozol létre: **kb. 2–3 óra** (domain propagálás nélkül).

Kezdd a **1. lépéssel**, és haladj sorban. Ha valahol elakadsz, a hibaüzenetre keress rá, vagy írd le, mit látsz.

---

## 0. Előkészület (2 perc)

- Nyisd meg egy böngésző tabban: **Vercel** → a DealSpy projekt → **Settings** → **Environment Variables**.
- Tartsd nyitva a projekt **`docs/`** mappáját (schema.sql, migrations).
- Generálj egy titkos stringet a CRON_SECRET-hez: pl. [randomkeygen.com](https://randomkeygen.com) (CodeIgniter Encryption Keys) vagy terminál: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` → ezt később bemásolod.

---

## 1. Supabase – adatbázis (kb. 10–15 perc)

### 1.1 Projekt

1. Menj a [supabase.com](https://supabase.com) → bejelentkezés.
2. **New project** (vagy válaszd a meglévőt).
3. **Name:** pl. `dealspy`. **Database password** – generálj egyet, mentsd el (később nem kell, ha nem kérdezi).
4. **Region:** válassz közeli (pl. Frankfurt). **Create project**.

### 1.2 Séma futtatása

1. Bal oldalt: **SQL Editor**.
2. **New query**.
3. Nyisd meg a projektben a **`docs/schema.sql`** fájlt, másold ki **az egész** tartalmát (Ctrl+A, Ctrl+C).
4. Illeszd be a Supabase SQL Editorba (Ctrl+V).
5. Kattints **Run** (vagy Ctrl+Enter).
6. Ha nincs piros hiba, kész. Ha azt írja, hogy a táblák már léteznek, az oké; akkor nyiss egy **új query**-t, nyisd meg a **`docs/migrations/002_billing_address.sql`**-t, másold be, **Run**. Ez hozzáadja a céges számlázási oszlopokat.

### 1.3 Kulcsok másolása

1. Bal oldalt: **Settings** (fogaskerék) → **API**.
2. Másold ki:
   - **Project URL** (pl. `https://xxxx.supabase.co`)
   - **anon public** (hosszú JWT) → ez lesz az **anon key**
   - **service_role** („secret”, hosszú JWT) → ez lesz a **service_role key**

### 1.4 Vercel env

1. Vercel → **Settings** → **Environment Variables**.
2. Add hozzá (Production):
   - **Name:** `SUPABASE_URL` → **Value:** a Project URL.
   - **Name:** `SUPABASE_ANON_KEY` → **Value:** az anon public key.
   - **Name:** `SUPABASE_SERVICE_ROLE_KEY` → **Value:** a service_role key.
3. **Save**.

---

## 2. Stripe – fizetés (kb. 15–20 perc)

### 2.1 Termékek és árak

1. [dashboard.stripe.com](https://dashboard.stripe.com) → bejelentkezés.
2. Kapcsold **Test mode**-ot (felső kapcsoló), amíg tesztelsz; élesben kapcsold **Live**-ra.
3. **Products** → **Add product**.
   - **Name:** Starter. **Price:** 19 EUR, **Billing period:** Monthly. **Save**. Másold ki a **Price ID**-t (pl. `price_xxx`) → ez a **STRIPE_PRICE_STARTER_MONTHLY**.
   - Ugyanebben a termékben: **Add another price** → 15 EUR, **Yearly** (ha éves összeg, írd be 180 EUR-t, vagy 15/month). Másold ki → **STRIPE_PRICE_STARTER_YEARLY**.
4. **Add product** – Pro: 49 / hó, 39 / hó évesen (vagy 468 EUR éves). Price ID-k → **STRIPE_PRICE_PRO_MONTHLY**, **STRIPE_PRICE_PRO_YEARLY**.
5. **Add product** – Enterprise: 149 / hó, 119 / hó évesen. Price ID-k → **STRIPE_PRICE_ENTERPRISE_MONTHLY**, **STRIPE_PRICE_ENTERPRISE_YEARLY**.

### 2.2 API kulcsok

1. **Developers** → **API keys**.
2. **Publishable key** (pk_…) → **STRIPE_PUBLISHABLE_KEY**.
3. **Secret key** (sk_…) → **STRIPE_SECRET_KEY**.

### 2.3 Vercel env – Stripe

Add hozzá a Vercel-en (Production):

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_STARTER_MONTHLY`
- `STRIPE_PRICE_STARTER_YEARLY`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_YEARLY`
- `STRIPE_PRICE_ENTERPRISE_MONTHLY`
- `STRIPE_PRICE_ENTERPRISE_YEARLY`

A **STRIPE_WEBHOOK_SECRET**-et a 2.4 után tudod betenni (webhook létrehozásakor adja a Stripe).

### 2.4 Webhook (domain után is megcsinálhatod)

1. **Developers** → **Webhooks** → **Add endpoint**.
2. **Endpoint URL:** `https://dealspy.eu/api/stripe/webhook`  
   (Ha még nincs domain: előbb deploy + domain (8. lépés), majd vissza ide, vagy ideiglenes URL: `https://dealspy-eu.vercel.app/api/stripe/webhook` – később átírod.)
3. **Select events:**  
   `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.
4. **Add endpoint**.
5. Kattints a létrejött endpointra → **Signing secret** → **Reveal** → másold ki → Vercel env: `STRIPE_WEBHOOK_SECRET`.

---

## 3. Anthropic – AI (kb. 5 perc)

1. [console.anthropic.com](https://console.anthropic.com) → bejelentkezés / regisztráció.
2. **API Keys** → **Create Key** → másold ki.
3. Vercel env: **Name** `ANTHROPIC_API_KEY`, **Value** a kulcs.

---

## 4. SendGrid – e-mail (kb. 10–15 perc) – ha nincs még fiókod

SendGrid nélkül nem megy a üdvözlő e-mail, digest és admin értesítés; ehhez kell egy SendGrid fiók.

### 4.1 Regisztráció

1. Nyisd meg: [sendgrid.com](https://sendgrid.com).
2. **Start for free** / **Sign Up** – e-mail, jelszó (vagy Google).
3. Erősítsd meg az e-mailt, ha kéri. A **Free** csomag (100 e-mail/nap) elég induláshoz.

### 4.2 Küldő cím verifikálása (egyszerű megoldás: Single Sender)

1. Bal oldalt: **Settings** (fogaskerék) → **Sender Authentication**.
2. **Single Sender Verification** → **Create New Sender** (gyorsabb, mint domain verifikálás).
3. Töltsd ki:
   - **From Name:** pl. `DealSpy` vagy `DealSpy Alert`
   - **From Email Address:** egy olyan e-mail, amit te használsz és eléred (pl. `alerts@dealspy.eu` vagy a saját Gmail címed, pl. `te@gmail.com`)
   - **Reply To:** ugyanaz vagy más cím
   - **Company address** stb. (kötelező mezők) – töltsd ki.
4. **Create**. SendGrid küld egy **verifikációs e-mailt** a From Email címre – nyisd meg, kattints a linkre. Ha nem jön: **Settings → Sender Authentication → Single Sender** → a sor mellett **Resend verification**.
5. Ha megvan a pipa (Verified), jegyezd meg ezt a címet → ez lesz a **SENDGRID_FROM_EMAIL**.

*(Opcionális, később: ha a saját domainről akarsz küldeni, pl. `alerts@dealspy.eu`, akkor **Authenticate Your Domain** – DNS rekordokat kell hozzáadni a domainhez. Single Senderrel is működik az app, a from cím lehet pl. egy Gmail vagy a SendGrid által megjelenített cím.)*

### 4.3 API kulcs

1. **Settings** → **API Keys**.
2. **Create API Key**.
3. **Name:** pl. `DealSpy`. **Permissions:** **Restricted Access** → kapcsold be **Mail Send** → **Full Access** (vagy csak **Mail Send → Full**).
4. **Create & View** → másold ki a kulcsot (egyszer mutatja; ha elveszted, új kulcsot kell csinálni).

### 4.4 Vercel env

1. Vercel → **Environment Variables** (Production).
2. **Add:**
   - **Name:** `SENDGRID_API_KEY` → **Value:** a másolt API kulcs.
   - **Name:** `SENDGRID_FROM_EMAIL` → **Value:** pontosan az a cím, amit a Single Sender-nél megadtál és ellenőrizted (pl. `alerts@dealspy.eu` vagy `te@gmail.com`).
3. **Save**, majd **Redeploy** a projektet, hogy az új env érvénybe lépjen.

---

## 5. OneSignal – push (kb. 10 perc)

1. [onesignal.com](https://onesignal.com) → bejelentkezés.
2. **New App/Website** → **Web** (Chrome, Firefox…).
3. **Site URL:** `https://dealspy.eu` (vagy a Vercel URL deploy után).
4. **Name:** DealSpy. Folytasd a wizardot.
5. **Settings** → **Keys & IDs**: másold ki **OneSignal App ID** és **REST API Key** (legyen „Key”).
6. Vercel env: `NEXT_PUBLIC_ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY`.

---

## 6. Telegram (opcionális, kb. 5 perc)

1. Telegramban nyisd a [@BotFather](https://t.me/BotFather) → `/newbot` → nevezd el a botot (pl. DealSpyBot).
2. Másold ki a kapott tokent.
3. Vercel env: `TELEGRAM_BOT_TOKEN`.  
A webhookot (7. lépés után) deploy után állítod be a KOVETKEZO_LEPESEK.md 6. pontja szerint.

---

## 7. App + admin + cron (kb. 5 perc)

Vercel Environment Variables – add ezeket (Production):

- **`NEXT_PUBLIC_APP_URL`** = `https://dealspy.eu` (vagy a Vercel default URL, pl. `https://dealspy-eu.vercel.app`, amíg nincs domain)
- **`ADMIN_EMAIL`** = a saját e-mail címed (ide jönnek a scraper / AI fallback értesítések)
- **`CRON_SECRET`** = a 0. lépésben generált hosszú véletlen string

A számlázás csak Stripe-on keresztül történik: a Stripe küldi a számlát a vevőnek e-mailben, és a Stripe Dashboardon te is megkapod.

---

## 8. Deploy + domain (kb. 10–20 perc)

### 8.1 Deploy

1. Vercel → a projekt **Deployments**.
2. Ha a repo össze van kötve: **Redeploy** (vagy push a main-re); ha még nincs: **Import Project** → GitHub repo → Connect.
3. Várd meg, amíg a deploy zöld. **Visit** → megnyílik az app (pl. `https://dealspy-eu.vercel.app`).

### 8.2 Domain (dealspy.eu)

1. Vercel → **Settings** → **Domains** → **Add** → írd be: `dealspy.eu`.
2. A Vercel megmondja, mit állíts be a domain szolgáltatónál (DNS):  
   - általában egy **A** record vagy **CNAME** (pl. `cname.vercel-dns.com` vagy konkrét IP).
3. A domain regisztrátornál (ahol a dealspy.eu van) állítsd be a DNS rekordot.
4. Várj 5–30 perc (néha több) propagálásra. A Vercel majd jelzi, ha aktív a domain.

### 8.3 Webhook és URL frissítés

- Ha a Stripe webhookot ideiglenes URL-re állítottad: **Stripe** → **Webhooks** → szerkeszd az endpointot → URL: `https://dealspy.eu/api/stripe/webhook`.
- Ha az **NEXT_PUBLIC_APP_URL** és az **OneSignal Site URL** még nem a dealspy.eu volt: frissítsd őket `https://dealspy.eu`-ra, majd **Redeploy** (Vercel), és OneSignal dashboardon a Site URL-t is.

---

## 9. Ellenőrzés (kb. 10 perc)

1. **Health:** böngészőben nyisd meg: `https://dealspy.eu/api/health`.  
   Várható: `database: "ok"`, `anthropic: "configured"`, `stripe: "configured"`, `sendgrid: "configured"`, `onesignal: "configured"`, `telegram: "configured"`. Ha valami „not configured”, azt a változót ellenőrizd a Vercel env-ben.

2. **Regisztráció:** menj a főoldalra → Regisztráció → email, jelszó, kategória, ország, stb. → Regisztráció.  
   - E-mailben meg kell érkezzen a beállítások link (ha SendGrid ok).  
   - Beállítások linkre kattintva be kell tudnod lépni.

3. **Cron (kézi):** terminálban (a CRON_SECRET-et használd):  
   `curl -X POST "https://dealspy.eu/api/cron/scrape" -H "Authorization: Bearer IDE_A_CRON_SECRET"`  
   Válaszban legyen `"success": true`, `stats.bySource` számokkal; ha `stats.errors` nem üres, azt a konzolban / logban nézd.

4. **Fizetés:** regisztráció után kattints a „Fizetés megadása” (vagy hasonló) linkre → Stripe Checkout → add meg a teszt kártyát (pl. 4242…). Sikeres fizetés után a Stripe számla és a Billing Portal link működnie kell.

5. **Admin e-mail:** ha van módod, generálj egy szándékos hibát (pl. egy scraper URL-t átírva), futtasd a cron-t; az **ADMIN_EMAIL**-re érkezzen egy értesítés.

---

## Ha valami nem működik

- **Health** piros / „error”: nézd meg a Vercel **Functions** logját (Runtime Logs), és a megfelelő env változót.
- **Nincs e-mail:** SendGrid → Activity → nézd, van-e bounce / block; a from domain/sender legyen verifikált.
- **Stripe webhook sikertelen:** Stripe → Webhooks → a végpont → **Recent deliveries** → kattints egy sikertelenre, nézd a válasz szövegét; általában 500 = backend hiba (Vercel log).
- **Cron nem fut:** Vercel Crons csak akkor fut, ha a projekt **Pro** (fizetős) terven van; vagy hívd kézzel a curl-lal, amíg nincs Pro.

---

**Idő összesen (becsült):**  
- Első alkalom, mindent létrehozva: **2–3 óra**.  
- Ha már minden fiók és domain megvan, csak env + webhook + ellenőrzés: **kb. 1 óra**.

Ha egy konkrét lépésnél elakadsz (pl. „a Stripe nem ad Price ID-t” vagy „a Supabase SQL hibát dob”), írd le pontosan a lépést és a hibaüzenetet, és onnan tudunk lépésről lépésre továbbmenni.
