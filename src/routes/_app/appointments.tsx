import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { analyzeSymptoms, pickBestDoctor, type Priority } from "@/lib/triage";

export const Route = createFileRoute("/_app/appointments")({
  head: () => ({ meta: [{ title: "Appointments — MediCore" }] }),
  component: AppointmentsPage,
});

const STATUS = ["pending", "confirmed", "cancelled", "completed", "no_show"] as const;
type Status = (typeof STATUS)[number];
const PRIORITIES: Priority[] = ["emergency", "high", "medium", "low"];

type Doctor = { id: string; full_name: string; specialty: string; status: string };
type Appt = {
  id: string; doctor_id: string; patient_id: string; scheduled_at: string;
  reason: string | null; symptoms: string | null; status: Status; priority: Priority;
  risk_score: number; follow_up_date: string | null;
  doctors?: { full_name: string; specialty: string } | null;
  patients?: { full_name: string } | null;
};

function AppointmentsPage() {
  const { role, user } = useAuth();
  const { t } = useI18n();
  const [rows, setRows] = useState<Appt[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [auto, setAuto] = useState(true);
  const [form, setForm] = useState({
    doctor_id: "", patient_id: "", date: "", time: "", reason: "", symptoms: "",
    priority: "medium" as Priority, follow_up_date: "",
  });

  const load = async () => {
    setLoading(true);
    const [a, d, p] = await Promise.all([
      supabase.from("appointments").select("*, doctors(full_name, specialty), patients(full_name)").order("scheduled_at", { ascending: true }),
      supabase.from("doctors").select("id, full_name, specialty, status").order("full_name"),
      supabase.from("patients").select("id, full_name").order("full_name"),
    ]);
    if (a.error) toast.error(a.error.message);
    setRows((a.data as Appt[]) ?? []);
    setDoctors((d.data as Doctor[]) ?? []);
    setPatients(p.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user?.id]);

  // Live workload count for auto-assign.
  const loadByDoctor = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => {
      if (r.status === "pending" || r.status === "confirmed") {
        m[r.doctor_id] = (m[r.doctor_id] ?? 0) + 1;
      }
    });
    return m;
  }, [rows]);

  const triage = useMemo(() => analyzeSymptoms(form.symptoms), [form.symptoms]);

  // Auto-update priority + suggested doctor when symptoms change.
  useEffect(() => {
    if (!form.symptoms) return;
    setForm((f) => ({ ...f, priority: triage.priority }));
    if (auto) {
      const best = pickBestDoctor(doctors, loadByDoctor, triage.suggestedSpecialty);
      if (best) setForm((f) => ({ ...f, doctor_id: best.id }));
    }
  }, [form.symptoms, auto, doctors, loadByDoctor, triage.priority, triage.suggestedSpecialty]);

  const openNew = async () => {
    let defaultPatient = "";
    if (role === "patient" && user) {
      const { data } = await supabase.from("patients").select("id").eq("user_id", user.id).maybeSingle();
      if (data) defaultPatient = data.id;
    }
    setForm({ doctor_id: "", patient_id: defaultPatient, date: "", time: "", reason: "", symptoms: "", priority: "medium", follow_up_date: "" });
    setOpen(true);
  };

  const book = async () => {
    if (!form.patient_id || !form.date || !form.time) {
      toast.error("Patient, date and time are required"); return;
    }
    let doctorId = form.doctor_id;
    if (!doctorId && auto) {
      const best = pickBestDoctor(doctors, loadByDoctor, triage.suggestedSpecialty);
      if (best) doctorId = best.id;
    }
    if (!doctorId) { toast.error("Select a doctor or enable auto-assign"); return; }

    const scheduled = new Date(`${form.date}T${form.time}:00`);
    if (isNaN(scheduled.getTime())) { toast.error("Invalid date/time"); return; }

    const dup = await supabase.from("appointments").select("id")
      .eq("doctor_id", doctorId).eq("scheduled_at", scheduled.toISOString()).maybeSingle();
    if (dup.data) { toast.error("Doctor already has an appointment at that time"); return; }

    const { error } = await supabase.from("appointments").insert({
      doctor_id: doctorId, patient_id: form.patient_id,
      scheduled_at: scheduled.toISOString(), reason: form.reason || null,
      symptoms: form.symptoms || null, priority: form.priority,
      risk_score: triage.riskScore,
      follow_up_date: form.follow_up_date || null,
      status: triage.emergency ? "confirmed" : "pending",
      created_by: user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(triage.emergency ? "Emergency booked — top priority" : "Appointment booked");
    setOpen(false); load();
  };

  const setStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); load(); }
  };

  const filtered = rows.filter((r) =>
    [r.doctors?.full_name, r.patients?.full_name, r.reason, r.symptoms].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase()))
  ).sort((a, b) => {
    const order: Record<Priority, number> = { emergency: 0, high: 1, medium: 2, low: 3 };
    return order[a.priority] - order[b.priority];
  });

  const statusBadge = (s: Status) => {
    const map: Record<Status, string> = {
      pending: "bg-warning/15 text-warning-foreground",
      confirmed: "bg-primary/15 text-primary",
      completed: "bg-success/15 text-success-foreground",
      cancelled: "bg-destructive/15 text-destructive",
      no_show: "bg-muted text-muted-foreground",
    };
    return <span className={`px-2 py-0.5 text-xs rounded-full capitalize ${map[s]}`}>{s.replace("_", " ")}</span>;
  };

  const priorityBadge = (p: Priority) => {
    const map: Record<Priority, string> = {
      emergency: "bg-destructive text-destructive-foreground",
      high: "bg-warning/20 text-warning-foreground",
      medium: "bg-muted text-foreground",
      low: "bg-accent text-accent-foreground",
    };
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full inline-flex items-center gap-1 capitalize ${map[p]}`}>
        {p === "emergency" && <AlertTriangle className="h-3 w-3" />} {p}
      </span>
    );
  };

  const emergencyCount = rows.filter((r) => r.priority === "emergency" && r.status !== "completed" && r.status !== "cancelled").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{t("appointments")}</h1>
          {emergencyCount > 0 && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-destructive/10 text-destructive px-3 py-1.5 text-sm">
              <AlertTriangle className="h-4 w-4" />
              {emergencyCount} {t("emergencyAlerts").toLowerCase()}
            </div>
          )}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4" /> {t("book")}</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t("book")}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>{t("symptoms")}</Label>
                <Textarea rows={2} placeholder="e.g. chest pain, shortness of breath"
                  value={form.symptoms} onChange={(e) => setForm({ ...form, symptoms: e.target.value })} />
                {form.symptoms && (
                  <div className={`text-xs rounded-md px-2 py-1.5 ${triage.emergency ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                    {triage.emergency && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                    {t("triageNotice")}: {t(triage.priority)} · {t("suggestedSpecialty")}: {triage.suggestedSpecialty}
                  </div>
                )}
              </div>
              <div className="col-span-2 flex items-center justify-between rounded-md border px-3 py-2">
                <Label htmlFor="auto" className="text-sm">{t("autoAssign")}</Label>
                <Switch id="auto" checked={auto} onCheckedChange={setAuto} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>{t("doctor")}</Label>
                <Select value={form.doctor_id} onValueChange={(v) => setForm({ ...form, doctor_id: v })}>
                  <SelectTrigger><SelectValue placeholder={auto ? "Auto-assign" : "–"} /></SelectTrigger>
                  <SelectContent>{doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.full_name} · {d.specialty}</SelectItem>
                  ))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>{t("patient")}</Label>
                <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })} disabled={role === "patient"}>
                  <SelectTrigger><SelectValue placeholder="–" /></SelectTrigger>
                  <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>{t("date")}</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>{t("time")}</Label><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
              <div className="space-y-1.5 col-span-2"><Label>{t("reason")}</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
              <div className="space-y-1.5 col-span-2">
                <Label>{t("priority")}</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{t(p)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
              <Button onClick={book}>{t("save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("priority")}</TableHead>
              <TableHead>{t("date")} / {t("time")}</TableHead>
              <TableHead>{t("doctor")}</TableHead>
              <TableHead>{t("patient")}</TableHead>
              <TableHead>{t("reason")}</TableHead>
              <TableHead>{t("status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("loading")}</TableCell></TableRow>
              : filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("noData")}</TableCell></TableRow>
              : filtered.map((r) => (
                <TableRow key={r.id} className={r.priority === "emergency" ? "bg-destructive/5" : ""}>
                  <TableCell>{priorityBadge(r.priority)}</TableCell>
                  <TableCell className="whitespace-nowrap">{new Date(r.scheduled_at).toLocaleString()}</TableCell>
                  <TableCell>{r.doctors?.full_name ?? "–"}</TableCell>
                  <TableCell>{r.patients?.full_name ?? "–"}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.reason ?? r.symptoms ?? "–"}</TableCell>
                  <TableCell>
                    {role === "admin" || role === "doctor" ? (
                      <Select value={r.status} onValueChange={(v) => setStatus(r.id, v as Status)}>
                        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : statusBadge(r.status)}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
