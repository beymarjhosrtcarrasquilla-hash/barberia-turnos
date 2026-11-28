import {
  NEGOCIO_CONFIG,
  SERVICIOS,
  esModoSupabase,
  cargarDisponibilidadFecha,
  obtenerReservasBarberoAsync,
  crearReservaManualBarberoAsync,
  actualizarEstadoReservaAsync,
  alternarBloqueoHoraAsync,
  alternarDiaCerradoAsync,
  tieneSesionBarberoSupabase,
  iniciarSesionBarberoSupabase,
  registrarBarberoSupabase,
  obtenerBarberoActualSupabase,
  cerrarSesionBarberoSupabase,
  formatearFechaISO,
  formatearCOP,
  generarSlotsDisponibles,
  verificarPinBarbero,
  pinConfigurado,
  configurarPinBarbero,
  segundosBloqueoRestantes,
  escaparHTML,
  guardarSesionBarbero
} from './storage.js';

// Estado del panel del barbero
const LIMITE_RECIENTES = 4;
const estadoPanel = {
  fechaActual: formatearFechaISO(new Date()),
  filtroEstado: 'todos', // 'todos', 'activos', 'completados', 'cancelados'
  mostrarTodas: true
};

// Elementos DOM de Autenticación
const authSection = document.getElementById('authSection');
const adminContent = document.getElementById('adminContent');
const barberoNombreHeader = document.getElementById('barberoNombreHeader');
const authTabs = document.getElementById('authTabs');
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const supabaseAuthForm = document.getElementById('supabaseAuthForm');
const barberoEmail = document.getElementById('barberoEmail');
const barberoPassword = document.getElementById('barberoPassword');
const authMensaje = document.getElementById('authMensaje');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const supabaseRegisterForm = document.getElementById('supabaseRegisterForm');
const regNombre = document.getElementById('regNombre');
const regEmail = document.getElementById('regEmail');
const regPassword = document.getElementById('regPassword');
const regInviteCode = document.getElementById('regInviteCode');
const regMensaje = document.getElementById('regMensaje');
const regSubmitBtn = document.getElementById('regSubmitBtn');
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

// Bloqueo rápido de horarios
const bloqueoGrid = document.getElementById('bloqueoGrid');
const btnCerrarDia = document.getElementById('btnCerrarDia');
const bloqueoSubtitulo = document.getElementById('bloqueoSubtitulo');

/**
 * Inicialización
 */
document.addEventListener('DOMContentLoaded', () => {
  verificarAutenticacion();
  configurarEventosAuth();
  configurarEventosAgenda();
  configurarCompartirClientes();
  poblarSelectServiciosManual();
  if (btnToggleTurnos) {
    btnToggleTurnos.addEventListener('click', () => {
      estadoPanel.mostrarTodas = !estadoPanel.mostrarTodas;
      cargarTurnos();
    });
  }
  registrarServiceWorker();
});

function configurarCompartirClientes() {
  const urlClientes = NEGOCIO_CONFIG.urlPublica || window.location.origin;
  const btnCopiar = document.getElementById('btnCopiarEnlace');
  if (btnCopiar) {
    btnCopiar.addEventListener('click', async () => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(urlClientes);
        } else {
          const tmp = document.createElement('input');
          tmp.value = urlClientes;
          document.body.appendChild(tmp);
          tmp.select();
          document.execCommand('copy');
          document.body.removeChild(tmp);
        }
        mostrarToast(`Enlace copiado: ${urlClientes}`, 'success');
      } catch {
        mostrarToast(`Comparte este enlace: ${urlClientes}`, 'info');
      }
    });
  }

  const btnShareWa = document.getElementById('btnCompartirWhatsApp');
  if (btnShareWa) {
    const msg = encodeURIComponent(
      `Reserva tu turno en ${NEGOCIO_CONFIG.nombre} (Cali) aquí:\n${urlClientes}\n\n✂️ Corte Básico $20.000 | Corte Completo $30.000`
    );
    btnShareWa.href = `https://wa.me/?text=${msg}`;
  }
}

/**
 * Control de acceso por PIN
 */
function actualizarCabeceraBarbero(autenticado) {
  if (!barberoNombreHeader) return;
  if (!autenticado) {
    barberoNombreHeader.style.display = 'none';
    barberoNombreHeader.textContent = '';
    return;
  }
  const barbero = obtenerBarberoActualSupabase();
  if (barbero?.nombre) {
    barberoNombreHeader.textContent = `💈 ${barbero.nombre}`;
    barberoNombreHeader.style.display = 'inline-flex';
  } else {
    barberoNombreHeader.style.display = 'none';
  }
}

function cambiarTabAuth(modo) {
  const esRegistro = modo === 'register';
  if (supabaseAuthForm) supabaseAuthForm.style.display = esRegistro ? 'none' : 'block';
  if (supabaseRegisterForm) supabaseRegisterForm.style.display = esRegistro ? 'block' : 'none';
  if (tabLogin) tabLogin.classList.toggle('primary', !esRegistro);
  if (tabRegister) tabRegister.classList.toggle('primary', esRegistro);
  if (pinSubtitulo) {
    pinSubtitulo.textContent = esRegistro
      ? 'Registra tu cuenta de barbero con el código de invitación del local.'
      : 'Inicia sesión con tu cuenta de barbero en Supabase.';
  }
  if (authMensaje) authMensaje.textContent = '';
  if (regMensaje) regMensaje.textContent = '';
  if (esRegistro && regNombre) regNombre.focus();
  if (!esRegistro && barberoEmail) barberoEmail.focus();
}

function verificarAutenticacion() {
  if (tieneSesionBarberoSupabase()) {
    authSection.style.display = 'none';
    adminContent.style.display = 'block';
    actualizarCabeceraBarbero(true);
    cargarTurnos();
  } else {
    authSection.style.display = 'block';
    adminContent.style.display = 'none';
    actualizarCabeceraBarbero(false);
    if (esModoSupabase()) {
      if (authTabs) authTabs.style.display = 'flex';
      if (pinForm) pinForm.style.display = 'none';
      cambiarTabAuth('login');
    } else {
      if (authTabs) authTabs.style.display = 'none';
      if (supabaseAuthForm) supabaseAuthForm.style.display = 'none';
      if (supabaseRegisterForm) supabaseRegisterForm.style.display = 'none';
      if (pinForm) pinForm.style.display = 'block';
      pinInput.focus();
    }
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
  if (esModoSupabase()) {
    pinTitulo.textContent = 'Portal Barbero';
    pinSubtitulo.textContent = 'Inicia sesión con tu correo y contraseña de Supabase.';
    if (tabLogin) tabLogin.addEventListener('click', () => cambiarTabAuth('login'));
    if (tabRegister) tabRegister.addEventListener('click', () => cambiarTabAuth('register'));
    if (supabaseAuthForm) {
      supabaseAuthForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (authMensaje) authMensaje.textContent = '';
        if (authSubmitBtn) authSubmitBtn.disabled = true;
        try {
          await iniciarSesionBarberoSupabase(barberoEmail.value, barberoPassword.value);
          barberoPassword.value = '';
          verificarAutenticacion();
          mostrarToast('Sesión iniciada en Supabase.', 'success');
        } catch (err) {
          if (authMensaje) authMensaje.textContent = err.message;
          mostrarToast(err.message, 'error');
        } finally {
          if (authSubmitBtn) authSubmitBtn.disabled = false;
        }
      });
    }
    if (supabaseRegisterForm) {
      supabaseRegisterForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (regMensaje) {
          regMensaje.style.color = 'var(--danger)';
          regMensaje.textContent = '';
        }
        if (regSubmitBtn) regSubmitBtn.disabled = true;
        try {
          const res = await registrarBarberoSupabase(
            regEmail.value,
            regPassword.value,
            regNombre.value,
            regInviteCode.value
          );
          regPassword.value = '';
          regInviteCode.value = '';
          if (res.requiereConfirmacion) {
            if (regMensaje) {
              regMensaje.style.color = 'var(--success)';
              regMensaje.textContent = 'Cuenta creada. Revisa tu correo para confirmar tu cuenta y luego inicia sesión.';
            }
            mostrarToast('Cuenta creada. Confirma tu correo para iniciar sesión.', 'success');
          } else {
            supabaseRegisterForm.reset();
            verificarAutenticacion();
            mostrarToast('Cuenta de barbero creada e iniciada correctamente.', 'success');
          }
        } catch (err) {
          if (regMensaje) {
            regMensaje.style.color = 'var(--danger)';
            regMensaje.textContent = err.message;
          }
          mostrarToast(err.message, 'error');
        } finally {
          if (regSubmitBtn) regSubmitBtn.disabled = false;
        }
      });
    }
  } else {
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
  }

  btnLogout.addEventListener('click', async () => {
    await cerrarSesionBarberoSupabase();
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

  if (btnCerrarDia) {
    btnCerrarDia.addEventListener('click', async () => {
      try {
        const actualmenteCerrado = btnCerrarDia.dataset.cerrado === '1';
        const cerrado = await alternarDiaCerradoAsync(estadoPanel.fechaActual, actualmenteCerrado);
        mostrarToast(
          cerrado ? `Día ${estadoPanel.fechaActual} cerrado para nuevas citas.` : `Día ${estadoPanel.fechaActual} reabierto.`,
          'info'
        );
        await cargarTurnos();
      } catch (err) {
        mostrarToast(err.message, 'error');
      }
    });
  }

  // Modal Turno Manual
  btnNuevoTurnoManual.addEventListener('click', () => {
    manualFechaInput.value = estadoPanel.fechaActual;
    modalManual.classList.add('active');
  });

  btnCerrarModalManual.addEventListener('click', () => {
    modalManual.classList.remove('active');
  });

  formManual.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cliente = document.getElementById('manualCliente').value.trim();
    const telefono = document.getElementById('manualTelefono').value.trim();
    const servicioId = manualServicioSelect.value;
    const fecha = manualFechaInput.value;
    const hora = manualHoraInput.value;
    const notas = document.getElementById('manualNotas').value.trim();

    try {
      await crearReservaManualBarberoAsync({
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
      await cargarTurnos();
    } catch (err) {
      mostrarToast(err.message, 'error');
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

  fechaTitulo.textContent = estadoPanel.fechaActual === hoyISO
    ? `Agenda de Hoy (${dia}/${mes}/${anio})`
    : `Agenda del ${dia}/${mes}/${anio}`;
}

/**
 * Carga y renderiza los turnos del día
 */
async function cargarTurnos() {
  let todas = [];
  let disp = { diaCerrado: false, horasBloqueadas: [] };
  try {
    [todas, disp] = await Promise.all([
      obtenerReservasBarberoAsync(estadoPanel.fechaActual),
      cargarDisponibilidadFecha(estadoPanel.fechaActual)
    ]);
  } catch (err) {
    mostrarToast(err.message, 'error');
  }
  const reservasDia = todas.filter(r => r.fecha === estadoPanel.fechaActual);
  renderizarBloqueos(reservasDia, disp);

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

  const cajaDelDia = reservasDia
    .filter(r => r.estado === 'completado')
    .reduce((sum, r) => sum + (r.precio || 0), 0);

  metTotalTurnos.textContent = total;
  metPendientes.textContent = pendientes;
  metCompletados.textContent = completados;
  metIngresos.textContent = formatearCOP(cajaDelDia);
}

function normalizarTelefonoWhatsApp(telefono) {
  const digits = String(telefono || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10 && digits.startsWith('3')) return `57${digits}`;
  return digits;
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
    const telWa = normalizarTelefonoWhatsApp(t.telefono);
    const msgRecordatorio = encodeURIComponent(
      `Hola ${t.cliente}, te recordamos tu turno en ${NEGOCIO_CONFIG.nombre} el ${t.fecha} a las ${t.hora} (${t.servicioNombre}). ¡Te esperamos!`
    );
    const waUrl = telWa ? `https://wa.me/${telWa}?text=${msgRecordatorio}` : '';
    card.className = `turno-card ${estadoSeguro}`;

    card.innerHTML = `
      <div class="turno-time">
        <span class="turno-hora">${esc(t.hora)}</span>
        <span class="turno-duracion">${esc(Number(t.duracionMinutos) || 30)} min</span>
      </div>

      <div class="turno-client">
        <div class="turno-client-top">
          <span class="turno-client-name">${esc(t.cliente)}</span>
          <span class="tag-badge ${estadoSeguro}">${esc(estadoSeguro === 'completado' ? 'atendido' : estadoSeguro)}</span>
        </div>
        <div class="turno-client-contact">
          <span>${esc(t.telefono)}</span>
        </div>
        ${t.notas ? `<p class="turno-nota">${esc(t.notas)}</p>` : ''}
      </div>

      <div class="turno-service">
        <div class="turno-service-name">${esc(t.servicioNombre)}</div>
        <div class="turno-service-meta">${esc(formatearCOP(t.precio))}</div>
      </div>

      <div class="turno-actions">
        ${estadoSeguro !== 'completado' && estadoSeguro !== 'cancelado' ? `
          <button type="button" class="nav-btn action-btn action-atendido" data-action="completar" data-id="${idSeguro}" title="Marcar como atendido y sumar a Caja del Día">
            ✓ Atendido
          </button>
        ` : ''}

        ${telWa ? `
          <a href="${esc(waUrl)}" target="_blank" rel="noopener noreferrer" class="nav-btn action-btn action-whatsapp" title="Enviar recordatorio por WhatsApp">
            💬 WhatsApp
          </a>
        ` : ''}

        ${estadoSeguro !== 'cancelado' ? `
          <button type="button" class="nav-btn action-btn action-cancelar" data-action="cancelar" data-id="${idSeguro}" title="Cancelar turno y liberar cupo">
            ✕ Cancelar
          </button>
        ` : `
          <button type="button" class="nav-btn action-btn" data-action="reactivar" data-id="${idSeguro}" title="Reactivar reserva">
            ↺ Reactivar
          </button>
        `}
      </div>
    `;

    // Eventos de botones de acción
    const btnComp = card.querySelector('[data-action="completar"]');
    if (btnComp) {
      btnComp.addEventListener('click', async () => {
        try {
          await actualizarEstadoReservaAsync(t.id, 'completado');
          mostrarToast(`Turno de ${t.cliente} marcado como completado.`, 'success');
          await cargarTurnos();
        } catch (err) {
          mostrarToast(err.message, 'error');
        }
      });
    }

    const btnCanc = card.querySelector('[data-action="cancelar"]');
    if (btnCanc) {
      btnCanc.addEventListener('click', async () => {
        if (confirm(`¿Cancelar el turno de las ${t.hora} de ${t.cliente}?`)) {
          try {
            await actualizarEstadoReservaAsync(t.id, 'cancelado');
            mostrarToast(`Turno de ${t.cliente} cancelado.`, 'info');
            await cargarTurnos();
          } catch (err) {
            mostrarToast(err.message, 'error');
          }
        }
      });
    }

    const btnReac = card.querySelector('[data-action="reactivar"]');
    if (btnReac) {
      btnReac.addEventListener('click', async () => {
        try {
          await actualizarEstadoReservaAsync(t.id, 'confirmado');
          mostrarToast(`Turno de ${t.cliente} reactivado.`, 'success');
          await cargarTurnos();
        } catch (err) {
          mostrarToast(err.message, 'error');
        }
      });
    }

    turnosList.appendChild(card);
  });
}

/**
 * Bloqueo rápido: cada franja del día se marca/desmarca como No disponible
 */
function renderizarBloqueos(reservasDia = [], disp = { diaCerrado: false, horasBloqueadas: [] }) {
  if (!bloqueoGrid) return;
  const fecha = estadoPanel.fechaActual;
  const diaCerrado = Boolean(disp.diaCerrado);

  if (btnCerrarDia) {
    btnCerrarDia.dataset.cerrado = diaCerrado ? '1' : '0';
    btnCerrarDia.textContent = diaCerrado ? 'Reabrir día' : 'Cerrar día completo';
    btnCerrarDia.style.color = diaCerrado ? 'var(--success)' : 'var(--danger)';
    btnCerrarDia.style.borderColor = diaCerrado ? 'var(--success)' : 'rgba(239, 68, 68, 0.35)';
  }
  if (bloqueoSubtitulo) {
    bloqueoSubtitulo.innerHTML = diaCerrado
      ? 'Este día está marcado como <strong>Cerrado</strong>. Los clientes no verán horarios disponibles hasta que lo reabras.'
      : 'Toca una hora para marcarla como <strong>No disponible</strong> (almuerzo, diligencia). Los clientes no la verán. Vuelve a tocarla para liberarla. Las horas con turno activo no se pueden bloquear.';
  }
  bloqueoGrid.style.opacity = diaCerrado ? '0.45' : '1';
  bloqueoGrid.style.pointerEvents = diaCerrado ? 'none' : 'auto';

  const ocupadas = new Set(
    reservasDia
      .filter(r => r.fecha === fecha && r.estado !== 'cancelado')
      .map(r => r.hora)
  );
  const bloqueadas = new Set(disp.horasBloqueadas || []);
  bloqueoGrid.textContent = '';
  generarSlotsDisponibles().forEach(hora => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot-btn' + (bloqueadas.has(hora) ? ' bloqueado' : '');
    btn.textContent = hora;
    btn.dataset.hora = hora;
    if (ocupadas.has(hora)) {
      btn.disabled = true;
      btn.title = 'Con turno activo';
    } else {
      const estaBloqueada = bloqueadas.has(hora);
      btn.title = estaBloqueada ? 'Bloqueado: clic para liberar' : 'Libre: clic para bloquear';
      if (estaBloqueada) btn.setAttribute('aria-pressed', 'true');
      btn.addEventListener('click', async () => {
        try {
          const ahoraBloqueada = await alternarBloqueoHoraAsync(fecha, hora, estaBloqueada);
          mostrarToast(`${hora} ${ahoraBloqueada ? 'bloqueada (No disponible)' : 'liberada'}.`, 'info');
          await cargarTurnos();
        } catch (err) {
          mostrarToast(err.message, 'error');
        }
      });
    }
    bloqueoGrid.appendChild(btn);
  });
}

function poblarSelectServiciosManual() {
  manualServicioSelect.innerHTML = '';
  SERVICIOS.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.nombre} (${formatearCOP(s.precio)})`;
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
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.log('ServiceWorker barbero no disponible:', err);
    });
  }
}
