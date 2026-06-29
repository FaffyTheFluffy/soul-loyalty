-- SOUL Loyalty — Schéma Supabase v1
-- Coller dans l'éditeur SQL de Supabase et cliquer "Run"

-- Clients fidélité
CREATE TABLE IF NOT EXISTS loyalty_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  gender TEXT,
  birth_date DATE,
  qr_code TEXT UNIQUE NOT NULL,
  rgpd_accepted_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);

-- Visites (chaque scan validé)
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES loyalty_clients(id) ON DELETE CASCADE,
  visited_at TIMESTAMPTZ DEFAULT NOW(),
  sumup_transaction_id TEXT,
  sumup_amount NUMERIC(10,2),
  sumup_products TEXT,
  discount_applied BOOLEAN DEFAULT TRUE
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_visits_client_id ON visits(client_id);
CREATE INDEX IF NOT EXISTS idx_visits_visited_at ON visits(visited_at);
CREATE INDEX IF NOT EXISTS idx_clients_qr_code ON loyalty_clients(qr_code);
