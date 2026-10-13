<?php
// Contador de visitantes únicos (dispositivos distintos), anónimo.
//   POST {"id":"<identificador aleatorio del móvil>"}  → registra la visita y devuelve el total
//   GET                                                → devuelve el total
declare(strict_types=1);
require __DIR__ . '/lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function salir(int $codigo, array $datos): never
{
    http_response_code($codigo);
    echo json_encode($datos);
    exit;
}

try {
    $db = new PDO('sqlite:' . dir_datos() . '/visitas.db');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec('PRAGMA busy_timeout = 3000');
    $db->exec('CREATE TABLE IF NOT EXISTS visitantes (
        id TEXT PRIMARY KEY, primera INTEGER NOT NULL, ultima INTEGER NOT NULL, visitas INTEGER NOT NULL DEFAULT 1)');
    $db->exec('CREATE TABLE IF NOT EXISTS altas_ip (ip TEXT NOT NULL, hora INTEGER NOT NULL)');

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $in = json_decode((string) file_get_contents('php://input', false, null, 0, 1024), true);
        $id = is_array($in) ? (string) ($in['id'] ?? '') : '';
        if (!preg_match('/^[A-Za-z0-9-]{16,64}$/', $id)) salir(400, ['ok' => false]);

        $ahora = time();
        $upd = $db->prepare('UPDATE visitantes SET ultima = ?, visitas = visitas + 1 WHERE id = ?');
        $upd->execute([$ahora, $id]);
        if ($upd->rowCount() === 0) {
            // Visitante nuevo. Tope de altas por IP y hora, para que nadie pueda inflar el contador a base de ids falsos
            // (el centro comparte IP pública, por eso el tope es holgado).
            $ip = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? '0');
            $db->prepare('DELETE FROM altas_ip WHERE hora < ?')->execute([$ahora - 3600]);
            $n = $db->prepare('SELECT COUNT(*) FROM altas_ip WHERE ip = ?');
            $n->execute([$ip]);
            if ((int) $n->fetchColumn() < 300) {
                $db->prepare('INSERT OR IGNORE INTO visitantes (id, primera, ultima) VALUES (?, ?, ?)')->execute([$id, $ahora, $ahora]);
                $db->prepare('INSERT INTO altas_ip (ip, hora) VALUES (?, ?)')->execute([$ip, $ahora]);
            }
        }
    } elseif ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        salir(405, ['ok' => false]);
    }

    salir(200, ['ok' => true, 'total' => (int) $db->query('SELECT COUNT(*) FROM visitantes')->fetchColumn()]);
} catch (Throwable $e) {
    registrar_log('visitas: ' . $e->getMessage());
    salir(500, ['ok' => false]);
}
