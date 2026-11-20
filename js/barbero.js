import {
  SERVICIOS,
  obtenerReservas,
  actualizarEstadoReserva,
  cancelarReserva,
  crearReserva,
  restablecerDatosDemo,
  formatearFechaISO,
  verificarPinBarbero,
  pinConfigurado,
  configurarPinBarbero,
  segundosBloqueoRestantes,
  escaparHTML,
  guardarSesionBarbero,
  tieneSesionBarberoActiva
} from './storage.js';

// Estado del panel del barbero
const LIMITE_RECIENTES = 4;
const estadoPanel = {
  fechaActual: formatearFechaISO(new Date()),
  filtroEstado: 'todos', // 'todos', 'activos', 'completados', 'cancelados'
  mostrarTodas: false
};

// Elementos DOM de Autenticación
const authSection = document.getElementById('authSection');
const adminContent = document.getElementById('adminContent');
const pinForm = document.getElementById('pinForm');
const pinInput = document.getElementById('pinInput');
const pinConfirmGroup = document.getElementById('pinConfirmGroup');
const pinConfirmInput = document.getElementById('pinConfirmInput');
const pinTitulo = document.getElementById('pinTitulo');
const pinSubtitulo = document.getElementById('pinSubtitulo');
const pinSubmitBtn = document.getElementById('pinSubmitBtn');
const pinMensaje = document.getElementById('pinMensaje');
let timerBloqueo = null;
const btnLogout = document.getElementById('btnLogout');

// Elementos de la Agenda
const fechaFiltroInput = document.getElementById('fechaFiltroInput');
const fechaTitulo = document.getElementById('fechaTitulo');
const btnDiaAnterior = document.getElementById('btnDiaAnterior');
const btnDiaSiguiente = document.getElementById('btnDiaSiguiente');
const btnHoy = document.getElementById('btnHoy');
const turnosList = document.getElementById('turnosList');
const turnosToggleWrap = document.getElementById('turnosToggleWrap');
const btnToggleTurnos = document.getElementById('btnToggleTurnos');
const turnosVacioMsg = document.getElementById('turnosVacioMsg');
const filtroEstadoSelect = document.getElementById('filtroEstadoSelect');

// Métricas
const metTotalTurnos = document.getElementById('metTotalTurnos');
const metIngresos = document.getElementById('metIngresos');
const metPendientes = document.getElementById('metPendientes');
const metCompletados = document.getElementById('metCompletados');

// Modal Nuevo Turno Manual
const btnNuevoTurnoManual = document.getElementById('btnNuevoTurnoManual');
const modalManual = document.getElementById('modalManual');
const formManual = document.getElementById('formManual');
const btnCerrarModalManual = document.getElementById('btnCerrarModalManual');
const manualServicioSelect = document.getElementById('manualServicioSelect');
const manualFechaInput = document.getElementById('manualFechaInput');
const manualHoraInput = document.getElementById('manualHoraInput');

// Restablecer Demo
const btnResetDemo = document.getElementById('btnResetDemo');

/**
 * Inicialización
 */
document.addEventListener('DOMContentLoaded', () => {
  verificarAutenticacion();
  configurarEventosAuth();
  configurarEventosAgenda();
  poblarSelectServiciosManual();
  if (btnToggleTurnos) {
    btnToggleTurnos.addEventListener('click', () => {
      estadoPanel.mostrarTodas = !estadoPanel.mostrarTodas;
      cargarTurnos();
    });
  }
  registrarServiceWorker();
});

/**
 * Control de acceso por PIN
 */
function verificarAutenticacion() {
  if (tieneSesionBarberoActiva()) {
    authSection.style.display = 'none';
    adminContent.style.display = 'block';
    cargarTurnos();
  } else {
    authSection.style.display = 'block';
    adminContent.style.display = 'none';
    pinInput.focus();
  }
}

function esc(v) { return escaparHTML(v); }

function prepararModoPin() {
  const configurado = pinConfigurado();
  pinConfirmGroup.style.display = configurado ? 'none' : 'block';
  pinConfirmInput.required = !configurado;
  pinTitulo.textContent = configurado ? 'Acceso Privado' : 'Configurar PIN del barbero';
  pinSubtitulo.textContent = configurado
    ? 'Ingresa el PIN para gestionar los turnos.'
    : 'Primer uso: define un PIN de 4 a 8 dígitos (no secuencias ni repetidos).';
  pinSubmitBtn.textContent = configurado ? 'Ingresar' : 'Guardar PIN e ingresar';
}

function actualizarCuentaBloqueo() {
  const seg = segundosBloqueoRestantes();
  const bloqueado = seg > 0;
  pinInput.disabled = bloqueado;
  pinSubmitBtn.disabled = bloqueado;
  if (bloqueado) {
    const m = Math.floor(seg / 60);
    pinMensaje.textContent = `Demasiados intentos. Reintenta en ${m}:${String(seg % 60).padStart(2, '0')} min.`;
    clearTimeout(timerBloqueo);
    timerBloqueo = setTimeout(actualizarCuentaBloqueo, 1000);
  } else if (pinMensaje.dataset.bloqueo === '1' || pinMensaje.textContent.startsWith('Demasiados')) {
    pinMensaje.textContent = '';
  }
  pinMensaje.dataset.bloqueo = bloqueado ? '1' : '0';
}

function configurarEventosAuth() {
  prepararModoPin();
  actualizarCuentaBloqueo();

  pinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = pinInput.value.trim();
    try {
      if (!pinConfigurado()) {
        if (pin !== pinConfirmInput.value.trim()) {
          mostrarToast('Los PIN no coinciden.', 'error');
          return;
        }
        await configurarPinBarbero(pin);
        prepararModoPin();
      }
      const r = await verificarPinBarbero(pin);
      pinInput.value = '';
      pinConfirmInput.value = '';
      if (r.ok) {
        guardarSesionBarbero(true);
        verificarAutenticacion();
        mostrarToast('Sesión iniciada correctamente.', 'success');
      } else if (r.bloqueado) {
        actualizarCuentaBloqueo();
        mostrarToast('Acceso bloqueado temporalmente por intentos fallidos.', 'error');
      } else {
        mostrarToast(`PIN incorrecto. Intentos restantes: ${r.restantes}.`, 'error');
        pinInput.focus();
      }
    } catch (err) {
      mostrarToast(err.message, 'error');
    }
  });

  btnLogout.addEventListener('click', () => {
    guardarSesionBarbero(false);
    verificarAutenticacion();
    mostrarToast('Sesión cerrada.', 'info');
  });
}

/**
 * Configuración de controles de la agenda
 */
function configurarEventosAgenda() {
  fechaFiltroInput.value = estadoPanel.fechaActual;
  actualizarTextoFechaTitulo();

  fechaFiltroInput.addEventListener('change', (e) => {
    estadoPanel.fechaActual = e.target.value;
    actualizarTextoFechaTitulo();
    cargarTurnos();
  });

  btnDiaAnterior.addEventListener('click', () => {
    cambiarDia(-1);
  });

  btnDiaSiguiente.addEventListener('click', () => {
    cambiarDia(1);
  });

  btnHoy.addEventListener('click', () => {
    estadoPanel.fechaActual = formatearFechaISO(new Date());
    fechaFiltroInput.value = estadoPanel.fechaActual;
    actualizarTextoFechaTitulo();
    cargarTurnos();
  });

  filtroEstadoSelect.addEventListener('change', (e) => {
    estadoPanel.filtroEstado = e.target.value;
    cargarTurnos();
  });

  // Modal Turno Manual
  btnNuevoTurnoManual.addEventListener('click', () => {
    manualFechaInput.value = estadoPanel.fechaActual;
    modalManual.classList.add('active');
  });

  btnCerrarModalManual.addEventListener('click', () => {
    modalManual.classList.remove('active');
  });

  formManual.addEventListener('submit', (e) => {
    e.preventDefault();
    const cliente = document.getElementById('manualCliente').value.trim();
    const telefono = document.getElementById('manualTelefono').value.trim();
    const servicioId = manualServicioSelect.value;
    const fecha = manualFechaInput.value;
    const hora = manualHoraInput.value;
    const notas = document.getElementById('manualNotas').value.trim();

    try {
      crearReserva({
        cliente,
        telefono,
        servicioId,
        fecha,
        hora,
        notas: notas ? `[Manual Barbero] ${notas}` : '[Agendado en local]'
      });

      mostrarToast(`Turno registrado para ${cliente} a las ${hora} hs.`, 'success');
      formManual.reset();
      modalManual.classList.remove('active');
      cargarTurnos();
    } catch (err) {
      mostrarToast(err.message, 'error');
    }
  });

  // Restablecer Demo
  btnResetDemo.addEventListener('click', () => {
    if (confirm('¿Deseas restablecer los turnos con los datos de demostración iniciales?')) {
      restablecerDatosDemo();
      cargarTurnos();
      mostrarToast('Datos de demostración restablecidos.', 'info');
    }
  });
}

function cambiarDia(offset) {
  const d = new Date(estadoPanel.fechaActual + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  estadoPanel.fechaActual = formatearFechaISO(d);
  fechaFiltroInput.value = estadoPanel.fechaActual;
  actualizarTextoFechaTitulo();
  cargarTurnos();
}

function actualizarTextoFechaTitulo() {
  const [anio, mes, dia] = estadoPanel.fechaActual.split('-');
  const hoyISO = formatearFechaISO(new Date());

  let sufijo = '';
  if (estadoPanel.fechaActual === hoyISO) sufijo = ' (Hoy)';

  fechaTitulo.textContent = `Agenda del ${dia}/${mes}/${anio}${sufijo}`;
}

/**
 * Carga y renderiza los turnos del día
 */
function cargarTurnos() {
  const todas = obtenerReservas();
  const reservasDia = todas.filter(r => r.fecha === estadoPanel.fechaActual);

  // Calcular métricas del día (independiente de los filtros)
  actualizarMetricas(reservasDia);

  // Aplicar filtro de estado
  let filtradas = reservasDia;
  if (estadoPanel.filtroEstado === 'activos') {
    filtradas = reservasDia.filter(r => r.estado === 'confirmado' || r.estado === 'pendiente');
  } else if (estadoPanel.filtroEstado === 'completados') {
    filtradas = reservasDia.filter(r => r.estado === 'completado');
  } else if (estadoPanel.filtroEstado === 'cancelados') {
    filtradas = reservasDia.filter(r => r.estado === 'cancelado');
  }

  // Ordenar cronológicamente
  filtradas.sort((a, b) => a.hora.localeCompare(b.hora));

  renderizarListaTurnos(filtradas);
}

/**
 * Actualiza las tarjetas numéricas de resumen
 */
function actualizarMetricas(reservasDia) {
  const total = reservasDia.length;
  const completados = reservasDia.filter(r => r.estado === 'completado').length;
  const cancelados = reservasDia.filter(r => r.estado === 'cancelado').length;
  const pendientes = total - completados - cancelados;

  const ingresosProyectados = reservasDia
    .filter(r => r.estado !== 'cancelado')
    .reduce((sum, r) => sum + (r.precio || 0), 0);

  metTotalTurnos.textContent = total;
  metPendientes.textContent = pendientes;
  metCompletados.textContent = completados;
  metIngresos.textContent = `$${ingresosProyectados.toFixed(2)}`;
}

/**
 * Renderiza la lista visual de turnos
 */
function renderizarListaTurnos(turnos) {
  turnosList.innerHTML = '';

  if (turnos.length === 0) {
    turnosVacioMsg.style.display = 'block';
    if (turnosToggleWrap) turnosToggleWrap.style.display = 'none';
    return;
  }

  turnosVacioMsg.style.display = 'none';

  const hayMas = turnos.length > LIMITE_RECIENTES;
  const visibles = (hayMas && !estadoPanel.mostrarTodas) ? turnos.slice(0, LIMITE_RECIENTES) : turnos;

  if (turnosToggleWrap && btnToggleTurnos) {
    if (hayMas) {
      turnosToggleWrap.style.display = 'flex';
      btnToggleTurnos.textContent = estadoPanel.mostrarTodas
        ? `Mostrar recientes (${LIMITE_RECIENTES})`
        : `Ver todas (${turnos.length})`;
    } else {
      turnosToggleWrap.style.display = 'none';
    }
  }

  visibles.forEach(t => {
    const card = document.createElement('div');
    const estadoSeguro = ['pendiente', 'confirmado', 'completado', 'cancelado'].includes(t.estado) ? t.estado : 'pendiente';
    const idSeguro = esc(t.id);
    card.className = `turno-card ${estadoSeguro}`;

    card.innerHTML = `
      <div class="turno-time">
        <span class="turno-hora">${esc(t.hora)}</span>
        <span class="turno-duracion">${esc(Number(t.duracionMinutos) || 45)} min</span>
      </div>

      <div class="turno-client">
        <div class="turno-client-top">
          <span class="turno-client-name">${esc(t.cliente)}</span>
          <span class="tag-badge ${estadoSeguro}">${esc(estadoSeguro)}</span>
          ${t.esDemo ? '<span class="tag-badge demo">Demo</span>' : ''}
        </div>
        <div class="turno-client-contact">
          <span>${esc(t.telefono)}</span>
          ${telLimpio ? `<a href="${esc(waUrl)}" target="_blank" rel="noopener noreferrer" style="font-weight:600; color:#25d366;">WhatsApp</a>` : ''}
        </div>
        ${t.notas ? `<p class="turno-nota">${esc(t.notas)}</p>` : ''}
      </div>

      <div class="turno-service">
        <div class="turno-service-name">${esc(t.servicioNombre)}</div>
        <div class="turno-service-meta">$${esc((Number(t.precio) || 0).toFixed(2))}</div>
      </div>

      <div class="turno-actions">
        ${estadoSeguro !== 'completado' && estadoSeguro !== 'cancelado' ? `
          <button type="button" class="nav-btn" data-action="completar" data-id="${idSeguro}" title="Marcar como atendido" style="color: var(--success); border-color: var(--success);">
            ✓ Listo
          </button>
        ` : ''}

        ${estadoSeguro !== 'cancelado' ? `
          <button type="button" class="nav-btn" data-action="cancelar" data-id="${idSeguro}" title="Cancelar turno" style="color: var(--danger); border-color: var(--danger);">
            ✕ Cancelar
          </button>
        ` : `
          <button type="button" class="nav-btn" data-action="reactivar" data-id="${idSeguro}" title="Reactivar reserva">
            ↺ Reactivar
          </button>
        `}
      </div>
    `;

    // Eventos de botones de acción
    const btnComp = card.querySelector('[data-action="completar"]');
    if (btnComp) {
      btnComp.addEventListener('click', () => {
        actualizarEstadoReserva(t.id, 'completado');
        mostrarToast(`Turno de ${t.cliente} marcado como completado.`, 'success');
        cargarTurnos();
      });
    }

    const btnCanc = card.querySelector('[data-action="cancelar"]');
    if (btnCanc) {
      btnCanc.addEventListener('click', () => {
        if (confirm(`¿Cancelar el turno de las ${t.hora} de ${t.cliente}?`)) {
          cancelarReserva(t.id);
          mostrarToast(`Turno de ${t.cliente} cancelado.`, 'info');
          cargarTurnos();
        }
      });
    }

    const btnReac = card.querySelector('[data-action="reactivar"]');
    if (btnReac) {
      btnReac.addEventListener('click', () => {
        actualizarEstadoReserva(t.id, 'confirmado');
        mostrarToast(`Turno de ${t.cliente} reactivado.`, 'success');
        cargarTurnos();
      });
    }

    turnosList.appendChild(card);
  });
}

function poblarSelectServiciosManual() {
  manualServicioSelect.innerHTML = '';
  SERVICIOS.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.nombre} ($${s.precio.toFixed(2)})`;
    manualServicioSelect.appendChild(opt);
  });
}

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
  const icono = document.createElement('span');
  icono.textContent = tipo === 'success' ? '✅' : tipo === 'error' ? '⚠️' : 'ℹ️';
  const texto = document.createElement('span');
  texto.textContent = String(mensaje);
  toast.append(icono, texto);

  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

function registrarServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('ServiceWorker barbero no disponible:', err);
    });
  }
}
