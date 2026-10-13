/* Checklist de Guardia · CIFP Tony Gallardo */
(() => {
  'use strict';
  const C = window.GUARDIAS_CONFIG;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const K = { perfil: 'tg_perfil', borrador: 'tg_borrador', cola: 'tg_cola' };

  // ── Almacenamiento local (puede fallar en modo privado) ──────────────────
  const leer = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } };
  const guardar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  // El nombre y la ronda en curso NO se guardan en el móvil: se pide el nombre cada vez que se entra.
  // (Solo se conserva la cola de envíos pendientes sin cobertura, para no perder rondas ya hechas.)
  guardar(K.perfil, null); guardar(K.borrador, null);   // limpia restos de versiones anteriores
  let perfil = null;
  let st = null;

  // ── Utilidades ───────────────────────────────────────────────────────────
  const pad = n => String(n).padStart(2, '0');
  const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const aMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const minAhora = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };
  const fechaLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const franjas = () => C.turnos.flatMap(t => t.franjas.map(f => ({ ...f, turno: t.id, turnoNombre: t.nombre })));
  const franjaPorId = id => franjas().find(f => f.id === id);
  const franjaActual = () => { const m = minAhora(); return franjas().find(f => m >= aMin(f.ini) && m < aMin(f.fin)); };
  const vibrar = p => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };

  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('ver');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('ver'), 2600);
  }

  function mostrar(id) {
    $$('.vista').forEach(v => { v.hidden = v.id !== id; });
    if (id === 'v-acceso') $('#top-sub').textContent = C.centro;
    window.scrollTo({ top: 0 });
    actualizarAviso();
  }

  const nuevoEstado = () => {
    const f = franjaActual();
    return {
      id: uid(), turno: f ? f.turno : C.turnos[0].id, franja: f ? f.id : null, funcion: null,
      nDocentes: 1, companeros: '', inicio: null, puntos: {}, plantas: [], grupos: [],
      entradasTardias: 0, salidasAnticipadas: 0, obs: '', fase: 'datos',
    };
  };
  const persistir = () => {};   // la ronda en curso vive solo en memoria

  // ── Acceso ───────────────────────────────────────────────────────────────
  $('#f-acceso').addEventListener('submit', e => {
    e.preventDefault();
    const nombre = $('#acc-nombre').value.trim().replace(/\s+/g, ' ');
    const err = $('#acc-error');
    err.hidden = nombre.length >= 3;
    if (!err.hidden) { err.textContent = 'Escribe tu nombre y apellidos.'; return; }
    perfil = { nombre };
    arrancar();
  });

  $('#btn-cambiar').addEventListener('click', () => {
    if (st && st.fase === 'ronda' && !confirm('Se descartará la ronda en curso. ¿Cambiar de docente?')) return;
    perfil = null; st = null;
    $('#acc-nombre').value = '';
    mostrar('v-acceso');
  });

  // ── Paso 1: datos de la guardia ──────────────────────────────────────────
  function pintarDatos() {
    $('#d-nombre').textContent = perfil.nombre;
    $('#d-fecha').textContent = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    $('#lista-normas').innerHTML = C.normas.map(n => `<li>${n}</li>`).join('');

    $('#seg-turno').innerHTML = C.turnos.map(t =>
      `<button type="button" role="radio" data-t="${t.id}" aria-checked="${t.id === st.turno}">${esc(t.nombre)}</button>`).join('');

    const actual = franjaActual();
    const turno = C.turnos.find(t => t.id === st.turno);
    $('#chips-franja').innerHTML = turno.franjas.map(f =>
      `<button type="button" role="radio" class="chip${f.recreo ? ' recreo' : ''}${actual && actual.id === f.id ? ' ahora' : ''}" data-f="${f.id}" aria-checked="${f.id === st.franja}">
        ${esc(f.nombre)}<small>${f.ini}–${f.fin}</small></button>`).join('');

    const fr = franjaPorId(st.franja);
    $('#bloque-recreo').hidden = !(fr && fr.recreo);
    $('#op-funcion').innerHTML = C.funcionesRecreo.map(o =>
      `<button type="button" role="radio" data-fn="${o.id}" aria-checked="${o.id === st.funcion}"><b>${esc(o.nombre)}</b><small>${esc(o.detalle)}</small></button>`).join('');

    $('[data-campo="nDocentes"] output').value = st.nDocentes;
    $('#campo-companeros').hidden = st.nDocentes < 2;
    $('#d-companeros').value = st.companeros;
    $('#btn-empezar').disabled = !st.franja || (fr && fr.recreo && !st.funcion);
    $('#top-sub').textContent = C.centro;
  }

  $('#seg-turno').addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    if (st.turno !== b.dataset.t) { st.turno = b.dataset.t; st.franja = null; st.funcion = null; }
    persistir(); pintarDatos();
  });
  $('#chips-franja').addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    st.franja = b.dataset.f; if (!franjaPorId(st.franja).recreo) st.funcion = null;
    persistir(); pintarDatos(); actualizarAviso();
  });
  $('#op-funcion').addEventListener('click', e => {
    const b = e.target.closest('[data-fn]'); if (!b) return;
    st.funcion = b.dataset.fn; persistir(); pintarDatos();
  });
  $('#d-companeros').addEventListener('input', e => { st.companeros = e.target.value; persistir(); });

  // Contadores (nDocentes, entradas, salidas)
  document.addEventListener('click', e => {
    const b = e.target.closest('.contador button'); if (!b || !st) return;
    const box = b.closest('.contador'); const campo = box.dataset.campo;
    const min = campo === 'nDocentes' ? 1 : 0;
    st[campo] = Math.max(min, Math.min(99, (st[campo] || 0) + Number(b.dataset.d)));
    $('output', box).value = st[campo];
    if (campo === 'nDocentes') $('#campo-companeros').hidden = st.nDocentes < 2;
    persistir();
  });

  $('#btn-empezar').addEventListener('click', () => {
    st.inicio = st.inicio || new Date().toISOString();
    st.fase = 'ronda'; persistir();
    pintarRonda(); mostrar('v-ronda');
  });

  // ── Paso 2: checklist ────────────────────────────────────────────────────
  function seccionesVisibles() {
    const recreo = !!(franjaPorId(st.franja) || {}).recreo;
    const vale = x => !x.solo || (x.solo === 'recreo') === recreo;
    return C.secciones.filter(vale).map(s => ({ ...s, puntos: s.puntos.filter(vale) })).filter(s => s.puntos.length);
  }

  function pintarRonda() {
    const fr = franjaPorId(st.franja);
    const fn = C.funcionesRecreo.find(f => f.id === st.funcion);
    $('#p-franja').textContent = `${fr.turnoNombre} · ${fr.nombre}${fn ? ' · ' + fn.nombre : ''}`;
    $('#top-sub').textContent = `${fr.nombre} (${fr.ini}–${fr.fin}) · ${perfil.nombre}`;

    const tpl = $('#tpl-punto');
    const cont = $('#secciones'); cont.innerHTML = '';
    for (const s of seccionesVisibles()) {
      const sec = document.createElement('section');
      sec.className = 'seccion'; sec.dataset.sec = s.id;
      sec.innerHTML = `<div class="seccion-cab"><span class="seccion-ico">${s.icono}</span><h3>${esc(s.titulo)}</h3><span class="cuenta"></span></div>`;
      for (const p of s.puntos) {
        const n = tpl.content.firstElementChild.cloneNode(true);
        n.dataset.p = p.id;
        $('.punto-txt b', n).textContent = p.texto;
        $('.punto-txt small', n).textContent = p.ayuda || '';
        $('.estados', n).setAttribute('aria-label', p.texto);
        $$('.estados button', n).forEach(b => b.setAttribute('role', 'radio'));
        sec.appendChild(n);
        pintarPunto(n);
      }
      cont.appendChild(sec);
    }

    $('#chips-plantas').innerHTML = C.plantas.map(p =>
      `<button type="button" class="chip" aria-pressed="${st.plantas.includes(p)}" data-planta="${esc(p)}">${esc(p)}</button>`).join('');
    pintarGrupos();
    $('[data-campo="entradasTardias"] output').value = st.entradasTardias;
    $('[data-campo="salidasAnticipadas"] output').value = st.salidasAnticipadas;
    $('#in-obs').value = st.obs;
    progreso();
  }

  function pintarPunto(n) {
    const v = st.puntos[n.dataset.p] || {};
    n.dataset.estado = v.e || '';
    $$('.estados button', n).forEach(b => b.setAttribute('aria-checked', String(b.dataset.e === v.e)));
    $('.punto-hora', n).textContent = v.t || '';
    $('.punto-inc', n).hidden = v.e !== 'inc';
    $('.punto-inc textarea', n).value = v.nota || '';
    $('.punto-inc input', n).checked = !!v.urgente;
  }

  $('#secciones').addEventListener('click', e => {
    const b = e.target.closest('.estados button'); if (!b) return;
    const n = b.closest('.punto'); const id = n.dataset.p;
    const prev = st.puntos[id] || {};
    if (prev.e === b.dataset.e) { delete st.puntos[id]; }               // segundo toque: desmarca
    else { st.puntos[id] = { ...prev, e: b.dataset.e, t: hhmm(new Date()) }; vibrar(12); }
    persistir(); pintarPunto(n); progreso();
    if (b.dataset.e === 'inc' && st.puntos[id]) $('.punto-inc textarea', n).focus();
  });
  $('#secciones').addEventListener('input', e => {
    const n = e.target.closest('.punto'); if (!n) return;
    const v = st.puntos[n.dataset.p]; if (!v) return;
    if (e.target.matches('textarea')) v.nota = e.target.value;
    else v.urgente = e.target.checked;
    persistir();
  });

  function progreso() {
    let total = 0, hechos = 0;
    for (const sec of $$('#secciones .seccion')) {
      const ps = $$('.punto', sec); const h = ps.filter(p => st.puntos[p.dataset.p]).length;
      total += ps.length; hechos += h;
      const c = $('.cuenta', sec); c.textContent = `${h}/${ps.length}`; c.classList.toggle('hecha', h === ps.length);
    }
    $('#p-hechos').textContent = hechos; $('#p-total').textContent = total;
    $('#p-barra').style.width = total ? `${(hechos / total) * 100}%` : '0';
    $('.barra').classList.toggle('completa', total > 0 && hechos === total);
    return { total, hechos };
  }

  $('#chips-plantas').addEventListener('click', e => {
    const b = e.target.closest('[data-planta]'); if (!b) return;
    const p = b.dataset.planta;
    st.plantas = st.plantas.includes(p) ? st.plantas.filter(x => x !== p) : [...st.plantas, p];
    b.setAttribute('aria-pressed', String(st.plantas.includes(p))); persistir();
  });

  function pintarGrupos() {
    $('#chips-grupos').innerHTML = st.grupos.map((g, i) =>
      `<span class="chip">${esc(g)}<button type="button" data-quitar="${i}" aria-label="Quitar ${esc(g)}">×</button></span>`).join('');
  }
  function addGrupo() {
    const i = $('#in-grupo'); const v = i.value.trim();
    if (!v) return;
    if (st.grupos.length < 20 && !st.grupos.includes(v)) st.grupos.push(v);
    i.value = ''; persistir(); pintarGrupos(); i.focus();
  }
  $('#btn-add-grupo').addEventListener('click', addGrupo);
  $('#in-grupo').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addGrupo(); } });
  $('#chips-grupos').addEventListener('click', e => {
    const b = e.target.closest('[data-quitar]'); if (!b) return;
    st.grupos.splice(Number(b.dataset.quitar), 1); persistir(); pintarGrupos();
  });
  $('#in-obs').addEventListener('input', e => { st.obs = e.target.value; persistir(); });

  $('#btn-descartar').addEventListener('click', () => {
    if (!confirm('¿Descartar esta ronda? Se borrará lo marcado.')) return;
    st = nuevoEstado(); persistir(); pintarDatos(); mostrar('v-datos');
  });

  // ── Envío ────────────────────────────────────────────────────────────────
  function construirRegistro() {
    const fr = franjaPorId(st.franja);
    const fn = C.funcionesRecreo.find(f => f.id === st.funcion);
    const puntos = seccionesVisibles().flatMap(s => s.puntos.map(p => {
      const v = st.puntos[p.id] || {};
      return { id: p.id, seccion: s.titulo, texto: p.texto, estado: v.e || '', hora: v.t || '',
        nota: v.e === 'inc' ? (v.nota || '').trim() : '', urgente: v.e === 'inc' && !!v.urgente };
    }));
    const ahora = new Date();
    return {
      id: st.id, docente: perfil.nombre,
      fecha: fechaLocal(new Date(st.inicio || ahora)),
      turno: fr.turnoNombre, franja: fr.nombre, franjaHoras: `${fr.ini}–${fr.fin}`,
      tipo: fr.recreo ? 'Recreo' : 'Guardia', funcion: fn ? fn.nombre : '',
      nDocentes: st.nDocentes, companeros: st.nDocentes > 1 ? st.companeros.trim() : '',
      horaInicio: st.inicio ? hhmm(new Date(st.inicio)) : '', horaEnvio: hhmm(ahora),
      puntos, plantas: st.plantas, grupos: st.grupos,
      entradasTardias: st.entradasTardias, salidasAnticipadas: st.salidasAnticipadas,
      observaciones: st.obs.trim(),
    };
  }

  function resumenHTML(r) {
    const ok = r.puntos.filter(p => p.estado === 'ok').length;
    const na = r.puntos.filter(p => p.estado === 'na').length;
    const incs = r.puntos.filter(p => p.estado === 'inc');
    const fila = (a, b) => `<div class="fila"><span>${a}</span><span>${b}</span></div>`;
    let h = fila('Guardia', esc(`${r.turno} · ${r.franja} (${r.franjaHoras})`))
      + (r.funcion ? fila('Función', esc(r.funcion)) : '')
      + fila('Ronda', `${esc(r.horaInicio)} → ${esc(r.horaEnvio)}`)
      + fila('Respuestas', `Sí ${ok} · Incidencias ${incs.length} · No ${na}`)
      + (r.plantas.length ? fila('Plantas', esc(r.plantas.join(', '))) : '')
      + (r.grupos.length ? fila('Grupos atendidos', r.grupos.length) : '')
      + ((r.entradasTardias || r.salidasAnticipadas) ? fila('Entradas / salidas', `${r.entradasTardias} / ${r.salidasAnticipadas}`) : '');
    if (incs.length) h += `<div class="incs"><b>Incidencias</b><ul>${incs.map(p =>
      `<li>${p.urgente ? '🔴 ' : ''}<b>${esc(p.texto)}</b>${p.nota ? ': ' + esc(p.nota) : ''}</li>`).join('')}</ul></div>`;
    return h;
  }

  $('#btn-revisar').addEventListener('click', () => {
    const r = construirRegistro();
    $('#conf-resumen').innerHTML = resumenHTML(r);
    const sin = r.puntos.filter(p => !p.estado).length;
    const incSinNota = r.puntos.filter(p => p.estado === 'inc' && !p.nota).length;
    const avisos = [];
    if (sin) avisos.push(`Quedan <b>${sin}</b> punto${sin > 1 ? 's' : ''} sin marcar.`);
    if (incSinNota) avisos.push(`Hay ${incSinNota} incidencia${incSinNota > 1 ? 's' : ''} sin describir.`);
    $('#conf-sin').innerHTML = avisos.join(' ');
    $('#conf-sin').hidden = !avisos.length;
    $('#dlg-confirmar').showModal();
  });

  // Pantalla de envío: bloquea toda la app con una barra de carga hasta que termina.
  // Devuelve fin(completar): completa la barra (si completar) y la oculta.
  function pantallaEnvio() {
    const ov = $('#enviando'), barra = $('#env-barra'), txt = $('#env-fase');
    const fases = [[0, 'Preparando el informe…'], [25, 'Enviando a Jefatura…'], [60, 'Guardando en Drive…'], [85, 'Casi listo…']];
    const t0 = Date.now(); let pct = 0;
    ov.hidden = false; $('#app').inert = true; $('.top').inert = true; document.body.classList.add('bloqueado');
    barra.style.width = '0%'; txt.textContent = fases[0][1];
    const reloj = setInterval(() => {                         // avanza rápido al principio y se frena hacia el 92 %
      pct += (92 - pct) * 0.06;
      barra.style.width = pct.toFixed(1) + '%';
      const f = fases.filter(x => pct >= x[0]).pop(); txt.textContent = f[1];
    }, 120);
    return async completar => {
      clearInterval(reloj);
      if (completar) {
        barra.style.width = '100%'; txt.textContent = '¡Enviado!';
        await new Promise(r => setTimeout(r, Math.max(700, 1400 - (Date.now() - t0))));   // que se vea la barra completa
      }
      ov.hidden = true; $('#app').inert = false; $('.top').inert = false; document.body.classList.remove('bloqueado');
    };
  }

  $('#dlg-confirmar').addEventListener('close', async () => {
    if ($('#dlg-confirmar').returnValue !== 'enviar') return;
    const registro = construirRegistro();
    const resumen = resumenHTML(registro);
    $('#btn-enviar').disabled = true;
    const fin = pantallaEnvio();
    let enviado = false;
    try {
      const r = await llamar({ accion: 'registrar', registro });
      if (!r.ok && r.status && r.status < 500 && r.status !== 429) throw Object.assign(new Error(r.error || 'Error'), { definitivo: true });
      enviado = r.ok;
      if (!enviado) encolar(registro);
    } catch (ex) {
      if (ex.definitivo) { $('#btn-enviar').disabled = false; await fin(false); toast(ex.message); return; }
      encolar(registro);
    }
    $('#btn-enviar').disabled = false;
    await fin(true);
    st = nuevoEstado(); persistir();
    $('#env-icono').textContent = enviado ? '✓' : '⏳';
    $('#env-icono').classList.toggle('pendiente', !enviado);
    $('#env-titulo').textContent = enviado ? 'Guardia registrada' : 'Guardada en el móvil';
    $('#env-texto').textContent = enviado ? 'Jefatura de Estudios ya tiene tu informe. ¡Gracias!'
      : 'No hay conexión ahora mismo. Se enviará sola en cuanto vuelva la cobertura.';
    $('#env-resumen').innerHTML = resumen;
    $('#top-sub').textContent = C.centro;
    mostrar('v-enviado'); vibrar([20, 60, 20]);
  });

  $('#btn-nueva').addEventListener('click', () => { st = nuevoEstado(); persistir(); pintarDatos(); mostrar('v-datos'); });

  async function llamar(cuerpo) {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 20000);
    try {
      const res = await fetch(C.api, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo), signal: ctl.signal, cache: 'no-store',
      });
      let j = {}; try { j = await res.json(); } catch {}
      return { ...j, ok: res.ok && j.ok === true, status: res.status };
    } finally { clearTimeout(to); }
  }

  // ── Cola de envíos pendientes (sin cobertura) ────────────────────────────
  function encolar(reg) {
    const cola = leer(K.cola, []);
    if (!cola.some(r => r.id === reg.id)) cola.push(reg);
    guardar(K.cola, cola); pintarCola();
  }
  function pintarCola() {
    const n = leer(K.cola, []).length;
    $('#btn-pendientes').hidden = !n; $('#n-pendientes').textContent = n;
  }
  let vaciando = false;
  async function vaciarCola(manual) {
    if (vaciando) return;
    let cola = leer(K.cola, []); if (!cola.length) return;
    vaciando = true; let enviados = 0;
    try {
      for (const reg of [...cola]) {
        let r; try { r = await llamar({ accion: 'registrar', registro: reg }); } catch { break; }
        if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 429)) {
          cola = cola.filter(x => x.id !== reg.id); guardar(K.cola, cola); if (r.ok) enviados++;
        } else break;
      }
    } finally { vaciando = false; pintarCola(); }
    if (enviados) toast(`${enviados} guardia${enviados > 1 ? 's' : ''} pendiente${enviados > 1 ? 's' : ''} enviada${enviados > 1 ? 's' : ''} ✓`);
    else if (manual) toast('Sigue sin conexión. Se reintentará sola.');
  }
  $('#btn-pendientes').addEventListener('click', () => vaciarCola(true));
  window.addEventListener('online', () => vaciarCola());
  setInterval(() => navigator.onLine && vaciarCola(), 60000);

  // ── Aviso de los últimos minutos ─────────────────────────────────────────
  let avisado = null;
  function actualizarAviso() {
    const box = $('#aviso-tiempo');
    const visible = st && perfil && !$('#v-ronda').hidden || (!$('#v-datos').hidden && st && st.franja);
    const fr = st && franjaPorId(st.franja);
    let txt = '', urg = false;
    if (visible && fr && fechaLocal(new Date(st.inicio || Date.now())) === fechaLocal(new Date())) {
      const m = minAhora(), ini = aMin(fr.ini), fin = aMin(fr.fin);
      if (m >= ini && m < fin) {
        const quedan = Math.ceil(fin - m);
        if (quedan <= C.avisoMinutos) {
          urg = true; txt = `⏱ Quedan ${quedan} min · vuelve al puesto principal de guardia`;
          if (avisado !== st.id) { avisado = st.id; vibrar([200, 100, 200]); }
        } else txt = `⏱ Quedan ${quedan} min · a las ${pad(Math.floor((fin - C.avisoMinutos) / 60))}:${pad((fin - C.avisoMinutos) % 60)} vuelve al puesto principal`;
      }
    }
    box.textContent = txt; box.hidden = !txt; box.classList.toggle('urgente', urg);
    document.body.classList.toggle('con-aviso', !!txt);
  }
  setInterval(actualizarAviso, 20000);

  // ── Contador de visitantes únicos (dispositivos distintos, anónimo) ───────
  // Cada móvil guarda un identificador aleatorio (no es el nombre) y el servidor cuenta los distintos.
  function visitante() {
    let id = leer('tg_visitante', null);
    if (!/^[A-Za-z0-9-]{16,64}$/.test(id || '')) { id = uid(); guardar('tg_visitante', id); }
    return id;
  }
  async function contarVisita(registrar) {
    try {
      const res = await fetch('api/visitas.php', registrar
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: visitante() }), cache: 'no-store' }
        : { cache: 'no-store' });
      const j = await res.json();
      if (j.ok) { $('#n-visitas').textContent = j.total; $('#visitas').hidden = false; }
    } catch { /* sin conexión: se deja el último valor */ }
  }
  contarVisita(true);
  setInterval(() => navigator.onLine && contarVisita(false), 120000);

  // ── Arranque ─────────────────────────────────────────────────────────────
  function arrancar() {
    pintarCola();
    vaciarCola();
    if (!perfil) { mostrar('v-acceso'); return; }
    // Un borrador de otro día no sirve: se empieza de cero.
    if (!st || !st.id || (st.inicio && fechaLocal(new Date(st.inicio)) !== fechaLocal(new Date()))) st = nuevoEstado();
    if (st.franja && !franjaPorId(st.franja)) st = nuevoEstado();
    persistir();
    pintarDatos();
    if (st.fase === 'ronda' && st.franja) { pintarRonda(); mostrar('v-ronda'); }
    else mostrar('v-datos');
  }
  arrancar();

  // ── Novedades de una actualización (una vez por versión, por móvil) ─────
  function mostrarNovedades() {
    const nov = C.novedades;
    if (!nov || !nov.items || !nov.items.length) return;
    if (leer('tg_novedades_vista', null) === nov.id) return;
    $('#nov-titulo').textContent = nov.titulo || 'Novedades';
    $('#nov-lista').innerHTML = nov.items.map(t => '<li>' + esc(t) + '</li>').join('');
    $('#novedades').hidden = false;
    $('#nov-cerrar').focus();
  }
  $('#nov-cerrar').addEventListener('click', () => {
    guardar('tg_novedades_vista', C.novedades.id);
    $('#novedades').hidden = true;
  });
  mostrarNovedades();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
