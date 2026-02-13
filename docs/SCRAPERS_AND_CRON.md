# Értékesítési források (scraperek) és automata keresés

## Mi van implementálva

- **Cron:** A `vercel.json` szerint a **scrape** naponta **1x** fut: **08:30 UTC** (09:30 CET). (Hobby terv: napi egy futás; Pro tervval 2x is beállítható.)
- **Folyamat:** `POST /api/cron/scrape` → `runAllScrapers()` → mind a 6 forrásból letöltés (fetch) → új dealek mentése a DB-be (fordítás, kategória) → utána a **notify** cron elküldi az értesítéseket a megfelelő usereknek.

### Scraperek forrásonként (mind fetch-alapúak, Vercel serverless kompatibilis)

| Forrás | Ország | URL / útvonal | Megjegyzés |
|--------|--------|----------------|------------|
| **EÉR** | HU | eer.sztfh.hu/palyazat/kereses | HTML regex; ha a struktúra változik, érdemes a parsert frissíteni. Van API fallback. |
| **NetBid** | DE | netbid.com/en/auctions/ | Fetch + link/title regex. Ha a listázó oldal HTML-je változik, a regex-et kell igazítani. |
| **Ediktsdatei** | AT | edikte.justiz.gv.at (kereső) | `result` sorok + linkek. |
| **Insolvenz** | DE | insolvenzbekanntmachungen.de (CGI) | POST/GET + HTML parser. |
| **Proventura** | DE | proventura.de/de/auktionen | Fetch + link/title regex. |
| **Machineseeker** | DE | machineseeker.com (kategóriák) | Kategóriánként (server, cnc, laser, …) fetch + HTML. |

**Összefoglalva:** Mind a 6 scraper **csak fetch + HTML feldolgozás** (regex). Nincs Playwright/Chromium, így **mindegyik fut Vercel cron-on** és lokálisan is.

---

## Hogyan biztosítható, hogy mindegyik működjön?

1. **Cron és hálózat:** A scrape cron (és a notify/digest) fusson rendben – ehhez a `CRON_SECRET` és a Vercel Cron beállítások megfelelőek. A scraperek 3× újrapróbálkoznak (`withRetry`), timeout 30 s.
2. **Ha egy forrás 0 dealet ad:** A céloldal gyakran **JavaScripttel renderel** listát (SPA), vagy **megváltozott a HTML**. Ekkor:
   - Nyisd meg a forrás listázó URL-jét böngészőben, vizsgáld meg a **View Page Source** (nyers HTML) tartalmát.
   - Ha a listaelemek (linkek, címsorok) benne vannak a nyers HTML-ben → a scraper regex/selectorát kell a jelenlegi struktúrára igazítani (pl. `lib/scrapers/<source>.ts`).
   - Ha a nyers HTML üres vagy csak egy üres shell (pl. egyetlen `<div id="root">`) → a portál kliensoldali renderelést használ; ilyenkor csak böngészős (Playwright) scraper adna adatot, ami Vercel serverless-en nem futtatható. Ilyen forrásnál vagy külön worker környezet kell, vagy a forrás kimarad.
3. **Élő teszt:** Futtasd le a scrape-et manuálisan (lásd alább), és nézd a válasz `stats.bySource` és `stats.errors` mezőit. A Supabase `deals` táblában látszik, melyik forrásból került be új sor.
4. **Admin értesítés:** Ha valamelyik scraper a 3 próba után is hibázik, a rendszer e-mailt küld az `ADMIN_EMAIL` címre (`sendScraperFailureAlert`). Ha egy forrás regex-e 0 dealet ad, de az **AI fallback** (Claude) dealeket tud kinyerni a HTML-ből, akkor is kapsz e-mailt (`sendScraperFallbackAlert`): „AI fallback használva – lehetséges HTML változás”. Ilyenkor érdemes frissíteni a parsert a jobb teljesítmény érdekében.
5. **HTML-változás automatikus követése:** Ha a portál HTML-je megváltozik és a regex 0 találatot ad, a rendszer opcionálisan **AI (Claude) fallbackot** használ: a letöltött HTML-ből az AI kinyeri a listaelemeket (cím, URL, ár, határidő). Így a scrape továbbra is ad dealeket; közben admin e-mail jelzi, hogy érdemes a parsert frissíteni. Az AI fallback alapból be van kapcsolva, ha `ANTHROPIC_API_KEY` be van állítva; kikapcsolás: `ENABLE_AI_SCRAPER_FALLBACK=0`.

---

## Automata keresés – folyamat

1. **Scrape cron** (08:30 UTC, naponta 1x): mind a 6 scraper lefut.
2. **Új dealek** → Supabase `deals` tábla, fordítás (Anthropic), kategória (AI).
3. **Notify cron** (09:00 UTC, naponta 1x): a `notify` job az új dealeket a user beállítások (kategória, ország, forrás, kulcsszó) alapján szűri → Push / Email / Telegram.

Nincs külön „értékesítési böngésző” oldal az appban – a userek értesítést kapnak (email digest, push, Telegram).

---

## Tesztelés – működik-e a scrape?

### Dry-run: csak scraperek, nincs DB írás (lokális teszt)

Ha csak azt akarod ellenőrizni, hogy **minden értékesítési site-on működik a scraper és talál is**, futtasd **dry-run** módban. Nem ír a DB-be, nem futtat fordítást/kategorizálást, nem küld admin e-mailt.

**Dry-run csak fejlesztési környezetben érhető el** (`NODE_ENV !== 'production'`). Éles (Vercel) deployon a `?dryRun=1` paramétert figyelmen kívül hagyjuk.

**Lokálisan (dev szerver fut, pl. `npm run dev`):**

```bash
curl -X GET "http://localhost:3000/api/cron/scrape?dryRun=1" -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**PowerShell:**

```powershell
$secret = $env:CRON_SECRET  # .env.local-ból
Invoke-RestMethod -Method GET -Uri "http://localhost:3000/api/cron/scrape?dryRun=1" -Headers @{ Authorization = "Bearer $secret" }
```

**Válasz példa:**

```json
{
  "success": true,
  "dryRun": true,
  "stats": {
    "bySource": { "eer": 12, "netbid": 5, "ediktsdatei": 0, "insolvenz": 8, "proventura": 3, "machineseeker": 20 },
    "errors": [],
    "aiFallbackSources": [],
    "totalDeals": 48,
    "durationMs": 45000
  },
  "sources": ["eer", "netbid", "ediktsdatei", "insolvenz", "proventura", "machineseeker"]
}
```

- **bySource:** forrásonként hány dealet talált a scraper. Ha valahol 0, az a forrás most üres vagy a parsert frissíteni kell.
- **errors:** ha valamelyik forrás hibázott (pl. timeout, 403), itt szerepel `{ "source": "...", "error": "..." }`.
- **aiFallbackSources:** ezeken a forrásokon a regex 0-t adott, de az AI fallback talált dealeket → érdemes a parsert igazítani.

Így egy hívással letesztelheted, hogy mind a 6 forrás (eer, netbid, ediktsdatei, insolvenz, proventura, machineseeker) működik és talál-e.

---

### Teljes scrape (DB írás, fordítás, cron szimuláció)

1. **Környezet:** Supabase (schema lefuttatva), `CRON_SECRET` beállítva (pl. `.env.local`).
2. **Manuális hívás** (pl. lokálisan):

   ```bash
   curl -X POST "http://localhost:3000/api/cron/scrape" -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

3. **Válasz:** JSON pl. `{ "success": true, "newDeals": N, "duplicates": D, "errors": E, "stats": { "bySource": { ... }, "errors": [], "aiFallbackSources": [] } }`.
4. **Logok:** A konzolban látszik forrásonként a deal szám és esetleges hibák.
