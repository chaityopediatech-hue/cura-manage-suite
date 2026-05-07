
-- Departments
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "departments readable" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "departments admin manage" ON public.departments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.doctors ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- Appointments enhancements
ALTER TABLE public.appointments
  ADD COLUMN risk_score integer NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  ADD COLUMN follow_up_date date;

-- Medical reports (file metadata; files in storage bucket)
CREATE TABLE public.medical_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  uploaded_by uuid,
  title text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medical_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports view scoped" ON public.medical_reports FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid())
  OR public.has_role(auth.uid(),'doctor')
);
CREATE POLICY "reports insert" ON public.medical_reports FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid())
  OR public.has_role(auth.uid(),'doctor')
);
CREATE POLICY "reports delete" ON public.medical_reports FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid())
);

-- Diagnoses
CREATE TABLE public.diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  appointment_id uuid,
  notes text NOT NULL,
  follow_up_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.diagnoses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diag view scoped" ON public.diagnoses FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid())
);
CREATE POLICY "diag doctor insert" ON public.diagnoses FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid())
);
CREATE POLICY "diag doctor update" ON public.diagnoses FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid())
);
CREATE POLICY "diag doctor delete" ON public.diagnoses FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid())
);
CREATE TRIGGER trg_diagnoses_updated BEFORE UPDATE ON public.diagnoses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Medical timeline
CREATE TABLE public.medical_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medical_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "timeline view scoped" ON public.medical_timeline FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'doctor')
  OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid())
);
CREATE POLICY "timeline insert" ON public.medical_timeline FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor')
  OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid())
);
CREATE POLICY "timeline delete admin" ON public.medical_timeline FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(),'admin')
);

-- Storage bucket for reports (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('medical-reports','medical-reports', false)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies: file path convention "<patient_id>/<filename>"
CREATE POLICY "mr read scoped" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'medical-reports' AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor')
    OR EXISTS (SELECT 1 FROM public.patients p
      WHERE p.user_id = auth.uid() AND p.id::text = (storage.foldername(name))[1])
  )
);
CREATE POLICY "mr insert scoped" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'medical-reports' AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor')
    OR EXISTS (SELECT 1 FROM public.patients p
      WHERE p.user_id = auth.uid() AND p.id::text = (storage.foldername(name))[1])
  )
);
CREATE POLICY "mr delete scoped" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'medical-reports' AND (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.patients p
      WHERE p.user_id = auth.uid() AND p.id::text = (storage.foldername(name))[1])
  )
);

-- Seed departments
INSERT INTO public.departments (name, description) VALUES
  ('Cardiology','Heart and cardiovascular care'),
  ('Pediatrics','Child healthcare'),
  ('Neurology','Brain and nervous system'),
  ('Emergency Medicine','Urgent and emergency care'),
  ('General Medicine','Primary care'),
  ('Dermatology','Skin conditions'),
  ('Orthopedics','Bones and joints'),
  ('Psychiatry','Mental health')
ON CONFLICT (name) DO NOTHING;
