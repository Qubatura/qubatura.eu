# PRD — Qubatura Group / qubatura.eu
**Wersja:** 3.0
**Data:** 2026-06-13
**Właściciel:** Kuba Hyrja
**Stack docelowy:** HTML / CSS / JS / Three.js / GSAP
**Hosting:** IQHost HS25 / DirectAdmin / IP: 195.117.36.228

---

## 1. Cel i filozofia

Qubatura Group — firma wielobranżowa: Events, Studio, Lab.
Strona główna = wizytówka grupy. Jedno zadanie: zbudować wrażenie marki premium i skierować do właściwej dywizji.

**Zasada nadrzędna:** Minimalna typografia. Maksymalny efekt wizualny. Każde słowo musi zarabiać na swoje miejsce.

**DNA marki:** Cywilizacja która opanowała dźwięk i światło jako technologię. Nie ziemska firma — coś z innego wymiaru. Kosmiczne, organiczne, elektryczne. Ukłon w stronę Nikoli Tesli — prąd jest w powietrzu.

**Referencja wizualna:** activetheory.net — wejście jako rytuał, wszystko żyje, przejścia = teleportacja, monumentalna rzadka typografia. Qubatura vs ActiveTheory: oni zimni/korporacyjni — my organiczni, ciepli, kosmiczni.

---

## 2. System kolorów — FINALNY

```css
/* Tło */
--color-bg:          #0A0A0F;

/* Marka / brand */
--color-primary:     #5B2EFF;   /* fiolet główny — sygnet, UI */
--color-accent:      #E0218A;   /* magenta — akcent marki, HOME pulse */

/* Dywizje */
--color-events:      #7C3AED;   /* fiolet premium */
--color-studio:      #1E90FF;   /* elektryczny błękit */
--color-lab:         #00E5FF;   /* elektryczny cyjan */

/* Typografia */
--color-white:       #FFFFFF;
--color-white-dim:   rgba(255,255,255,0.35);
```

⚠️ Kolory z PRD v2 (#F5A623, #00D4FF, #39FF14, #3D1A7F, #1B3FD8) są NIEAKTUALNE.

---

## 3. Typografia

- **Display / nagłówki:** Chakra Petch (technologiczny, kanciasty)
- **UI / etykiety / mono:** Space Mono
- Wszystko uppercase lub sentence case — nigdy mixed
- Letter-spacing szeroki na etykietach (0.15–0.25em)
- Font docelowy produkcyjny: TBD (kierunek zatwierdzony)

---

## 4. Architektura

```
qubatura.eu/          ← HOME
qubatura.eu/events    ← Qubatura Events
qubatura.eu/studio    ← Studio Q
qubatura.eu/lab       ← Qubatura Lab
qubatura.eu/contact   ← Kontakt
```

Routing: SPA-like, Vanilla JS History API — bez przeładowania strony.
Przejścia między stronami: GSAP, teleportation feel.

---

## 5. HOME — szczegółowy opis

### 5.1 Zasady ogólne
- Zero scrolla
- Brak logo/sygnetu w nagłówku (sygnet jest bohaterem centralnym)
- Nawigacja kierunkowa, nie klasyczne menu

### 5.2 Nagłówek (top bar)
- Lewy górny: pusty
- Prawy górny: `CONTACT` — spacja — `PL / EN`
- Prawy górny (przy CONTACT): toggle dźwięku — animowany waveform, klik = ambient
- Font: Space Mono, 10px, letter-spacing 0.18em, color: rgba(255,255,255,0.25)
- Pojawia się przy hover, znika w idle

### 5.3 Tło — "Planeta Qubatura"
Trzy warstwy (od tyłu):

**Warstwa 1 — planeta (statyczna):**
- Plik: `assets/planet-bg.png` (4K, dostarcza Kuba)
- Opacity: 15–20%
- Zawiera: miasto na horyzoncie, centralna wieża z wiązką światła, dwa księżyce (fioletowy + magenta)
- NIE animowana — siedzi cicho

**Warstwa 2 — mgła elektryczna:**
- Shader noise/nebula (Three.js fragment shader lub canvas 2D)
- Kolor bazowy: głęboki granat/ultramaryna, bardzo niska opacity
- Reaguje na hover nawigacji: tintuje się kolorem hoverowanej dywizji (płynne 0.8s)
- Delikatne błyski corona discharge: rzadkie (2–3 co 10 sekund), krótkie, ultra-subtelne
  - Kolor: biało-fioletowy baseline, adoptuje kolor dywizji przy hover
  - Długość: 15–35px, czas życia: 6–8 klatek

**Warstwa 3 — DNA infinity creatures:**
Patrz sekcja 5.4

### 5.4 DNA Infinity Creatures — specyfikacja

**Kształt:** Lemniskata Lissajous (ósemka ∞)
```
x(t) = cx + RX * sin(t)
y(t) = cy + RY * sin(2t) / 2
t ∈ [0, 2π]
```

**Parametry sugerowane:** RX ≈ 100–160px, RY ≈ 60–90px (skalowane względem viewport)

**Dwie orbity:**
- Dwie offsetowane ścieżki wzdłuż lemniskata (offset ±D wzdłuż normalnej do krzywej)
- BEZ mostków DNA — tylko czyste dwie linie
- Linie: cienkie (1–2px), kolor --color-primary z niską opacity (0.4–0.6)

**3D efekt — kluczowe:**
- W punkcie przecięcia ósemki (t=0 i t=π) jedna linia przechodzi "nad" drugą
- Realizacja: z-ordering (Three.js naturalny) lub canvas masking w 2D
- Całość powoli rotuje wokół własnej osi — organiczne wicie się, nie mechaniczne

**Elektrony — serce wizualne:**
- Dwa elektrony na orbitach, przeciwne kierunki, lekko różna prędkość
- Zostawiają długi świecący ślad (trail) — ślad IS ciałem stworzenia
- Additive blending dla glow — nie CSS shadow, nie canvas shadowBlur
- Kolor baseline: --color-accent (magenta) puls
- Przy hover nawigacji: adoptują kolor dywizji

**Zachowanie przy hover nav:**
- Cała scena tintuje kolor dywizji (mocny, wyraźny tint — nie subtelny hint)
- Elektrony zmieniają kolor pulsacji
- Mgła adoptuje kolor

**Ilość na ekranie:** 8–10 stworków
**Rozmiar:** różnicowany, większe i mniejsze
**Ruch:** swobodny po ekranie, łagodne zmiany kierunku
**Reakcja na kursor:** zbliżają się / intensywnieją przy bliskości myszy (< 200px)

### 5.5 Sygnet centralny

**Źródło:** `assets/signet.svg` — wyciągnięty z `qubaturalogopoziomblack.pdf` przez Inkscape CLI
**Realizacja produkcyjna:** Three.js — SVGLoader + ExtrudeGeometry lub Blender → GLB

**Rozmiar:** duży, dominujący — minimum 120px radius, docelowo ~15% viewport height

**Zachowania:**
- Idle: delikatna pulsacja glow (--color-primary)
- Mouse proximity: fiolet → magenta + glow rośnie proporcjonalnie do bliskości
- Mouse hover/click: burst światła — intensywny flash, potem powrót
- (v2) Powolna rotacja w 3D — do implementacji po podstawach

**Pozycja:** centrum ekranu, bez logo w topbarze na HOME

### 5.6 Nawigacja kierunkowa

Trzy kierunki wychodzące z sygnetu — BLISKO sygnetu, oczywista droga:

| Kierunek | Dywizja | Kolor |
|----------|---------|-------|
| ← lewo   | Events  | #7C3AED |
| → prawo  | Studio  | #1E90FF |
| ↓ dół    | Lab     | #00E5FF |

**Układ każdego kierunku:** sygnet → linia świetlna → napis dywizji
- Linia: cienka (1px), kolor dywizji, glow neonowy za linią i napisem
- Napis: Chakra Petch, 11px, uppercase, letter-spacing 0.2em
- Hover: linia wydłuża się + intensywność glow rośnie + pojawia się tooltip

**Tooltip (hover bez kliku):**
- Mała ramka z 1–2 zdaniami opisu dywizji
- Events: "Nagłośnienie · Oświetlenie · Streaming"
- Studio: "Audiobooki · Sound design · Binaural"
- Lab: "3D · Mapping · IoT · Web"

**Tagline:** `PRZYBYWAMY Z SYGNAŁEM` — centered, bottom area, Space Mono, bardzo mała opacity

### 5.7 Audio
- Brak autoplay
- Animowany waveform toggle (top-right, przy CONTACT)
- Klik → ambient dźwięk "qubaturowy"
- HOME zaprasza dźwiękiem, Studio daje treść

---

## 6. Podstrony dywizji — wspólne zasady

- To samo tło co HOME ale tintowane kolorem dywizji
- Tło docelowe: unikalne per dywizja (generowane Open Art) — na starcie: czarne
- Sygnet w lewym górnym rogu = przycisk powrotu do HOME
- Scroll dozwolony
- Spójny system typografii z HOME
- SPA transition przy wejściu (GSAP)

---

## 7. Qubatura Events
**Kolor akcentu:** #7C3AED

**Sekcje:**
1. **Hero** — mocne zdjęcie lub reel loop (autoplay muted)
2. **Kompetencje** — ikonki + loga sprzętu: DiGiCo, Allen & Heath, Midas, Robe, Clay Paky, Chamsys
3. **Portfolio** — slideshow: hotele, konferencje, koncerty
4. **Formularz wyceny:**
   - Ile osób / gdzie / kiedy / rider T/N
   - Upload zdjęć lokalizacji
   - Telefon + email
   - Obietnica: 7 dni → wizualizacja + wycena
5. **Kontakt bezpośredni** — telefon zawsze widoczny (klient dzwoni, wygrywa kto odbierze)

---

## 8. Studio Q
**Kolor akcentu:** #1E90FF

**Sekcje:**
1. **Hero** — zdjęcia studia, cinematic
2. **Player audio** — Web Audio API:
   - Fragment audiobooka
   - Miks binauralny → obowiązkowy komunikat "ZAŁÓŻ SŁUCHAWKI"
   - Sound design sample
3. **Usługi** — produkcja muzyczna, audiobooki, słuchowiska, sound design, lektorzy, pomiary akustyczne
4. **Realizacje** — logotypy klientów (SQN Kraków i inni)
5. **Kontakt**

---

## 9. Qubatura Lab
**Kolor akcentu:** #00E5FF

**Sekcje:**
1. **Hero** — wizualizacje / renders projektów
2. **Kompetencje** — druk 3D, mapping, IoT, projekty techniczne, web design / UX
3. **Projekty** — galeria realizacji
4. **Kontakt**

---

## 10. Stack techniczny

| Warstwa | Technologia |
|---------|-------------|
| 3D / Particles | Three.js r160+ |
| Animacje | GSAP 3 |
| Shadery | GLSL fragment shader |
| DNA creatures | Three.js + lemniskata parametryczna |
| Sygnet 3D | Three.js SVGLoader + ExtrudeGeometry |
| Audio | Web Audio API |
| Routing | Vanilla JS History API |
| Fonty | Chakra Petch + Space Mono (Google Fonts) |
| SEO | JSON-LD + sr-only HTML |
| i18n | lang.pl.js / lang.en.js |
| Hosting | DirectAdmin / IQHost HS25 |
| Formularz | Formspree lub PHP (TBD) |

---

## 11. SEO
- Meta tagi: title, description, og:image, og:title
- Schema.org: Organization + LocalBusiness JSON-LD
- Semantyczny HTML sr-only na HOME
- Sitemap.xml + robots.txt
- Treść SEO na PODSTRONACH — HOME = brand impression

---

## 12. Co NIE wchodzi w scope HOME
- Blog / aktualności
- Cennik
- Duże bloki tekstu
- Klasyczne menu poziome
- Social media feed

---

## 13. Otwarte decyzje

- [ ] Font display produkcyjny (Chakra Petch = kierunek, finalna decyzja TBD)
- [ ] Formularz: PHP backend vs Formspree
- [ ] Analytics: GA4 vs Plausible
- [ ] Tła podstron: Open Art (dostarczy Kuba gdy budowa dojrzeje)
- [ ] Tagline finalny: "Przybywamy z sygnałem" — kandydat, nie zatwierdzone 100%

---

*PRD v3.0 — sesja 2026-06-13. Zastępuje PRD v2.0.*
