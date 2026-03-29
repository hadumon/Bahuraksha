-- Create alerts table (public read, no auth needed for this demo)
CREATE TABLE public.alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('flood', 'landslide', 'glof')),
  severity TEXT NOT NULL CHECK (severity IN ('safe', 'watch', 'warning', 'evacuate')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  zone TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Alerts are publicly readable" ON public.alerts FOR SELECT USING (true);

-- Create citizen_reports table (public read/insert for community reporting)
CREATE TABLE public.citizen_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('rising_water', 'cracks', 'blocked_drain', 'landslide_signs', 'other')),
  description TEXT NOT NULL,
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  location_name TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  trust_score DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.citizen_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reports are publicly readable" ON public.citizen_reports FOR SELECT USING (true);
CREATE POLICY "Anyone can submit reports" ON public.citizen_reports FOR INSERT WITH CHECK (true);

-- Create glacial_lakes table
CREATE TABLE public.glacial_lakes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  area DOUBLE PRECISION NOT NULL,
  volume DOUBLE PRECISION NOT NULL,
  elevation INTEGER NOT NULL,
  dam_type TEXT NOT NULL,
  trend TEXT NOT NULL CHECK (trend IN ('expanding', 'stable', 'shrinking')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('safe', 'watch', 'warning', 'evacuate')),
  district TEXT NOT NULL,
  region TEXT NOT NULL,
  downstream_population INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.glacial_lakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Glacial lakes are publicly readable" ON public.glacial_lakes FOR SELECT USING (true);

-- Seed initial alerts
INSERT INTO public.alerts (type, severity, title, message, zone, is_active) VALUES
  ('flood', 'evacuate', 'CRITICAL: Flood Warning — Kirtipur', 'Water level at Teku Station has exceeded danger level. Immediate evacuation recommended for low-lying areas.', 'Kirtipur Municipality', true),
  ('flood', 'warning', 'Flood Warning — Kathmandu Metro', 'Gokarna Station water level approaching danger threshold. Predicted to exceed in 6 hours.', 'Kathmandu Metro', true),
  ('landslide', 'watch', 'Landslide Watch — Budhanilkantha', 'Heavy rainfall combined with steep terrain increases landslide risk. Monitor conditions.', 'Budhanilkantha', true),
  ('flood', 'watch', 'Flood Watch — Chovar', 'Rising water levels detected. Situation under monitoring.', 'Kathmandu Metro', true),
  ('flood', 'safe', 'All Clear — Bhaktapur', 'Flood risk has subsided. Normal conditions restored.', 'Bhaktapur Municipality', false);

-- Seed citizen reports
INSERT INTO public.citizen_reports (type, description, location_lat, location_lng, location_name, verified, trust_score) VALUES
  ('rising_water', 'Bagmati river visibly rising near Teku bridge. Water is close to road level.', 27.6950, 85.3050, 'Teku Bridge', true, 0.92),
  ('blocked_drain', 'Major drainage blocked with debris near Rani Pokhari.', 27.7100, 85.3150, 'Rani Pokhari', true, 0.85),
  ('cracks', 'New cracks appearing on hillside road near Budhanilkantha temple.', 27.7800, 85.3600, 'Budhanilkantha', false, 0.68),
  ('landslide_signs', 'Small rocks falling on the road, tilting trees visible on the slope.', 27.7500, 85.3100, 'Tokha Hill Road', true, 0.78),
  ('rising_water', 'Water seeping into basement of houses near Bishnumati river.', 27.7150, 85.3050, 'Bishnumati Corridor', false, 0.55);

-- Seed glacial lakes
INSERT INTO public.glacial_lakes (name, location_lat, location_lng, area, volume, elevation, dam_type, trend, risk_level, district, region, downstream_population) VALUES
  ('Imja Tsho', 27.9020, 86.9300, 1.28, 35.8, 5010, 'Moraine', 'expanding', 'warning', 'Solukhumbu', 'Koshi', 12500),
  ('Tsho Rolpa', 27.8600, 86.4800, 1.55, 80.0, 4580, 'Moraine', 'expanding', 'evacuate', 'Dolakha', 'Janakpur', 18200),
  ('Thulagi Lake', 28.4900, 84.4200, 0.94, 31.0, 4020, 'Moraine', 'stable', 'watch', 'Manang', 'Gandaki', 5800),
  ('Lower Barun', 27.8200, 87.0800, 0.63, 23.5, 4550, 'Moraine', 'expanding', 'watch', 'Sankhuwasabha', 'Koshi', 8400),
  ('Dig Tsho', 27.8700, 86.5800, 0.38, 6.2, 4365, 'Ice-cored Moraine', 'stable', 'safe', 'Solukhumbu', 'Koshi', 3200),
  ('Chamlang South', 27.7600, 86.9900, 0.72, 18.4, 4940, 'Moraine', 'expanding', 'warning', 'Sankhuwasabha', 'Koshi', 6700);