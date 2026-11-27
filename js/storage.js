/**
 * storage.js - Capa de persistencia local y gestión de datos de la barbería
 * Arquitectura modular: utiliza localStorage con estructura preparada para
 * migración directa a Firebase / Supabase / REST API sin cambiar la interfaz.
 */

const STORAGE_KEYS = {
  RESERVAS: 'barberia_reservas_v1',
  CONFIG: 'barberia_config_v1',
  SESION_BARBERO: 'barberia_sesion_barbero',
  PIN: 'barberia_pin_v1',
  INTENTOS: 'barberia_pin_intentos_v1',
  BLOQUEOS: 'barberia_bloqueos_v1',
  DIAS_CERRADOS: 'barberia_dias_cerrados_v1'
};

// Configuración centralizada del negocio (Fran Barbe - Cali, Colombia)
export const NEGOCIO_CONFIG = Object.freeze({
  nombre: 'Fran Barbe',
  ciudad: 'Cali, Colombia',
  ubicacion: 'Sector La Nueva Base / Villa, Cali',
  telefonoVisible: '+57 300 000 0000',
  whatsapp: '573000000000',
  whatsappUrl: 'https://wa.me/573000000000',
  moneda: 'COP',
  servicios: [
    {
      id: 'corte-basico',
      nombre: 'Corte Básico',
      duracionMinutos: 30,
      precio: 20000,
      descripcion: 'Corte de cabello clásico o moderno, perfilado de patillas y acabado limpio.'
    },
    {
      id: 'corte-completo',
      nombre: 'Corte Completo',
      duracionMinutos: 45,
      precio: 30000,
      descripcion: 'Corte completo + arreglo y perfilado de barba con terminación detallada.'
    }
  ]
});

// Servicios oficiales ofrecidos (únicamente 2)
export const SERVICIOS = NEGOCIO_CONFIG.servicios;

// La agenda inicia limpia en producción, sin turnos ficticios de demostración
export function generarDatosDemo() {
  return [];
}

// Formato de pesos colombianos sin decimales: 20000 -> $20.000
export function formatearCOP(valor) {
  const n = Math.round(Number(valor) || 0);
  return (n < 0 ? '-$' : '$') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Horarios de atención configurados (Lunes a Sábado de 09:00 a 19:30)
export const HORARIOS_CONFIG = {
  apertura: '09:00',
  cierre: '19:30',
  intervaloMinutos: 30,
  diasLaborables: [1, 2, 3, 4, 5, 6] // 0 = Domingo (cerrado)
};

// Helper: Formato de fecha YYYY-MM-DD local
export function formatearFechaISO(fecha = new Date()) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

// Genera franjas horarias disponibles según el horario de atención
export function generarSlotsDisponibles() {
  const slots = [];
  const [horaInicio, minInicio] = HORARIOS_CONFIG.apertura.split(':').map(Number);
  const [horaFin, minFin] = HORARIOS_CONFIG.cierre.split(':').map(Number);

  let current = horaInicio * 60 + minInicio;
  const end = horaFin * 60 + minFin;

  while (current <= end) {
    const hh = String(Math.floor(current / 60)).padStart(2, '0');
    const mm = String(current % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
    current += HORARIOS_CONFIG.intervaloMinutos;
  }
  return slots;
}

/**
 * Obtiene todas las reservas almacenadas
 */
export function obtenerReservas() {
  try {
    const raw = adaptador.leer();
    if (!raw) return []; // La agenda inicia vacía (sin turnos ficticios)
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Migración: purga turnos de demostración heredados de versiones anteriores
    const limpias = parsed.filter((r) => r && r.esDemo !== true);
    if (limpias.length !== parsed.length) guardarReservas(limpias);
    return limpias;
  } catch (err) {
    console.error('Error al leer reservas:', err);
    return [];
  }
}

/**
 * Guarda el arreglo de reservas en el almacenamiento local
 */
export function guardarReservas(reservas) {
  try {
    adaptador.escribir(JSON.stringify(reservas));
  } catch (err) {
    console.error('Error al guardar reservas:', err);
  }
}

/**
 * Verifica si un horario específico ya está ocupado en una fecha dada
 */
export function estaHorarioOcupado(fecha, hora, excluirId = null) {
  const reservas = obtenerReservas();
  return reservas.some(r =>
    r.fecha === fecha &&
    r.hora === hora &&
    r.estado !== 'cancelado' &&
    (!excluirId || r.id !== excluirId)
  );
}

/**
 * Obtiene las horas reservadas para una fecha dada (para deshabilitar slots)
 */
export function obtenerHorasOcupadasPorFecha(fecha) {
  const reservas = obtenerReservas();
  return reservas
    .filter(r => r.fecha === fecha && r.estado !== 'cancelado')
    .map(r => r.hora);
}

/* ==========================================================================
 * BLOQUEO RÁPIDO DE HORARIOS (barbero): franjas no disponibles sin crear turnos
 * Estructura: { 'YYYY-MM-DD': ['12:00', '12:30'] }
 * ========================================================================== */
function leerBloqueos() {
  try {
    const b = JSON.parse(localStorage.getItem(STORAGE_KEYS.BLOQUEOS) || '{}');
    return b && typeof b === 'object' && !Array.isArray(b) ? b : {};
  } catch (_) {
    return {};
  }
}

export function obtenerHorasBloqueadas(fecha) {
  const lista = leerBloqueos()[fecha];
  return Array.isArray(lista) ? lista.filter((h) => RE_HORA.test(h)) : [];
}

export function estaHoraBloqueada(fecha, hora) {
  return obtenerHorasBloqueadas(fecha).includes(hora);
}

// Marca/desmarca una franja. Devuelve true si queda bloqueada, false si queda libre.
export function alternarBloqueoHora(fecha, hora) {
  if (!RE_FECHA.test(String(fecha)) || !RE_HORA.test(String(hora)) || !generarSlotsDisponibles().includes(hora)) {
    throw new Error('Franja horaria inválida.');
  }
  const bloqueos = leerBloqueos();
  const actuales = obtenerHorasBloqueadas(fecha);
  let bloqueada;
  if (actuales.includes(hora)) {
    bloqueos[fecha] = actuales.filter((h) => h !== hora);
    bloqueada = false;
  } else {
    if (estaHorarioOcupado(fecha, hora)) {
      throw new Error('Esa franja tiene un turno activo; cancélalo primero para bloquearla.');
    }
    bloqueos[fecha] = [...actuales, hora].sort();
    bloqueada = true;
  }
  if (bloqueos[fecha].length === 0) delete bloqueos[fecha];
  localStorage.setItem(STORAGE_KEYS.BLOQUEOS, JSON.stringify(bloqueos));
  return bloqueada;
}

/* ==========================================================================
 * CIERRE DE DÍA COMPLETO (barbero): marca/desmarca una fecha como no laborable
 * ========================================================================== */
export function obtenerDiasCerrados() {
  try {
    const lista = JSON.parse(localStorage.getItem(STORAGE_KEYS.DIAS_CERRADOS) || '[]');
    return Array.isArray(lista) ? lista.filter((f) => RE_FECHA.test(f)) : [];
  } catch (_) {
    return [];
  }
}

export function estaDiaCerrado(fecha) {
  return obtenerDiasCerrados().includes(String(fecha));
}

// Marca/desmarca un día completo como cerrado. Devuelve true si queda cerrado.
export function alternarDiaCerrado(fecha) {
  const f = String(fecha ?? '');
  if (!RE_FECHA.test(f)) throw new Error('Fecha inválida.');
  const actuales = obtenerDiasCerrados();
  let cerrado;
  let siguientes;
  if (actuales.includes(f)) {
    siguientes = actuales.filter((d) => d !== f);
    cerrado = false;
  } else {
    siguientes = [...actuales, f].sort();
    cerrado = true;
  }
  localStorage.setItem(STORAGE_KEYS.DIAS_CERRADOS, JSON.stringify(siguientes));
  return cerrado;
}

/**
 * Crea una nueva reserva evitando duplicados (concurrencia de turnos)
 */
export function crearReserva(datos) {
  datos = validarReserva(datos); // sanitización + validación estricta
  // Validación estricta anti-duplicados
  if (estaHorarioOcupado(datos.fecha, datos.hora)) {
    throw new Error(`El horario de las ${datos.hora} para el día ${datos.fecha} ya ha sido reservado. Por favor selecciona otro turno.`);
  }

  if (estaHoraBloqueada(datos.fecha, datos.hora)) {
    throw new Error(`El horario de las ${datos.hora} no está disponible. Por favor selecciona otro turno.`);
  }

  const servicio = SERVICIOS.find(s => s.id === datos.servicioId);
  const nuevoId = 'TURNO-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  const existentes = new Set(obtenerReservas().map((r) => r.codigo));
  let codigo;
  do { codigo = 'BARB-' + Math.floor(1000 + Math.random() * 9000); } while (existentes.has(codigo));

  const nuevaReserva = {
    id: nuevoId,
    codigo,
    cliente: datos.cliente,
    telefono: datos.telefono,
    email: datos.email,
    servicioId: servicio.id,
    servicioNombre: servicio.nombre,
    precio: servicio.precio,
    duracionMinutos: servicio.duracionMinutos,
    fecha: datos.fecha,
    hora: datos.hora,
    estado: 'confirmado',
    notas: datos.notas,
    creadoEn: new Date().toISOString()
  };

  const reservas = obtenerReservas();
  reservas.push(nuevaReserva);
  guardarReservas(reservas);

  return nuevaReserva;
}

/**
 * Actualiza el estado de una reserva (confirmado, completado, cancelado)
 */
export function actualizarEstadoReserva(id, nuevoEstado) {
  const reservas = obtenerReservas();
  const index = reservas.findIndex(r => r.id === id);
  if (index !== -1) {
    reservas[index].estado = nuevoEstado;
    guardarReservas(reservas);
    return reservas[index];
  }
  return null;
}

/**
 * Cancela una reserva liberando el turno
 */
export function cancelarReserva(id) {
  return actualizarEstadoReserva(id, 'cancelado');
}

/**
 * Consulta de la reserva por el cliente: requiere código (BARB-XXXX) + teléfono registrado.
 * Devuelve null si no coincide (sin revelar cuál dato falló).
 */
export function consultarReservaCliente(codigo, telefono) {
  const cod = sanitizarTexto(codigo, 12).toUpperCase();
  const tel = normalizarTelefonoCO(telefono);
  if (!/^BARB-\d{3,4}$/.test(cod) || !tel) return null;
  return obtenerReservas().find((r) => r.codigo === cod && normalizarTelefonoCO(r.telefono) === tel) || null;
}

/**
 * Cancelación por el cliente (código + teléfono): libera el cupo.
 */
export function cancelarReservaCliente(codigo, telefono) {
  const r = consultarReservaCliente(codigo, telefono);
  if (!r) throw new Error('No encontramos una cita con ese código y teléfono.');
  if (r.estado === 'cancelado') throw new Error('Esta cita ya estaba cancelada.');
  if (r.estado === 'completado') throw new Error('Esta cita ya fue atendida.');
  if (new Date(`${r.fecha}T${r.hora}:00`) <= new Date()) throw new Error('No se puede cancelar una cita que ya pasó.');
  return cancelarReserva(r.id);
}


/* ==========================================================================
 * ADAPTADOR DE BASE DE DATOS (desacoplado)
 * Interfaz: leer() -> string JSON | null, escribir(string)
 * - adaptadorLocal: localStorage (por defecto, sin credenciales).
 * - crearAdaptadorSupabase(): cliente REST listo para usar con supabase_schema.sql.
 *   Un cliente anónimo solo puede INSERTAR reservas (RLS) mediante la RPC
 *   crear_reserva y consultar horas ocupadas mediante horas_ocupadas().
 * Seleccione el adaptador con configurarAdaptador().
 * ========================================================================== */
export const adaptadorLocal = {
  nombre: 'local',
  leer: () => localStorage.getItem(STORAGE_KEYS.RESERVAS),
  escribir: (json) => localStorage.setItem(STORAGE_KEYS.RESERVAS, json)
};

export function crearAdaptadorSupabase({ url, anonKey }) {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url || '') || !anonKey) {
    throw new Error('Configuración de Supabase inválida (url/anonKey).');
  }
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json'
  };
  return {
    nombre: 'supabase',
    // El cliente público nunca lee reservas ajenas: solo crea y consulta horas ocupadas.
    async crearReserva(reserva) {
      const r = await fetch(`${url}/rest/v1/rpc/crear_reserva`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          p_cliente: reserva.cliente,
          p_telefono: reserva.telefono,
          p_email: reserva.email,
          p_servicio_id: reserva.servicioId,
          p_fecha: reserva.fecha,
          p_hora: reserva.hora,
          p_notas: reserva.notas
        })
      });
      if (!r.ok) throw new Error('No se pudo crear la reserva.');
      return r.json();
    },
    async horasOcupadas(fecha) {
      const r = await fetch(`${url}/rest/v1/rpc/horas_ocupadas`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ p_fecha: fecha })
      });
      if (!r.ok) throw new Error('No se pudo consultar disponibilidad.');
      return r.json();
    },
    // Consulta/cancelación del cliente: exige código + teléfono (RPC security definer)
    async consultarReserva(codigo, telefono) {
      const r = await fetch(`${url}/rest/v1/rpc/consultar_reserva_cliente`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ p_codigo: codigo, p_telefono: telefono })
      });
      if (!r.ok) throw new Error('No se pudo consultar la reserva.');
      return r.json();
    },
    async cancelarReserva(codigo, telefono) {
      const r = await fetch(`${url}/rest/v1/rpc/cancelar_reserva_cliente`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ p_codigo: codigo, p_telefono: telefono })
      });
      if (!r.ok) throw new Error('No se pudo cancelar la reserva.');
      return r.json();
    }
  };
}

let adaptador = adaptadorLocal;
export function configurarAdaptador(nuevo) {
  if (!nuevo || typeof nuevo.leer !== 'function' || typeof nuevo.escribir !== 'function') {
    throw new Error('Adaptador no compatible con la interfaz leer/escribir.');
  }
  adaptador = nuevo;
}
export function obtenerAdaptadorActivo() {
  return adaptador;
}

/* ==========================================================================
 * SANITIZACIÓN Y VALIDACIÓN ESTRICTA DE ENTRADAS
 * ========================================================================== */
export function escaparHTML(valor) {
  return String(valor ?? '').replace(/[&<>"'`=\/]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
    "'": '&#39;', '`': '&#96;', '=': '&#61;', '/': '&#47;'
  }[c]));
}

// Elimina caracteres de control, etiquetas y espacios redundantes
export function sanitizarTexto(valor, max = 200) {
  return String(valor ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\uFEFF]/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

const RE_NOMBRE = /^[\p{L}][\p{L}\p{M}' .-]{1,59}$/u;
const RE_TELEFONO = /^\+?[0-9][0-9 ()-]{6,19}$/;
const RE_CEL_CO = /^3\d{9}$/;     // celular colombiano: 3XXXXXXXXX
const RE_CEL_CO_57 = /^573\d{9}$/; // con prefijo +57
const RE_EMAIL = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,255}\.[A-Za-z]{2,}$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

// Normaliza un celular colombiano a +573XXXXXXXXX; devuelve null si es inválido.
// Acepta 3XXXXXXXXX o +57 3XXXXXXXXX (con espacios, guiones o paréntesis).
export function normalizarTelefonoCO(valor) {
  const t = sanitizarTexto(valor, 20);
  if (!RE_TELEFONO.test(t)) return null;
  const d = t.replace(/\D/g, '');
  if (t.startsWith('+')) return RE_CEL_CO_57.test(d) ? '+' + d : null;
  return RE_CEL_CO.test(d) ? '+57' + d : null;
}

export function validarReserva(datos) {
  if (!datos || typeof datos !== 'object') throw new Error('Datos de reserva inválidos.');

  const cliente = sanitizarTexto(datos.cliente, 60);
  if (!RE_NOMBRE.test(cliente)) {
    throw new Error('Nombre inválido: use 2 a 60 letras (sin números ni símbolos).');
  }

  const telefono = normalizarTelefonoCO(datos.telefono);
  if (!telefono) {
    throw new Error('Teléfono inválido: use un celular colombiano de 10 dígitos (3XXXXXXXXX) o con prefijo +57.');
  }

  const email = sanitizarTexto(datos.email, 120);
  if (email && !RE_EMAIL.test(email)) throw new Error('Correo electrónico inválido.');

  const servicio = SERVICIOS.find((s) => s.id === datos.servicioId);
  if (!servicio) throw new Error('Servicio inválido.');

  const fecha = String(datos.fecha ?? '');
  const hora = String(datos.hora ?? '');
  if (!RE_FECHA.test(fecha) || !RE_HORA.test(hora)) throw new Error('Fecha u hora con formato inválido.');
  const d = new Date(fecha + 'T00:00:00');
  if (Number.isNaN(d.getTime()) || formatearFechaISO(d) !== fecha) throw new Error('Fecha inexistente.');
  if (!HORARIOS_CONFIG.diasLaborables.includes(d.getDay())) throw new Error('La barbería está cerrada ese día.');
  if (estaDiaCerrado(fecha)) throw new Error('La barbería no atiende en la fecha seleccionada (día cerrado).');
  if (!generarSlotsDisponibles().includes(hora)) throw new Error('Horario fuera del horario de atención.');
  const hoyISO = formatearFechaISO(new Date());
  const max = new Date();
  max.setDate(max.getDate() + 60);
  if (fecha < hoyISO || fecha > formatearFechaISO(max)) throw new Error('Fecha fuera del rango permitido.');

  const notas = sanitizarTexto(datos.notas, 300);

  return { cliente, telefono, email, servicioId: servicio.id, fecha, hora, notas };
}

/* ==========================================================================
 * ACCESO DEL BARBERO: PIN con SHA-256 + sal (Web Crypto) y rate-limiting
 * ========================================================================== */
const PIN_ITERACIONES = 10000;
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 5 * 60 * 1000;
const RE_PIN = /^\d{4,8}$/;

const aHex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
async function sha256Hex(texto) {
  return aHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)));
}

// Algoritmo (idéntico en scripts/generar-pin-hash.mjs):
// h0 = SHA256(sal:pin); h(n) = SHA256(h(n-1):sal), n = 1..ITERACIONES-1
export async function calcularHashPin(pin, sal) {
  let h = await sha256Hex(`${sal}:${pin}`);
  for (let i = 1; i < PIN_ITERACIONES; i++) h = await sha256Hex(`${h}:${sal}`);
  return h;
}

export function generarSal() {
  return aHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

function compararConstante(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Credenciales: primero configuración externa (.env.example -> BARBERIA_CONFIG), luego primer uso
function obtenerCredencialPin() {
  const ext = globalThis.BARBERIA_CONFIG;
  if (ext && /^[0-9a-f]{32,}$/i.test(ext.pinSalt || '') && /^[0-9a-f]{64}$/i.test(ext.pinHash || '')) {
    return { sal: ext.pinSalt, hash: ext.pinHash.toLowerCase() };
  }
  try {
    const c = JSON.parse(localStorage.getItem(STORAGE_KEYS.PIN) || 'null');
    if (c && typeof c.sal === 'string' && /^[0-9a-f]{64}$/.test(c.hash || '')) return c;
  } catch (_) { /* credencial corrupta: se pedirá configurar de nuevo */ }
  return null;
}

export function pinConfigurado() {
  return obtenerCredencialPin() !== null;
}

export async function configurarPinBarbero(pin) {
  if (pinConfigurado()) throw new Error('El PIN ya está configurado.');
  if (!RE_PIN.test(pin) || /^(\d)\1+$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)) {
    throw new Error('PIN débil: use de 4 a 8 dígitos, sin repetir ni secuencias.');
  }
  const sal = generarSal();
  const hash = await calcularHashPin(pin, sal);
  localStorage.setItem(STORAGE_KEYS.PIN, JSON.stringify({ sal, hash }));
}

function leerBloqueo() {
  try {
    const b = JSON.parse(localStorage.getItem(STORAGE_KEYS.INTENTOS) || '{}');
    return { fallos: Number(b.fallos) || 0, hasta: Number(b.hasta) || 0 };
  } catch (_) {
    return { fallos: 0, hasta: 0 };
  }
}

export function segundosBloqueoRestantes() {
  const { hasta } = leerBloqueo();
  return Math.max(0, Math.ceil((hasta - Date.now()) / 1000));
}

// Devuelve { ok, bloqueado, segundos, restantes }
export async function verificarPinBarbero(pinIngresado) {
  const seg = segundosBloqueoRestantes();
  if (seg > 0) return { ok: false, bloqueado: true, segundos: seg, restantes: 0 };

  const cred = obtenerCredencialPin();
  const pin = String(pinIngresado ?? '');
  const hash = cred && RE_PIN.test(pin) ? await calcularHashPin(pin, cred.sal) : null;
  if (cred && hash && compararConstante(hash, cred.hash)) {
    localStorage.removeItem(STORAGE_KEYS.INTENTOS);
    return { ok: true, bloqueado: false, segundos: 0, restantes: MAX_INTENTOS };
  }

  const estado = leerBloqueo();
  const fallos = (estado.hasta && estado.hasta <= Date.now() ? 0 : estado.fallos) + 1;
  if (fallos >= MAX_INTENTOS) {
    localStorage.setItem(STORAGE_KEYS.INTENTOS, JSON.stringify({ fallos: 0, hasta: Date.now() + BLOQUEO_MS }));
    return { ok: false, bloqueado: true, segundos: BLOQUEO_MS / 1000, restantes: 0 };
  }
  localStorage.setItem(STORAGE_KEYS.INTENTOS, JSON.stringify({ fallos, hasta: 0 }));
  return { ok: false, bloqueado: false, segundos: 0, restantes: MAX_INTENTOS - fallos };
}

export function guardarSesionBarbero(activa = true) {
  if (activa) {
    sessionStorage.setItem(STORAGE_KEYS.SESION_BARBERO, 'true');
  } else {
    sessionStorage.removeItem(STORAGE_KEYS.SESION_BARBERO);
  }
}

export function tieneSesionBarberoActiva() {
  return sessionStorage.getItem(STORAGE_KEYS.SESION_BARBERO) === 'true';
}
