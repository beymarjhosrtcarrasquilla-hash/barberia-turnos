import assert from 'node:assert/strict';
const mem = new Map();
globalThis.localStorage = { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
globalThis.sessionStorage = globalThis.localStorage;
const S = await import('file:///C:/Users/beyma/Projects/Aplicaciones/barberia-turnos/js/storage.js');
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('OK  ' + name); };

// próximo día laborable (no domingo) dentro de rango
const d = new Date(); d.setDate(d.getDate() + 2); while (d.getDay() === 0) d.setDate(d.getDate() + 1);
const fecha = S.formatearFechaISO(d);
const base = { cliente: 'Juan Perez', telefono: '3001234567', email: '', servicioId: 'basico', fecha, hora: '10:00', notas: '' };

ok('agenda inicia vacía', () => assert.equal(S.obtenerReservas().length, 0));
ok('migración purga demo', () => { mem.set('barberia_reservas_v1', JSON.stringify([{ id: 'x', esDemo: true, fecha, hora: '09:00', estado: 'confirmado' }])); assert.equal(S.obtenerReservas().length, 0); });
ok('solo 2 servicios', () => assert.deepEqual(S.SERVICIOS.map(s => [s.id, s.precio, s.duracionMinutos]), [['basico', 20000, 30], ['completo', 30000, 45]]));
ok('formato COP', () => { assert.equal(S.formatearCOP(20000), '$20.000'); assert.equal(S.formatearCOP(30000), '$30.000'); assert.equal(S.formatearCOP(0), '$0'); });
ok('NEGOCIO_CONFIG', () => { assert.equal(S.NEGOCIO_CONFIG.nombre, 'Fran Barbe'); assert.equal(S.NEGOCIO_CONFIG.whatsappUrl, 'https://wa.me/573000000000'); });
ok('teléfonos válidos', () => { for (const t of ['3001234567', '300 123 4567', '+57 300 123 4567', '+573001234567']) assert.equal(S.normalizarTelefonoCO(t), '+573001234567', t); });
ok('teléfonos inválidos', () => { for (const t of ['2001234567', '300123456', '30012345678', '+54 9 11 4455-6677', '573001234567', '+57 200 123 4567', '300<b>x</b>1234', 'abc', '']) assert.equal(S.normalizarTelefonoCO(t), null, t); });
ok('XSS escapado', () => assert.ok(!S.escaparHTML('<img src=x onerror=alert(1)>').includes('<')));
ok('nombre con HTML rechazado', () => assert.throws(() => S.crearReserva({ ...base, cliente: '<script>alert(1)</script>' })));
let r;
ok('crear reserva normaliza teléfono', () => { r = S.crearReserva(base); assert.equal(r.telefono, '+573001234567'); assert.match(r.codigo, /^BARB-\d{4}$/); assert.equal(r.precio, 20000); });
ok('anti-colisión', () => assert.throws(() => S.crearReserva(base), /ya ha sido reservado/));
ok('bloquear franja', () => { assert.equal(S.alternarBloqueoHora(fecha, '12:00'), true); assert.deepEqual(S.obtenerHorasBloqueadas(fecha), ['12:00']); });
ok('reserva en franja bloqueada falla', () => assert.throws(() => S.crearReserva({ ...base, hora: '12:00' }), /no está disponible/));
ok('no bloquear franja con turno', () => assert.throws(() => S.alternarBloqueoHora(fecha, '10:00'), /turno activo/));
ok('desbloquear franja', () => { assert.equal(S.alternarBloqueoHora(fecha, '12:00'), false); assert.deepEqual(S.obtenerHorasBloqueadas(fecha), []); S.crearReserva({ ...base, hora: '12:00', telefono: '+57 311 222 3344' }); });
ok('bloqueo inválido', () => assert.throws(() => S.alternarBloqueoHora(fecha, '25:99')));
ok('consulta correcta', () => assert.equal(S.consultarReservaCliente(r.codigo.toLowerCase(), '300 123 4567').id, r.id));
ok('consulta tel ajeno => null', () => assert.equal(S.consultarReservaCliente(r.codigo, '3119999999'), null));
ok('consulta código inválido => null', () => assert.equal(S.consultarReservaCliente('XXXX', '3001234567'), null));
ok('cancelar con tel ajeno falla', () => assert.throws(() => S.cancelarReservaCliente(r.codigo, '3119999999'), /No encontramos/));
ok('cancelar libera cupo', () => { S.cancelarReservaCliente(r.codigo, '+57 3001234567'); assert.ok(!S.obtenerHorasOcupadasPorFecha(fecha).includes('10:00')); S.crearReserva(base); });
ok('doble cancelación falla', () => assert.throws(() => S.cancelarReservaCliente(r.codigo, '3001234567'), /ya estaba cancelada/));
console.log(`\n${n} pruebas OK`);

