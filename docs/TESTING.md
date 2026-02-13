# Lokális tesztelés

## API + oldal tesztek (fetch)

A dev szerver futása mellett (pl. `npm run dev`):

```bash
npm run test
```

Vagy: `node scripts/test-pages.mjs`

- Összes nyilvános oldal GET 200 (/, /register, /settings, /unsubscribe, /impressum, /login, /success, /register?cancelled=true).
- API-k: register validáció, settings/checkout/unsubscribe rossz token → 404/400, health, billing session/checkout.
- Teljes regisztrációs folyamat: ha a Supabase elérhető, regisztráció → token → settings → checkout URL → unsubscribe. Ha nincs DB, ez a lépés „kihagyva” jelzésű, a többi teszt sikeres marad.

## Böngészős E2E (Playwright)

```bash
npm run test:e2e
```

A Playwright automatikusan indítja a dev szervert (ha még nem fut), majd Chromiummal futtatja az E2E teszteket:

- Főoldal CTA és regisztráció link
- Regisztrációs űrlap betöltése és küldés (siker vagy hiba)
- Sikeres regisztráció esetén beállítások link (ha DB elérhető)
- Beállítások token nélkül
- Impressum, Login, Success, Unsubscribe oldalak
- `/register?cancelled=true` – megszakított fizetés üzenet

Első futtatáskor: `npx playwright install chromium` (a `npm install` már telepíti a csomagot).
