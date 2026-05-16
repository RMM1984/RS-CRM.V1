CREATE TABLE IF NOT EXISTS public.ego_agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  vui TEXT UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  total_properties INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ego_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES public.ego_agencies(id),
  external_id TEXT NOT NULL,
  source_system TEXT DEFAULT 'ego_real_estate',
  title TEXT,
  description TEXT,
  price NUMERIC,
  bedrooms INTEGER,
  bathrooms INTEGER,
  built_area NUMERIC,
  plot_area NUMERIC,
  lat NUMERIC,
  lon NUMERIC,
  property_type TEXT,
  operation_type TEXT DEFAULT 'sale',
  status TEXT DEFAULT 'available',
  city TEXT,
  zone TEXT,
  address TEXT,
  images JSONB DEFAULT '[]',
  features JSONB DEFAULT '[]',
  search_text TEXT,
  content_hash TEXT,
  raw_json JSONB,
  created_at_source TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(agency_id, external_id)
);

CREATE TABLE IF NOT EXISTS public.ego_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.ego_properties(id),
  price NUMERIC NOT NULL,
  previous_price NUMERIC,
  change_amount NUMERIC,
  change_percent NUMERIC,
  detected_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.ego_agencies (name, vui)
VALUES ('Vicens Ash', '575457f0-1f9a-4d39-bdc8-82853e68ffae')
ON CONFLICT (vui) DO NOTHING;
