/* Configuración de la app de guardias. Se puede editar sin tocar app.js. */
window.GUARDIAS_CONFIG = {
  centro: 'CIFP Tony Gallardo',
  api: 'api/enviar.php',

  /* Franjas horarias (HH:MM). «aviso» = minutos antes del final en los que hay
     que volver al puesto principal. Revisar con el horario real del centro. */
  turnos: [
    { id: 'M', nombre: 'Mañana', franjas: [
      { id: 'M1', nombre: '1ª hora', ini: '08:00', fin: '08:55' },
      { id: 'M2', nombre: '2ª hora', ini: '08:55', fin: '09:50' },
      { id: 'M3', nombre: '3ª hora', ini: '09:50', fin: '10:45' },
      { id: 'MR', nombre: 'Recreo',  ini: '10:45', fin: '11:15', recreo: true },
      { id: 'M4', nombre: '4ª hora', ini: '11:15', fin: '12:10' },
      { id: 'M5', nombre: '5ª hora', ini: '12:10', fin: '13:05' },
      { id: 'M6', nombre: '6ª hora', ini: '13:05', fin: '14:00' },
    ]},
    { id: 'T', nombre: 'Tarde', franjas: [
      { id: 'T1', nombre: '1ª hora', ini: '15:00', fin: '15:55' },
      { id: 'T2', nombre: '2ª hora', ini: '15:55', fin: '16:50' },
      { id: 'T3', nombre: '3ª hora', ini: '16:50', fin: '17:45' },
      { id: 'TR', nombre: 'Recreo',  ini: '17:45', fin: '18:15', recreo: true },
      { id: 'T4', nombre: '4ª hora', ini: '18:15', fin: '19:10' },
      { id: 'T5', nombre: '5ª hora', ini: '19:10', fin: '20:05' },
      { id: 'T6', nombre: '6ª hora', ini: '20:05', fin: '21:00' },
    ]},
  ],
  avisoMinutos: 5,

  plantas: ['Planta baja', 'Planta 1ª', 'Planta 2ª', 'Exteriores'],

  funcionesRecreo: [
    { id: 'puesto', nombre: 'Puesto principal', detalle: 'Control de acceso y DNI' },
    { id: 'ronda',  nombre: 'Ronda',            detalle: 'Resto de instalaciones' },
    { id: 'patio',  nombre: 'Patio',            detalle: 'Presencia activa' },
  ],

  /* Puntos del checklist. «solo»: 'recreo' | 'clase' limita cuándo aparecen. */
  secciones: [
    { id: 'inicio', titulo: 'Inicio de la guardia', icono: '🚩', puntos: [
      { id: 'puesto_inicio', texto: 'He acudido al puesto de guardia principal', ayuda: 'Al empezar, todo el profesorado de guardia pasa por el puesto principal.' },
      { id: 'coordinacion',  texto: 'Nos hemos coordinado y repartido zonas',  ayuda: 'Si coincidís varios: incidencias conocidas y refuerzos.' },
      { id: 'ausencias',     texto: 'Revisadas ausencias y grupos sin docente', ayuda: 'Grupos sin actividad por falta de nombramientos.', solo: 'clase' },
    ]},
    { id: 'recreo', titulo: 'Recreo', icono: '☀️', solo: 'recreo', puntos: [
      { id: 'dos_en_puesto', texto: 'Mínimo dos personas en el puesto principal', ayuda: 'Mientras se consolida el control de DNI y acceso.' },
      { id: 'control_dni',   texto: 'Control de acceso y revisión de DNI', ayuda: 'Entradas y salidas por el puesto principal.' },
      { id: 'patio',         texto: 'Patio vigilado con presencia activa', ayuda: 'Supervisión de todo el alumnado en el patio.' },
    ]},
    { id: 'ronda', titulo: 'Ronda por el centro', icono: '🚶', puntos: [
      { id: 'banos',       texto: 'Baños', ayuda: 'Alumnado fuera de clase, desperfectos, humo…' },
      { id: 'pasillos',    texto: 'Pasillos y espacios de tránsito', ayuda: 'Alumnado deambulando, ruido, obstáculos.' },
      { id: 'escaleras',   texto: 'Escaleras', ayuda: 'Tramos y rellanos.' },
      { id: 'poca_vis',    texto: 'Zonas con poca visibilidad', ayuda: 'Rincones, final de pasillos, detrás de talleres.' },
      { id: 'comunes',     texto: 'Zonas comunes', ayuda: 'Plaza, hall, cafetería…' },
      { id: 'puertas',     texto: 'Puertas y accesos', ayuda: 'Acceso principal controlado, salidas de emergencia despejadas.' },
      { id: 'aulas',       texto: 'Aulas', ayuda: 'Grupos sin docente atendidos; aulas vacías cerradas.' },
      { id: 'exteriores',  texto: 'Patio y exteriores', ayuda: 'Aparcamiento, zonas exteriores, vallado.', solo: 'clase' },
    ]},
    { id: 'cierre', titulo: 'Últimos 5 minutos', icono: '⏱️', puntos: [
      { id: 'puesto_final', texto: 'He vuelto al puesto principal', ayuda: 'Salvo que se esté atendiendo una situación urgente.' },
      { id: 'entradas_salidas', texto: 'Entradas tardías y salidas anticipadas organizadas', ayuda: 'Refuerzo en el cambio de hora.' },
    ]},
  ],

  /* Novedades de la última actualización. Para avisar de un cambio:
     1) cambia «id» (p. ej. 'v9'), 2) escribe los puntos en «items».
     Cada móvil ve el aviso una vez por id; al cambiar el id, sale de nuevo. */
  novedades: {
    id: 'v10',
    titulo: 'Novedades de la app',
    items: [
      'Las preguntas se responden con Sí, No o Incidencia.',
      'Si marcas Incidencia, puedes describir lo que ha pasado.',
    ],
  },

  normas: [
    'La guardia es <b>vigilancia activa</b>: no es tiempo para trabajo personal con el ordenador.',
    'Al empezar, <b>todo el profesorado de guardia</b> acude al puesto principal.',
    'En los <b>últimos 5 minutos</b>, vuelta al puesto principal (entradas tardías y salidas anticipadas).',
    'En el <b>recreo</b>: mínimo 2 personas en el puesto principal y 1 haciendo ronda. Refuerzo especial del patio.',
    'En las rondas, atención a <b>baños, zonas con poca visibilidad, pasillos y zonas comunes</b>.',
  ],
};
