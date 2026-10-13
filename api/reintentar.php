<?php
// Reenvía a la hoja de Google las rondas que no llegaron (cron cada 5 minutos).
// Solo se ejecuta por línea de comandos: php api/reintentar.php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/lib.php';

$r = vaciar_pendientes(100);
if ($r['enviados'] || $r['fallos']) echo date('c') . " enviados={$r['enviados']} fallos={$r['fallos']}\n";
