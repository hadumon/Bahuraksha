-- Update risk_zones and river_stations source from 'seed' to authoritative references
-- risk_zones: these are Kathmandu Valley municipal boundaries from DoS Nepal
-- river_stations: Bagmati basin DHM gauge stations

update public.risk_zones
set source = 'dos-nepal'
where source = 'seed';

update public.river_stations
set source = 'dhm-nepal'
where source = 'seed';
