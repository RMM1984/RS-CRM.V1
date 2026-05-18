CREATE SCHEMA IF NOT EXISTS "__SCHEMA_NAME__";
SET search_path TO "__SCHEMA_NAME__", public;

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  type TEXT NOT NULL DEFAULT 'buyer' CHECK (type IN ('buyer', 'seller', 'landlord', 'tenant', 'investor')),
  stage TEXT NOT NULL DEFAULT 'new',
  source TEXT,
  budget_min NUMERIC,
  budget_max NUMERIC,
  client_profile TEXT CHECK (client_profile IN (
    'investor_yield',
    'investor_flip',
    'first_home',
    'second_home',
    'foreign',
    'digital_nomad',
    'luxury_standard',
    'luxury_premium'
  )),
  rooms_min INTEGER,
  bathrooms_min INTEGER,
  surface_min INTEGER,
  price_per_m2_max NUMERIC,
  needs_renovation BOOLEAN DEFAULT false,
  needs_pool BOOLEAN DEFAULT false,
  needs_sea_view BOOLEAN DEFAULT false,
  needs_garden BOOLEAN DEFAULT false,
  needs_parking BOOLEAN DEFAULT false,
  preferred_zones TEXT[] DEFAULT '{}',
  languages TEXT[] DEFAULT '{}',
  requirements_text TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Madrid',
  zip TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'available', 'reserved', 'sold', 'rented', 'archived')),
  property_type TEXT NOT NULL DEFAULT 'apartment',
  operation TEXT NOT NULL DEFAULT 'sale' CHECK (operation IN ('sale', 'rent')),
  bedrooms INT,
  bathrooms INT,
  sqm NUMERIC,
  plot_m2 NUMERIC,
  description TEXT,
  assigned_to UUID REFERENCES public.users(id),
  source TEXT NOT NULL DEFAULT 'internal' CHECK (source IN ('internal','crown_property','colaboracion','kyero','sooprema','other')),
  source_url TEXT,
  source_agency_name TEXT,
  source_agency_phone TEXT,
  external_ref TEXT,
  external_badge TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS property_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS property_shortlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  external_data JSONB,
  status TEXT DEFAULT 'investigating'
    CHECK (status IN ('investigating','visit_pending','interested','discarded')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('sale', 'rent')),
  stage TEXT NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead', 'visit', 'offer', 'contract', 'closed', 'lost')),
  value NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  agent_id UUID REFERENCES public.users(id),
  expected_close_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL,
  prompt TEXT NOT NULL,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contacts_stage_idx ON contacts(stage);
CREATE INDEX IF NOT EXISTS properties_status_idx ON properties(status);
CREATE INDEX IF NOT EXISTS properties_source_idx ON properties(source);
CREATE INDEX IF NOT EXISTS properties_operation_idx ON properties(operation);
CREATE INDEX IF NOT EXISTS property_shortlist_contact_id_idx ON property_shortlist(contact_id);
CREATE INDEX IF NOT EXISTS operations_stage_idx ON operations(stage);
CREATE INDEX IF NOT EXISTS operations_agent_id_idx ON operations(agent_id);
CREATE INDEX IF NOT EXISTS operations_active_idx ON operations(active);
CREATE INDEX IF NOT EXISTS visits_starts_at_idx ON visits(starts_at);

RESET search_path;
