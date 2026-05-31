-- Fix legacy risk_zone_assessment_alert_trigger:
-- was creating alerts with is_active=true and no status column
-- now uses status='pending' + is_active=false (same pattern as landslide/flood triggers)

create or replace function public.create_risk_alert_from_assessment()
returns trigger as $$
begin
  if NEW.computed_risk_level in ('warning', 'evacuate') then
    if not exists (
      select 1 from public.alerts
      where is_active = false
        and status = 'pending'
        and type = 'flood'
        and zone = NEW.zone_name
        and severity = NEW.computed_risk_level
        and created_at > now() - interval '6 hours'
    ) then
      insert into public.alerts (type, severity, title, message, zone, is_active, status)
      values (
        'flood',
        NEW.computed_risk_level,
        case
          when NEW.computed_risk_level = 'evacuate' then 'CRITICAL: Composite flood risk — ' || NEW.zone_name
          else 'Flood warning — ' || NEW.zone_name
        end,
        'Composite risk engine score ' || round((NEW.composite_score * 100)::numeric, 1) || '%. Review rainfall, gauge, XGBoost, and HEC-RAS drivers before field action.',
        NEW.zone_name,
        false,
        'pending'
      );
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql;
