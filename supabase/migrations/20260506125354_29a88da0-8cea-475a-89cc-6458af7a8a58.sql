
DO $$ BEGIN
  CREATE TYPE public.appointment_priority AS ENUM ('emergency','high','medium','low');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS priority public.appointment_priority NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS symptoms text;

CREATE INDEX IF NOT EXISTS idx_appointments_priority ON public.appointments(priority);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_time ON public.appointments(doctor_id, scheduled_at);
