
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'doctor', 'patient');
CREATE TYPE public.appointment_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
CREATE TYPE public.gender_type AS ENUM ('male', 'female', 'other');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles (separate table - security best practice)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Security definer to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.user_roles WHERE user_id = auth.uid() ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'doctor' THEN 2 ELSE 3 END LIMIT 1 $$;

-- Doctors
CREATE TABLE public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  specialty TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  phone TEXT,
  email TEXT,
  availability TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Patients
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  age INT,
  gender public.gender_type,
  phone TEXT,
  email TEXT,
  address TEXT,
  blood_group TEXT,
  medical_history TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Appointments
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  status public.appointment_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, scheduled_at)
);

-- Medicines
CREATE TABLE public.medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  generic_name TEXT,
  form TEXT,
  strength TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prescriptions
CREATE TABLE public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments ON DELETE SET NULL,
  diagnosis TEXT NOT NULL DEFAULT '',
  instructions TEXT,
  prescribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.prescription_medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES public.prescriptions ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES public.medicines ON DELETE RESTRICT,
  dosage TEXT NOT NULL,
  timing TEXT NOT NULL,
  duration TEXT NOT NULL,
  notes TEXT
);

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: auto-create profile + default patient role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.raw_user_meta_data->>'phone');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'patient');
  INSERT INTO public.patients (user_id, full_name, phone, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.raw_user_meta_data->>'phone', NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER t_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_doctors_updated BEFORE UPDATE ON public.doctors FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_patients_updated BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_appts_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies
-- profiles
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor'));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR id = auth.uid());

-- user_roles
CREATE POLICY "view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- doctors
CREATE POLICY "doctors readable" ON public.doctors FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage doctors" ON public.doctors FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "doctor edit self" ON public.doctors FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- patients
CREATE POLICY "patients view own" ON public.patients FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor'));
CREATE POLICY "patients update own" ON public.patients FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin/doctor insert patients" ON public.patients FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor') OR user_id = auth.uid());
CREATE POLICY "admin delete patients" ON public.patients FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- appointments
CREATE POLICY "appointments view scoped" ON public.appointments FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid())
);
CREATE POLICY "appointments insert" ON public.appointments FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'doctor')
  OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid())
);
CREATE POLICY "appointments update" ON public.appointments FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid())
);
CREATE POLICY "appointments delete" ON public.appointments FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- medicines
CREATE POLICY "medicines readable" ON public.medicines FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin/doctor manage medicines" ON public.medicines FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'doctor'));

-- prescriptions
CREATE POLICY "rx view scoped" ON public.prescriptions FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid())
);
CREATE POLICY "rx doctor/admin insert" ON public.prescriptions FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid())
);
CREATE POLICY "rx doctor/admin update" ON public.prescriptions FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = doctor_id AND d.user_id = auth.uid())
);
CREATE POLICY "rx admin delete" ON public.prescriptions FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- prescription_medicines
CREATE POLICY "rxm view via rx" ON public.prescription_medicines FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.prescriptions r WHERE r.id = prescription_id AND (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = r.doctor_id AND d.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = r.patient_id AND p.user_id = auth.uid())
  ))
);
CREATE POLICY "rxm manage via rx" ON public.prescription_medicines FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.prescriptions r WHERE r.id = prescription_id AND (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = r.doctor_id AND d.user_id = auth.uid())
  ))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.prescriptions r WHERE r.id = prescription_id AND (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.doctors d WHERE d.id = r.doctor_id AND d.user_id = auth.uid())
  ))
);

-- audit_logs
CREATE POLICY "audit admin read" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "audit insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Seed a small medicines catalog
INSERT INTO public.medicines (name, generic_name, form, strength) VALUES
('Paracetamol','Acetaminophen','Tablet','500mg'),
('Amoxicillin','Amoxicillin','Capsule','250mg'),
('Ibuprofen','Ibuprofen','Tablet','400mg'),
('Cetirizine','Cetirizine HCl','Tablet','10mg'),
('Metformin','Metformin','Tablet','500mg'),
('Amlodipine','Amlodipine','Tablet','5mg'),
('Omeprazole','Omeprazole','Capsule','20mg'),
('Azithromycin','Azithromycin','Tablet','500mg');
