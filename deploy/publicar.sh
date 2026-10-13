#!/usr/bin/env bash
# Publica la app en el servidor. Uso (Git Bash, desde la carpeta del proyecto):
#   bash deploy/publicar.sh [ruta-a-la-clave-ssh]
set -euo pipefail
# Datos del servidor: se pasan por variables de entorno, no van en este fichero.
#   SRV=usuario@ip-del-servidor  bash deploy/publicar.sh ruta/a/la-clave.key
KEY="${1:?Indica la ruta a la clave SSH como primer argumento}"
SRV="${SRV:?Define SRV=usuario@servidor}"
cd "$(dirname "$0")/.."
tar czf - --exclude=.git --exclude=apps-script --exclude='*.md' . | ssh -i "$KEY" "$SRV" '
  set -e
  sudo mkdir -p /var/www/html/Tony_Guardias /var/lib/tony-guardias
  sudo tar xzf - -C /var/www/html/Tony_Guardias
  sudo chown -R www-data:www-data /var/www/html/Tony_Guardias /var/lib/tony-guardias
  sudo find /var/www/html/Tony_Guardias -type d -exec chmod 755 {} + ; sudo find /var/www/html/Tony_Guardias -type f -exec chmod 644 {} +
  sudo chmod 770 /var/lib/tony-guardias
  sudo install -m 644 /var/www/html/Tony_Guardias/deploy/cron-reintentos /etc/cron.d/tony-guardias
  [ -f /var/lib/tony-guardias/config.php ] || { sudo cp /var/www/html/Tony_Guardias/api/config.ejemplo.php /var/lib/tony-guardias/config.php; echo "AVISO: rellena /var/lib/tony-guardias/config.php"; }
  sudo chown www-data:www-data /var/lib/tony-guardias/config.php; sudo chmod 640 /var/lib/tony-guardias/config.php
  echo publicado'
