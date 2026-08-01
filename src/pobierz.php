<?php
/**
 * pobierz.php — bramka pobierania Qplayera.
 *
 * ZASADA: kluczem jest KOD, nie mail. Mail i imię służą do powiązania pobrania
 * z człowiekiem (CRM), ale NIE blokują — chyba że dla danego kodu włączono to ręcznie
 * w panelu. Powód: to jest jedenastu znajomych z branży, a nie system antypiracki;
 * odbicie kogoś od drzwi w sobotę o 22:00 kosztuje więcej, niż jest warte.
 *
 * Kod ma sumę kontrolną, więc LITERÓWKA odpada tu, lokalnie, zanim ruszymy bazę.
 *
 * Plik bazy leży POZA public_html — z przeglądarki nie da się go pobrać.
 */

declare(strict_types=1);

const ALFABET   = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';   // bez 0/O i 1/I/L — kod ma się dać podyktować
const KATALOG   = '/pobierz/q7f3a91c/';                 // nieodgadywalny; zmiana nazwy unieważnia stare linki
// ⚠️ NAZWY SĄ ZASZYTE Z NUMEREM WERSJI. Przy każdym wydaniu: najpierw wgraj wszystkie
// trzy paczki na serwer, POTEM podmień te trzy linie, i dopiero wtedy skasuj stare.
// Odwrotna kolejność daje 404 u człowieka, który ma poprawny kod — czyli dokładnie
// tego, kogo najmniej stać na naszą pomyłkę.
const PLIKI     = [
    'win'   => 'Qplayer-Setup-0.66.5.exe',
    'arm'   => 'Qplayer-0.66.5-arm64.dmg',
    'intel' => 'Qplayer-0.66.5-intel.dmg',
];
const LIMIT_PROB = 25;      // nieudanych prób z jednego IP na 10 minut

require __DIR__ . '/../dane/konfig.php';   // $DB_SCIEZKA, $PANEL_HASLO_HASH

/**
 * Kandydaci na kod z tego, co człowiek wpisał. Myślniki, spacje i wielkość liter
 * są bez znaczenia; znaki spoza alfabetu (0, O, 1, I, L) wypadają.
 *
 * ⚠️ PUŁAPKA, która raz już nas ugryzła: przedrostek marki „QP-" NIE jest częścią kodu,
 * ale litery Q i P NALEŻĄ do alfabetu — więc samo czyszczenie zostawiało 14 znaków
 * i suma kontrolna odrzucała POPRAWNY kod. Nie da się tego rozstrzygnąć na sztywno,
 * bo losowy kod też może zaczynać się od „QP". Dlatego zwracamy oba warianty
 * i sprawdzamy, który przechodzi sumę kontrolną.
 */
function kandydaci(string $s): array {
    $c = preg_replace('/[^' . ALFABET . ']/', '', strtoupper(trim($s))) ?? '';
    $out = [];
    if (strlen($c) === 12) $out[] = $c;                                   // wklejony sam kod
    if (strlen($c) === 14 && substr($c, 0, 2) === 'QP') $out[] = substr($c, 2);   // z przedrostkiem
    return $out;
}

/** Suma kontrolna: ostatni znak = f(reszta). Łapie literówkę bez pytania bazy. */
function sumaOk(string $kod): bool {
    if (strlen($kod) !== 12) return false;
    $tresc = substr($kod, 0, 11);
    $suma = 0;
    for ($i = 0; $i < 11; $i++) {
        $p = strpos(ALFABET, $tresc[$i]);
        if ($p === false) return false;
        $suma += $p * ($i + 1);
    }
    return $kod[11] === ALFABET[$suma % strlen(ALFABET)];
}

function baza(): PDO {
    global $DB_SCIEZKA;
    $pdo = new PDO('sqlite:' . $DB_SCIEZKA);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    return $pdo;
}

/** Strona błędu w stylistyce marki. Zawsze z drogą powrotu — nigdy ślepy zaułek. */
function odmowa(string $tytul, string $tresc, int $status = 400): void {
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="pl"><head><meta charset="utf-8">'
       . '<meta name="viewport" content="width=device-width,initial-scale=1">'
       . '<title>Qplayer — ' . htmlspecialchars($tytul) . '</title><style>'
       . 'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;'
       . 'background:#0A0A0F;color:#F3F1FF;font:15px/1.65 system-ui,-apple-system,sans-serif;padding:24px}'
       . '.k{max-width:520px;border:1px solid rgba(139,79,255,.28);padding:38px;background:#0E0B1A}'
       . 'h1{font-size:22px;margin:0 0 14px;letter-spacing:-.02em}'
       . 'p{color:rgba(243,241,255,.7);margin:0 0 22px}'
       . 'a{display:inline-block;padding:12px 22px;background:#8B4FFF;color:#0B0714;'
       . 'text-decoration:none;font-weight:700;font-size:13px;letter-spacing:.1em;text-transform:uppercase}'
       . '</style></head><body><div class="k"><h1>' . htmlspecialchars($tytul) . '</h1><p>'
       . $tresc . '</p><a href="/qplayer">‹ Wróć do Qplayera</a></div></body></html>';
    exit;
}

// ── Wejście ──────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /qplayer', true, 302);
    exit;
}

$imie = trim((string)($_POST['imie'] ?? ''));
$mail = trim((string)($_POST['mail'] ?? ''));
$kodW = (string)($_POST['kod']  ?? '');
$plik = (string)($_POST['plik'] ?? '');
$ip   = (string)($_SERVER['REMOTE_ADDR'] ?? '');
$ua   = substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300);
$teraz = gmdate('Y-m-d H:i:s');

if (!isset(PLIKI[$plik])) {
    odmowa('Nie wiadomo, którą paczkę', 'Wybierz system, dla którego chcesz pobrać program.');
}
if ($imie === '' || !filter_var($mail, FILTER_VALIDATE_EMAIL)) {
    odmowa('Brakuje imienia albo adresu', 'Potrzebujemy obu, żeby wiedzieć, kto testuje — i żeby móc się odezwać.');
}

// Z kandydatów zostaje ten, który przechodzi sumę kontrolną. Gdy żaden — to literówka.
$kod = '';
foreach (kandydaci($kodW) as $k) { if (sumaOk($k)) { $kod = $k; break; } }
$pdo = baza();

// Zapora na zgadywanie kodów. Przy jedenastu osobach to teoria, ale kosztuje trzy linijki.
$prob = $pdo->prepare("SELECT COUNT(*) FROM pobrania WHERE ip = ? AND wynik = 'zly-kod' AND kiedy > datetime('now','-10 minutes')");
$prob->execute([$ip]);
if ((int)$prob->fetchColumn() >= LIMIT_PROB) {
    odmowa('Za dużo prób', 'Odczekaj kilka minut i spróbuj ponownie.', 429);
}

/** Zapis KAŻDEJ próby — udanej i nie. To jest pierwsze źródło danych CRM-u. */
$zapisz = function (string $wynik, ?int $zgodnyMail = null) use ($pdo, $kod, $imie, $mail, $plik, $ip, $ua, $teraz) {
    $pdo->prepare('INSERT INTO pobrania (kod, imie, mail, plik, ip, ua, kiedy, wynik, zgodny_mail)
                   VALUES (?,?,?,?,?,?,?,?,?)')
        ->execute([$kod, $imie, $mail, $plik, $ip, $ua, $teraz, $wynik, $zgodnyMail]);
};

if ($kod === '') {                         // literówka — rozstrzygnięta bez pytania bazy
    $zapisz('zly-kod');
    odmowa('Ten kod jest niepoprawny', 'Sprawdź, czy nie wkradła się literówka. Najprościej: kliknij link z maila — kod wpisze się sam.');
}

$st = $pdo->prepare('SELECT * FROM kody WHERE kod = ?');
$st->execute([$kod]);
$rek = $st->fetch(PDO::FETCH_ASSOC);

if (!$rek) {
    $zapisz('zly-kod');
    odmowa('Nie znamy tego kodu', 'Kod ma poprawną budowę, ale nie ma go na naszej liście. Napisz do nas: <b>biuro@qubatura.eu</b>');
}
if (!empty($rek['uniewazniony'])) {
    $zapisz('uniewazniony');
    odmowa('Ten kod został wycofany', 'Napisz do nas, a wyślemy nowy: <b>biuro@qubatura.eu</b>');
}
if (!empty($rek['wazny_do']) && $rek['wazny_do'] < gmdate('Y-m-d')) {
    $zapisz('po-terminie');
    odmowa('Okres testowy się skończył', 'Ten kod był ważny do ' . htmlspecialchars($rek['wazny_do'])
        . '. Jeśli chcesz grać dalej — napisz: <b>biuro@qubatura.eu</b>');
}

// Mail: sprawdzamy zgodność zawsze, blokujemy tylko gdy tak ustawiono dla tego kodu.
$zgodny = (strcasecmp(trim((string)$rek['mail']), $mail) === 0) ? 1 : 0;
if (!$zgodny && !empty($rek['blokuj_obce_maile'])) {
    $zapisz('obcy-mail', 0);
    odmowa('Ten kod jest przypisany do innego adresu',
        'Jeśli chcesz pobrać na inny adres, napisz do nas: <b>biuro@qubatura.eu</b>');
}

$zapisz('ok', $zgodny);
header('Location: ' . KATALOG . rawurlencode(PLIKI[$plik]), true, 302);
