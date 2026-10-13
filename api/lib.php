<?php
// Utilidades compartidas por enviar.php y reintentar.php.
declare(strict_types=1);

date_default_timezone_set('Atlantic/Canary');

const CONFIG_POR_DEFECTO = '/var/lib/tony-guardias/config.php';

function config(): array
{
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $ruta = getenv('TONY_GUARDIAS_CONFIG') ?: CONFIG_POR_DEFECTO;
    $cfg = is_file($ruta) ? (require $ruta) : [];
    $cfg += [
        'apps_script_url'   => '',
        'apps_script_token' => '',
        'datos_dir'         => dirname($ruta),
    ];
    return $cfg;
}

function dir_datos(string $sub = ''): string
{
    $d = rtrim(config()['datos_dir'], '/') . ($sub !== '' ? '/' . $sub : '');
    if (!is_dir($d)) mkdir($d, 0770, true);
    return $d;
}

function escribir_json(string $ruta, array $datos): void
{
    $tmp = $ruta . '.' . bin2hex(random_bytes(4)) . '.tmp';
    file_put_contents($tmp, json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    rename($tmp, $ruta);
}

/** Envía un registro a Google Apps Script. Devuelve true si la hoja lo ha aceptado. */
function enviar_a_drive(array $registro, ?string &$error = null): bool
{
    $cfg = config();
    if ($cfg['apps_script_url'] === '' || $cfg['apps_script_token'] === '') {
        $error = 'sin_configurar';
        return false;
    }
    $ch = curl_init($cfg['apps_script_url']);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(['token' => $cfg['apps_script_token'], 'registro' => $registro], JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER     => ['Content-Type: text/plain;charset=utf-8'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true, // Apps Script responde con una redirección a la respuesta
        CURLOPT_MAXREDIRS      => 5,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT        => 25,
    ]);
    $cuerpo = curl_exec($ch);
    $codigo = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $errCurl = curl_error($ch);
    curl_close($ch);

    if ($cuerpo === false) { $error = 'curl: ' . $errCurl; return false; }
    $r = json_decode((string) $cuerpo, true);
    if ($codigo !== 200 || !is_array($r) || empty($r['ok'])) {
        $error = 'HTTP ' . $codigo . ': ' . mb_substr(is_array($r) ? (string) ($r['error'] ?? '') : strip_tags((string) $cuerpo), 0, 200);
        return false;
    }
    return true;
}

/** Reintenta los registros que aún no han llegado a la hoja. */
function vaciar_pendientes(int $max = 20): array
{
    $ok = 0; $fallos = 0;
    foreach (array_slice(glob(dir_datos('pendientes') . '/*.json') ?: [], 0, $max) as $f) {
        $reg = json_decode((string) file_get_contents($f), true);
        if (!is_array($reg)) { rename($f, $f . '.corrupto'); continue; }
        $err = null;
        if (enviar_a_drive($reg, $err)) { unlink($f); $ok++; }
        else { $fallos++; registrar_log("pendiente {$reg['id']}: $err"); if ($err === 'sin_configurar') break; }
    }
    return ['enviados' => $ok, 'fallos' => $fallos];
}

function registrar_log(string $msg): void
{
    file_put_contents(dir_datos() . '/eventos.log', date('Y-m-d H:i:s') . ' ' . $msg . "\n", FILE_APPEND | LOCK_EX);
}
