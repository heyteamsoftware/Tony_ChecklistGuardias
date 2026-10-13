# Checklist de Guardia · CIFP Tony Gallardo

Checklist para el profesorado de guardia. Cada docente rellena su ronda desde el móvil
(pasillos, baños, puertas, aulas…) y el informe llega a una **hoja de Google en una carpeta
de Drive de Jefatura de Estudios**.

**URL:** https://myappsserver.duckdns.org/Tony_Guardias/ (se puede «Añadir a pantalla de inicio»).

## Cómo funciona

```
Móvil (app)  ──►  servidor del centro (api/enviar.php)  ──►  Google Apps Script  ──►  Hoja «Registro de guardias» (Drive)
                   └─ copia de cada ronda en /var/lib/tony-guardias
```

- **Primera vez:** nombre y apellidos (el móvil lo recuerda). El enlace es privado: se comparte solo con el profesorado.
- **Datos:** turno y franja (se marca sola la que está en curso), función si es recreo
  (puesto principal / ronda / patio) y cuántos docentes coinciden.
- **Checklist** (cada punto: Bien / Incidencia / No aplica, con la hora a la que se marcó):
  inicio en el puesto principal, coordinación, ausencias; en recreo, 2 personas en el puesto,
  control de DNI y patio; ronda por baños, pasillos, escaleras, zonas con poca visibilidad,
  zonas comunes, puertas y accesos, aulas y exteriores; y vuelta al puesto en los últimos 5 min.
- Plantas recorridas, grupos atendidos sin docente, entradas tardías / salidas anticipadas y observaciones.
- **Aviso de tiempo:** barra con los minutos que quedan; a 5 min del final se pone en rojo y vibra.
- **Sin cobertura:** la ronda se guarda en el móvil y se envía sola al volver la conexión.
  Si Google falla, el servidor la guarda y la reintenta cada 5 minutos (cron).
- Las incidencias marcadas como **urgentes** se resaltan en rojo en la hoja.

La hoja tiene tres pestañas: **Resumen** (rondas de hoy/semana, incidencias pendientes, rondas por
docente, incidencias por zona), **Registro** (una fila por ronda, una columna por punto) e
**Incidencias** (una fila por incidencia, con columna *Estado* Pendiente / En curso / Resuelta
y *Nota de Jefatura* para hacer el seguimiento).

## Puesta en marcha de la hoja de Drive (una sola vez)

1. Con la cuenta de Google de Jefatura (o la que vaya a ser dueña de la hoja), entra en
   <https://script.google.com> → **Nuevo proyecto**. Llámalo «Registro de guardias».
2. Borra lo que haya y pega `apps-script/Codigo.gs`. Opcional: `CARPETA_ID` si quieres usar una carpeta de Drive que ya existe.
3. Elige la función **configurar** → **Ejecutar** → acepta los permisos. En el registro de
   ejecución aparecen los enlaces de la carpeta y de la hoja creadas.
4. **Implementar → Nueva implementación → Aplicación web** · Ejecutar como: **Yo** ·
   Quién tiene acceso: **Cualquier usuario** → copia la URL que acaba en `/exec`.
5. Pon esa URL en el servidor, en `/var/lib/tony-guardias/config.php` (`apps_script_url`).
   Las rondas que ya se hayan hecho se envían solas en los 5 minutos siguientes.

> Si cambias el `.gs`: Implementar → Gestionar implementaciones → editar → Versión: *Nueva versión*
> (la URL no cambia).

## Servidor

| Pieza | Dónde |
|---|---|
| App (estática + `api/enviar.php`) | `/var/www/html/Tony_Guardias` |
| Configuración (URL y token de Apps Script) | `/var/lib/tony-guardias/config.php` (fuera de la web) |
| Copia de cada ronda | `/var/lib/tony-guardias/registros/AAAA-MM/*.json` |
| Pendientes de llegar a Drive | `/var/lib/tony-guardias/pendientes/` |
| Reintentos (cada 5 min) | `/etc/cron.d/tony-guardias` → `api/reintentar.php` |

Publicar cambios (desde Git Bash, en esta carpeta):

```bash
bash deploy/publicar.sh
```

Ejemplo: `SRV=ubuntu@IP_DEL_SERVIDOR bash deploy/publicar.sh /ruta/a/servidor-apps.key`.

## Personalizar

Todo el checklist, las franjas horarias, las plantas y el texto del recordatorio están en
`js/config.js`. Si se añade un punto nuevo, la hoja crea su columna automáticamente.
**Revisa las franjas horarias**: están puestas con sesiones de 55 min (mañana 8:00–14:00 y tarde
15:00–21:00, recreos 10:45 y 17:45).

