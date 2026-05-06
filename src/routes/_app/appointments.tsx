import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/appointments")({
  head: () => ({ meta: [{ title: "Appointments — MediCore" }] }),
  component: AppointmentsPage,
});

const STATUS = ["pending", "confirmed", "cancelled", "completed", "no_show"] as const;
type Status = (typeof STATUS)[number];

type Appt = {
  id: string; doctor_id: string; patient_id: string; scheduled_at: string;
  reason: string | null; status: Status;
  doctors?: { full_name: string } | null;
  patients?: { full_name: string } | null;
};

function AppointmentsPage() {
  const { role, user } = useAuth();
  const { t } = useI18n();
  const [rows, setRows] = useState<Appt[]>([]);
  const [doctors, setDoctors] = useState<{ id: string; full_name: string }[]>([]);
  const [patients, setPatients] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ doctor_id: "", patient_id: "", date: "", time: "", reason: "" });

  const load = async () => {
    setLoading(true);
    const [a, d, p] = await Promise.all([
      supabase.from("appointments").select("*, doctors(full_name), patients(full_name)").order("scheduled_at", { ascending: true }),
      supabase.from("doctors").select("id, full_name").order("full_name"),
      supabase.from("patients").select("id, full_name").order("full_name"),
    ]);
    if (a.error) toast.error(a.error.message);
    setRows((a.data as Appt[]) ?? []);
    setDoctors(d.data ?? []);
    setPatients(p.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user?.id]);

  const openNew = async () => {
    let defaultPatient = "";
    if (role === "patient" && user) {
      const { data } = await supabase.from("patients").select("id").eq("user_id", user.id).maybeSingle();
      if (data) defaultPatient = data.id;
    }
    setForm({ doctor_id: "", patient_id: defaultPatient, date: "", time: "", reason: "" });
    setOpen(true);
  };

  const book = async () => {
    if (!form.doctor_id || !form.patient_id || !form.date || !form.time) {
      toast.error("Doctor, patient, date and time are required"); return;
    }
    const scheduled = new Date(`${form.date}T${form.time}:00`);
    if (isNaN(scheduled.getTime())) { toast.error("Invalid date/time"); return; }

    const dup = await supabase.from("appointments").select("id")
      .eq("doctor_id", form.doctor_id).eq("scheduled_at", scheduled.toISOString()).maybeSingle();
    if (dup.data) { toast.error("Doctor already has an appointment at that time"); return; }

    const { error } = await supabase.from("appointments").insert({
      doctor_id: form.doctor_id, patient_id: form.patient_id,
      scheduled_at: scheduled.toISOString(), reason: form.reason || null,
      status: "pending", created_by: user?.id ?? null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Booked"); setOpen(false); load();
  };

  const setStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); load(); }
  };

  const filtered = rows.filter((r) =>
    [r.doctors?.full_name, r.patients?.full_name, r.reason].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase()))
  );

  const badge = (s: Status) => {
    const map: Record<Status, string> = {
      pending: "bg-warning/15 text-warning-foreground",
      confirmed: "bg-primary/15 text-primary",
      completed: "bg-success/15 text-success-foreground",
      cancelled: "bg-destructive/15 text-destructive",
      no_show: "bg-muted text-muted-foreground",
    };
    return <span className={`px-2 py-0.5 text-xs rounded-full capitalize ${map[s]}`}>{s.replace("_", " ")}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">{t("appointments")}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4" /> {t("book")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("book")}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>{t("doctor")}</Label>
                <Select value={form.doctor_id} onValueChange={(v) => setForm({ ...form, doctor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="–" /></SelectTrigger>
                  <SelectContent>{doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}</SelectContent>
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

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("date")} / {t("time")}</TableHead>
              <TableHead>{t("doctor")}</TableHead>
              <TableHead>{t("patient")}</TableHead>
              <TableHead>{t("reason")}</TableHead>
              <TableHead>{t("status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("loading")}</TableCell></TableRow>
              : filtered.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("noData")}</TableCell></TableRow>
              : filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{new Date(r.scheduled_at).toLocaleString()}</TableCell>
                  <TableCell>{r.doctors?.full_name ?? "–"}</TableCell>
                  <TableCell>{r.patients?.full_name ?? "–"}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.reason ?? "–"}</TableCell>
                  <TableCell>
                    {role === "admin" || role === "doctor" ? (
                      <Select value={r.status} onValueChange={(v) => setStatus(r.id, v as Status)}>
                        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : badge(r.status)}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
