# Előfizetés, próbaidő és fizetési fal

## Ingyenes használati ablak (próbaidő)

- **Van:** regisztrációkor **3 napos ingyenes próba** indul.
- **Beállítás:** a regisztráció API (`/api/register`) a user létrehozásakor beállítja:
  - `subscription_status = 'trialing'`
  - `subscription_tier = 'trial'`
  - `trial_ends_at = most + 3 nap`
- **Próba alatt:** a felhasználó ugyanúgy kap értesítéseket (Push, Email digest, Telegram), mint egy fizető előfizető – a mentett keresései (kategóriák, országok, kulcsszavak, források) alapján.

## Hol van a fizetési fal?

- **Nincs külön „paywall” oldal.** A korlátozás **implicit**:
  - **Próba lejárta után** (`trial_ends_at` múlt): ha a user **nem fizetett** (nincs aktív Stripe előfizetés), akkor:
    - `canUserAccessFeature(user, 'push' | 'telegram')` → **false** → nem kap Push és Telegram értesítést.
    - `isSubscriptionActive(user)` → **false** → nem kap **email digest**-et sem.
  - Tehát a „fal” = **próba lejárta után nem jön több értesítés**, amíg nem fizet (Stripe checkout).
- **Fizetés megadása:** a regisztráció sikerképernyőjén opcionálisan megjelenik a Stripe **checkout link** (ha a backend sikeresen létrehozott sessiont). A user később a **beállítások** oldalról (pl. emailben kapott link) nem tud közvetlenül fizetni – ehhez külön „Fizetés” / „Upgrade” gomb kellene a settings oldalon (opcionális bővítés).

## Email értesítések a saját mentett keresések alapján (fizetős részen)

- **Igen, beállítható és működik.** Aki **email digest**-et választ (regisztráció vagy beállításoknál: „Email összefoglaló” bepipálva), az naponta **egyszer** (15:00 CET) kap egy emailt.
- **Tartalom:** csak azok a dealek jelennek meg, amelyek **egyeznek a user mentett beállításaival**:
  - **Kategóriák** (it, machines, vehicles, property)
  - **Országok** (hu, at, de)
  - **Források** (ha van szűrés, pl. eer, netbid, …)
  - **Kulcsszavak** (OR logika: ha bármelyik kulcsszó benne van a deal szövegében)
- A szűrés logikája: `lib/notifications/matcher.ts` → `matchUserToDeal()` / `findMatchingDeals()`.
- **Kik kapják:** csak olyan userek, akiknek **aktív az előfizetése** (próbaidőn belül vagy fizetett): a digest cron `isSubscriptionActive(user)` szerint szűr, tehát a lejárt próba nélkül fizetés nélkül **nem** kap digestet.

## Összefoglalva

| Kérdés | Válasz |
|--------|--------|
| Van-e ingyenes használati ablak? | Igen, **3 nap** próba (teljes értesítés). |
| Hol van a fizetési fal? | Nincs külön oldal; **próba lejárta után** nem jön Push/Telegram/Email, amíg nincs aktív előfizetés. |
| Tud-e a fizetős részen email értesítést küldeni a saját mentett keresések alapján? | Igen: **email digest** 15:00-kor, **mentett kategóriák/országok/források/kulcsszavak** alapján; csak aktív (próba vagy fizetős) usereknek. |
