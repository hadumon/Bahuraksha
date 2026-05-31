-- Flood prediction storage table
-- Stores XGBoost satellite model predictions for historical analysis and alerting

create table if not exists public.flood_predictions (
  id uuid default gen_random_uuid() primary key,
  zone_id text not null,
  zone_name text not null,
  latitude numeric,
  longitude numeric,
  risk_score numeric not null check (risk_score >= 0 and risk_score <= 100),
  risk_level text not null check (risk_level in ('safe', 'watch', 'warning', 'evacuate')),
  label text not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  model_source text not null default 'ml-api' check (model_source in ('ml-api', 'heuristic', 'satellite')),
  created_at timestamptz default now()
);

create index if not exists idx_flood_predictions_zone on public.flood_predictions(zone_id);
create index if not exists idx_flood_predictions_risk on public.flood_predictions(risk_level);
create index if not exists idx_flood_predictions_created on public.flood_predictions(created_at desc);

alter table public.flood_predictions enable row level security;

create policy "flood_predictions_select_all"
  on public.flood_predictions
  for select
  using (true);

create policy "flood_predictions_insert_authenticated"
  on public.flood_predictions
  for insert
  to authenticated
  with check (true);

-- Automatic alert trigger for high-risk flood predictions
create or replace function public.check_flood_alert()
returns trigger as $$
begin
  if new.risk_level in ('warning', 'evacuate') then
    insert into public.alerts (type, severity, title, message, zone, is_active, created_at)
    values (
      'flood',
      new.risk_level,
      'Flood Risk Alert: ' || new.zone_name,
      'Satellite model predicts ' || new.risk_level || ' risk (score: ' || round(new.risk_score, 1) || '/100) with ' || round(new.confidence * 100, 1) || '% confidence. Source: ' || new.model_source,
      new.zone_name,
      true,
      now()
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists flood_alert_trigger on public.flood_predictions;
create trigger flood_alert_trigger
  after insert on public.flood_predictions
  for each row
  execute function public.check_flood_alert();
