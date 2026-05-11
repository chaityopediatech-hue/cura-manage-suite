DROP POLICY IF EXISTS "rx admin delete" ON public.prescriptions;
DROP POLICY IF EXISTS "rx doctor/admin delete" ON public.prescriptions;

CREATE POLICY "rx doctor/admin delete"
ON public.prescriptions
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.doctors d
    WHERE d.id = prescriptions.doctor_id AND d.user_id = auth.uid()
  )
);