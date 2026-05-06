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
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/doctors")({
  head: () => ({ meta: [{ title: "Doctors — MediCore" }] }),
  component: DoctorsPage,
});

type Doctor = {
  id: string; full_name: string; specialty: string; department: string;
  phone: string | null; email: string | null; availability: string | null; status: string;
};

function DoctorsPage() {
  const { role } = useAuth();
  const { t } = useI18n();
  const [rows, setRows] = useState<Doctor[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Doctor | null>(null);

  const blank = { id: "", full_name: "", specialty: "", department: "", phone: "", email: "", availability: "", status: "active" };
  const [form, setForm] = useState<Doctor>(blank as Doctor);

  const isAdmin = role === "admin";

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("doctors").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEdit(null); setForm(blank as Doctor); setOpen(true); };
  const openEdit = (d: Doctor) => { setEdit(d); setForm(d); setOpen(true); };

  const save = async () => {
    if (!form.full_name.trim()) { toast.error("Name required"); return; }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error("Invalid email"); return; }
    const payload = { ...form }; delete (payload as Record<string, unknown>).id;
    const res = edit
      ? await supabase.from("doctors").update(payload).eq("id", edit.id)
      : await supabase.from("doctors").insert(payload);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Saved"); setOpen(false); load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this doctor?")) return;
    const { error } = await supabase.from("doctors").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); load();
  };

  const filtered = rows.filter((r) =>
    [r.full_name, r.specialty, r.department, r.email].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">{t("doctors")}</h1>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4" /> {t("add")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{edit ? t("edit") : t("add")} {t("doctors")}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("name")} v={form.full_name} on={(v) => setForm({ ...form, full_name: v })} />
                <Field label={t("specialty")} v={form.specialty} on={(v) => setForm({ ...form, specialty: v })} />
                <Field label={t("department")} v={form.department} on={(v) => setForm({ ...form, department: v })} />
                <Field label={t("availability")} v={form.availability ?? ""} on={(v) => setForm({ ...form, availability: v })} />
                <Field label={t("phone")} v={form.phone ?? ""} on={(v) => setForm({ ...form, phone: v })} />
                <Field label={t("email")} v={form.email ?? ""} on={(v) => setForm({ ...form, email: v })} type="email" />
                <Field label={t("status")} v={form.status} on={(v) => setForm({ ...form, status: v })} />
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
              <TableHead>{t("specialty")}</TableHead>
              <TableHead>{t("department")}</TableHead>
              <TableHead>{t("phone")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              {isAdmin && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("loading")}</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("noData")}</TableCell></TableRow>
            ) : filtered.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.full_name}</TableCell>
                <TableCell>{d.specialty}</TableCell>
                <TableCell>{d.department}</TableCell>
                <TableCell>{d.phone}</TableCell>
                <TableCell><span className="px-2 py-0.5 text-xs rounded-full bg-accent text-accent-foreground capitalize">{d.status}</span></TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(d.id)}><Trash2 className="h-4 w-4" /></Button>
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

function Field({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={v} onChange={(e) => on(e.target.value)} type={type} />
    </div>
  );
}
