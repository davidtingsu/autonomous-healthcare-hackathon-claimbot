-- Reset schema managed by Drizzle ORM
-- Run via: npm run db:migrate

DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS claim_events CASCADE;
DROP TABLE IF EXISTS insurance_claims CASCADE;
DROP TABLE IF EXISTS claim_requests CASCADE;
DROP TABLE IF EXISTS langgraph_checkpoints CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  primary_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE claim_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  claimed_amount NUMERIC(12, 2) NOT NULL,
  service_date DATE NOT NULL,
  receipt_url TEXT,
  receipt_extracted_patient_name TEXT,
  receipt_extracted_amount NUMERIC(12, 2),
  receipt_extracted_date DATE,
  status TEXT NOT NULL CHECK (status IN (
    'created', 'reviewing', 'cancelled_for_submission',
    'revision_requested', 'submitted'
  )),
  graph_thread_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_request_id UUID NOT NULL UNIQUE REFERENCES claim_requests(id),
  claimed_amount NUMERIC(12, 2) NOT NULL,
  service_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('created', 'approved', 'denied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE claim_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_request_id UUID NOT NULL REFERENCES claim_requests(id),
  event_type TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  claim_request_id UUID NOT NULL REFERENCES claim_requests(id),
  type TEXT NOT NULL CHECK (type IN (
    'revision_requested', 'cancelled_for_submission',
    'claim_matched_approved', 'claim_matched_denied'
  )),
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE langgraph_checkpoints (
  thread_id TEXT PRIMARY KEY,
  checkpoint JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_claim_requests_user_id ON claim_requests(user_id);
CREATE INDEX idx_claim_requests_status ON claim_requests(status);
CREATE INDEX idx_claim_events_claim_request_id ON claim_events(claim_request_id);
CREATE INDEX idx_claim_events_created_at ON claim_events(created_at DESC);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_insurance_claims_claim_request_id ON insurance_claims(claim_request_id);

ALTER PUBLICATION supabase_realtime ADD TABLE claim_events;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER claim_requests_updated_at
  BEFORE UPDATE ON claim_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER insurance_claims_updated_at
  BEFORE UPDATE ON insurance_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Demo seed (valid RFC 4122 v4 UUIDs)
INSERT INTO users (id, first_name, last_name, primary_id) VALUES
  ('11111111-1111-4111-8111-111111111101', 'John', 'Smith', NULL),
  ('11111111-1111-4111-8111-111111111102', 'Jane', 'Doe', NULL);

INSERT INTO users (id, first_name, last_name, primary_id) VALUES
  ('22222222-2222-4222-8222-222222222201', 'Emily', 'Smith', '11111111-1111-4111-8111-111111111101'),
  ('22222222-2222-4222-8222-222222222202', 'Michael', 'Doe', '11111111-1111-4111-8111-111111111102');
