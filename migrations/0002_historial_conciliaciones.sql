-- Migración 0002: Historial de Conciliaciones Multi-Empresa con aislamiento por usuario y sincronización en la nube.
CREATE TABLE IF NOT EXISTS historial_conciliaciones (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT,
  company_nit TEXT,
  company_name TEXT,
  period_label TEXT,
  dian_name TEXT,
  mov_name TEXT,
  entry_timestamp BIGINT NOT NULL,
  totals JSONB NOT NULL,
  result JSONB NOT NULL,
  reviews JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historial_conciliaciones_user_ts 
  ON historial_conciliaciones (user_id, entry_timestamp DESC);
