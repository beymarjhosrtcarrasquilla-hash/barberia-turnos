-- Barberia Turnos - esquema Supabase con Row Level Security (RLS)
-- Ejecutar en el SQL Editor de Supabase. No contiene secretos.
-- Modelo: el cliente anonimo NO puede SELECT/UPDATE/DELETE reservas. Solo puede crear
-- una reserva (RPC crear_reserva) y consultar horas ocupadas (RPC horas_ocupadas, sin datos personales).
-- El barbero opera autenticado (Supabase Auth) con rol 'barbero' en app_metadata.

create extension if not exists pgcrypto;

create table if not exists public.servicios (
  id text primary key,
  nombre text not null,
  duracion_minutos int not null check (duracion_minutos between 5 and 240),
  precio numeric(8,2) not null check (precio >= 0),
  activo boolean not null default true
);

create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique default ('BARB-' || floor(1000 + random() * 9000)::int),
  cliente text not null check (char_length(cliente) between 2 and 60),
  telefono text not null check (telefono ~ '^\+?[0-9][0-9 ()-]{6,19}$'),
  email text check (email is null or char_length(email) <= 120),
  servicio_id text not null references public.servicios(id),
  fecha date not null,
  hora time not null,
  estado text not null default 'confirmado' check (estado in ('pendiente','confirmado','completado','cancelado')),
  notas text check (notas is null or char_length(notas) <= 300),
  creado_en timestamptz not null default now()
);

-- Un solo turno activo por fecha/hora (evita doble reserva)
create unique index if not exists reservas_slot_unico
  on public.reservas (fecha, hora) where estado <> 'cancelado';

alter table public.servicios enable row level security;
alter table public.reservas enable row level security;
alter table public.servicios force row level security;
alter table public.reservas force row level security;

revoke all on public.reservas from anon, authenticated;
revoke all on public.servicios from anon, authenticated;
grant select on public.servicios to anon, authenticated;
grant select, insert, update, delete on public.reservas to authenticated;

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
  select hora from public.reservas where fecha = p_fecha and estado <> 'cancelado';
$$;

revoke all on function public.crear_reserva(text,text,text,text,date,time,text) from public;
revoke all on function public.horas_ocupadas(date) from public;
grant execute on function public.crear_reserva(text,text,text,text,date,time,text) to anon, authenticated;
grant execute on function public.horas_ocupadas(date) to anon, authenticated;

insert into public.servicios (id, nombre, duracion_minutos, precio) values
  ('corte-clasico','Corte Clásico & Estilo',45,15.00),
  ('barba-ritual','Ritual de Barba & Toalla Caliente',30,12.00),
  ('combo-master','Combo Master (Corte + Barba Completa)',70,25.00),
  ('perfilado-express','Perfilado de Barba & Cuello Express',20,8.00),
  ('corte-infantil','Corte Infantil (Hasta 12 años)',35,12.00)
on conflict (id) do nothing;