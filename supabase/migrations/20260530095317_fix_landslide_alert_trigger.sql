-- Fix check_landslide_alert() trigger: set is_active=false and status='pending'
create or replace function public.check_landslide_alert()
returns trigger as $$
begin
  if new.risk_level in ('warning', 'evacuate') then
    insert into public.alerts (type, severity, title, message, zone, is_active, status, created_at)
    values (
      'landslide',
      new.risk_level,
      'Landslide Risk Alert: ' || new.zone_name,
      'ML model predicts ' || new.risk_level || ' risk with ' || round(new.probability * 100, 1) || '% probability. Primary driver: ' || new.primary_driver,
      new.zone_name,
      false,
      'pending',
      now()
    );
  end if;
  return new;
end;
$$ language plpgsql;
