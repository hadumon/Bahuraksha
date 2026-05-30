-- Landslide prediction storage table
-- Stores ML model predictions for historical analysis and alerting

create table if not exists public.landslide_predictions (
  id uuid default gen_random_uuid() primary key,
  zone_id text not null,
  zone_name text not null,
  district text not null,
  latitude numeric not null,
  longitude numeric not null,
  probability numeric not null check (probability >= 0 and probability <= 1),
  risk_level text not null check (risk_level in ('safe', 'watch', 'warning', 'evacuate')),
  susceptibility_score numeric not null check (susceptibility_score >= 0 and susceptibility_score <= 1),
  primary_driver text not null,
  secondary_drivers jsonb default '[]'::jsonb,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  time_horizon_hours integer not null default 72,
  model_source text not null check (model_source in ('ml-api', 'heuristic')),
  feature_contributions jsonb,
  created_at timestamptz default now()
);

-- Indexes for common queries
create index if not exists idx_landslide_predictions_zone on public.landslide_predictions(zone_id);
create index if not exists idx_landslide_predictions_risk on public.landslide_predictions(risk_level);
create index if not exists idx_landslide_predictions_created on public.landslide_predictions(created_at desc);
create index if not exists idx_landslide_predictions_location on public.landslide_predictions(latitude, longitude);

-- RLS policies
alter table public.landslide_predictions enable row level security;

create policy "landslide_predictions_select_all"
  on public.landslide_predictions
  for select
  using (true);

create policy "landslide_predictions_insert_authenticated"
  on public.landslide_predictions
  for insert
  to authenticated
  with check (true);

-- Automatic alert trigger for high-risk predictions
create or replace function public.check_landslide_alert()
returns trigger as $$
begin
  if new.risk_level in ('warning', 'evacuate') then
    insert into public.alerts (type, severity, title, message, zone, is_active, created_at)
    values (
      'landslide',
      new.risk_level,
      'Landslide Risk Alert: ' || new.zone_name,
      'ML model predicts ' || new.risk_level || ' risk with ' || round(new.probability * 100, 1) || '% probability. Primary driver: ' || new.primary_driver,
      new.zone_name,
      true,
      now()
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists landslide_alert_trigger on public.landslide_predictions;
create trigger landslide_alert_trigger
  after insert on public.landslide_predictions
  for each row
  execute function public.check_landslide_alert();
