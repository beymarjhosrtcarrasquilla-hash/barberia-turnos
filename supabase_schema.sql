-- Fran Barbe (Cali, Colombia) - esquema Supabase con Row Level Security (RLS)
-- Ejecutar en el SQL Editor de Supabase. No contiene secretos.
-- Modelo: el cliente anonimo NO puede SELECT/UPDATE/DELETE reservas. Solo puede crear
-- una reserva (RPC crear_reserva) y consultar horas ocupadas (RPC horas_ocupadas, sin datos personales).
-- El barbero opera autenticado (Supabase Auth) con rol 'barbero' en app_metadata.

create extension if not exists pgcrypto;

create table if not exists public.servicios (
  id text primary key,
  nombre text not null,
  duracion_minutos int not null check (duracion_minutos between 5 and 240),
  precio numeric(10,0) not null check (precio >= 0), -- pesos colombianos (COP), sin decimales
  activo boolean not null default true
);

create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique default ('BARB-' || floor(1000 + random() * 9000)::int),
  cliente text not null check (char_length(cliente) between 2 and 60),
  telefono text not null check (telefono ~ '^\+573[0-9]{9}$') -- celular colombiano normalizado +573XXXXXXXXX,
  email text check (email is null or char_length(email) <= 120),
  servicio_id text not null references public.servicios(id),
  fecha date not null,
  hora time not null,
  estado text not null default 'confirmado' check (estado in ('pendiente','confirmado','completado','cancelado')),
  notas text check (notas is null or char_length(notas) <= 300),
  creado_en timestamptz not null default now()
);

-- Bloqueos de horario del barbero (almuerzo, diligencias) sin crear turnos ficticios
create table if not exists public.bloqueos_horario (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  hora time not null,
  motivo text check (motivo is null or char_length(motivo) <= 100),
  creado_en timestamptz not null default now(),
  unique (fecha, hora)
);

-- Días cerrados completos por el barbero
create table if not exists public.dias_cerrados (
  fecha date primary key,
  motivo text check (motivo is null or char_length(motivo) <= 100),
  creado_en timestamptz not null default now()
);

-- Un solo turno activo por fecha/hora (evita doble reserva)
create unique index if not exists reservas_slot_unico
  on public.reservas (fecha, hora) where estado <> 'cancelado';

alter table public.servicios enable row level security;
alter table public.reservas enable row level security;
alter table public.bloqueos_horario enable row level security;
alter table public.dias_cerrados enable row level security;
alter table public.servicios force row level security;
alter table public.reservas force row level security;
alter table public.bloqueos_horario force row level security;
alter table public.dias_cerrados force row level security;

revoke all on public.reservas from anon, authenticated;
revoke all on public.servicios from anon, authenticated;
revoke all on public.bloqueos_horario from anon, authenticated;
revoke all on public.dias_cerrados from anon, authenticated;
grant select on public.servicios to anon, authenticated;
grant select on public.bloqueos_horario to anon, authenticated;
grant select on public.dias_cerrados to anon, authenticated;
grant select, insert, update, delete on public.reservas to authenticated;
grant insert, update, delete on public.bloqueos_horario to authenticated;
grant insert, update, delete on public.dias_cerrados to authenticated;

-- Servicios: lectura publica de los activos
drop policy if exists servicios_lectura_publica on public.servicios;
create policy servicios_lectura_publica on public.servicios
  for select to anon, authenticated using (activo);

-- Reservas: SOLO el barbero autenticado puede leer/modificar/borrar.
-- El rol anon no tiene ninguna policy (ni grant) => no puede leer ni modificar turnos ajenos.
drop policy if exists reservas_barbero_todo on public.reservas;
create policy reservas_barbero_todo on public.reservas
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'barbero')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'barbero');

-- Bloqueos: lectura pública, escritura solo rol barbero
drop policy if exists bloqueos_barbero_todo on public.bloqueos_horario;
drop policy if exists bloqueos_lectura_publica on public.bloqueos_horario;
create policy bloqueos_lectura_publica on public.bloqueos_horario
  for select to anon, authenticated using (true);
drop policy if exists bloqueos_barbero_escritura on public.bloqueos_horario;
create policy bloqueos_barbero_escritura on public.bloqueos_horario
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'barbero')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'barbero');

-- Días cerrados: lectura pública, escritura solo rol barbero
drop policy if exists dias_cerrados_lectura_publica on public.dias_cerrados;
create policy dias_cerrados_lectura_publica on public.dias_cerrados
  for select to anon, authenticated using (true);
drop policy if exists dias_cerrados_barbero_escritura on public.dias_cerrados;
create policy dias_cerrados_barbero_escritura on public.dias_cerrados
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'barbero')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'barbero');

-- Crear reserva (unica operacion de escritura del cliente anonimo).
-- security definer: valida y fuerza estado 'confirmado'; el cliente no elige id, estado ni codigo.
create or replace function public.crear_reserva(
  p_cliente text, p_telefono text, p_email text, p_servicio_id text,
  p_fecha date, p_hora time, p_notas text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_row public.reservas;
begin
  if p_fecha < current_date or p_fecha > current_date + 60 then
    raise exception 'fecha fuera de rango';
  end if;
  if extract(isodow from p_fecha) = 7 then
    raise exception 'barberia cerrada los domingos';
  end if;
  if p_hora < time '09:00' or p_hora > time '19:30' or extract(minute from p_hora)::int % 30 <> 0 then
    raise exception 'horario invalido';
  end if;
  if not exists (select 1 from public.servicios where id = p_servicio_id and activo) then
    raise exception 'servicio invalido';
  end if;
  if exists (select 1 from public.dias_cerrados where fecha = p_fecha) then
    raise exception 'dia cerrado por el barbero';
  end if;
  if exists (select 1 from public.bloqueos_horario where fecha = p_fecha and hora = p_hora) then
    raise exception 'horario no disponible';
  end if;
  -- Telefono colombiano: 3XXXXXXXXX o +573XXXXXXXXX (se normaliza a +57...)
  p_telefono := regexp_replace(trim(p_telefono), '[ ()-]', '', 'g');
  if p_telefono ~ '^3[0-9]{9}$' then p_telefono := '+57' || p_telefono; end if;
  if p_telefono !~ '^\+573[0-9]{9}$' then
    raise exception 'telefono invalido';
  end if;

  insert into public.reservas (cliente, telefono, email, servicio_id, fecha, hora, notas)
  values (trim(p_cliente), trim(p_telefono), nullif(trim(p_email), ''), p_servicio_id, p_fecha, p_hora,
          nullif(left(trim(coalesce(p_notas, '')), 300), ''))
  returning * into v_row;

  -- Devuelve solo lo necesario para el comprobante del propio cliente
  return jsonb_build_object('codigo', v_row.codigo, 'fecha', v_row.fecha, 'hora', v_row.hora);
end $$;

-- Horas ocupadas por fecha, sin exponer datos personales
create or replace function public.horas_ocupadas(p_fecha date)
returns setof time
language sql security definer stable set search_path = public as $$
  select hora from public.reservas where fecha = p_fecha and estado <> 'cancelado'
  union
  select hora from public.bloqueos_horario where fecha = p_fecha; -- bloqueos del barbero: se ocultan al cliente
$$;

-- Consulta del cliente: exige codigo + telefono registrado (sin listar reservas ajenas)
create or replace function public.consultar_reserva_cliente(p_codigo text, p_telefono text)
returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare v_tel text; v_row public.reservas;
begin
  v_tel := regexp_replace(trim(p_telefono), '[ ()-]', '', 'g');
  if v_tel ~ '^3[0-9]{9}$' then v_tel := '+57' || v_tel; end if;
  select * into v_row from public.reservas where codigo = upper(trim(p_codigo)) and telefono = v_tel;
  if not found then return null; end if;
  return jsonb_build_object('codigo', v_row.codigo, 'servicio_id', v_row.servicio_id,
    'fecha', v_row.fecha, 'hora', v_row.hora, 'estado', v_row.estado);
end $$;

-- Cancelacion del cliente: libera el cupo (indice unico parcial ignora 'cancelado')
create or replace function public.cancelar_reserva_cliente(p_codigo text, p_telefono text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tel text; v_row public.reservas;
begin
  v_tel := regexp_replace(trim(p_telefono), '[ ()-]', '', 'g');
  if v_tel ~ '^3[0-9]{9}$' then v_tel := '+57' || v_tel; end if;
  update public.reservas set estado = 'cancelado'
   where codigo = upper(trim(p_codigo)) and telefono = v_tel
     and estado in ('pendiente','confirmado') and (fecha + hora) > now()
  returning * into v_row;
  if not found then raise exception 'no se pudo cancelar'; end if;
  return jsonb_build_object('codigo', v_row.codigo, 'estado', v_row.estado);
end $$;

revoke all on function public.crear_reserva(text,text,text,text,date,time,text) from public;
revoke all on function public.horas_ocupadas(date) from public;
grant execute on function public.crear_reserva(text,text,text,text,date,time,text) to anon, authenticated;
grant execute on function public.horas_ocupadas(date) to anon, authenticated;
revoke all on function public.consultar_reserva_cliente(text,text) from public;
revoke all on function public.cancelar_reserva_cliente(text,text) from public;
grant execute on function public.consultar_reserva_cliente(text,text) to anon, authenticated;
grant execute on function public.cancelar_reserva_cliente(text,text) to anon, authenticated;

insert into public.servicios (id, nombre, duracion_minutos, precio) values
  ('corte-basico','Corte Básico',30,20000),
  ('corte-completo','Corte Completo',45,30000)
on conflict (id) do update set
  nombre = excluded.nombre,
  duracion_minutos = excluded.duracion_minutos,
  precio = excluded.precio,
  activo = true;
-- Si existian servicios de la demo anterior, desactivarlos (sin borrar historial):
update public.servicios set activo = false where id not in ('corte-basico','corte-completo');
