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
  INTENTOS: 'barberia_pin_intentos_v1'
};

// Servicios oficiales ofrecidos
export const SERVICIOS = [
  {
    id: 'corte-clasico',
    nombre: 'Corte Clásico & Estilo',
    duracionMinutos: 45,
    precio: 15.00,
    descripcion: 'Lavado previo, corte a tijera o máquina, perfilado de patillas, lavado posterior y peinado con cera mate.'
  },
  {
    id: 'barba-ritual',
    nombre: 'Ritual de Barba & Toalla Caliente',
    duracionMinutos: 30,
    precio: 12.00,
    descripcion: 'Aceites esenciales, doble toalla caliente al vapor, afeitado tradicional a navaja y bálsamo hidratante.'
  },
  {
    id: 'combo-master',
    nombre: 'Combo Master (Corte + Barba Completa)',
    duracionMinutos: 70,
    precio: 25.00,
    descripcion: 'El servicio insignia: corte integral, ritual completo de barba, toalla caliente y tratamiento capilar express.'
  },
  {
    id: 'perfilado-express',
    nombre: 'Perfilado de Barba & Cuello Express',
    duracionMinutos: 20,
    precio: 8.00,
    descripcion: 'Delineado rápido de contornos de barba, bigote y cuello para mantenimiento semanal.'
  },
  {
    id: 'corte-infantil',
    nombre: 'Corte Infantil (Hasta 12 años)',
    duracionMinutos: 35,
    precio: 12.00,
    descripcion: 'Atención paciente, corte moderno adaptado y peinado con gel suave infantil.'
  }
];

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

// Datos iniciales de demostración para que el sistema tenga vida desde el primer instante
function generarDatosDemo() {
  const hoy = formatearFechaISO(new Date());
  const mananaDate = new Date();
  mananaDate.setDate(mananaDate.getDate() + 1);
  const manana = formatearFechaISO(mananaDate);

  return [
    {
      id: 'TURNO-DEMO-01',
      codigo: 'BARB-101',
      esDemo: true,
      cliente: 'Carlos Rodríguez',
      telefono: '+54 9 11 4455-8899',
      email: 'carlos.r@ejemplo.com',
      servicioId: 'combo-master',
      servicioNombre: 'Combo Master (Corte + Barba Completa)',
      precio: 25.00,
      fecha: hoy,
      hora: '10:00',
      estado: 'confirmado', // pendiente, confirmado, completado, cancelado
      notas: 'Prefiere degradado bajo (low fade).',
      creadoEn: new Date(Date.now() - 3600000 * 5).toISOString()
    },
    {
      id: 'TURNO-DEMO-02',
      codigo: 'BARB-102',
      esDemo: true,
      cliente: 'Mariano Benítez',
      telefono: '+54 9 11 2233-4455',
      email: 'mariano.b@ejemplo.com',
      servicioId: 'corte-clasico',
      servicioNombre: 'Corte Clásico & Estilo',
      precio: 15.00,
      fecha: hoy,
      hora: '11:30',
      estado: 'confirmado',
      notas: 'Corte con tijera arriba, nada de cera brillante.',
      creadoEn: new Date(Date.now() - 3600000 * 3).toISOString()
    },
    {
      id: 'TURNO-DEMO-03',
      codigo: 'BARB-103',
      esDemo: true,
      cliente: 'Lucas Fernández',
      telefono: '+54 9 11 9988-7766',
      email: 'lucas.f@ejemplo.com',
      servicioId: 'barba-ritual',
      servicioNombre: 'Ritual de Barba & Toalla Caliente',
      precio: 12.00,
      fecha: hoy,
      hora: '15:00',
      estado: 'confirmado',
      notas: 'Piel sensible a la navaja en cuello.',
      creadoEn: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    {
      id: 'TURNO-DEMO-04',
      codigo: 'BARB-104',
      esDemo: true,
      cliente: 'Esteban Morales',
      telefono: '+54 9 11 3344-5566',
      email: 'esteban.m@ejemplo.com',
      servicioId: 'combo-master',
      servicioNombre: 'Combo Master (Corte + Barba Completa)',
      precio: 25.00,
      fecha: manana,
      hora: '16:30',
      estado: 'confirmado',
      notas: 'Cliente nuevo por recomendación.',
      creadoEn: new Date(Date.now() - 3600000).toISOString()
    }
  ];
}

/**
 * Obtiene todas las reservas almacenadas
 */
export function obtenerReservas() {
  try {
    const raw = adaptador.leer();
    if (!raw) {
      const inicial = generarDatosDemo();
      guardarReservas(inicial);
      return inicial;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
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

/**
 * Crea una nueva reserva evitando duplicados (concurrencia de turnos)
 */
export function crearReserva(datos) {
  datos = validarReserva(datos); // sanitización + validación estricta
  // Validación estricta anti-duplicados
  if (estaHorarioOcupado(datos.fecha, datos.hora)) {
    throw new Error(`El horario de las ${datos.hora} para el día ${datos.fecha} ya ha sido reservado. Por favor selecciona otro turno.`);
  }

  const servicio = SERVICIOS.find(s => s.id === datos.servicioId);
  const nuevoId = 'TURNO-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  const codigo = 'BARB-' + Math.floor(1000 + Math.random() * 9000);

  const nuevaReserva = {
    id: nuevoId,
    codigo,
    esDemo: false,
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
 * Restablece los datos de demostración
 */
export function restablecerDatosDemo() {
  const demo = generarDatosDemo();
  guardarReservas(demo);
  return demo;
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
const RE_EMAIL = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,255}\.[A-Za-z]{2,}$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validarReserva(datos) {
  if (!datos || typeof datos !== 'object') throw new Error('Datos de reserva inválidos.');

  const cliente = sanitizarTexto(datos.cliente, 60);
  if (!RE_NOMBRE.test(cliente)) {
    throw new Error('Nombre inválido: use 2 a 60 letras (sin números ni símbolos).');
  }

  const telefono = sanitizarTexto(datos.telefono, 20);
  const digitos = telefono.replace(/\D/g, '');
  if (!RE_TELEFONO.test(telefono) || digitos.length < 7 || digitos.length > 15) {
    throw new Error('Teléfono inválido: use de 7 a 15 dígitos (puede incluir + ( ) - y espacios).');
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
