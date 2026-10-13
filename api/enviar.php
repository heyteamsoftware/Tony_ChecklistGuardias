<?php
// API de la app: registra rondas de guardia.
// Cada ronda se guarda en el servidor y se reenvía a la hoja de Google (Jefatura).
declare(strict_types=1);
require __DIR__ . '/lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function responder(int $codigo, array $datos): never
{
    http_response_code($codigo);
    echo json_encode($datos, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') responder(405, ['ok' => false, 'error' => 'Método no permitido']);

$crudo = file_get_contents('php://input', false, null, 0, 65536);
$in = json_decode((string) $crudo, true);
if (!is_array($in)) responder(400, ['ok' => false, 'error' => 'Petición no válida']);

if (($in['accion'] ?? '') !== 'registrar') responder(400, ['ok' => false, 'error' => 'Acción desconocida']);

// ── Validación del registro ────────────────────────────────────────────────
$r = $in['registro'] ?? null;
if (!is_array($r)) responder(400, ['ok' => false, 'error' => 'Falta el registro']);

$txt = fn($v, int $max) => mb_substr(trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string) ($v ?? ''))), 0, $max);
$ent = fn($v, int $min, int $max) => max($min, min($max, (int) $v));
$hora = fn($v) => preg_match('/^\d{2}:\d{2}$/', (string) $v) ? (string) $v : '';

$id = (string) ($r['id'] ?? '');
if (!preg_match('/^[A-Za-z0-9-]{8,64}$/', $id)) responder(400, ['ok' => false, 'error' => 'Identificador no válido']);
$fecha = (string) ($r['fecha'] ?? '');
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha) || abs(strtotime($fecha) - time()) > 40 * 86400) {
    responder(400, ['ok' => false, 'error' => 'Fecha no válida']);
}
$docente = $txt($r['docente'] ?? '', 80);
if (mb_strlen($docente) < 3) responder(400, ['ok' => false, 'error' => 'Falta el nombre del docente']);

$estados = ['ok', 'inc', 'na', ''];
$puntos = [];
foreach (array_slice(is_array($r['puntos'] ?? null) ? $r['puntos'] : [], 0, 40) as $p) {
    if (!is_array($p)) continue;
    $estado = in_array($p['estado'] ?? '', $estados, true) ? $p['estado'] : '';
    $puntos[] = [
        'id'      => $txt($p['id'] ?? '', 40),
        'seccion' => $txt($p['seccion'] ?? '', 60),
        'texto'   => $txt($p['texto'] ?? '', 120),
        'estado'  => $estado,
        'hora'    => $hora($p['hora'] ?? ''),
        'nota'    => $estado === 'inc' ? $txt($p['nota'] ?? '', 600) : '',
        'urgente' => $estado === 'inc' && !empty($p['urgente']),
    ];
}
$lista = fn($v, int $n, int $max) => array_values(array_filter(array_map(fn($x) => $txt($x, $max), array_slice(is_array($v) ? $v : [], 0, $n)), 'strlen'));

$registro = [
    'id'                 => $id,
    'recibido'           => date('Y-m-d H:i:s'),
    'fecha'              => $fecha,
    'docente'            => $docente,
    'turno'              => $txt($r['turno'] ?? '', 20),
    'franja'             => $txt($r['franja'] ?? '', 30),
    'franjaHoras'        => $txt($r['franjaHoras'] ?? '', 20),
    'tipo'               => ($r['tipo'] ?? '') === 'Recreo' ? 'Recreo' : 'Guardia',
    'funcion'            => $txt($r['funcion'] ?? '', 40),
    'nDocentes'          => $ent($r['nDocentes'] ?? 1, 1, 99),
    'companeros'         => $txt($r['companeros'] ?? '', 200),
    'horaInicio'         => $hora($r['horaInicio'] ?? ''),
    'horaEnvio'          => $hora($r['horaEnvio'] ?? ''),
    'puntos'             => $puntos,
    'plantas'            => $lista($r['plantas'] ?? [], 10, 30),
    'grupos'             => $lista($r['grupos'] ?? [], 20, 60),
    'entradasTardias'    => $ent($r['entradasTardias'] ?? 0, 0, 99),
    'salidasAnticipadas' => $ent($r['salidasAnticipadas'] ?? 0, 0, 99),
    'observaciones'      => $txt($r['observaciones'] ?? '', 1500),
];

// ── Guardado (idempotente: reenviar el mismo id no duplica) ────────────────
$dirMes = dir_datos('registros/' . substr($fecha, 0, 7));
$fReg = "$dirMes/$id.json";
if (is_file($fReg)) {
    $enDrive = !is_file(dir_datos('pendientes') . "/$id.json");
    responder(200, ['ok' => true, 'duplicado' => true, 'drive' => $enDrive]);
}
escribir_json($fReg, $registro);

$err = null;
$enDrive = enviar_a_drive($registro, $err);
if (!$enDrive) {
    escribir_json(dir_datos('pendientes') . "/$id.json", $registro);
    if ($err !== 'sin_configurar') registrar_log("drive $id: $err");
} else {
    vaciar_pendientes(5); // aprovecha que Google responde para mandar lo atrasado
}

responder(200, ['ok' => true, 'drive' => $enDrive]);
