import {
  NEGOCIO_CONFIG,
  SERVICIOS,
  generarSlotsDisponibles,
  obtenerHorasOcupadasPorFecha,
  obtenerHorasBloqueadas,
  estaDiaCerrado,
  crearReserva,
  consultarReservaCliente,
  cancelarReservaCliente,
  formatearFechaISO,
  formatearCOP,
  escaparHTML
} from './storage.js';

// Estado de la reserva en curso
const estadoReserva = {
  servicioSeleccionado: null,
  fechaSeleccionada: null,
  horaSeleccionada: null
};

// Elementos DOM
const serviciosContainer = document.getElementById('serviciosGrid');
const fechaInput = document.getElementById('fechaInput');
const slotsContainer = document.getElementById('slotsContainer');
const slotsVacioMsg = document.getElementById('slotsVacio');
const bookingForm = document.getElementById('bookingForm');
const btnSubmit = document.getElementById('btnSubmit');

// Elementos de resumen en vivo
const summaryServicio = document.getElementById('summaryServicio');
const summaryFecha = document.getElementById('summaryFecha');
const summaryHora = document.getElementById('summaryHora');
const summaryPrecio = document.getElementById('summaryPrecio');

// Modal de confirmación
const confirmacionModal = document.getElementById('confirmacionModal');
const ticketCodigo = document.getElementById('ticketCodigo');
const ticketCliente = document.getElementById('ticketCliente');
const ticketServicio = document.getElementById('ticketServicio');
const ticketFechaHora = document.getElementById('ticketFechaHora');
const ticketTotal = document.getElementById('ticketTotal');
const btnWhatsApp = document.getElementById('btnWhatsApp');
const btnCalendar = document.getElementById('btnCalendar');
const btnCerrarModal = document.getElementById('btnCerrarModal');

// Consulta / cancelación por código
const consultaForm = document.getElementById('consultaForm');
const consultaCodigo = document.getElementById('consultaCodigo');
const consultaTelefono = document.getElementById('consultaTelefono');
const consultaResultado = document.getElementById('consultaResultado');

/**
 * Inicialización de la aplicación
 */
document.addEventListener('DOMContentLoaded', () => {
  renderizarServicios();
  inicializarContactoNegocio();
  inicializarSelectorFecha();
  configurarConsultaCita();
  configurarEventosFormulario();
  actualizarResumen();
  registrarServiceWorker();
});

/**
 * Refleja los datos del negocio (NEGOCIO_CONFIG) en los elementos marcados con data-negocio
 */
function inicializarContactoNegocio() {
  document.querySelectorAll('[data-negocio]').forEach((el) => {
    const v = NEGOCIO_CONFIG[el.dataset.negocio];
    if (v) el.textContent = v;
  });
  document.querySelectorAll('[data-negocio-wa]').forEach((el) => {
    el.href = NEGOCIO_CONFIG.whatsappUrl;
  });
}

/**
 * Sección "¿Ya tienes cita?": consulta o cancela con código + teléfono
 */
function configurarConsultaCita() {
  if (!consultaForm) return;
  const mostrar = (reserva, mensaje, tipo = 'info') => {
    consultaResultado.textContent = '';
    if (mensaje) {
      const p = document.createElement('p');
      p.className = `consulta-msg ${tipo}`;
      p.textContent = mensaje;
      consultaResultado.appendChild(p);
    }
    if (!reserva) return;
    const lista = document.createElement('ul');
    lista.className = 'consulta-detalle';
    [
      ['Código', reserva.codigo],
      ['Servicio', reserva.servicioNombre],
      ['Fecha y hora', `${reserva.fecha} a las ${reserva.hora} h`],
      ['Total', formatearCOP(reserva.precio)],
      ['Estado', reserva.estado]
    ].forEach(([k, v]) => {
      const li = document.createElement('li');
      const b = document.createElement('strong');
      b.textContent = `${k}: `;
      li.append(b, document.createTextNode(String(v)));
      lista.appendChild(li);
    });
    consultaResultado.appendChild(lista);
    if (reserva.estado === 'confirmado' || reserva.estado === 'pendiente') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-secondary';
      btn.textContent = 'Cancelar mi cita';
      btn.addEventListener('click', () => {
        if (!confirm('¿Seguro que deseas cancelar tu cita?')) return;
        try {
          const r = cancelarReservaCliente(consultaCodigo.value, consultaTelefono.value);
          mostrar(r, 'Tu cita fue cancelada y el horario quedó libre.', 'success');
          renderizarSlotsHorarios();
        } catch (err) {
          mostrar(null, err.message, 'error');
        }
      });
      consultaResultado.appendChild(btn);
    }
  };

  consultaForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const r = consultarReservaCliente(consultaCodigo.value, consultaTelefono.value);
    if (!r) mostrar(null, 'No encontramos una cita con ese código y teléfono.', 'error');
    else mostrar(r, '', 'info');
  });
}

/**
 * Renderiza el catálogo de servicios
 */
function renderizarServicios() {
  serviciosContainer.innerHTML = '';
  SERVICIOS.forEach((servicio, index) => {
    const card = document.createElement('div');
    card.className = 'service-card' + (index === 0 ? ' selected' : '');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.dataset.id = servicio.id;

    card.innerHTML = `
      <div class="service-top">
        <h3 class="service-title">${escaparHTML(servicio.nombre)}</h3>
        <p class="service-desc">${escaparHTML(servicio.descripcion)}</p>
      </div>
      <div class="service-bottom">
        <div class="service-duration">${escaparHTML(servicio.duracionMinutos)} min</div>
        <div class="service-price">${escaparHTML(formatearCOP(servicio.precio))}</div>
      </div>
    `;

    card.addEventListener('click', () => seleccionarServicio(servicio, card));
    serviciosContainer.appendChild(card);

    if (index === 0) {
      estadoReserva.servicioSeleccionado = servicio;
    }
  });
}

function seleccionarServicio(servicio, cardElement) {
  estadoReserva.servicioSeleccionado = servicio;
  document.querySelectorAll('.service-card').forEach(c => c.classList.remove('selected'));
  cardElement.classList.add('selected');
  actualizarResumen();
}

/**
 * Inicializa el campo de fecha restringiendo fechas pasadas y domingos
 */
function inicializarSelectorFecha() {
  const hoy = new Date();
  // Si hoy es domingo (0), saltar al lunes
  if (hoy.getDay() === 0) {
    hoy.setDate(hoy.getDate() + 1);
  }
  const hoyISO = formatearFechaISO(hoy);
  fechaInput.min = hoyISO;
  fechaInput.value = hoyISO;
  estadoReserva.fechaSeleccionada = hoyISO;

  // Fecha máxima: 30 días adelante
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  fechaInput.max = formatearFechaISO(maxDate);

  fechaInput.addEventListener('change', (e) => {
    const fechaElegida = new Date(e.target.value + 'T00:00:00');
    // Si el usuario elige un domingo
    if (fechaElegida.getDay() === 0) {
      mostrarToast('Los domingos la barbería permanece cerrada. Por favor elige de lunes a sábado.', 'error');
      // Mover al siguiente lunes
      fechaElegida.setDate(fechaElegida.getDate() + 1);
      const nuevaFecha = formatearFechaISO(fechaElegida);
      fechaInput.value = nuevaFecha;
      estadoReserva.fechaSeleccionada = nuevaFecha;
    } else {
      estadoReserva.fechaSeleccionada = e.target.value;
    }
    estadoReserva.horaSeleccionada = null;
    renderizarSlotsHorarios();
    actualizarResumen();
  });

  renderizarSlotsHorarios();
}

/**
 * Renderiza los horarios disponibles detectando ocupación en tiempo real
 */
function renderizarSlotsHorarios() {
  const fecha = estadoReserva.fechaSeleccionada;
  if (!fecha) {
    slotsContainer.innerHTML = '';
    slotsVacioMsg.style.display = 'block';
    return;
  }

  slotsVacioMsg.style.display = 'none';
  slotsVacioMsg.textContent = 'No hay turnos disponibles para esta fecha.';
  slotsContainer.innerHTML = '';

  if (estaDiaCerrado(fecha)) {
    slotsVacioMsg.textContent = 'La barbería no atiende en esta fecha (día cerrado).';
    slotsVacioMsg.style.display = 'block';
    estadoReserva.horaSeleccionada = null;
    actualizarResumen();
    return;
  }

  const todosLosSlots = generarSlotsDisponibles();
  const horasOcupadas = obtenerHorasOcupadasPorFecha(fecha);
  const horasBloqueadas = obtenerHorasBloqueadas(fecha); // no disponibles: se ocultan al cliente

  // Si la fecha seleccionada es hoy, bloquear horas que ya pasaron
  const ahora = new Date();
  const hoyISO = formatearFechaISO(ahora);
  const horaActualMinutos = ahora.getHours() * 60 + ahora.getMinutes();

  let primerDisponible = null;

  todosLosSlots.forEach(hora => {
    if (horasBloqueadas.includes(hora)) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot-btn';
    btn.textContent = hora;

    const [hh, mm] = hora.split(':').map(Number);
    const slotMinutos = hh * 60 + mm;

    const esOcupado = horasOcupadas.includes(hora);
    const esPasado = (fecha === hoyISO && slotMinutos <= horaActualMinutos);

    if (esOcupado || esPasado) {
      btn.disabled = true;
      btn.title = esOcupado ? 'Horario reservado' : 'Horario ya transcurrido';
    } else {
      if (!primerDisponible && !estadoReserva.horaSeleccionada) {
        primerDisponible = hora;
      }
      btn.addEventListener('click', () => {
        document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        estadoReserva.horaSeleccionada = hora;
        actualizarResumen();
      });
    }

    if (estadoReserva.horaSeleccionada === hora && !btn.disabled) {
      btn.classList.add('selected');
    }

    slotsContainer.appendChild(btn);
  });

  if (slotsContainer.children.length === 0) slotsVacioMsg.style.display = 'block';

  // Autoseleccionar el primer disponible si no hay uno elegido
  if (!estadoReserva.horaSeleccionada && primerDisponible) {
    const primerBtn = Array.from(slotsContainer.children).find(b => b.textContent === primerDisponible);
    if (primerBtn) {
      primerBtn.classList.add('selected');
      estadoReserva.horaSeleccionada = primerDisponible;
    }
  }

  actualizarResumen();
}

/**
 * Actualiza la barra inferior de resumen en vivo
 */
function actualizarResumen() {
  if (estadoReserva.servicioSeleccionado) {
    summaryServicio.textContent = estadoReserva.servicioSeleccionado.nombre;
    summaryPrecio.textContent = formatearCOP(estadoReserva.servicioSeleccionado.precio);
  } else {
    summaryServicio.textContent = 'Ninguno seleccionado';
    summaryPrecio.textContent = formatearCOP(0);
  }

  if (estadoReserva.fechaSeleccionada) {
    const partes = estadoReserva.fechaSeleccionada.split('-');
    summaryFecha.textContent = `${partes[2]}/${partes[1]}/${partes[0]}`;
  } else {
    summaryFecha.textContent = 'Seleccionar fecha';
  }

  summaryHora.textContent = estadoReserva.horaSeleccionada ? `${estadoReserva.horaSeleccionada} h` : 'Seleccionar horario';

  // Habilitar o deshabilitar botón de confirmar
  const completo = estadoReserva.servicioSeleccionado && estadoReserva.fechaSeleccionada && estadoReserva.horaSeleccionada;
  btnSubmit.disabled = !completo;
}

/**
 * Configura los eventos del formulario y envío de reserva
 */
function configurarEventosFormulario() {
  bookingForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const nombre = document.getElementById('clienteNombre').value.trim();
    const telefono = document.getElementById('clienteTelefono').value.trim();
    const email = document.getElementById('clienteEmail').value.trim();
    const notas = document.getElementById('clienteNotas').value.trim();

    if (!nombre || !telefono) {
      mostrarToast('Por favor completa tu nombre y número de teléfono.', 'error');
      return;
    }

    if (!estadoReserva.servicioSeleccionado || !estadoReserva.fechaSeleccionada || !estadoReserva.horaSeleccionada) {
      mostrarToast('Por favor selecciona el servicio, fecha y horario.', 'error');
      return;
    }

    try {
      // Intentar crear la reserva evitando colisiones
      const nuevaReserva = crearReserva({
        cliente: nombre,
        telefono,
        email,
        servicioId: estadoReserva.servicioSeleccionado.id,
        fecha: estadoReserva.fechaSeleccionada,
        hora: estadoReserva.horaSeleccionada,
        notas
      });

      // Notificar éxito y abrir modal
      mostrarModalConfirmacion(nuevaReserva);
      mostrarToast('¡Tu turno ha sido confirmado con éxito!', 'success');

      // Limpiar formulario y refrescar slots
      bookingForm.reset();
      renderizarSlotsHorarios();
    } catch (err) {
      mostrarToast(err.message, 'error');
      renderizarSlotsHorarios();
    }
  });

  btnCerrarModal.addEventListener('click', () => {
    confirmacionModal.classList.remove('active');
  });
}

/**
 * Despliega el comprobante modal con opciones de compartir y calendario
 */
function mostrarModalConfirmacion(reserva) {
  ticketCodigo.textContent = reserva.codigo;
  ticketCliente.textContent = reserva.cliente;
  ticketServicio.textContent = reserva.servicioNombre;
  ticketFechaHora.textContent = `${reserva.fecha} a las ${reserva.hora} hs`;
  ticketTotal.textContent = formatearCOP(reserva.precio);

  // Enlace a WhatsApp de la Barbería con datos pre-cargados
  const mensajeWhatsApp = encodeURIComponent(
    `Hola! Acabo de reservar un turno en ${NEGOCIO_CONFIG.nombre}:\n` +
    `📌 Código: ${reserva.codigo}\n` +
    `👤 Cliente: ${reserva.cliente}\n` +
    `✂️ Servicio: ${reserva.servicioNombre}\n` +
    `📅 Fecha: ${reserva.fecha} a las ${reserva.hora} hs\n` +
    `¡Nos vemos pronto!`
  );
  // WhatsApp provisional de Fran Barbe
  btnWhatsApp.href = `${NEGOCIO_CONFIG.whatsappUrl}?text=${mensajeWhatsApp}`;

  // Generador de archivo .ics para Google Calendar y Apple Calendar
  btnCalendar.onclick = () => generarArchivoICS(reserva);

  confirmacionModal.classList.add('active');
}

/**
 * Genera y descarga un archivo .ics estándar para añadir al calendario del cliente
 */
function generarArchivoICS(reserva) {
  const [anio, mes, dia] = reserva.fecha.split('-').map(Number);
  const [hora, min] = reserva.hora.split(':').map(Number);

  const inicio = new Date(anio, mes - 1, dia, hora, min);
  const fin = new Date(inicio.getTime() + (reserva.duracionMinutos || 30) * 60000);

  const formatoICS = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${NEGOCIO_CONFIG.nombre}//Turnos Web//ES`,
    'BEGIN:VEVENT',
    `UID:${reserva.id}@barberia.local`,
    `DTSTAMP:${formatoICS(new Date())}`,
    `DTSTART:${formatoICS(inicio)}`,
    `DTEND:${formatoICS(fin)}`,
    `SUMMARY:${NEGOCIO_CONFIG.nombre}: ${reserva.servicioNombre}`,
    `DESCRIPTION:Reserva código ${reserva.codigo} para ${reserva.cliente}.\\nNotas: ${reserva.notas || 'Ninguna'}`,
    `LOCATION:${NEGOCIO_CONFIG.ubicacion}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Turno-Barberia-${reserva.codigo}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  mostrarToast('Archivo de calendario (.ics) descargado.', 'success');
}

/**
 * Muestra mensajes flotantes (Toasts)
 */
function mostrarToast(mensaje, tipo = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  const texto = document.createElement('span');
  texto.textContent = String(mensaje);
  toast.appendChild(texto);

  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

/**
 * Registra el Service Worker para capacidad offline y PWA
 */
function registrarServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('ServiceWorker no disponible en este contexto:', err);
    });
  }
}
