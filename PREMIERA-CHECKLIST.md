# PREMIERA — checklist qubatura.eu

**Kontekst:** 5 lat firmy + link na LinkedIn (aplikacja do ElevenLabs). Cel: strona **LIVE na własnej domenie**, pro, z działającym kontaktem. Zasada: live z drobiazgami > idealna nieopublikowana. Resztę ogarniamy systemem list po premierze.

---

## 🔴 BLOKERY — bez tego nie wychodzimy

- [ ] **Formularz realnie wysyła.** Teraz `WEB3FORMS_KEY` pusty (`src/js/contact-console.js`) = tryb podglądu, zgłoszenia przepadają. → klucz Web3Forms (szybko) **albo** PHP na IQ Host (docelowo, dane zostają na serwerze Kuby).
- [ ] **Deploy na `qubatura.eu`** (IQ Host, podmiana „w budowie"). Link na LinkedIn = własna domena, nie github.io.

## 🟠 WAŻNE — zanim wrzucisz link na LinkedIn

- [ ] **og-image działa pod domeną.** Share na LinkedIn renderuje kartę (obrazek+tytuł). Sprawdzić że `https://qubatura.eu/assets/og-image.png` NIE 404-uje. (Jak 404 → podgląd zepsuty = źle na aplikacji.)
- [ ] **Favicon** — wpiąć `assets/favicon-dark.svg` (gotowy) w `index.html` (dziś jeszcze stary `favicon.svg`) + apple-touch-icon 180 + png 32 fallback.
- [ ] **Teksty — widoczne/krytyczne** — zbiorcza lista Kuby; przynajmniej literówki i placeholdery na żywej stronie (Lab/showcase/karta = teraz robocze).

## 🟡 TEST na urządzeniach

- [ ] **Mac** (Kuba — ocena całości)
- [ ] **iOS** — TYLKO przez HTTPS (localhost/http maskuje bugi)
- [ ] **Android**
- [ ] Klucz: formularz → wyślij → mail dochodzi na biuro@qubatura.eu

## ✅ JUŻ GOTOWE (dla spokoju)

- ✅ Karta produktu Qplayer (3/4, spec-sheet, 6 funkcji)
- ✅ Showcase „na zamówienie" + 5 mockupów (iframe + ‹ ›)
- ✅ Deep-link CTA → formularz z torem Lab
- ✅ Kafle Qplayer/Qtune symetryczne
- ✅ Mini-player (magenta→primary, puls), cookie (klimat)
- ✅ Polityka prywatności + RODO + cookie consent + honeypot
- ✅ SEO: `<title>`, OG/Twitter, canonical, sitemap.xml, JSON-LD (NIP/legalName)

## 🕒 PO PREMIERZE (system list Kuby)

- [ ] Studio „ożywiony monitor"
- [ ] Events CTA „Zaprojektuj event"
- [ ] 3. utwór playera (Relax, `Qubatura.eu-relax.mp3`)
- [ ] Kolejne mockupy w showcase (rozszerzalna tablica MOCKUPS)
- [ ] Tła działów (B-1 → webp) na Events/Studio/Lab
- [ ] EN i18n (`#lang-toggle` jest w nav) — pod Awwwards
- [ ] Mikro-poprawki z listy Kuby

---

## 🎯 Strategicznie pod ElevenLabs (audio-AI)
Najmocniejsze karty: **Studio** (produkcja audio) + **Qplayer/Qtune** (software audio, samodzielnie zbudowany). Inżynier dźwięku który *koduje własne narzędzia* = ich język. Te dwie sekcje dopiąć na ostatni guzik; reszta może być „w budowie".

---
*Zestawić z listą braków Kuby po review na Macu.*
