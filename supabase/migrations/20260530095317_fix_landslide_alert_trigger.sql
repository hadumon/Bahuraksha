-- Fix check_landslide_alert() trigger: wrong column names and severity values
-- Previous version used alert_type, description, location_lat, location_lng
-- which don't exist on the alerts table. Severity values 'critical'/'high'
-- violated the CHECK constraint.

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
