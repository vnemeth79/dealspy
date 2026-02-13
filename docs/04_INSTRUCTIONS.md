# DealSpy.eu - Cursor Instructions

## 🎯 Projekt Összefoglaló

**DealSpy.eu** egy EU csődvagyon és aukció monitoring platform, amely automatikusan figyeli a magyar, osztrák és német csődvagyon/aukciós oldalakat, és személyre szabott értesítéseket küld a felhasználóknak.

### Fő funkciók:
- 6 forrás automatikus scraping-je (naponta 1x, Vercel Hobby)
- AI fordítás (DE→HU/EN) Claude Haiku-val
- AI kategorizálás
- Web Push értesítések (OneSignal)
- Email digest (SendGrid)
- Telegram bot értesítések
- Többnyelvű UI (HU/EN/DE)

---

## 📁 Fájlok ebben a mappában

| Fájl | Tartalom |
|------|----------|
| `01_PRD.md` | Product Requirements Document - termék specifikáció |
| `02_TECHNICAL_SPEC.md` | Technikai specifikáció - architektúra, DB séma, API-k |
| `03_CURSOR_PROMPTS.md` | Lépésről lépésre promptok a fejlesztéshez |
| `04_INSTRUCTIONS.md` | Ez a fájl - használati útmutató |

---

## 🚀 Használati Útmutató

### 1. Cursor beállítása

1. Nyisd meg a Cursor-t
2. Hozz létre egy új projektet vagy nyiss meg egy üres mappát
3. Nyisd meg a Chat panelt (Cmd+L / Ctrl+L)

### 2. Kontextus betöltése

**Fontos:** Mielőtt elkezded a fejlesztést, töltsd be a specifikációs fájlokat a Cursor kontextusába.

Opció A - Fájlok hozzáadása:
- Húzd be a PRD.md és TECHNICAL_SPEC.md fájlokat a chat-be
- Vagy használd a @ mention-t: `@01_PRD.md @02_TECHNICAL_SPEC.md`

Opció B - Teljes kontextus:
```
Olvasd el és értsd meg a következő fájlokat, mert ezek alapján fogunk dolgozni:
- 01_PRD.md (Product Requirements)
- 02_TECHNICAL_SPEC.md (Technical Specification)
```

### 3. Fejlesztés indítása

A `03_CURSOR_PROMPTS.md` fájl tartalmazza a lépésről lépésre promptokat.

**Kövesd a sorrendet:**
1. FÁZIS 1: Projekt Setup (1.1 → 1.3)
2. FÁZIS 2: Scraperek (2.1 → 2.5)
3. FÁZIS 3: AI Feldolgozás (3.1 → 3.2)
4. FÁZIS 4: Értesítések (4.1 → 4.4)
5. FÁZIS 5: API Routes (5.1 → 5.4)
6. FÁZIS 6: Frontend (6.1 → 6.4)
7. FÁZIS 7: Deploy (7.1 → 7.2)

### 4. Prompt használata

Minden prompt egy önálló feladatot fed le. Másold be a prompt szövegét a Cursor chat-be és hagyd, hogy generálja a kódot.

**Tipp:** Ha a generált kód nem teljes vagy hibás, kérd meg, hogy folytassa vagy javítsa.

---

## ⚙️ Environment Variables

A projekt futtatásához a következő környezeti változókra van szükség:

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# Anthropic (Claude AI)
ANTHROPIC_API_KEY=sk-ant-xxx

# OneSignal (Web Push)
NEXT_PUBLIC_ONESIGNAL_APP_ID=xxx
ONESIGNAL_API_KEY=xxx

# SendGrid (Email)
SENDGRID_API_KEY=SG.xxx

# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-xxx

# App
NEXT_PUBLIC_APP_URL=https://dealspy.eu
CRON_SECRET=valami-titkos-string
```

### Hol szerezd be:

| Szolgáltatás | URL | Megjegyzés |
|--------------|-----|------------|
| Supabase | supabase.com | Ingyenes tier |
| Anthropic | console.anthropic.com | Pay-as-you-go |
| OneSignal | onesignal.com | Ingyenes 10k subscriber |
| SendGrid | sendgrid.com | Ingyenes 100 email/nap |
| Telegram | @BotFather | Ingyenes |

---

## 📊 Adatbázis Setup

### Supabase projekt létrehozása:

1. Hozz létre új projektet: supabase.com
2. Menj: SQL Editor
3. Futtasd a `02_TECHNICAL_SPEC.md` fájl "3. Database Schema" szekcióját
4. Másold ki az API URL-t és key-eket a Settings → API oldalról

---

## 🤖 Telegram Bot Setup

1. Nyisd meg a @BotFather-t Telegram-on
2. Küldj: `/newbot`
3. Kövesd az utasításokat
4. Mentsd el a token-t
5. Deploy után állítsd be a webhook-ot:

```bash
curl -X POST "https://api.telegram.org/bot{TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://dealspy.eu/api/telegram/webhook"}'
```

---

## 🔔 OneSignal Setup

1. Hozz létre fiókot: onesignal.com
2. New App/Website
3. Platform: Web
4. Site URL: https://dealspy.eu
5. Másold ki az App ID-t és API Key-t
6. Töltsd fel a service worker-t deploy után

---

## 🚢 Deployment (Vercel)

1. Push a kódot GitHub-ra
2. Vercel-ben: Import Project
3. Kapcsold össze a GitHub repo-val
4. Add hozzá az environment variable-eket
5. Deploy

### Cron jobs automatikusan beállnak a `vercel.json` alapján:
- Scraping: 09:30 CET (naponta 1x)
- Notifications: 10:00 és 15:00 CET
- Email digest: 15:00 CET

---

## 🐛 Troubleshooting

### "Scraper nem talál semmit"
- Az oldal HTML struktúrája változhatott
- Próbáld headful módban (headless: false)
- Ellenőrizd a selector-okat

### "Push notification nem megy"
- Ellenőrizd az OneSignal App ID-t
- Ellenőrizd, hogy a service worker deployolva van
- Nézd meg a browser console-t

### "Telegram nem válaszol"
- Ellenőrizd a webhook URL-t
- Ellenőrizd a bot token-t
- Nézd meg a Vercel function logokat

### "Email nem megy ki"
- Ellenőrizd a SendGrid API key-t
- Ellenőrizd a sender email domain verification-t
- Nézd meg a SendGrid Activity-t

---

## 📝 Fejlesztési Tippek

1. **Kezdd lokálisan:** `npm run dev` és teszteld minden funkciót
2. **Teszteld a scraper-eket egyenként:** `npx ts-node scripts/test-scrapers.ts`
3. **Használj console.log-ot:** Debug-oláshoz a Vercel logok segítenek
4. **Inkrementálisan haladj:** Minden fázis után tesztelj

---

## 📞 Támogatás

Ha elakadsz, a Cursor chat-ben kérdezz rá a specifikus problémára és másold be a releváns hibaüzenetet.

**Jó fejlesztést! 🚀**
