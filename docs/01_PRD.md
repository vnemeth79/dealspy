# DealSpy.eu - Product Requirements Document (PRD)

## 1. Termék Áttekintés

### 1.1 Projekt neve
**DealSpy.eu** - EU Csődvagyon és Aukció Monitoring Platform

### 1.2 Verzió
MVP v1.0

### 1.3 Tagline
- **HU:** "EU csődvagyon monitoring – mi figyeljük, te vásárolsz"
- **EN:** "EU insolvency monitoring – we watch, you win"
- **DE:** "EU Insolvenz-Monitoring – wir beobachten, Sie profitieren"

### 1.4 Probléma
Az EU-ban több tucat csődvagyon és aukciós platform létezik (EÉR, NetBid, Ediktsdatei, stb.), amelyeket manuálisan kellene naponta ellenőrizni. Ez időigényes, a nyelvek különbözőek (magyar, német), és könnyű lemaradni jó lehetőségekről.

### 1.5 Megoldás
Automatizált scraping 6+ forrásból, AI-alapú fordítás és kategorizálás, személyre szabott értesítések (Web Push, Email, Telegram) naponta egyszer (Vercel Hobby: scrape 09:30 CET, értesítés 10:00 CET, digest 15:00 CET).

---

## 2. Felhasználói Célcsoport

| Szegmens | Igény | Prioritás |
|----------|-------|-----------|
| KKV tulajdonosok | Olcsó eszközbeszerzés csődvagyonból | P0 |
| Befektetők | Deal flow monitoring | P0 |
| Használtgép kereskedők | Beszerzési lehetőségek | P1 |
| M&A tanácsadók | Ügyfelek számára deal sourcing | P2 |
| Felszámolók | Piac átlátása, benchmark | P2 |

---

## 3. Funkcionális Követelmények

### 3.1 Adatgyűjtés (Scraping)

#### Támogatott források (MVP)
| Forrás | Ország | URL | Típus |
|--------|--------|-----|-------|
| EÉR | HU | eer.sztfh.hu | Csődvagyon |
| Ediktsdatei | AT | edikte.justiz.gv.at | Hivatalos csődhirdetmények |
| Insolvenzbekanntmachungen | DE | insolvenzbekanntmachungen.de | Hivatalos csődhirdetmények |
| NetBid | DE/EU | netbid.com | Ipari aukciók |
| Proventura | DE | proventura.de | Gépek, IT, járművek |
| Machineseeker | EU | machineseeker.com | Használt gépek |

#### Scraping specifikáció
- **Gyakoriság:** Naponta 1x (Vercel Hobby; 09:30 CET scrape)
- **Technológia:** Playwright (headless browser)
- **Duplikáció kezelés:** source + source_id alapján
- **Hiba kezelés:** Retry 3x, majd alert admin-nak

### 3.2 AI Feldolgozás

#### Fordítás
- **Motor:** Claude Haiku API
- **Nyelvek:** DE → HU, DE → EN
- **Scope:** Cím + első 200 karakter leírás
- **Költség optimalizálás:** Batch processing, cache

#### Kategorizálás
- **Kategóriák:** it, machines, vehicles, property, other
- **Módszer:** Claude Haiku prompt-alapú klasszifikáció

### 3.3 Felhasználói Felület

#### Landing Page (dealspy.eu)
- Regisztrációs form
- Beállítások módosítása (token-alapú link)
- 3 nyelv: HU, EN, DE
- OneSignal SDK integrálva

#### Routes
```
/                    → Landing + Regisztráció form
/settings?token=xyz  → Beállítások módosítása
/unsubscribe?token=xyz → Leiratkozás
/impressum           → Jogi infók
```

### 3.4 Értesítési Csatornák

| Csatorna | Időzítés | Tartalom |
|----------|----------|----------|
| Web Push (OneSignal) | Azonnal új deal-nél | Rövid: cím, ár, forrás, link |
| Email (SendGrid) | 15:00 CET | Napi digest összefoglaló |
| Telegram (@DealSpyBot) | Azonnal új deal-nél | Részletes: cím, fordítás, ár, határidő, link |

### 3.5 Felhasználói Beállítások

- **Kategóriák:** Multi-select (it, machines, vehicles, property)
- **Országok:** Multi-select (hu, at, de)
- **Kulcsszavak:** Szabadszöveges, vesszővel elválasztva
- **Források:** Multi-select (opcionális, üres = mind)
- **Csatornák:** Push, Email, Telegram (multi-select)
- **Nyelv:** HU, EN, DE

---

## 4. Nem-funkcionális Követelmények

### 4.1 Teljesítmény
- Scraping: max 5 perc / forrás
- Notification küldés: max 30 másodperc az új deal észlelésétől
- Landing page: < 2s betöltés

### 4.2 Skálázhatóság
- MVP: 100 user
- V1.0: 1000 user
- Architektúra: Horizontal scaling ready (stateless backend)

### 4.3 Megbízhatóság
- Uptime cél: 99%
- Scraping failure: Retry + admin alert
- Notification failure: Queue + retry

### 4.4 Biztonság
- HTTPS everywhere
- Token-based settings access (no login required for MVP)
- GDPR compliant (consent, unsubscribe)

---

## 5. Tech Stack

| Komponens | Technológia | Indoklás |
|-----------|-------------|----------|
| Frontend | Next.js 14 + Tailwind | SSR, gyors, modern |
| Backend | Next.js API Routes | Egyszerűség, egy repo |
| Database | Supabase (PostgreSQL) | Ingyenes tier, auth ready |
| Scraping | Playwright | JS renderelés, headless |
| Scheduling | Vercel Cron / BullMQ | Megbízható ütemezés |
| AI | Claude Haiku API | Olcsó, gyors, pontos |
| Push | OneSignal | Ingyenes 10k subscriber |
| Email | SendGrid | Ingyenes 100 email/nap |
| Telegram | Telegram Bot API | Ingyenes, megbízható |
| Hosting | Vercel | Ingyenes tier, edge |
| Domain | dealspy.eu | - |

---

## 6. Adatmodell

### 6.1 Users tábla
```
id: UUID (PK)
email: TEXT (unique)
token: TEXT (unique) - settings link-hez
language: TEXT (hu/en/de)
created_at: TIMESTAMP

-- Értesítési csatornák
notify_push: BOOLEAN
notify_email: BOOLEAN
notify_telegram: BOOLEAN
telegram_chat_id: TEXT
onesignal_player_id: TEXT

-- Szűrők
categories: TEXT[] (it, machines, vehicles, property)
countries: TEXT[] (hu, at, de)
keywords: TEXT[]
sources: TEXT[] (üres = mind)
```

### 6.2 Deals tábla
```
id: UUID (PK)
source: TEXT (eer, netbid, ediktsdatei, proventura, machineseeker, insolvenz)
source_id: TEXT
title_original: TEXT
title_hu: TEXT
title_en: TEXT
title_de: TEXT
description_original: TEXT
description_translated: TEXT
category: TEXT (it, machines, vehicles, property, other)
country: TEXT (hu, at, de)
price: DECIMAL
currency: TEXT
deadline: TIMESTAMP
url: TEXT
image_url: TEXT
created_at: TIMESTAMP
notified_at: TIMESTAMP

UNIQUE(source, source_id)
```

### 6.3 Notifications tábla (log)
```
id: UUID (PK)
user_id: UUID (FK)
deal_id: UUID (FK)
channel: TEXT (push, email, telegram)
sent_at: TIMESTAMP
```

---

## 7. User Flow

### 7.1 Regisztráció
1. User → dealspy.eu
2. Kitölti a formot (email, kategóriák, országok, csatornák)
3. Ha Push-t választott → böngésző permission kérés
4. Ha Telegram-ot → link a bot-hoz (/start)
5. Adatok mentése Supabase-be
6. Visszaigazoló email token-es settings linkkel

### 7.2 Napi működés (Hobby: naponta 1x)
1. 09:30 CET - Scraperek futnak
2. 10:00 CET - Új deal-ek → Push + Telegram küldés a matching user-eknek
3. 15:00 CET - Email digest

### 7.3 Beállítások módosítása
1. User kap emailt settings linkkel (dealspy.eu/settings?token=xyz)
2. Form előre kitöltve jelenlegi beállításokkal
3. Módosít → Mentés → Visszaigazolás

---

## 8. Értesítés Formátumok

### 8.1 Web Push
```
Title: 🔍 DealSpy | Új deal
Body: 42U Szerver rack | NetBid | €450
URL: [eredeti link]
```

### 8.2 Telegram
```
🔍 DealSpy | IT/Server

📦 42U Szerver rack kabelmenedzsmenttel
   (42U Serverschrank mit Kabelmanagement)

📍 NetBid.com | 🇩🇪 Németország
💰 Kikiáltás: €450
⏰ Lejár: feb. 3. (5 nap)
🏷️ #szerver #rack #IT

🔗 https://netbid.com/lot/123456
```

### 8.3 Email Digest
```
Subject: 🔍 DealSpy | 7 új deal - jan. 29.

Body:
Szia [név],

Ma 7 új releváns deal érkezett:

IT/SERVER (3)
─────────────
• 42U Szerver rack - €450 - NetBid 🇩🇪
  ⏰ feb. 3. | [Link]
  
• HP ProLiant szerverek (10db) - €2.200 - Proventura 🇩🇪
  ⏰ feb. 5. | [Link]

GÉPEK (4)
─────────
[...]

━━━━━━━━━━━━━━━━━━━━━
Beállítások: [link]
Leiratkozás: [link]
```

---

## 9. Fejlesztési Ütemezés

| Nap | Feladat | Output |
|-----|---------|--------|
| 1 | Projekt setup, Supabase, domain | Infra kész |
| 2-3 | EÉR + NetBid scraper | 2 forrás működik |
| 4 | Ediktsdatei + Insolvenzbekanntmachungen | 4 forrás működik |
| 5 | Proventura + Machineseeker | 6 forrás működik |
| 6 | Claude Haiku integráció | AI fordítás működik |
| 7 | Telegram bot (@DealSpyBot) | Bot működik |
| 8 | Email digest (SendGrid) | Email működik |
| 9 | Landing page + form | Weboldal él |
| 10 | OneSignal integráció | Push működik |
| 11 | Szűrés logika + matching | Személyre szabás |
| 12 | Tesztelés, deploy | **MVP LIVE** |

---

## 10. Költségbecslés (havi)

| Tétel | Költség |
|-------|---------|
| Supabase (free tier) | €0 |
| Vercel (free tier) | €0 |
| OneSignal (free, 10k sub) | €0 |
| SendGrid (free, 100/nap) | €0 |
| Claude Haiku API (~10k fordítás) | €5-10 |
| Domain (dealspy.eu) | ~€1 |
| **Összesen** | **~€6-11/hó** |

---

## 11. Sikerkritériumok (MVP)

- [ ] 6 forrás scraping működik
- [ ] AI fordítás DE→HU/EN működik
- [ ] Web Push értesítés működik
- [ ] Email digest működik
- [ ] Telegram bot működik
- [ ] Landing page 3 nyelven
- [ ] 10 teszt user regisztrált
- [ ] < €15/hó üzemeltetési költség
