# Session handoff — 2026-07-04 (popołudnie) — KONTAKT + fonty + SEO

Kontynuacja po porannej sesji. Dziś: **zbudowany i wpięty silnik formularza Kontakt w PRAWDZIWĄ stronę**, self-host fontów, SEO. **Wszystko na `dev`, NIC nie zacommitowane** (working tree dirty) — czekamy na akceptację Kuby.

## ⏭️ NA START (jutro ~7:15) — kolejka wg Kuby (koniec dnia 07-04)
0. **Frost-szkiełka → jak w Studio** (GŁÓWNA uwaga Kuby): tło frost bramy „Napisz do nas" ORAZ kafelków wyboru działu (`.cc-tor`) jest „trochę nie-qubaturowe". Bazować na **szkiełkach ze Studio** (`.pl-card`/`.studio-*`): **praktycznie przezroczyste, tylko frosted** (pokój łączności ma prześwitywać przez szkło — teraz fill za ciemny: `#cc-gate` ma `rgba(6,5,15,.20)`, `.cc-tor` `rgba(255,255,255,.015)` — zejść do niemal 0 fill, zostawić backdrop-blur). **Obwódka podświetla się kolorem działu** (już jest na hover — wzmocnić / „bardziej jako szkiełko"). Tapeta w formularzu = ZAAKCEPTOWANA („wygląda super").
1. **Wskaźnik toru** — dziś kropki → mini-waveform (`.cc-wave`). **Kuba: waveform NIE finalny — rano wymyślić alternatywy** („tez nie wymyslimy rano cos innego"). Kandydaci „nasi": kątowniki-celownik HUD (jak galeria), sam sygnet Q, kreski nav, mini-EQ inaczej. Pokazać kilka wariantów (poligon/screenshot).
2. **Fonty w formularzu „wyglądają AI"** — zrobione dziś: pytania `.cc-q` → UPPERCASE (echo `page-title`). **DOPYTAĆ o konkret** — co dokładnie pachnie AI (case? Space Mono w polach? blinking `_`?). Nie zgadywać dalej bez wskazania.
2. **Web3Forms + honeypot** — `send()` w `contact-console.js` na razie tylko pokazuje ekran sukcesu (TODO w kodzie). Dopiąć realną wysyłkę na biuro@ + honeypot anti-bot (to była pozycja z kolejki premiery).
3. **Grafiki działów** — Kuba dowiezie `qubatura.eu-tlo-dep-events-2/studio-2/lab-2` (warianty). Podmienić/porównać ze starymi. Jest też `qubatura.eu-tlo-dep-signal.png` (parking na sekcję „Przybywamy z sygnałem" — hero/o-nas, NIE pod formularz).
4. **Domena/hosting** — canonical/OG/sitemap/robots używają `https://qubatura.eu/`. Potwierdzić czy custom domain podpięty do Pages (live to `qubatura.github.io/qubatura.eu/src/`). robots.txt/sitemap.xml leżą w `src/` (root aplikacji) — placement zależy od finalnej domeny.

## Zrobione dziś

### 1. Silnik Kontaktu — WPIĘTY W PRAWDZIWĄ STRONĘ (nie poligon)
Rozszerzony `#contact-overlay` (reuse istniejącego lockup+strzałka; dodany label „Kontakt" obok logo).
- **Przepływ:** minimalistyczny Kontakt (współrzędne/mail/QR/socjale) + **frost-brama „Napisz do nas"** → konsoleta „CENTRUM STEROWANIA KOMUNIKACJĄ": tor (Events/Studio/Lab) → podpowiedź (auto-wypełnia opis gotowym szkieletem) → opis+kontakt → „Wyślij sygnał" → „Sygnał odebrany". Temat składa się sam: `[EVENTS] Wyceń wydarzenie`.
- **Tło „pokój łączności"** (`qubatura.eu-tlo-dep-contact.webp`, 63 KB): przygaszone na bramie (`OP_GATE 0.22`), mocniejsze w konsolecie (`OP_FORM 0.42`), **morfuje w scenę działu** przy wyborze toru (crossfade dwuwarstwowy + winieta). Pełny kadr (fix ucięcia u góry).
- **Kolor działu** zalewa konsoletę po wyborze toru (`--cc`).
- **Frost-brama** w stylu `.pl-card` (Studio/Lab): szkło + poświata primary na obrysie, mocniejsza na hover.
- **Wskaźnik toru = mini-waveform** w kolorze działu (`.cc-wave`, animowany „equalizer") — zamiast kropki (Kuba: „coś bardziej naszego", fala=DNA).
- `.contact-inner` chowa się w trybie konsolety (`is-console`, `visibility:hidden` — NIE tranzycja, bo virtual-time headless nie chował).
- Overlay: blur `9px` + zasłona `rgba(10,10,15,.42)` (sygnet nie przebija).
- **Pliki:** `src/index.html` (markup overlay + konsoleta), `src/css/main.css` (blok `/* KONTAKT — konsoleta */` ~linia 1968+), **nowy `src/js/contact-console.js`**, wpięcie w `src/js/main.js` (`initContactConsole()` + preload tła contact).
- **contact.js (stary overlay) zostaje** — obsługuje open/close overlaya; contact-console dokłada silnik + reset na zamknięciu.
- **`poligon/kontakt.html`** — piaskownica, w której to prototypowaliśmy. Superseded, można skasować (albo zostawić jako referencję).

### 2. Self-host fontów (koniec z „raz są, raz nie" od Google)
- Wszystkie 3 fonty lokalnie: `assets/fonts/*.woff2` (14 plików, ~200 KB, latin+latin-ext = polskie znaki).
- Nowy `src/css/fonts.css` (`@font-face`, ścieżki `../../assets/fonts/` — odporne na SPA).
- Usunięty link + preconnect do Google Fonts z `index.html`. **Zero zależności od Google.**
- `stamp-version.mjs` rozszerzony o stemplowanie `css/fonts.css`.
- Skrypt generujący: `scratchpad/selfhost-fonts.mjs` (gdyby trzeba odświeżyć/dodać wagę).
- Zweryfikowane headless: fonty renderują z lokalnych plików, „ŁADOWANIE" (Ł z latin-ext) OK.
- Press Start 2P też self-hosted, ale używany TYLKO w Pongu (8-bit Atari — celowo).

### 3. SEO
- **Meta:** dodane `keywords`, `author`, `robots (index,follow,max-image-preview:large)`, `theme-color #0A0A0F`.
- **JSON-LD** wzbogacony: `logo`, `image`, `telephone`, `slogan`, `addressRegion`, `areaServed`, `contactPoint` (tel/email/lang), `sameAs` (FB/LinkedIn). Zwalidowane (`JSON.parse` OK).
- **`src/robots.txt`** (allow all + Sitemap).
- **`src/sitemap.xml`** (/, /events, /studio, /lab — `qubatura.eu`). ⚠️ routes SPA na Pages wymagają fallbacku (404.html→index) żeby były indeksowalne — do sprawdzenia przy domenie.

## Stan repo
- **Branch:** `dev`. **HEAD:** bez zmian (NIC nie zacommitowane dziś-pm).
- **Working tree:** modyfikacje `src/*` (JS przez stamp-version), nowe: `assets/fonts/`, `src/js/contact-console.js`, `src/css/fonts.css`, `src/robots.txt`, `src/sitemap.xml`, `assets/qubatura.eu-tlo-dep-contact.{png,webp}`, `assets/qubatura.eu-tlo-dep-signal.png`, `poligon/`.
- **Token cache:** `mr6t2en6` (ostatni stamp).
- **Serwer:** `python -m http.server 8080` z roota → `http://localhost:8080/src/`.

## Do commita (gdy Kuba da OK)
Sensowny podział na 2-3 commity: (a) silnik Kontaktu, (b) self-host fontów, (c) SEO. Przed pushem: `node tools/stamp-version.mjs`. Rozważyć czy `poligon/` i `assets/*-contact.png`/`signal.png` (duże PNG-mastery) mają iść do repo, czy `.gitignore`.

## Konwencje (bez zmian)
Odpowiedzi PL. Vanilla JS, dark, premium, bez generycznych AI aesthetics. Show-before-commit. Trudne decyzje wizualne → poligon + headless-screenshot.
