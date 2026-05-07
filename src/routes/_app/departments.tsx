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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/departments")({
  head: () => ({ meta: [{ title: "Departments — MediCore" }] }),
  component: DepartmentsPage,
});

type Dept = { id: string; name: string; description: string | null };

function DepartmentsPage() {
  const { role } = useAuth();
  const { t } = useI18n();
  const [rows, setRows] = useState<Dept[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Dept | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const isAdmin = role === "admin";

  const load = async () => {
    setLoading(true);
    const [d, docs] = await Promise.all([
      supabase.from("departments").select("*").order("name"),
      supabase.from("doctors").select("department_id"),
    ]);
    if (d.error) toast.error(d.error.message);
    setRows(d.data ?? []);
    const c: Record<string, number> = {};
    (docs.data ?? []).forEach((r) => { if (r.department_id) c[r.department_id] = (c[r.department_id] ?? 0) + 1; });
    setCounts(c);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEdit(null); setForm({ name: "", description: "" }); setOpen(true); };
  const openEdit = (d: Dept) => { setEdit(d); setForm({ name: d.name, description: d.description ?? "" }); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) { toast.error(t("name")); return; }
    const res = edit
      ? await supabase.from("departments").update(form).eq("id", edit.id)
      : await supabase.from("departments").insert(form);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(t("save")); setOpen(false); load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete?")) return;
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("delete")); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">{t("departments")}</h1>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4" /> {t("add")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{edit ? t("edit") : t("add")} {t("departments")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>{t("name")}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>{t("instructions")}</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                <Button onClick={save}>{t("save")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("name")}</TableHead>
            <TableHead>{t("doctors")}</TableHead>
            <TableHead>{t("instructions")}</TableHead>
            {isAdmin && <TableHead></TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t("loading")}</TableCell></TableRow>
              : rows.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t("noData")}</TableCell></TableRow>
              : rows.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>{counts[d.id] ?? 0}</TableCell>
                  <TableCell className="max-w-md truncate text-muted-foreground">{d.description}</TableCell>
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
