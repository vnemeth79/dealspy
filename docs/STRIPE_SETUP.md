# Stripe beállítás – hol mire kell az adat

Az alábbi értékeket add meg a **Stripe Dashboard** (dashboard.stripe.com) alapján. Lokálban a `.env.local`-ba, élesben a **Vercel → Project → Settings → Environment Variables**-ba.

---

## 1. API kulcsok

**Stripe Dashboard → Developers → API keys**

| Env változó | Hol másold | Megjegyzés |
|-------------|------------|------------|
| `STRIPE_SECRET_KEY` | **Secret key** (sk_live_… vagy sk_test_…) | Soha ne commitold, csak env-ben |
| `STRIPE_PUBLISHABLE_KEY` | **Publishable key** (pk_live_… vagy pk_test_…) | Ha a frontendről kell (pl. Elements), add meg; jelenleg a backend hozza létre a Checkout sessiont |

---

## 2. Price ID-k (előfizetések)

**Stripe Dashboard → Product catalog → minden termékhez hozz létre árat (recurring, monthly/yearly)**

A kód ezeket a változókat várja. Ha nincs Enterprise/Starter, használhatod ugyanazt a price ID-t több helyen, vagy a kódot kell egyszerűsíteni.

| Env változó | Példa érték | Termék / ciklus |
|------------|-------------|------------------|
| `STRIPE_PRICE_STARTER_MONTHLY` | price_xxxxxxxxxxxx | Starter, havi |
| `STRIPE_PRICE_STARTER_YEARLY` | price_xxxxxxxxxxxx | Starter, éves |
| `STRIPE_PRICE_PRO_MONTHLY` | price_xxxxxxxxxxxx | Pro, havi |
| `STRIPE_PRICE_PRO_YEARLY` | price_xxxxxxxxxxxx | Pro, éves |
| `STRIPE_PRICE_ENTERPRISE_MONTHLY` | price_xxxxxxxxxxxx | Enterprise, havi |
| `STRIPE_PRICE_ENTERPRISE_YEARLY` | price_xxxxxxxxxxxx | Enterprise, éves |

**Hol találod:** Product → Add price → Recurring → Monthly / Yearly → Create → a Price ID a részleteknél (pl. `price_1ABC...`).

---

## 3. Webhook signing secret

**Stripe Dashboard → Developers → Webhooks**

1. **Add endpoint**
   - URL: `https://dealspy.eu/api/stripe/webhook` (éles) vagy `https://your-ngrok-or-preview-url/api/stripe/webhook` (teszt).
2. **Events to send:**  
   `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.
3. **Signing secret** (az endpoint létrehozása után): kattints az endpointra → **Signing secret** → Reveal → másold.

| Env változó | Példa érték |
|-------------|-------------|
| `STRIPE_WEBHOOK_SECRET` | whsec_xxxxxxxxxxxx |

---

## 4. Összefoglaló – mit illessz be

Másold a `.env.local.example`-t `.env.local`-ra, majd töltsd ki az alábbiakat a saját Stripe adataiddal:

```env
# Stripe Payment
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx

# Stripe Price IDs
STRIPE_PRICE_STARTER_MONTHLY=price_xxxxxxxxxxxx
STRIPE_PRICE_STARTER_YEARLY=price_xxxxxxxxxxxx
STRIPE_PRICE_PRO_MONTHLY=price_xxxxxxxxxxxx
STRIPE_PRICE_PRO_YEARLY=price_xxxxxxxxxxxx
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_xxxxxxxxxxxx
STRIPE_PRICE_ENTERPRISE_YEARLY=price_xxxxxxxxxxxx
```

- **Teszt:** használj `sk_test_...`, `pk_test_...` és teszt webhook secretet; a Price ID-k a teszt termékekhez tartoznak.
- **Éles:** ugyanezeket a változókat add meg a Vercel Environment Variables-ban is, éles kulcsokkal és az éles webhook URL signing secretjével.

---

## 5. Success / Cancel URL-ek

A Checkout session a kódban ezekre irányít (nem kell Stripe-ben beállítani):

- **Success:** `{NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`  
  → a success oldal lekéri a usert a session alapján és linkel a beállításokra.
- **Cancel:** `{NEXT_PUBLIC_APP_URL}/register?cancelled=true`  
  → a regisztrációs oldal üzenetet mutat: „Fizetés megszakítva, bármikor folytathatod a beállításokból”.

Ellenőrizd, hogy az **App** szekcióban az `NEXT_PUBLIC_APP_URL` élesben `https://dealspy.eu` legyen.
