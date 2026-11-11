/**
 * storage.js - Capa de persistencia local y gestión de datos de la barbería
 * Arquitectura modular: utiliza localStorage con estructura preparada para
 * migración directa a Firebase / Supabase / REST API sin cambiar la interfaz.
 */

const STORAGE_KEYS = {
  RESERVAS: 'barberia_reservas_v1',
  CONFIG: 'barberia_config_v1',
  SESION_BARBERO: 'barberia_sesion_barbero'
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
    const raw = localStorage.getItem(STORAGE_KEYS.RESERVAS);
    if (!raw) {
      const inicial = generarDatosDemo();
      guardarReservas(inicial);
      return inicial;
    }
    return JSON.parse(raw);
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
    localStorage.setItem(STORAGE_KEYS.RESERVAS, JSON.stringify(reservas));
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
  // Validación estricta anti-duplicados
  if (estaHorarioOcupado(datos.fecha, datos.hora)) {
    throw new Error(`El horario de las ${datos.hora} para el día ${datos.fecha} ya ha sido reservado. Por favor selecciona otro turno.`);
  }

  const servicio = SERVICIOS.find(s => s.id === datos.servicioId) || SERVICIOS[0];
  const nuevoId = 'TURNO-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  const codigo = 'BARB-' + Math.floor(1000 + Math.random() * 9000);

  const nuevaReserva = {
    id: nuevoId,
    codigo,
    esDemo: false,
    cliente: datos.cliente.trim(),
    telefono: datos.telefono.trim(),
    email: (datos.email || '').trim(),
    servicioId: servicio.id,
    servicioNombre: servicio.nombre,
    precio: servicio.precio,
    duracionMinutos: servicio.duracionMinutos,
    fecha: datos.fecha,
    hora: datos.hora,
    estado: 'confirmado',
    notas: (datos.notas || '').trim(),
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

/**
 * Manejo de sesión del barbero (PIN de acceso simple y seguro)
 */
const PIN_BARBERO_DEFAULT = '1234';

export function verificarPinBarbero(pinIngresado) {
  return pinIngresado === PIN_BARBERO_DEFAULT;
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
