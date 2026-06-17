# Sesja 2026-06-17 (wieczór) — qubatura.eu

Branch: `dev` · ostatni commit: `e18dbac`

## Zrobione dziś

### Nawigacja / HUD (Etap 7 domknięcie)
- Ramki HUD: jedna pozioma linia usług z `·`, spójnie dla Events/Studio/Lab (10px, ls 0.02em, nowrap, padding 14px).
- Events `right:18`, Studio `left:0`, Lab wycentrowany (`text-align:center`).
- **fix:** reset stanu HUD przy powrocie na HOME (`resetNavState()` w `navigation.js`, wołane z `router.js` w `closePage()`) — wcześniej guard trybu strony blokował `mouseleave` i ramki zostawały „zamrożone".

### Topbar / tagline
- Header zawsze widoczny (usunięty auto-hide, `#top-right` opacity 1, z-index 100).
- Gap 26px; baza 0.45 → hover 1.0 na CONTACT/EN/waveform.
- Przełącznik języka pokazuje język docelowy (PL→EN), domyślnie PL.
- Tagline w lewym-dolnym rogu (2.5%), hover 0.45→1.0, `cursor:none`.

### Kursor (nowy moduł `cursor.js`)
- Globalny `cursor:none !important`, własna kulka sterowana GSAP (zero CSS transition).
- HOME: idle 6px magenta / nav 14px kolor dywizji / sygnet 18px biały + pulse 1.2s / topbar+tagline 10px magenta. Powrót do idle 0.3s.
- Podstrony: idle magenta, nad interaktywnymi → akcent aktualnej dywizji.
- Hover sygnetu wykrywany geometrycznie (odległość od środka).

### Contact overlay (`contact.js`) + favicon
- Kontakt = **fullscreen overlay** (`#contact-overlay`, z-index 1000), NIE podstrona. Usunięta trasa `/contact` i `page-contact` z routera.
- Trigger `[data-contact]` (KONTAKT w topbarze, CTA podstron).
- Tło `rgba(10,10,15,0.40)` + `blur(8px)` — żywa scena prześwituje. Wejście GSAP opacity+scale, stagger treści (koordynaty → miasto → dane → social).
- Zamykanie: „← Powrót" (komponent jak `#page-back`, biały hover), klik w tło, Escape.
- Treść: `50°17'N · 19°08'E` / `ŚLĄSK · POLSKA`, mail + tel, QR placeholder (ramka HUD), social FA (FB + LinkedIn aktywne, TikTok/IG placeholder).
- Kursor nad koordynatami → stan signet (18px biały). `#cursor` z-index 2000 (nad overlay).
- **fix:** `#contact-close z-index:10` — `.contact-inner` (100%×100%) zasłaniał przycisk i przechwytywał klik/hover.
- Favicon `assets/favicon.svg` (ścieżka sygnetu, fill `#5B2EFF`), link w `<head>`.
- Font Awesome przez CDN cdnjs 6.5.1.

## Commity dzisiejszej sesji (na `dev`)
- `e18dbac` fix(contact): klikalny przycisk powrotu + biały hover
- `2e1adbe` feat(contact+favicon): fullscreen contact overlay + favicon sygnetu
- `51004b1` feat(cursor): stanowy kursor GSAP (home + podstrony + tagline)
- `8d3af66` fix(nav): reset stanu HUD przy powrocie na HOME
- `132aaa5` feat(pages): podstrony SPA (Etap 10) + tła dywizji + galeria Events
- (+ wcześniejsze: nav HUD, topbar, tagline)

## NIE wypchnięte / do ogarnięcia
- **Brak git remote** — repo lokalne, nie ma `origin`. Push i GitHub Pages niemożliwe do czasu podpięcia repo na GitHub.
- Niezacommitowane (spoza wątku): `atmosphere.js` (M), `signet-hologram.js` (??), `assets/ref-creatures.png` (??) — decyzja: commit czy czyścić.
- Caveat produkcyjny: SPA na History API — refresh na `/events` da 404 na statycznym serwerze; potrzebny fallback rewrite na `index.html` (albo hash routing).

## Dalej
- Etap 9: loading screen (animacja sygnetu GSAP + przejście do sceny).
- Dostrojenia podstron (pozycja galerii / sygnetu-logo na różnych aspektach, scrim teł).
- Treść/copy podstron + tłumaczenie i18n (przełącznik na razie tylko przełącza stan, nie tłumaczy).
