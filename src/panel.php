<?php
/**
 * panel.php — mini CRM testerów Qplayera.
 *
 * Odpowiada na dwa pytania, które Kuba zadaje naprawdę:
 *   1. Kto pobrał, co pobrał i ile mu zostało instalacji.
 *   2. Czy w ogóle uruchomił — kolumna „ostatni kontakt" wypełni się, gdy stanie
 *      endpoint licencyjny; do tego czasu stoi „—" i to jest uczciwy stan, nie błąd.
 *
 * Ręczna ingerencja per osoba (o to prosił): przedłuż termin, dodaj instalację,
 * zablokuj obce adresy, unieważnij, dopisz notatkę.
 *
 * Hasło: hash w ~/domains/qubatura.eu/dane/konfig.php (poza public_html).
 */

declare(strict_types=1);
session_start();
require __DIR__ . '/../dane/konfig.php';   // $DB_SCIEZKA, $PANEL_HASLO_HASH

function baza(): PDO {
    global $DB_SCIEZKA;
    $pdo = new PDO('sqlite:' . $DB_SCIEZKA);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    return $pdo;
}
function h(?string $s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function ozdob(string $k): string {
    return strlen($k) === 12 ? 'QP-' . substr($k,0,4) . '-' . substr($k,4,4) . '-' . substr($k,8,4) : $k;
}

// ── Logowanie ────────────────────────────────────────────────────────────────
if (isset($_GET['wyloguj'])) { session_destroy(); header('Location: /panel.php'); exit; }

if (empty($_SESSION['qp_ok'])) {
    $blad = '';
    if (($_POST['haslo'] ?? '') !== '') {
        // Opóźnienie po nieudanej próbie — zgadywanie hasła przestaje być opłacalne.
        if (password_verify((string)$_POST['haslo'], $PANEL_HASLO_HASH)) {
            $_SESSION['qp_ok'] = true;
            $_SESSION['token'] = bin2hex(random_bytes(16));
            header('Location: /panel.php'); exit;
        }
        sleep(2); $blad = 'Nie to hasło.';
    }
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
       . '<meta name="robots" content="noindex,nofollow">'   // panel nie ma prawa trafić do wyszukiwarki
       . '<title>Qplayer — panel</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;'
       . 'justify-content:center;background:#0A0A0F;color:#F3F1FF;font:15px system-ui,sans-serif}'
       . 'form{border:1px solid rgba(139,79,255,.3);padding:34px;background:#0E0B1A;width:300px}'
       . 'input{width:100%;box-sizing:border-box;margin:14px 0;padding:12px;background:#07060D;'
       . 'border:1px solid rgba(139,79,255,.35);color:#F3F1FF;font:14px monospace}'
       . 'button{width:100%;padding:12px;background:#8B4FFF;color:#0B0714;border:0;font-weight:700;cursor:pointer}'
       . 'p{color:#ff8080;font-size:13px;margin:8px 0 0}</style>'
       . '<form method="post"><b>Qplayer — panel testerów</b>'
       . '<input type="password" name="haslo" autofocus placeholder="hasło">'
       . '<button>Wejdź</button>' . ($blad ? '<p>' . h($blad) . '</p>' : '') . '</form>';
    exit;
}

$pdo = baza();

// ── Akcje (POST) ─────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['token'] ?? '') === ($_SESSION['token'] ?? '~')) {
    $kod = (string)($_POST['kod'] ?? '');
    switch ($_POST['akcja'] ?? '') {
        case 'zapisz':
            $pdo->prepare('UPDATE kody SET imie=?, mail=?, firma=?, wazny_do=?, instalacje_limit=?,
                           blokuj_obce_maile=?, uniewazniony=?, notatka=? WHERE kod=?')
                ->execute([
                    trim((string)$_POST['imie']), trim((string)$_POST['mail']), trim((string)$_POST['firma']),
                    trim((string)$_POST['wazny_do']), max(1, (int)$_POST['instalacje_limit']),
                    isset($_POST['blokuj']) ? 1 : 0, isset($_POST['uniewazniony']) ? 1 : 0,
                    trim((string)$_POST['notatka']), $kod,
                ]);
            break;
        case 'instalacja_plus':
            $pdo->prepare('UPDATE kody SET instalacje_limit = instalacje_limit + 1 WHERE kod=?')->execute([$kod]);
            break;
        case 'przedluz':
            $pdo->prepare("UPDATE kody SET wazny_do = date(wazny_do, '+30 days') WHERE kod=?")->execute([$kod]);
            break;
        // Znacznik wysyłki. Trzymamy DATĘ, nie „tak/nie": ptaszek mówi tylko, że poszło,
        // a data mówi „ma to od trzech dni i nie pobrał" — czyli kiedy przypomnieć.
        case 'mail_wyslany':
            $pdo->prepare("UPDATE kody SET mail_wyslany = CASE WHEN mail_wyslany IS NULL OR mail_wyslany = ''
                           THEN date('now') ELSE NULL END WHERE kod = ?")->execute([$kod]);
            break;
    }
    header('Location: /panel.php'); exit;
}

// ── Dane ─────────────────────────────────────────────────────────────────────
$kody = $pdo->query('
    SELECT k.*,
      (SELECT COUNT(*) FROM pobrania p WHERE p.kod=k.kod AND p.wynik="ok")        AS pobran,
      (SELECT MAX(kiedy) FROM pobrania p WHERE p.kod=k.kod AND p.wynik="ok")      AS ostatnie_pobranie,
      (SELECT COUNT(*) FROM instalacje i WHERE i.kod=k.kod)                       AS instalacji,
      (SELECT MAX(ostatni_kontakt) FROM instalacje i WHERE i.kod=k.kod)           AS ostatni_kontakt
    FROM kody k ORDER BY (k.imie LIKE "REZERWA%"), k.imie')->fetchAll(PDO::FETCH_ASSOC);

$log = $pdo->query('SELECT * FROM pobrania ORDER BY id DESC LIMIT 40')->fetchAll(PDO::FETCH_ASSOC);
$tok = h($_SESSION['token']);
header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Qplayer — panel testerów</title>
<style>
 body{margin:0;background:#0A0A0F;color:#F3F1FF;font:14px/1.5 system-ui,-apple-system,sans-serif;padding:26px}
 h1{font-size:19px;margin:0 0 4px} .sub{color:rgba(243,241,255,.45);font-size:12.5px;margin:0 0 22px}
 a{color:#A472FF} table{width:100%;border-collapse:collapse;margin-bottom:34px}
 th{text-align:left;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;
    color:rgba(243,241,255,.4);border-bottom:1px solid rgba(139,79,255,.25);padding:8px 10px;font-weight:400}
 td{padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.06);vertical-align:top}
 tr.rez td{opacity:.42} tr.blok td{background:rgba(255,90,90,.06)}
 .kod{font-family:ui-monospace,monospace;font-size:12.5px;color:#A472FF;white-space:nowrap}
 .mut{color:rgba(243,241,255,.4)} .ok{color:#7FE3A0} .zle{color:#FF7A7A}
 details{margin:0} summary{cursor:pointer;color:rgba(243,241,255,.5);font-size:12px}
 form.edy{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-top:10px;
   padding:12px;background:rgba(139,79,255,.06);border:1px solid rgba(139,79,255,.2)}
 input,textarea{background:#07060D;border:1px solid rgba(139,79,255,.3);color:#F3F1FF;padding:8px;
   font:12.5px ui-monospace,monospace;width:100%;box-sizing:border-box}
 label{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(243,241,255,.42)}
 button{background:#8B4FFF;color:#0B0714;border:0;padding:9px 14px;font-weight:700;font-size:12px;cursor:pointer}
 button.sec{background:rgba(139,79,255,.18);color:#F3F1FF}
 .ptk{display:flex;align-items:center;gap:6px;font-size:12px;color:rgba(243,241,255,.7);text-transform:none;letter-spacing:0}
 /* Znacznik wysyłki maila — jedno kliknięcie, ale zapisuje DATĘ, nie samo „tak”. */
 td.wys{white-space:nowrap;text-align:center}
 td.wys form{display:inline}
 button.ptak{background:none;border:1px solid rgba(139,79,255,.35);color:rgba(243,241,255,.45);
   padding:3px 8px;font-size:14px;line-height:1;cursor:pointer}
 button.ptak.jest{background:rgba(127,227,160,.14);border-color:rgba(127,227,160,.5);color:#7FE3A0}
 td.wys .mut{display:block;font-size:10.5px;margin-top:3px}
</style></head><body>

<h1>Qplayer — panel testerów</h1>
<p class="sub">Baza poza public_html · <a href="/panel.php?wyloguj=1">wyloguj</a></p>

<table>
 <tr><th>Mail</th><th>Kod</th><th>Osoba</th><th>Ważny do</th><th>Pobrania</th><th>Instalacje</th><th>Ostatni kontakt</th><th></th></tr>
 <?php foreach ($kody as $k):
   $rez = strpos((string)$k['imie'], 'REZERWA') === 0;
   $po  = $k['wazny_do'] && $k['wazny_do'] < gmdate('Y-m-d'); ?>
 <tr class="<?= $rez ? 'rez' : '' ?><?= !empty($k['uniewazniony']) ? ' blok' : '' ?>">
   <td class="wys">
     <form method="post">
       <input type="hidden" name="token" value="<?= $tok ?>">
       <input type="hidden" name="kod" value="<?= h($k['kod']) ?>">
       <button class="ptak <?= !empty($k['mail_wyslany']) ? 'jest' : '' ?>" name="akcja" value="mail_wyslany"
               title="<?= !empty($k['mail_wyslany']) ? 'Wysłano ' . h($k['mail_wyslany']) . ' — kliknij, żeby cofnąć' : 'Oznacz jako wysłany' ?>">
         <?= !empty($k['mail_wyslany']) ? '&#10003;' : '&#9744;' ?>
       </button>
     </form>
     <?php if (!empty($k['mail_wyslany'])): ?>
       <span class="mut"><?= h(substr((string)$k['mail_wyslany'], 5)) ?></span>
     <?php endif; ?>
   </td>
   <td class="kod"><?= h(ozdob($k['kod'])) ?></td>
   <td><?= h($k['imie']) ?><?php if ($k['firma']): ?><br><span class="mut"><?= h($k['firma']) ?></span><?php endif; ?>
       <?php if ($k['mail']): ?><br><span class="mut"><?= h($k['mail']) ?></span>
       <?php else: ?><br><span class="zle">brak adresu</span><?php endif; ?></td>
   <td class="<?= $po ? 'zle' : '' ?>"><?= h($k['wazny_do']) ?><?= $po ? ' · po terminie' : '' ?></td>
   <td><?= (int)$k['pobran'] ?><?php if ($k['ostatnie_pobranie']): ?>
       <br><span class="mut"><?= h(substr((string)$k['ostatnie_pobranie'], 0, 16)) ?></span><?php endif; ?></td>
   <td><?= (int)$k['instalacji'] ?> / <?= (int)$k['instalacje_limit'] ?></td>
   <td class="mut"><?= $k['ostatni_kontakt'] ? h(substr((string)$k['ostatni_kontakt'],0,16)) : '—' ?></td>
   <td>
     <details><summary>zmień</summary>
       <form class="edy" method="post">
         <input type="hidden" name="token" value="<?= $tok ?>">
         <input type="hidden" name="kod" value="<?= h($k['kod']) ?>">
         <input type="hidden" name="akcja" value="zapisz">
         <div><label>Imię</label><input name="imie" value="<?= h($k['imie']) ?>"></div>
         <div><label>Mail</label><input name="mail" value="<?= h($k['mail']) ?>"></div>
         <div><label>Firma</label><input name="firma" value="<?= h($k['firma']) ?>"></div>
         <div><label>Ważny do</label><input name="wazny_do" value="<?= h($k['wazny_do']) ?>"></div>
         <div><label>Instalacji</label><input name="instalacje_limit" value="<?= (int)$k['instalacje_limit'] ?>"></div>
         <div><label>Notatka</label><input name="notatka" value="<?= h($k['notatka']) ?>"></div>
         <div><label class="ptk"><input type="checkbox" name="blokuj" style="width:auto"
              <?= !empty($k['blokuj_obce_maile']) ? 'checked' : '' ?>> blokuj obce adresy</label></div>
         <div><label class="ptk"><input type="checkbox" name="uniewazniony" style="width:auto"
              <?= !empty($k['uniewazniony']) ? 'checked' : '' ?>> unieważnij kod</label></div>
         <div><button>Zapisz</button></div>
       </form>
       <form method="post" style="margin-top:8px;display:flex;gap:8px">
         <input type="hidden" name="token" value="<?= $tok ?>">
         <input type="hidden" name="kod" value="<?= h($k['kod']) ?>">
         <button class="sec" name="akcja" value="instalacja_plus">+1 instalacja</button>
         <button class="sec" name="akcja" value="przedluz">+30 dni</button>
       </form>
     </details>
   </td>
 </tr>
 <?php endforeach; ?>
</table>

<h1>Ostatnie próby pobrania</h1>
<p class="sub">Każda próba — udana i nieudana. To jest pierwsze źródło wiedzy o tym, kto realnie wszedł.</p>
<table>
 <tr><th>Kiedy (UTC)</th><th>Kod</th><th>Podał</th><th>Plik</th><th>Wynik</th><th>Mail zgodny</th></tr>
 <?php foreach ($log as $p): ?>
 <tr>
   <td class="mut"><?= h(substr((string)$p['kiedy'],0,16)) ?></td>
   <td class="kod"><?= h($p['kod'] ? ozdob($p['kod']) : '—') ?></td>
   <td><?= h($p['imie']) ?><br><span class="mut"><?= h($p['mail']) ?></span></td>
   <td class="mut"><?= h($p['plik']) ?></td>
   <td class="<?= $p['wynik'] === 'ok' ? 'ok' : 'zle' ?>"><?= h($p['wynik']) ?></td>
   <td><?= $p['zgodny_mail'] === null ? '<span class="mut">—</span>'
        : ($p['zgodny_mail'] ? '<span class="ok">tak</span>' : '<span class="zle">nie</span>') ?></td>
 </tr>
 <?php endforeach; ?>
</table>
</body></html>
