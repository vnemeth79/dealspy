# DealSpy.eu

EU csődvagyon és aukció monitoring platform.

## Funkciók

- 🔍 **6 forrás automatikus scraping** (EÉR, NetBid, Ediktsdatei, stb.)
- 🤖 **AI fordítás** német→magyar/angol (Claude Haiku)
- 📊 **AI kategorizálás** (IT, gépek, járművek, ingatlan)
- 🔔 **Értesítések**: Web Push, Email, Telegram
- 📅 **Naponta 1x futás** (Vercel Hobby): scrape 09:30 CET, értesítés 10:00 CET, digest 15:00 CET
- 🌍 **Többnyelvű UI**: magyar, angol, német
- 💳 **Stripe előfizetés**: Starter, Pro, Enterprise csomagok

## Tech Stack

- **Frontend**: Next.js 14 + Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **AI**: Claude Haiku (Anthropic)
- **Push**: OneSignal
- **Email**: SendGrid
- **Payments**: Stripe
- **Hosting**: Vercel

## Telepítés

```bash
# Clone
git clone https://github.com/yourusername/dealspy.eu.git
cd dealspy.eu

# Dependencies
npm install

# Environment variables
cp .env.local.example .env.local
# Töltsd ki a szükséges API kulcsokat

# Development server
npm run dev
```

## Environment Variables

Lásd: `.env.local.example`

Szükséges szolgáltatások:
- Supabase (database)
- Anthropic (AI)
- OneSignal (push)
- SendGrid (email)
- Telegram Bot
- Stripe (payments)

## Adatbázis Setup

1. Hozz létre Supabase projektet: https://supabase.com
2. Futtasd a `docs/02_TECHNICAL_SPEC.md` fájl "Database Schema" SQL-jét
3. Másold a connection stringeket az `.env.local` fájlba

## Cron Jobs

A Vercel cron naponta egyszer fut (Hobby terv):
- **Scraping**: 08:30 UTC (09:30 CET)
- **Notifications**: 09:00 UTC (10:00 CET)
- **Email Digest**: 14:00 UTC (15:00 CET)

## Projekt Struktúra

```
dealspy.eu/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── register/      # User registration
│   │   ├── settings/      # User settings
│   │   ├── cron/          # Scheduled jobs
│   │   └── stripe/        # Payment webhooks
│   ├── register/          # Registration page
│   ├── settings/          # Settings page
│   └── page.tsx           # Landing page
├── lib/
│   ├── db/                # Supabase client, CRUD
│   ├── scrapers/          # 6 source scrapers
│   ├── ai/                # Translation, categorization
│   ├── notifications/     # Push, email, Telegram
│   └── i18n/              # Translations
├── components/            # React components
├── docs/                  # Documentation
└── public/                # Static assets
```

## Dokumentáció

A `docs/` mappában:
- `01_PRD.md` - Product Requirements
- `02_TECHNICAL_SPEC.md` - Technikai specifikáció
- `03_CURSOR_PROMPTS.md` - Fejlesztési promptok
- `04_INSTRUCTIONS.md` - Használati útmutató
- `05_LANDING_PAGE_PAYMENT.md` - Landing page és fizetés

## License

Private - All rights reserved
