-- FrankBarber: Blindaje anti-spam en crear_reserva y Buzón Privado de Soporte (soporte_tickets)
-- Respaldo versionado de migración aplicada en Supabase (tubvnxcuwtnyfckkqtpk)

create or replace function public.crear_reserva(
  p_cliente text, p_telefono text, p_email text, p_servicio_id text,
  p_fecha date, p_hora time, p_notas text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_row public.reservas;
  v_activas_dia int;
  v_recientes_60m int;
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

  -- Freno anti-spameo: max 1 reserva activa por telefono en la misma fecha
  select count(*) into v_activas_dia
  from public.reservas
  where telefono = p_telefono
    and fecha = p_fecha
    and estado not in ('cancelado', 'cancelada');

  if v_activas_dia >= 1 then
    raise exception 'Ya tienes una cita activa para este día o alcanzaste el límite temporal de reservas.';
  end if;

  -- Freno anti-spameo: max 2 reservas creadas por telefono en los ultimos 60 minutos
  select count(*) into v_recientes_60m
  from public.reservas
  where telefono = p_telefono
    and creado_en >= now() - interval '60 minutes';

  if v_recientes_60m >= 2 then
    raise exception 'Ya tienes una cita activa para este día o alcanzaste el límite temporal de reservas.';
  end if;

  insert into public.reservas (cliente, telefono, email, servicio_id, fecha, hora, notas)
  values (trim(p_cliente), trim(p_telefono), nullif(trim(p_email), ''), p_servicio_id, p_fecha, p_hora,
          nullif(left(trim(coalesce(p_notas, '')), 300), ''))
  returning * into v_row;

  -- Devuelve solo lo necesario para el comprobante del propio cliente
  return jsonb_build_object('codigo', v_row.codigo, 'fecha', v_row.fecha, 'hora', v_row.hora);
end $$;

revoke all on function public.crear_reserva(text,text,text,text,date,time,text) from public;
grant execute on function public.crear_reserva(text,text,text,text,date,time,text) to anon, authenticated;

-- Buzón Privado de Soporte
create table if not exists public.soporte_tickets (
  id uuid primary key default gen_random_uuid(),
  origen text not null check (origen in ('cliente', 'barbero')),
  mensaje text not null check (char_length(trim(mensaje)) between 5 and 600),
  contacto_opcional text not null default '' check (char_length(contacto_opcional) <= 80),
  pagina text not null default '',
  estado text not null default 'nuevo' check (estado in ('nuevo', 'revisado', 'resuelto')),
  creado_en timestamptz not null default now()
);

alter table public.soporte_tickets enable row level security;

revoke all on public.soporte_tickets from public, anon, authenticated;
grant insert on public.soporte_tickets to anon, authenticated;

drop policy if exists soporte_insert_publico on public.soporte_tickets;
create policy soporte_insert_publico
  on public.soporte_tickets
  for insert
  to anon, authenticated
  with check (estado = 'nuevo');
