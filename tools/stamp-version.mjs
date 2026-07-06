#!/usr/bin/env node
// stamp-version.mjs — cache-busting dla ES-modułów bez bundlera.
// Nadaje JEDEN wspólny token ?v=... wszystkim WZGLĘDNYM importom (./ lub ../) w src/js/*.js
// oraz wpisowi <script type="module" src="js/main.js"> w src/index.html.
// Dzięki temu jeden deploy busta CAŁY graf modułów (iOS Safari nie odświeża modułów przez ?v=
// na samym adresie strony — token musi siedzieć przy KAŻDYM module). Specyfikatory CDN
// ('three', 'three/addons/…', 'gsap') NIE są ruszane. Idempotentne: stary ?v= jest zastępowany.
//
// Użycie:  node tools/stamp-version.mjs           (token = aktualny czas, base36)
//          node tools/stamp-version.mjs 20260702a (własny token)
// URUCHAMIAĆ PRZED KAŻDYM push, gdy zmieniłeś pliki JS (albo zawsze — nie zaszkodzi).

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = (process.argv[2] || Date.now().toString(36)).trim();

// Względny specyfikator .js (./x.js lub ../x.js), z opcjonalnym istniejącym ?v=…
const relImport = /((?:from|import)\s*\(?\s*['"])(\.\.?\/[^'"?]+\.js)(?:\?v=[^'"]*)?(['"])/g;

let touched = 0;
const jsDir = join(ROOT, 'src', 'js');
for (const f of readdirSync(jsDir)) {
  if (!f.endsWith('.js')) continue;
  const p = join(jsDir, f);
  const src = readFileSync(p, 'utf8');
  const out = src.replace(relImport, (_m, a, spec, q) => `${a}${spec}?v=${TOKEN}${q}`);
  if (out !== src) { writeFileSync(p, out); touched++; }
}

// Wpis entry (JS) + arkusz CSS w index.html — oba cache'owane per-URL na iOS, więc oba stemplujemy
const htmlPath = join(ROOT, 'src', 'index.html');
const html = readFileSync(htmlPath, 'utf8');
const htmlOut = html
  .replace(
    /(<script\s+type="module"\s+src="js\/main\.js)(?:\?v=[^"]*)?(")/,
    `$1?v=${TOKEN}$2`
  )
  .replace(
    /(<link\s+rel="stylesheet"\s+href="css\/main\.css)(?:\?v=[^"]*)?(")/,
    `$1?v=${TOKEN}$2`
  )
  .replace(
    /(<link\s+rel="stylesheet"\s+href="css\/fonts\.css)(?:\?v=[^"]*)?(")/,
    `$1?v=${TOKEN}$2`
  );
if (htmlOut !== html) { writeFileSync(htmlPath, htmlOut); touched++; }

console.log(`stamp-version: token=${TOKEN}, zaktualizowano plików=${touched}`);
