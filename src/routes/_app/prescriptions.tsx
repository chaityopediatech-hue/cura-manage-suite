import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";

type RxSearch = { diagnosis_id?: string; appointment_id?: string };

export const Route = createFileRoute("/_app/prescriptions")({
  head: () => ({ meta: [{ title: "Prescriptions — MediCore" }] }),
  validateSearch: (s: Record<string, unknown>): RxSearch => ({
    diagnosis_id: typeof s.diagnosis_id === "string" ? s.diagnosis_id : undefined,
    appointment_id: typeof s.appointment_id === "string" ? s.appointment_id : undefined,
  }),
  component: PrescriptionsPage,
});

type Rx = {
  id: string; doctor_id: string; patient_id: string; diagnosis: string;
  instructions: string | null; prescribed_at: string;
  doctors?: { full_name: string } | null;
  patients?: { full_name: string } | null;
};
type Med = { id: string; name: string; strength: string | null };
type RxItem = { id: string; medicine_id: string; dosage: string; timing: string; duration: string };

function PrescriptionsPage() {
  const { role, user } = useAuth();
  const { t } = useI18n();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Rx[]>([]);
  const [doctors, setDoctors] = useState<{ id: string; full_name: string; user_id: string | null }[]>([]);
  const [patients, setPatients] = useState<{ id: string; full_name: string }[]>([]);
  const [meds, setMeds] = useState<Med[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Rx | null>(null);
  const [items, setItems] = useState<RxItem[]>([]);
  const [form, setForm] = useState({
    doctor_id: "", patient_id: "", diagnosis: "", instructions: "", appointment_id: "" as string,
    medicines: [{ medicine_id: "", dosage: "", timing: "morning", duration: "" }] as Array<{ medicine_id: string; dosage: string; timing: string; duration: string }>,
  });

  const canCreate = role === "admin" || role === "doctor";
  const myDoctorId = role === "doctor" && user ? doctors.find((d) => d.user_id === user.id)?.id : undefined;
  const canModify = (rx: Rx | null) =>
    !!rx && (role === "admin" || (role === "doctor" && rx.doctor_id === myDoctorId));

  const removeRx = async (rx: Rx) => {
    if (!canModify(rx)) {
      toast.error("Not permitted: you can't modify this prescription");
      return;
    }
    if (!confirm("Delete this prescription?")) return;
    const { error } = await supabase.from("prescriptions").delete().eq("id", rx.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    setView(null);
    load();
  };

  const load = async () => {
    setLoading(true);
    const [r, d, p, m] = await Promise.all([
      supabase.from("prescriptions").select("*, doctors(full_name), patients(full_name)").order("prescribed_at", { ascending: false }),
      supabase.from("doctors").select("id, full_name, user_id"),
      supabase.from("patients").select("id, full_name"),
      supabase.from("medicines").select("id, name, strength").order("name"),
    ]);
    if (r.error) toast.error(r.error.message);
    setRows((r.data as Rx[]) ?? []);
    setDoctors(d.data ?? []);
    setPatients(p.data ?? []);
    setMeds(m.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    let did = "";
    if (role === "doctor" && user) {
      const me = doctors.find((x) => x.user_id === user.id);
      if (me) did = me.id;
    }
    setForm({ doctor_id: did, patient_id: "", diagnosis: "", instructions: "", appointment_id: "",
      medicines: [{ medicine_id: "", dosage: "", timing: "morning", duration: "" }] });
    setOpen(true);
  };

  // Prefill from a saved diagnosis when navigated with ?diagnosis_id=...
  useEffect(() => {
    if (!canCreate || !search.diagnosis_id) return;
    (async () => {
      const { data: dx } = await supabase.from("diagnoses")
        .select("id, doctor_id, patient_id, notes, appointment_id")
        .eq("id", search.diagnosis_id!).maybeSingle();
      if (!dx) return;
      let apptLine = "";
      const apptId = dx.appointment_id ?? search.appointment_id ?? null;
      if (apptId) {
        const { data: appt } = await supabase.from("appointments")
          .select("reason, symptoms, scheduled_at").eq("id", apptId).maybeSingle();
        if (appt) {
          apptLine = `Appointment: ${new Date(appt.scheduled_at).toLocaleString()}` +
            (appt.reason ? ` — ${appt.reason}` : "") +
            (appt.symptoms ? ` (symptoms: ${appt.symptoms})` : "");
        }
      }
      setForm({
        doctor_id: dx.doctor_id, patient_id: dx.patient_id,
        diagnosis: dx.notes ?? "",
        instructions: apptLine,
        appointment_id: apptId ?? "",
        medicines: [{ medicine_id: "", dosage: "", timing: "morning", duration: "" }],
      });
      setOpen(true);
    })();
  }, [search.diagnosis_id, search.appointment_id, canCreate]);

  const save = async () => {
    if (!form.doctor_id || !form.patient_id || !form.diagnosis.trim()) {
      toast.error("Doctor, patient and diagnosis required"); return;
    }
    const valid = form.medicines.filter((m) => m.medicine_id && m.dosage && m.duration);
    if (valid.length === 0) { toast.error("Add at least one medicine"); return; }

    const { data: rx, error } = await supabase.from("prescriptions").insert({
      doctor_id: form.doctor_id, patient_id: form.patient_id,
      diagnosis: form.diagnosis, instructions: form.instructions || null,
      appointment_id: form.appointment_id || null,
    }).select("id").single();
    if (error || !rx) { toast.error(error?.message ?? "Failed"); return; }

    const { error: e2 } = await supabase.from("prescription_medicines").insert(
      valid.map((m) => ({ prescription_id: rx.id, medicine_id: m.medicine_id, dosage: m.dosage, timing: m.timing, duration: m.duration }))
    );
    if (e2) { toast.error(e2.message); return; }

    await supabase.from("medical_timeline").insert({
      patient_id: form.patient_id, event_type: "prescription",
      title: "Prescription issued", description: form.diagnosis,
      occurred_at: new Date().toISOString(), created_by: user?.id ?? null,
    });

    toast.success("Prescription saved"); setOpen(false);
    if (search.diagnosis_id) navigate({ to: "/prescriptions", search: {} });
    load();
  };

  const openView = async (r: Rx) => {
    setView(r);
    const { data } = await supabase.from("prescription_medicines").select("*").eq("prescription_id", r.id);
    setItems((data ?? []) as RxItem[]);
  };

  const updateMed = (i: number, k: string, v: string) => {
    const next = [...form.medicines]; (next[i] as Record<string, string>)[k] = v; setForm({ ...form, medicines: next });
  };
  const addMed = () => setForm({ ...form, medicines: [...form.medicines, { medicine_id: "", dosage: "", timing: "morning", duration: "" }] });
  const rmMed = (i: number) => setForm({ ...form, medicines: form.medicines.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">{t("prescriptions")}</h1>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4" /> {t("add")}</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{t("add")} {t("prescriptions")}</DialogTitle></DialogHeader>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t("doctor")}</Label>
                    <Select value={form.doctor_id} onValueChange={(v) => setForm({ ...form, doctor_id: v })}>
                      <SelectTrigger><SelectValue placeholder="–" /></SelectTrigger>
                      <SelectContent>{doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("patient")}</Label>
                    <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                      <SelectTrigger><SelectValue placeholder="–" /></SelectTrigger>
                      <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 col-span-2"><Label>{t("diagnosis")}</Label><Input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></div>
                  <div className="space-y-1.5 col-span-2"><Label>{t("instructions")}</Label><Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t("medicine")}</Label>
                    <Button variant="outline" size="sm" onClick={addMed}><Plus className="h-3 w-3" /> {t("add")}</Button>
                  </div>
                  {form.medicines.map((m, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        <Select value={m.medicine_id} onValueChange={(v) => updateMed(i, "medicine_id", v)}>
                          <SelectTrigger><SelectValue placeholder={t("medicine")} /></SelectTrigger>
                          <SelectContent>{meds.map((md) => <SelectItem key={md.id} value={md.id}>{md.name} {md.strength}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <Input className="col-span-2" placeholder={t("dosage")} value={m.dosage} onChange={(e) => updateMed(i, "dosage", e.target.value)} />
                      <div className="col-span-3">
                        <Select value={m.timing} onValueChange={(v) => updateMed(i, "timing", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="morning">Morning</SelectItem>
                            <SelectItem value="afternoon">Afternoon</SelectItem>
                            <SelectItem value="night">Night</SelectItem>
                            <SelectItem value="morning,night">Morning + Night</SelectItem>
                            <SelectItem value="morning,afternoon,night">3x daily</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Input className="col-span-2" placeholder={t("duration")} value={m.duration} onChange={(e) => updateMed(i, "duration", e.target.value)} />
                      <Button variant="ghost" size="icon" className="col-span-1" onClick={() => rmMed(i)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                <Button onClick={save}>{t("save")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? <div className="text-muted-foreground text-sm">{t("loading")}</div>
        : rows.length === 0 ? <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">{t("noData")}</div>
        : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rows.map((r) => (
              <button key={r.id} onClick={() => openView(r)}
                className="text-left rounded-lg border bg-card p-4 hover:shadow-sm hover:bg-muted/40 transition">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-primary mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{r.diagnosis || "–"}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {r.patients?.full_name} · Dr. {r.doctors?.full_name}
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(r.prescribed_at).toLocaleDateString()}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>}

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("prescriptions")}</DialogTitle></DialogHeader>
          {view && (
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">{t("patient")}:</span> {view.patients?.full_name}</div>
              <div><span className="text-muted-foreground">{t("doctor")}:</span> {view.doctors?.full_name}</div>
              <div><span className="text-muted-foreground">{t("diagnosis")}:</span> {view.diagnosis}</div>
              {view.instructions && <div><span className="text-muted-foreground">{t("instructions")}:</span> {view.instructions}</div>}
              <div className="rounded-md border">
                <div className="grid grid-cols-4 px-3 py-2 text-xs text-muted-foreground border-b">
                  <span>{t("medicine")}</span><span>{t("dosage")}</span><span>{t("timing")}</span><span>{t("duration")}</span>
                </div>
                {items.map((it) => {
                  const m = meds.find((x) => x.id === it.medicine_id);
                  return (
                    <div key={it.id} className="grid grid-cols-4 px-3 py-2 text-sm border-b last:border-0">
                      <span>{m?.name ?? "–"}</span><span>{it.dosage}</span><span>{it.timing}</span><span>{it.duration}</span>
                    </div>
                  );
                })}
                {items.length === 0 && <div className="px-3 py-4 text-center text-muted-foreground text-sm">{t("noData")}</div>}
              </div>
            </div>
          )}
          {canModify(view) && (
            <DialogFooter>
              <Button variant="destructive" onClick={() => view && removeRx(view)}>
                <Trash2 className="h-4 w-4" /> {t("delete") ?? "Delete"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
