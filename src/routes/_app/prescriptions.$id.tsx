import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type DetailSearch = { edit?: boolean; denied?: boolean };

export const Route = createFileRoute("/_app/prescriptions/$id")({
  head: () => ({ meta: [{ title: "Prescription — MediCore" }] }),
  validateSearch: (s: Record<string, unknown>): DetailSearch => ({
    edit: s.edit === true || s.edit === "true",
    denied: s.denied === true || s.denied === "true",
  }),
  beforeLoad: async ({ params, search }) => {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) {
      throw redirect({ to: "/login" });
    }

    // Fetch prescription + role context
    const [{ data: rx }, { data: roles }, { data: doc }] = await Promise.all([
      supabase.from("prescriptions").select("id, doctor_id, patient_id").eq("id", params.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("doctors").select("id").eq("user_id", uid).maybeSingle(),
    ]);

    if (!rx) {
      throw redirect({ to: "/prescriptions", search: { denied: true } as never });
    }

    const roleSet = new Set((roles ?? []).map((r) => r.role as string));
    const isAdmin = roleSet.has("admin");
    const isOwningDoctor = !!doc && doc.id === rx.doctor_id;

    // For edit: only admin or owning doctor
    if (search.edit && !(isAdmin || isOwningDoctor)) {
      throw redirect({ to: "/prescriptions", search: { denied: true } as never });
    }

    // For view: admin, owning doctor, or owning patient
    if (!search.edit && !isAdmin && !isOwningDoctor) {
      const { data: pat } = await supabase
        .from("patients").select("id").eq("user_id", uid).eq("id", rx.patient_id).maybeSingle();
      if (!pat) {
        throw redirect({ to: "/prescriptions", search: { denied: true } as never });
      }
    }
  },
  component: PrescriptionDetailRedirect,
});

function PrescriptionDetailRedirect() {
  const navigate = Route.useNavigate();
  useEffect(() => {
    // Detail/edit UI lives in the prescriptions list dialog; route exists
    // primarily as a guarded deep-link surface.
    navigate({ to: "/prescriptions" });
  }, [navigate]);
  return null;
}
