<?php
// send.php — odbiór formularza Kontakt z qubatura.eu → mail na biuro@qubatura.eu.
// Kompatybilne z PHP 7.4 (IQ Host). Bez zależności. JSON in/out.
// Dane zostają na serwerze (żaden pośrednik) — czysto pod RODO.

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(array('ok' => false, 'error' => 'method'));
    exit;
}

// body: JSON (fetch application/json) albo zwykły POST
$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) { $data = $_POST; }

$get = function ($k) use ($data) {
    return isset($data[$k]) ? trim((string) $data[$k]) : '';
};

// honeypot — bot wypełnił ukryte pole → udajemy sukces, ale NIE wysyłamy
if ($get('botcheck') !== '') {
    echo json_encode(array('ok' => true));
    exit;
}

$name    = $get('name');
$kontakt = $get('kontakt');
$message = $get('message');
$subject = $get('subject');
if ($subject === '') { $subject = 'Nowy sygnał — qubatura.eu'; }

// nic sensownego → odrzuć
if ($message === '' && $kontakt === '') {
    http_response_code(422);
    echo json_encode(array('ok' => false, 'error' => 'empty'));
    exit;
}

// anty header-injection: bez CR/LF w polach trafiających do nagłówków
$noCRLF = function ($s) { return str_replace(array("\r", "\n"), ' ', $s); };
$subject = $noCRLF($subject);

$to   = 'biuro@qubatura.eu';
$body =
    "Nowy sygnał z qubatura.eu\n\n" .
    "Imię:    " . ($name    !== '' ? $name    : '(brak)') . "\n" .
    "Kontakt: " . ($kontakt !== '' ? $kontakt : '(brak)') . "\n\n" .
    "Wiadomość:\n" . $message . "\n";

$headers  = "From: qubatura.eu <no-reply@qubatura.eu>\r\n";
if (filter_var($kontakt, FILTER_VALIDATE_EMAIL)) {
    $headers .= "Reply-To: " . $noCRLF($kontakt) . "\r\n";
}
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=utf-8\r\n";

// temat z polskimi znakami → MIME-encode
$subjectEnc = '=?UTF-8?B?' . base64_encode($subject) . '?=';

$ok = @mail($to, $subjectEnc, $body, $headers);

if ($ok) {
    echo json_encode(array('ok' => true));
} else {
    http_response_code(500);
    echo json_encode(array('ok' => false, 'error' => 'mail'));
}
