-- Tighten prescription INSERT to require doctor↔patient relationship
DROP POLICY IF EXISTS "rx doctor/admin insert" ON public.prescriptions;
CREATE POLICY "rx doctor/admin insert"
ON public.prescriptions
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = prescriptions.doctor_id
        AND d.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.doctor_id = prescriptions.doctor_id
        AND a.patient_id = prescriptions.patient_id
    )
    AND (
      prescriptions.appointment_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.id = prescriptions.appointment_id
          AND a.doctor_id = prescriptions.doctor_id
          AND a.patient_id = prescriptions.patient_id
      )
    )
  )
);

-- Apply the same consistency rule on UPDATE
DROP POLICY IF EXISTS "rx doctor/admin update" ON public.prescriptions;
CREATE POLICY "rx doctor/admin update"
ON public.prescriptions
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE d.id = prescriptions.doctor_id
      AND d.user_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    EXISTS (
      SELECT 1 FROM public.doctors d
      WHERE d.id = prescriptions.doctor_id
        AND d.user_id = auth.uid()
    )
    AND (
      prescriptions.appointment_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.id = prescriptions.appointment_id
          AND a.doctor_id = prescriptions.doctor_id
          AND a.patient_id = prescriptions.patient_id
      )
    )
  )
);

-- Make sure existing SELECT policy is the strict, role-scoped one
DROP POLICY IF EXISTS "rx view scoped" ON public.prescriptions;
CREATE POLICY "rx view scoped"
ON public.prescriptions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE d.id = prescriptions.doctor_id
      AND d.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = prescriptions.patient_id
      AND p.user_id = auth.uid()
  )
);
