<?php
/**
 * serwer-init-baza.php — JEDNORAZOWE założenie bazy testerów Qplayera.
 *
 * Uruchamiany RĘCZNIE na serwerze (php CLI), nie z przeglądarki. Nie leży w public_html
 * i nie jedzie z deployem strony — to narzędzie, nie część witryny.
 *
 * Tworzy:
 *   ~/domains/qubatura.eu/dane/qplayer.sqlite   ← baza (POZA public_html)
 *   ~/domains/qubatura.eu/dane/konfig.php       ← ścieżka do bazy + hash hasła do panelu
 *
 * Uruchomienie drugi raz NIE nadpisuje bazy — przerywa. Kody generuje się raz.
 */

declare(strict_types=1);

const ALFABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const WAZNY_DO = '2026-08-31';     // koniec okresu testowego — sprzedaż rusza we wrześniu
const LIMIT_INSTALACJI = 3;        // Mac + Windows + tablet: tak brzmi prośba w mailu

$KATALOG = getenv('HOME') . '/domains/qubatura.eu/dane';

/** Ten sam algorytm co w pobierz.php — literówka odpada bez pytania bazy. */
function zrobKod(): string {
    $tresc = '';
    for ($i = 0; $i < 11; $i++) $tresc .= ALFABET[random_int(0, strlen(ALFABET) - 1)];
    $suma = 0;
    for ($i = 0; $i < 11; $i++) $suma += strpos(ALFABET, $tresc[$i]) * ($i + 1);
    return $tresc . ALFABET[$suma % strlen(ALFABET)];
}

/** Do maila i na stronę: QP-XXXX-XXXX-XXXX. W bazie trzymamy postać bez myślników. */
function ozdob(string $kod): string {
    return 'QP-' . substr($kod, 0, 4) . '-' . substr($kod, 4, 4) . '-' . substr($kod, 8, 4);
}

// ── Katalog i zabezpieczenie ────────────────────────────────────────────────
if (!is_dir($KATALOG)) mkdir($KATALOG, 0700, true);
$db = $KATALOG . '/qplayer.sqlite';
if (file_exists($db)) {
    fwrite(STDERR, "PRZERWANE: baza juz istnieje ($db). Nie nadpisuje kodow.\n");
    exit(1);
}

$pdo = new PDO('sqlite:' . $db);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$pdo->exec("
CREATE TABLE kody (
  kod                TEXT PRIMARY KEY,      -- bez myslnikow, wielkie litery
  imie               TEXT NOT NULL,
  mail               TEXT,                  -- moze byc puste: Kuba dosle adresy
  firma              TEXT,
  wazny_do           TEXT,                  -- 'RRRR-MM-DD'
  instalacje_limit   INTEGER DEFAULT 3,
  blokuj_obce_maile  INTEGER DEFAULT 0,     -- domyslnie NIE blokujemy; wlacza sie recznie
  uniewazniony       INTEGER DEFAULT 0,
  notatka            TEXT,
  utworzony          TEXT
);
CREATE TABLE pobrania (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kod         TEXT, imie TEXT, mail TEXT, plik TEXT,
  ip          TEXT, ua TEXT, kiedy TEXT,
  wynik       TEXT,                         -- ok | zly-kod | po-terminie | obcy-mail | uniewazniony
  zgodny_mail INTEGER
);
CREATE INDEX ix_pobrania_kod ON pobrania(kod);
CREATE INDEX ix_pobrania_ip  ON pobrania(ip, kiedy);

-- Wypelni ENDPOINT LICENCYJNY, gdy stanie. Dzieki temu panel od poczatku ma miejsce
-- na odpowiedz 'czy on w ogole uruchomil', a nie tylko 'czy pobral'.
CREATE TABLE instalacje (
  instalacja_id    TEXT PRIMARY KEY,
  kod              TEXT, wersja TEXT, system TEXT,
  pierwszy_kontakt TEXT, ostatni_kontakt TEXT
);
");

// ── Ludzie ──────────────────────────────────────────────────────────────────
// Kolejnosc i pisownia wg listy Kuby z 01.08. Puste maile dosle wieczorem —
// kod dziala bez adresu, bo kluczem jest KOD, a mail tylko wiaze pobranie z czlowiekiem.
$ludzie = [
    ['Kasia Milewska',   'katarzynaamilewskaa@gmail.com', ''],
    ['Andrzej Prugar',   'prugar@radio.katowice.pl',      'Radio Katowice'],
    ['Andrzej Bochnar',  'bochnar@radio.katowice.pl',     'Radio Katowice'],
    ['Grzesiu Balewski', '',                              'Gbee'],
    ['Radek Barczak',    'info@portalnaglosnieniowy.eu',  'Portal naglosnieniowy'],
    ['Karol',            '',                              'events Krakow'],
    ['Bielsko 1',        '',                              'chlopcy z Bielska'],
    ['Lukasz Kedzia',    '',                              'Motus'],
    ['Tomek Kramarczyk', '',                              'Forfiter'],
    ['Mateusz Poliwoda', 'mateusz.poliwoda@lsvmp.pl',     'LSV'],
    ['Kuba Krzywak',     '',                              ''],
];

$ins = $pdo->prepare('INSERT INTO kody (kod, imie, mail, firma, wazny_do, instalacje_limit, utworzony)
                      VALUES (?,?,?,?,?,?,?)');
$teraz = gmdate('Y-m-d H:i:s');
$uzyte = [];
$wypisz = [];

foreach ($ludzie as [$imie, $mail, $firma]) {
    do { $k = zrobKod(); } while (isset($uzyte[$k]));
    $uzyte[$k] = true;
    $ins->execute([$k, $imie, $mail, $firma, WAZNY_DO, LIMIT_INSTALACJI, $teraz]);
    $wypisz[] = [ozdob($k), $imie, $firma, $mail ?: '— brak adresu —'];
}
for ($i = 1; $i <= 9; $i++) {                       // rezerwa: Bielsko, dogrywki, wpadki
    do { $k = zrobKod(); } while (isset($uzyte[$k]));
    $uzyte[$k] = true;
    $ins->execute([$k, 'REZERWA ' . $i, '', '', WAZNY_DO, LIMIT_INSTALACJI, $teraz]);
    $wypisz[] = [ozdob($k), 'REZERWA ' . $i, '', ''];
}

// ── Konfiguracja + haslo do panelu ──────────────────────────────────────────
$haslo = '';
for ($i = 0; $i < 14; $i++) $haslo .= ALFABET[random_int(0, strlen(ALFABET) - 1)];
$hash = password_hash($haslo, PASSWORD_DEFAULT);

file_put_contents($KATALOG . '/konfig.php',
    "<?php\n// Wygenerowane przez serwer-init-baza.php — NIE commitowac.\n"
  . '$DB_SCIEZKA = ' . var_export($db, true) . ";\n"
  . '$PANEL_HASLO_HASH = ' . var_export($hash, true) . ";\n");
chmod($KATALOG . '/konfig.php', 0600);
chmod($db, 0600);

printf("%-20s %-18s %-22s %s\n", 'KOD', 'IMIE', 'FIRMA', 'MAIL');
foreach ($wypisz as $w) printf("%-20s %-18s %-22s %s\n", $w[0], $w[1], $w[2], $w[3]);
printf("\nBaza:   %s\nWazne do: %s · instalacji na kod: %d\n", $db, WAZNY_DO, LIMIT_INSTALACJI);
printf("\nHASLO DO PANELU (zapisz teraz, nie da sie go odczytac pozniej):\n    %s\n", $haslo);
