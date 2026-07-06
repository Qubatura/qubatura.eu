# Session handoff — 2026-07-06 PM (qubatura.eu) — przed /clear

Kontynuacja po SESSION-2026-07-06.md. Wielka sesja o Lab: linia softu audio (Qplayer/Qtune), karta produktu 3/4, showcase „oprogramowanie na zamówienie" z 5 realnymi mockupami. **Wszystko na `dev`, NIC niezacommitowane** (HEAD `88d627a`, working tree dirty). Czytać JAKO PIERWSZE po `/clear` (plus pamięć + repo).

## Stan repo / serwer
- **Branch:** `dev`. **HEAD:** `88d627a` (nic dziś nie zacommitowane). **Serwer:** `python -m http.server 8080` z roota → `http://localhost:8080/src/`.
- **Token cache:** `mr6t2en6`. ⚠️ **przed pushem:** `node tools/stamp-version.mjs` — DUŻO nowych/zmienionych modułów (lab.js, contact-console.js, player.js, main.css, index.html). Potwierdzić że stamp je stempluje.
- Headless-screenshot workflow działa (Chrome, świeży `--user-data-dir` za każdym razem, `--no-sandbox`; często trzeba **powtórzyć strzał** po pierwszym „NOFILE"; do iframe dodać `--virtual-time-budget=4000`).

## ⚙️ KLUCZOWE DECYZJE tej sesji
- **BRANDING SOFTU = prefiks Q.** Wróciliśmy do Q w nazwach softu (było „Event Player" bez Q). Linia: **Qplayer** (playback na eventy) + **Qtune** (strojenie PA, w produkcji). Pieczęć-Q = akcent koloru. Powód: rodzina > pojedynczy byt, transfer zaufania, ownable/SEO. **Prefiks, nie sufiks** (spójność).
- **KOLORY:** dotarcie/kontekst działu = **cyjan Lab**; prezentacja PRODUKTU (karta Qplayera) = **violet primary** (bo interfejs Qplayera jest fioletowy + spina z marką). Showcase „na zamówienie" = kontekst DZIAŁU → **cyjan**. Karty platform w showcase = **własny akcent każdej platformy**.
- **FONT karty produktu:** treść-do-czytania = **Chakra Petch** (czytelniej na miękkim ekranie Kuby MSI), etykiety UPPERCASE = **Space Mono**. (Uwaga: brand-book mówi „DM Mono", ale strona realnie na Space Mono — `--font-mono: 'Space Mono'` w main.css:19.)
- **Qlab → Lab** wszędzie (główny fix: main.css `content:"Lab"` w lockupie; było „Qlab").
- **„nie festyniarsko"** — Kuba odrzucił tekstowy „posłuchaj" przy mini-playerze; puls ma być mocny ale elegancki.
- **Teksty = NA KOŃCU.** Kuba przyśle ZBIORCZĄ listę tekstową do poprawek. Do tego czasu copy w Lab/showcase/karcie = **robocze**, nie dłubać.

## Zrobione w tej sesji

### Linia softu audio (sekcja `.lab-software`, prawa strona Lab)
- Karta 1 **Qplayer** (`data-product="qplayer"` → overlay produktu), karta 2 **Qtune** „w produkcji".
- Kafle: **równej wysokości 208px, symetryczne** (tekst u góry, guzik/tag przypięty do dołu). **BUG naprawiony:** `.pl-card{height:144px}` był PÓŹNIEJ w pliku niż `.lab-card` → nadpisywał; fix = selektor `.pl-card.lab-card` (wyższa specyficzność). Qtune ma tag `w produkcji` (`.pl-cta.is-tag`) w miejscu guzika Qplayera „Zobacz więcej →" (mirror).

### Karta produktu Qplayer — pełna przebudowa (full-screen → zwarta 3/4)
- Overlay `#product-overlay` przerobiony: klasy **`pc-*`** (scoped, zero kolizji), zastąpiły stary blok CSS. Struktura: **lewa** (screen `event-player.webp` + kafle-liczby `2 decki · ∞ jingle · 9 padów · ∞ kolejka` + pasek **100% offline**) / **prawa** (breadcrumb `Lab · Oprogramowanie audio` + tytuł Qplayer + sub + **6 funkcji** + 2 CTA „Pobierz/Pobierz instrukcję · wkrótce") / **dół** = spec-sheet 3-kol (Platforma / Wymagania / Formaty).
- **6 funkcji:** Automix (z zadanymi fade'ami) · Dwa dedykowane decki (auto/z ręki) · **Jingle** i spoty (po ANGIELSKU „jingle", z priorytetami emisji) · Sampler (9 padów) · Głośność i fade'y na sekcję · Mapowanie klawiszy (MIDI w przyszłości).
- **Spec (od Kuby, realne):** macOS 12+ v1.0 (Apple Silicon M1–M4/Intel i5+, 4GB RAM, ~150MB, CoreAudio) · **Windows = wkrótce v2** (WASAPI/ASIO) · Formaty „czyta wszystko": MP3·**MP2**·AAC·M4A·FLAC·ALAC·WAV·AIFF·OGG·OPUS·WMA·WebM, 16/24/32-bit float. **Mac-first.**
- lab.js ustawia `.prod-shot-img` src (SPA-proof). Poligony robocze: `poligon/qplayer-card-v2..v4.html`.

### Lab — sekcja/hero
- **Nowy lead** (software-first, druk 3D na końcu bez „drukujemy"): „Software, strony i aplikacje — od pomysłu, przez UX, po wdrożony produkt. Projektujemy i programujemy rzeczy, których jeszcze nie ma; do tego IoT, pomiary akustyczne i druk 3D." Chipy przestawione (Druk 3D last, dodane Pomiary akustyczne).
- **Sekcja „Oprogramowanie audio" podniesiona** do wysokości hero (`.lab-software top: calc(50% - 198px)`, było center) — oddech na dole. ⚠️ offset 198px to estymata, ew. nudge.
- **Para guzików w hero:** nowy `.page-showcase` (kicker „Systemy · platformy · aplikacje" + hook „Zbudujemy to pod Twoją branżę →") + `.page-cta` „Opisz projekt" **przerobiony na biały bold, na wymiar showcase'a** (scoped `#page[data-division="lab"] .page-cta`, żeby nie ruszać Events/Studio).
- **Deep-link do formularza:** oba Lab-CTA mają `data-contact data-contact-tor="lab"` → contact-console.js łapie `[data-contact-tor]` → `openConsole()` + `pickTor('lab')` → wchodzisz PROSTO na krok „Co budujemy?" w kolorze/tle Lab (pomija bramę i wybór toru). Nie budujemy nowego formularza — reuse.

### Showcase „oprogramowanie na zamówienie" (NOWE, flagowy element Lab)
- **Guzik `.page-showcase`** [data-showcase] → overlay **`#lab-showcase`** (`.lab-showcase`), cyjan/Lab.
- Tło: **`assets/lab/lab-showcase-bg.webp`** (konwersja z labB-1.png ffmpeg: 4.7MB→**56KB**), przyciemnione. Klasy `ls-*`.
- Zawartość: kicker + tytuł „Zbudujemy to pod Twoją branżę" + lead + **3 filary** (Platformy i systemy / Aplikacja + panel admin / Integracje) + **latająca galeria (marquee)** kart platform + CTA „Opisz projekt" (deep-link Lab).
- **Galeria = 5 kart platform**, każda w SWOIM akcencie (`--acc`), klik → detal. Marquee: `.ls-track` dwie kopie, `@keyframes ls-marquee` -50%, pauza na hover. (NIE bramkować za prefers-reduced-motion — to treść/pokaz.)

### Detal branży `#lab-case` (warstwa 2) — WOW
- Klik karty → overlay **`.lab-case`** z **`<iframe>`** pełnego mockupu HTML (izolowany → własna tożsamość platformy, ZERO kolizji CSS ze stroną). **‹ ›** przeskok między 5 branżami (+ strzałki klawiatury, Esc). Chrome (ramka + strzałki + licznik `01/05`) bierze **akcent platformy** (`--acc`) — immersja.
- Lazy: `iframe.src` ustawiany dopiero przy otwarciu, czyszczony przy zamknięciu.
- **5 mockupów** = gotowe pliki Kuby w **`assets/lab/mockupy/`**: `01-warsztat-samochodowy` (TORQ, #FF5A1F) · `02-druzyna-pilkarska` (Młode Orły, #F2C14E) · `03-salon-kosmetyczny` (Atelier Dłoń, #C9A227) · `04-silownia-fitness` (IRON LAB, #C6FF3D) · `05-restauracja` (Stół., #B08D57). Każdy: samodzielny HTML, własne fonty (Google Fonts) + kolor, 3 ekrany (klient telefon + panel admina). **Tablica MOCKUPS w lab.js** — rozszerzalna (dodajesz `{file,name,cap,accent}`).
- ⚠️ Mockupy ciągną Google Fonts (osobny dokument iframe → OK na serwerze; ew. self-host przy ostrym CSP).

### Mini-player muzyczny (`#sound-toggle`)
- **Magenta OUT:** gra = `--color-primary` (violet #5B2EFF), było `--color-accent` magenta #E0218A (main.css ~241).
- **Puls-zaproszenie mocniejszy** (nie gra): spokojny oddech + co ~2s wyraźny fioletowy ROZBŁYSK (skok słupków + primary + bloom). Cykl 2.2s. Trudny do ominięcia.

### Cookie banner (`.cookie-bar`)
- **Ostre krawędzie** (0px, było 12px) + frost + **żywa krawędź pulsująca poświatą primary** (`@keyframes cookie-glow`, obrys+glow co 3.2s). Guzik `border-radius:0`. Pozycja dół-środek bez zmian. (Kuba: „jeszcze posiedzieć" — otwarte na iterację. Żeby ZOBACZYĆ baner: wyczyścić localStorage `qub-cookie-ok`.)

## ⏭️ KOLEJKA (co zostało)
1. **TEKSTY** — Kuba przyśle zbiorczą listę poprawek (Lab, showcase, karta Qplayer, podpisy). Wtedy dopieścić.
2. **Mockupy showcase** — 5 wpiętych; Kuba może dorobić więcej (dodać do MOCKUPS). Ew. thumbnaile-podglądy w kartach (upgrade).
3. **Formularz → PHP** na IQ Host (czeka na dostęp/dane; Web3Forms scaffold w contact-console.js, `WEB3FORMS_KEY` pusty).
4. **Favicon** — wpiąć `favicon-dark.svg` + komplet (apple-touch + png).
5. **Tła działów** — B-1 warianty do webp + wpięcie (event-player + lab-showcase już zrobione).
6. **Commit + push** (`stamp-version.mjs` PRZED!) + **deploy IQ Host** (podmiana „w budowie").
7. Reszta: Studio „ożywiony monitor", Events CTA, 3. utwór Relax do playera.

## Konwencje
PL. Vanilla JS, dark, premium, bez generycznych AI aesthetics (Kuba tego pilnuje!). Show-before-commit (poligon + headless-screenshot). `.pl-card`/`pc-`/`ls-`/`lc-` = frost, ostre krawędzie, żywa krawędź. `stamp-version.mjs` przed każdym pushem JS/CSS. Funkcje-treść (marquee, autoplay) działają u KAŻDEGO — nie bramkować za prefers-reduced-motion.
