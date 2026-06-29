# Session handoff — 2026-06-29 (popołudnie / wieczór)

Kontynuacja po porannym SESSION-2026-06-29.md (nocny przebieg A1–B4). Kuba ocenia
poprawki **jutro rano (30.06)** na świeżym linku, potem feedback i dalsze korekty.

- **Branch:** `dev` (zsync z `origin/dev`)
- **HEAD:** `e984882`
- **Live:** `https://qubatura.github.io/qubatura.eu/src/` (hard-refresh / `?v=...` na cache)
- Wszystkie pliki JS przeszły `node --check`. GLSL kompiluje się w przeglądarce.

## Zrobione dziś po południu

### Blok A — sygnet (kolor + szkło), iteracyjnie z Kubą
| Commit | Co |
|--------|-----|
| `07aa727` | C1–C4: mobile primary+szklisty, desktop mniej magenty, płyn „jak woda w butelce" (gładsza refrakcja: niższe freq wirów, miększy specular pow 64→28) |
| `f3313b0` | C5: mobile mniej bieli/matu — `uEdgeWarm` fioletowy (był prawie biały), `_glowMul` 1.3→1.1, `uBaseFill`↓, `uOpal`↑ |
| `fc459bf` | C6: front mniej matowy — **sheen szkła** na froncie (pow N·H 8 × uGlassFloor), opalCol schłodzony, mniej różu |
| `5153185` | C7: barwa znacząco ku primary — **`uPrimaryShift`** (mobile 0.7) ściąga R, lekko ↑B; finalna linia `color = mix(color, color*vec3(0.74,0.94,1.05), uPrimaryShift)` |

**Suwaki do kalibracji koloru sygnetu (mobile, signet.js uniforms):**
- za różowy → `uPrimaryShift` ↑ (0.7→0.85–1.0) lub R w `vec3(0.74…)` ↓
- za niebieski/indygo → `uPrimaryShift` ↓ (0.5)
- czerni się wnętrze w trough'ach → `uBaseFill` 0.16→0.18–0.20
- front za jasny → mnożnik sheen 0.35 ↓
- desktop = wszystko bramkowane `<=768` / `uGlassFloor` (=0) → NIETKNIĘTY, Kuba go zaakceptował

### Blok B — podstrona Studio (brief „BRIEF — Podstrona Studio")
| Commit | Co |
|--------|-----|
| `183daa8` | Część 1 pkt 1–5: kicker Studio Q→Studio, Qubatura Events→Events (Qlab został); font Chakra Petch waga 700; tło studio scrim −15–20%; copy „20 lat pracy studyjnej" + „Miksy binauralne i imersyjne"; CTA „Wyceń projekt" |
| `ffc5324` | Część 1 pkt 6: logo/HOME w rogu — lockup sygnet(maska na signet.svg)+wordmark QUBATURA, biały statyczny, hover-glow tylko na sygnecie; router pokazuje/chowa, klik→HOME; sygnet 3D na stronach scale→0 |
| `e984882` | Część 2: playery audio — grid 2×2 prawa strona, zero scrolla, dół zarezerwowany; nagłówek POSŁUCHAJ:; ring postępu (motyw obręczy); slot 1 „Nie z tej ziemi" + link YT; sloty 2–4 [TBD]; `players.js` symulacja postępu dla placeholderów |

## Do zrobienia jutro / czeka na Kubę

1. **Feedback po obejrzeniu Studio** (Mac + iPhone) — „małe poprawki, do których wrócę jutro".
2. **Kolor sygnetu mobile** — finalna ocena C7 (czy róż zszedł). Suwak `uPrimaryShift` gotowy.
3. **Placeholdery playerów do podmiany przez Kubę:**
   - pliki MP3 → `assets/audio/`, ustawić `data-audio="../assets/audio/xxx.mp3"` w kartach (reszta działa)
   - link YT slotu 1: dziś placeholder (YT search) → realny kanał/playlista „Nie z tej ziemi"
   - treść slotów 2–4 (audiobook SQN, binaural z „ZAŁÓŻ SŁUCHAWKI", sound design)
4. **Zarezerwowana dolna część sceny Studio** — osobny temat, jeszcze nieopisany przez Kubę.
5. **Decyzje do potwierdzenia:** kicker „Events" (czy ok) i „Qlab" (zostawiony) — gdyby Kuba wolał inaczej, to zmiana 1 słowa.

## Czego NIE robić (wg briefu)
- Formularz wyceny pod CTA „Wyceń projekt" — osobna sesja.
- Treści slotów 2–4 — czekają na materiały Kuby.

## Pliki kluczowe (zmienione dziś)
- `src/js/signet.js` — uniformy mobile + shader (C1–C7)
- `src/js/players.js` — NOWY, logika playerów + symulacja postępu
- `src/js/router.js` — logo/HOME (#page-home), sygnet 3D scale→0 na stronach
- `src/js/main.js` — wpięcie `initPlayers()`
- `src/index.html` — kickery/copy/CTA, #page-home, sekcja .studio-players
- `src/css/main.css` — page-title 700, tło studio, #page-home, .studio-players + karty/ring
