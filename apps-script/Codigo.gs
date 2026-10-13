/**
 * Registro de guardias · CIFP Tony Gallardo
 * Backend en Google Apps Script: recibe las rondas desde el servidor del centro
 * y las anota en una hoja de cálculo dentro de una carpeta de Drive de Jefatura (sin correos).
 *
 * Puesta en marcha (ver README.md):
 *   1. Pega este código en un proyecto nuevo de https://script.google.com
 *   2. Ejecuta la función «configurar» y acepta los permisos.
 *   3. Implementar → Nueva implementación → Aplicación web
 *      (Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario)
 */

// ── Ajustes ────────────────────────────────────────────────────────────────
const TOKEN = 'CAMBIAR_POR_UN_TOKEN_PROPIO';        // el mismo valor que apps_script_token en el servidor (api/config.ejemplo.php)
const CARPETA_ID = '1MK1ctP2YQcrD6-GpnokvnXnFTZE-9BEc'; // carpeta de Drive de Jefatura (vacío = crea una nueva)

// ── Estructura de la hoja ──────────────────────────────────────────────────
const H_REGISTRO = ['ID', 'Recibido', 'Fecha', 'Turno', 'Franja', 'Horario', 'Tipo', 'Función recreo', 'Docente',
  'Nº docentes', 'Compañeros', 'Inicio ronda', 'Envío', 'Revisados', 'Incidencias', 'Urgentes', 'Plantas',
  'Grupos atendidos', 'Entradas tardías', 'Salidas anticipadas', 'Observaciones'];
const H_INCIDENCIAS = ['Fecha', 'Hora', 'Docente', 'Franja', 'Zona / punto', 'Descripción', 'Urgente', 'Estado',
  'Nota de Jefatura', 'ID ronda'];
const ESTADOS_INC = ['Pendiente', 'En curso', 'Resuelta'];
const AZUL = '#0d2b5e', GRANATE = '#8e1b2c';

function doPost(e) {
  let d = {};
  try { d = JSON.parse(e.postData.contents); } catch (_) { return json_({ ok: false, error: 'JSON no válido' }); }
  if (d.token !== TOKEN) return json_({ ok: false, error: 'No autorizado' });
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    return json_(registrar_(d.registro));
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  const id = PropertiesService.getScriptProperties().getProperty('HOJA_ID');
  return json_({ ok: true, app: 'Registro de guardias', configurada: !!id });
}

function registrar_(r) {
  if (!r || !r.id) return { ok: false, error: 'Registro vacío' };
  const ss = hoja_();
  const reg = ss.getSheetByName('Registro');

  // Idempotente: si el servidor reintenta, no se duplica.
  if (reg.getLastRow() > 1 && reg.getRange(2, 1, reg.getLastRow() - 1, 1)
        .createTextFinder(r.id).matchEntireCell(true).findNext()) {
    return { ok: true, duplicado: true };
  }

  const puntos = r.puntos || [];
  const incs = puntos.filter(p => p.estado === 'inc');
  const urgentes = incs.filter(p => p.urgente);
  const fecha = fechaDe_(r.fecha);

  // Lo primero: el fichero de la ronda en la carpeta (día · hora · docente).
  crearInforme_(r, incs.length);

  // Una columna por punto del checklist (se crean solas si se añaden puntos nuevos).
  const cab = reg.getRange(1, 1, 1, reg.getLastColumn()).getValues()[0];
  const fila = [
    r.id, new Date(), fecha, r.turno, r.franja, r.franjaHoras, r.tipo, r.funcion, r.docente,
    r.nDocentes, r.companeros, r.horaInicio, r.horaEnvio,
    puntos.filter(p => p.estado).length + '/' + puntos.length, incs.length, urgentes.length,
    (r.plantas || []).join(', '), (r.grupos || []).join(' · '), r.entradasTardias, r.salidasAnticipadas, r.observaciones,
  ];
  for (const p of puntos) {
    let col = cab.indexOf(p.texto);
    if (col < 0) {
      col = cab.length; cab.push(p.texto);
      reg.getRange(1, col + 1).setValue(p.texto).setFontWeight('bold').setBackground(AZUL).setFontColor('#ffffff').setWrap(true);
      reg.setColumnWidth(col + 1, 150);
    }
    while (fila.length <= col) fila.push('');
    fila[col] = celdaPunto_(p);
  }
  reg.appendRow(fila.map((v, i) => i === 0 ? v : t_(v)));
  const n = reg.getLastRow();
  reg.getRange(n, 3).setNumberFormat('dd/mm/yyyy');
  reg.getRange(n, 2).setNumberFormat('dd/mm/yyyy hh:mm');

  if (incs.length) {
    const inc = ss.getSheetByName('Incidencias');
    const filas = incs.map(p => [fecha, p.hora || r.horaEnvio || '', r.docente,
      r.franja + ' (' + r.franjaHoras + ')', p.texto, p.nota || '(sin descripción)', p.urgente ? 'Sí' : 'No', 'Pendiente', '', r.id]
      .map((v, i) => i === 0 || i === 9 ? v : t_(v)));
    const ini = inc.getLastRow() + 1;
    inc.getRange(ini, 1, filas.length, filas[0].length).setValues(filas);
    inc.getRange(ini, 1, filas.length, 1).setNumberFormat('dd/mm/yyyy');
  }

  return { ok: true };
}

// ── Informe PDF de cada ronda, en la carpeta de Drive ──────────────────────
function nombreInforme_(r) {
  const limpio = t => String(t || '').replace(/[\\/:*?"<>|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  return (r.fecha + ' ' + (r.horaEnvio || '00:00') + ' · ' + limpio(r.docente) + ' · ' + limpio(r.franja)).slice(0, 120);
}

function carpeta_() {
  if (CARPETA_ID) return DriveApp.getFolderById(CARPETA_ID);
  return DriveApp.getFileById(PropertiesService.getScriptProperties().getProperty('HOJA_ID')).getParents().next();
}

function crearInforme_(r, nIncs) {
  const carpeta = carpeta_();
  const nombre = nombreInforme_(r) + '.pdf';
  // Idempotente: si el servidor reintenta, no se crea dos veces el mismo fichero.
  const ya = carpeta.getFilesByName(nombre);
  while (ya.hasNext()) if (ya.next().getDescription() === r.id) return;

  const e = h_;
  const fila = (a, b) => b ? '<tr><td class="k">' + a + '</td><td>' + e(b) + '</td></tr>' : '';
  const color = { ok: '#138a52', inc: '#c2410c', na: '#64748b', '': '#94a3b8' };
  const etiqueta = { ok: 'Sí', inc: 'Incidencia', na: 'No', '': 'Sin responder' };
  let seccion = '', puntos = '';
  for (const p of (r.puntos || [])) {
    if (p.seccion !== seccion) { seccion = p.seccion; puntos += '<tr><td colspan="3" class="sec">' + e(seccion) + '</td></tr>'; }
    puntos += '<tr><td>' + e(p.texto) + (p.nota ? '<div class="nota">' + (p.urgente ? '🔴 URGENTE · ' : '') + e(p.nota) + '</div>' : '') + '</td>' +
      '<td style="color:' + color[p.estado || ''] + ';font-weight:bold;white-space:nowrap">' + etiqueta[p.estado || ''] + '</td>' +
      '<td class="h">' + e(p.hora || '') + '</td></tr>';
  }
  const html = '<html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,sans-serif;color:#1b2433;font-size:11pt}h1{color:#0d2b5e;font-size:17pt;margin:0}' +
    '.sub{color:#5d6b80;margin:2px 0 14px}table{border-collapse:collapse;width:100%;margin-bottom:12px}' +
    'td{padding:5px 7px;border-bottom:1px solid #e2e8f0;vertical-align:top}td.k{width:32%;color:#5d6b80}' +
    '.sec{background:#0d2b5e;color:#fff;font-weight:bold}.h{color:#5d6b80;text-align:right}' +
    '.nota{margin-top:3px;padding:4px 6px;background:#fff1e8;color:#7c2d12;font-size:10pt}' +
    '.alerta{background:#fde2e4;color:#8e1b2c;padding:7px 9px;font-weight:bold;margin-bottom:10px}' +
    '</style></head><body>' +
    '<h1>Ronda de guardia · CIFP Tony Gallardo</h1>' +
    '<div class="sub">' + e(r.fecha) + ' · ' + e(r.turno) + ' · ' + e(r.franja) + ' (' + e(r.franjaHoras) + ')</div>' +
    (nIncs ? '<div class="alerta">' + nIncs + ' incidencia' + (nIncs > 1 ? 's' : '') + ' en esta ronda</div>' : '') +
    '<table>' + fila('Docente de guardia', r.docente) + fila('Tipo', r.tipo + (r.funcion ? ' · ' + r.funcion : '')) +
    fila('Docentes en la franja', String(r.nDocentes || 1)) + fila('Compañeros/as', r.companeros) +
    fila('Inicio de la ronda', r.horaInicio) + fila('Envío', r.horaEnvio) +
    fila('Plantas recorridas', (r.plantas || []).join(', ')) + fila('Grupos atendidos sin docente', (r.grupos || []).join(' · ')) +
    fila('Entradas tardías / salidas anticipadas', r.entradasTardias + ' / ' + r.salidasAnticipadas) + '</table>' +
    '<table>' + puntos + '</table>' +
    (r.observaciones ? '<table>' + fila('Observaciones', r.observaciones) + '</table>' : '') +
    '</body></html>';

  const pdf = Utilities.newBlob(html, 'text/html', 'informe.html').getAs('application/pdf').setName(nombre);
  carpeta.createFile(pdf).setDescription(r.id);
}

function h_(t) {
  return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function celdaPunto_(p) {
  const h = p.hora ? ' ' + p.hora : '';
  if (p.estado === 'ok') return 'Sí' + h;
  if (p.estado === 'na') return 'No' + h;
  if (p.estado === 'inc') return (p.urgente ? '🔴 ' : '') + 'Incidencia' + h + (p.nota ? ': ' + p.nota : '');
  return 'Sin responder';
}


// ── Configuración inicial (ejecutar una vez desde el editor) ───────────────
function configurar() {
  const props = PropertiesService.getScriptProperties();
  let ss = props.getProperty('HOJA_ID') ? SpreadsheetApp.openById(props.getProperty('HOJA_ID')) : null;
  let carpeta;
  if (!ss) {
    carpeta = CARPETA_ID ? DriveApp.getFolderById(CARPETA_ID) : DriveApp.createFolder('Guardias · CIFP Tony Gallardo');
    ss = SpreadsheetApp.create('Registro de guardias · CIFP Tony Gallardo');
    DriveApp.getFileById(ss.getId()).moveTo(carpeta);
    props.setProperty('HOJA_ID', ss.getId());
  } else {
    carpeta = DriveApp.getFileById(ss.getId()).getParents().next();
  }
  // en_US: las fórmulas del Resumen llevan comas; con es_ES (coma decimal) darían #ERROR!. Las fechas tienen formato propio.
  ss.setSpreadsheetLocale('en_US');
  ss.setSpreadsheetTimeZone('Atlantic/Canary');

  const reg = hojaCon_(ss, 'Registro', H_REGISTRO);
  [260, 120, 90, 70, 70, 90, 70, 110, 190, 70, 160, 70, 70, 75, 80, 70, 160, 200, 70, 70, 280]
    .forEach((w, i) => reg.setColumnWidth(i + 1, w));
  reg.hideColumns(1);
  const inc = hojaCon_(ss, 'Incidencias', H_INCIDENCIAS);
  [90, 60, 180, 140, 190, 340, 70, 100, 260, 80].forEach((w, i) => inc.setColumnWidth(i + 1, w));
  inc.getRange('H2:H').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS_INC, true).build());
  inc.getRange('F2:F').setWrap(true);
  inc.setConditionalFormatRules([
    regla_(inc, '=$H2="Resuelta"', '#e3f6ec', '#138a52'),
    regla_(inc, '=AND($G2="Sí",$H2<>"Resuelta")', '#fde2e4', GRANATE),
    regla_(inc, '=$H2="En curso"', '#fff8e1', '#6b4f00'),
  ]);
  reg.setConditionalFormatRules([regla_(reg, '=$P2>0', '#fde2e4', GRANATE), regla_(reg, '=$O2>0', '#fff1e8', '#7c2d12')]);

  resumen_(ss);
  const sobra = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (sobra && ss.getSheets().length > 1) ss.deleteSheet(sobra);
  ss.setActiveSheet(ss.getSheetByName('Resumen')); ss.moveActiveSheet(1);

  Logger.log('Carpeta: ' + carpeta.getUrl());
  Logger.log('Hoja:    ' + ss.getUrl());
}

function hojaCon_(ss, nombre, cab) {
  const h = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
  h.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold')
    .setBackground(AZUL).setFontColor('#ffffff').setVerticalAlignment('middle').setWrap(true);
  h.setFrozenRows(1);
  h.setRowHeight(1, 36);
  return h;
}

function regla_(h, formula, fondo, texto) {
  return SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(formula)
    .setBackground(fondo).setFontColor(texto).setRanges([h.getRange('A2:Z')]).build();
}

function resumen_(ss) {
  const h = ss.getSheetByName('Resumen') || ss.insertSheet('Resumen');
  h.clear();
  h.getRange('A1').setValue('Seguimiento de las guardias · CIFP Tony Gallardo')
    .setFontSize(16).setFontWeight('bold').setFontColor(AZUL);
  const kpis = [
    // setFormula usa siempre la sintaxis en inglés (comas), sea cual sea el idioma de la hoja.
    ['Rondas hoy', '=COUNTIF(Registro!C2:C,TODAY())'],
    ['Rondas esta semana', '=COUNTIFS(Registro!C2:C,">="&(TODAY()-WEEKDAY(TODAY(),2)+1),Registro!C2:C,"<="&TODAY())'],
    ['Rondas totales', '=COUNTA(Registro!A2:A)'],
    ['Incidencias pendientes', '=COUNTIF(Incidencias!H2:H,"Pendiente")'],
    ['Urgentes sin resolver', '=COUNTIFS(Incidencias!G2:G,"Sí",Incidencias!H2:H,"<>Resuelta")'],
  ];
  h.getRange(3, 1, kpis.length, 1).setValues(kpis.map(k => [k[0]]));
  h.getRange(3, 2, kpis.length, 1).setFormulas(kpis.map(k => [k[1]]));
  h.getRange(3, 1, kpis.length, 1).setFontColor('#5d6b80');
  h.getRange(3, 2, kpis.length, 1).setFontWeight('bold').setFontSize(14).setHorizontalAlignment('left');
  h.getRange('A10').setValue('Rondas por docente').setFontWeight('bold').setFontColor(AZUL);
  h.getRange('A11').setFormula('=IFERROR(QUERY(Registro!A:P,"select I, count(A), sum(O), max(C) where A is not null group by I order by count(A) desc label I \'Docente\', count(A) \'Rondas\', sum(O) \'Incidencias\', max(C) \'Última\'",1),"Aún no hay rondas")');
  h.getRange('F10').setValue('Incidencias por zona').setFontWeight('bold').setFontColor(AZUL);
  h.getRange('F11').setFormula('=IFERROR(QUERY(Incidencias!A:H,"select E, count(A) where A is not null group by E order by count(A) desc label E \'Zona\', count(A) \'Incidencias\'",1),"Sin incidencias")');
  h.getRange('D12:D').setNumberFormat('dd/mm/yyyy');   // la columna «Última» sale como número de serie si no
  h.setColumnWidth(1, 220); h.setColumnWidth(6, 220);
}

// ── Utilidades ─────────────────────────────────────────────────────────────
function hoja_() {
  // La primera vez crea la hoja en la carpeta, aunque no se haya ejecutado «configurar» a mano.
  if (!PropertiesService.getScriptProperties().getProperty('HOJA_ID')) configurar();
  return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('HOJA_ID'));
}

function fechaDe_(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
}

// Texto tal cual: evita que Sheets convierta «10:12» o «1/3» y que un texto que empiece por «=» sea una fórmula.
function t_(v) {
  return (typeof v === 'string' && v !== '') ? "'" + v : v;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
