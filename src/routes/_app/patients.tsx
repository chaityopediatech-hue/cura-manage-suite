import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/patients")({
  head: () => ({ meta: [{ title: "Patients — MediCore" }] }),
  component: PatientsPage,
});

type Patient = {
  id: string; full_name: string; age: number | null; gender: "male" | "female" | "other" | null;
  phone: string | null; email: string | null; address: string | null;
  blood_group: string | null; medical_history: string | null;
};

function PatientsPage() {
  const { role } = useAuth();
  const { t } = useI18n();
  const [rows, setRows] = useState<Patient[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Patient | null>(null);
  const blank: Patient = { id: "", full_name: "", age: null, gender: null, phone: "", email: "", address: "", blood_group: "", medical_history: "" };
  const [form, setForm] = useState<Patient>(blank);
  const canManage = role === "admin" || role === "doctor";

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("patients").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEdit(null); setForm(blank); setOpen(true); };
  const openEdit = (p: Patient) => { setEdit(p); setForm(p); setOpen(true); };

  const save = async () => {
    if (!form.full_name.trim()) { toast.error("Name required"); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error("Invalid email"); return; }
    const payload = { ...form, age: form.age ? Number(form.age) : null };
    delete (payload as Record<string, unknown>).id;
    const res = edit
      ? await supabase.from("patients").update(payload).eq("id", edit.id)
      : await supabase.from("patients").insert(payload);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Saved"); setOpen(false); load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this patient?")) return;
    const { error } = await supabase.from("patients").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); load();
  };

  const filtered = rows.filter((r) =>
    [r.full_name, r.email, r.phone, r.blood_group].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">{t("patients")}</h1>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4" /> {t("add")}</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{edit ? t("edit") : t("add")} {t("patients")}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <Fld label={t("name")}><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Fld>
                <Fld label={t("age")}><Input type="number" min={0} value={form.age ?? ""} onChange={(e) => setForm({ ...form, age: e.target.value ? Number(e.target.value) : null })} /></Fld>
                <Fld label={t("gender")}>
                  <Select value={form.gender ?? ""} onValueChange={(v) => setForm({ ...form, gender: v as Patient["gender"] })}>
                    <SelectTrigger><SelectValue placeholder="–" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </Fld>
                <Fld label={t("bloodGroup")}><Input value={form.blood_group ?? ""} onChange={(e) => setForm({ ...form, blood_group: e.target.value })} /></Fld>
                <Fld label={t("phone")}><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Fld>
                <Fld label={t("email")}><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Fld>
                <Fld label={t("address")} full><Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Fld>
                <Fld label={t("medicalHistory")} full><Textarea value={form.medical_history ?? ""} onChange={(e) => setForm({ ...form, medical_history: e.target.value })} /></Fld>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                <Button onClick={save}>{t("save")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("age")}</TableHead>
              <TableHead>{t("gender")}</TableHead>
              <TableHead>{t("phone")}</TableHead>
              <TableHead>{t("bloodGroup")}</TableHead>
              {canManage && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("loading")}</TableCell></TableRow>
              : filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("noData")}</TableCell></TableRow>
              : filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name}</TableCell>
                  <TableCell>{p.age ?? "–"}</TableCell>
                  <TableCell className="capitalize">{p.gender ?? "–"}</TableCell>
                  <TableCell>{p.phone ?? "–"}</TableCell>
                  <TableCell>{p.blood_group ?? "–"}</TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      {role === "admin" && <Button variant="ghost" size="icon" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </TableCell>
                  )}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Fld({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return <div className={`space-y-1.5 ${full ? "col-span-2" : ""}`}><Label>{label}</Label>{children}</div>;
}
