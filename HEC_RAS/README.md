# Bagmati River HEC-RAS Model Scaffold

This folder contains a practical HEC-RAS model design scaffold for the Bagmati River corridor in Kathmandu Valley and data files consumed by the Bahuraksha dashboard.

> Safety note: this is a planning and software-integration scaffold, not a calibrated engineering model. Do not use its placeholder geometry, Manning values, or discharge scenarios for public warnings, bridge design, land acquisition, or evacuation decisions until calibrated against surveyed cross sections, gauge observations, DEM quality checks, and local hydrology review.

## Model purpose

- Simulate 1D steady/unsteady flood stages along the urban Bagmati corridor.
- Convert model output at key stations into dashboard risk states.
- Provide a repeatable path from HEC-RAS exported CSV output into Bahuraksha.

## Suggested river reach

- River: Bagmati
- Reach: Sundarijal/Gokarna upstream to Chovar outlet
- Approximate length: 18 to 22 km
- Key dashboard locations:
  - Sundarijal
  - Gokarna
  - Pashupati
  - Teku
  - Chovar

## Recommended HEC-RAS setup

1. Terrain
   - Use a hydrologically conditioned DEM clipped to Kathmandu Valley.
   - Prefer surveyed river bathymetry and bridge/culvert geometry where available.
   - DEM-only channels are usually too shallow for reliable flood stages.

2. Geometry
   - Draw river centerline from upstream Sundarijal/Gokarna to Chovar outlet.
   - Add left/right banks and flow paths.
   - Create cross sections every 250 to 500 m, with tighter spacing near bridges, bends, confluences, and urban constrictions.
   - Add structures for major bridges and constrictions if surveyed geometry is available.

3. Roughness
   - Start with calibrated ranges, not final values:
     - Main channel: n = 0.030 to 0.045
     - Urban overbank: n = 0.050 to 0.080
     - Vegetated/irregular banks: n = 0.060 to 0.100

4. Boundary conditions
   - Upstream hydrograph from DHM gauge or rainfall-runoff model.
   - Downstream normal depth or rating curve at Chovar.
   - Add lateral inflows for tributaries and drainage inflows where data exists.

5. Scenarios
   - Monsoon watch event
   - 2-year flood
   - 10-year flood
   - 25-year flood
   - 50-year flood
   - Historical calibration events with observed gauge records

6. Calibration targets
   - Water surface elevation at gauges.
   - Arrival time of hydrograph peaks.
   - Observed flood marks or satellite flood extent.
   - Local reports around Teku, Thapathali, Pashupati, and Chovar.

## Output integration contract

Export HEC-RAS result tables to CSV with these fields:

```csv
station_id,station_name,river_km,lat,lng,scenario,flow_cms,water_surface_m,channel_invert_m,depth_m,velocity_ms,warning_level_m,danger_level_m,risk_level,arrival_time_hours
```

Bahuraksha currently includes `src/lib/hecrasModel.ts` with a typed version of this output and a monitoring page panel.

## Next calibration tasks

- Import final DEM into RAS Mapper.
- Replace approximate station coordinates with surveyed chainage.
- Add real cross sections and bridge geometries.
- Calibrate Manning n against observed Bagmati gauge data.
- Export model output CSV and replace the placeholder values in `src/lib/hecrasModel.ts` or load them from Supabase.
