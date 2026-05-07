import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Download, Trash2, FileUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Medical Reports — MediCore" }] }),
  component: ReportsPage,
});

const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

type Report = {
  id: string; patient_id: string; title: string; file_path: string;
  file_type: string | null; file_size: number | null; created_at: string;
  patients?: { full_name: string } | null;
};

function ReportsPage() {
  const { role, user } = useAuth();
  const { t } = useI18n();
  const [rows, setRows] = useState<Report[]>([]);
  const [patients, setPatients] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ patient_id: string; title: string; file: File | null }>({
    patient_id: "", title: "", file: null,
  });
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [r, p] = await Promise.all([
      supabase.from("medical_reports").select("*, patients(full_name)").order("created_at", { ascending: false }),
      supabase.from("patients").select("id, full_name").order("full_name"),
    ]);
    if (r.error) toast.error(r.error.message);
    setRows((r.data as Report[]) ?? []);
    setPatients(p.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user?.id]);

  const myPatientId = useMemo(() => {
    if (role !== "patient" || !user) return "";
    const me = patients.find(() => true); // placeholder — patient sees their reports via RLS regardless
    return me?.id ?? "";
  }, [patients, role, user]);

  const openNew = async () => {
    let pid = "";
    if (role === "patient" && user) {
      const { data } = await supabase.from("patients").select("id").eq("user_id", user.id).maybeSingle();
      pid = data?.id ?? "";
    }
    setForm({ patient_id: pid, title: "", file: null });
    setOpen(true);
  };

  const upload = async () => {
    if (!form.patient_id) { toast.error(t("patient")); return; }
    if (!form.title.trim()) { toast.error(t("name")); return; }
    if (!form.file) { toast.error(t("upload")); return; }
    if (!ALLOWED.includes(form.file.type)) { toast.error("Only PDF, PNG, JPG"); return; }
    if (form.file.size > MAX_BYTES) { toast.error("Max 10MB"); return; }

    setUploading(true);
    const ext = form.file.name.split(".").pop();
    const path = `${form.patient_id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("medical-reports").upload(path, form.file, {
      contentType: form.file.type, upsert: false,
    });
    if (up.error) { toast.error(up.error.message); setUploading(false); return; }

    const { error } = await supabase.from("medical_reports").insert({
      patient_id: form.patient_id, title: form.title, file_path: path,
      file_type: form.file.type, file_size: form.file.size, uploaded_by: user?.id ?? null,
    });
    if (error) {
      await supabase.storage.from("medical-reports").remove([path]);
      toast.error(error.message); setUploading(false); return;
    }
    toast.success(t("upload")); setUploading(false); setOpen(false); load();
  };

  const download = async (r: Report) => {
    const { data, error } = await supabase.storage.from("medical-reports").createSignedUrl(r.file_path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (r: Report) => {
    if (!confirm("Delete report?")) return;
    await supabase.storage.from("medical-reports").remove([r.file_path]);
    const { error } = await supabase.from("medical_reports").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("delete")); load();
  };

  const canDelete = (r: Report) =>
    role === "admin" || (role === "patient" && rows.some((x) => x.id === r.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{t("reports")}</h1>
          <p className="text-sm text-muted-foreground">PDF · JPG · PNG · max 10MB</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4" /> {t("upload")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle><FileUp className="inline h-4 w-4 mr-2" />{t("upload")} {t("reports").toLowerCase()}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>{t("patient")}</Label>
                <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })} disabled={role === "patient"}>
                  <SelectTrigger><SelectValue placeholder="–" /></SelectTrigger>
                  <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>{t("name")}</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Blood test, X-ray, …" />
              </div>
              <div className="space-y-1.5"><Label>{t("upload")}</Label>
                <Input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
              <Button onClick={upload} disabled={uploading}>{uploading ? t("loading") : t("save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("name")}</TableHead>
            <TableHead>{t("patient")}</TableHead>
            <TableHead>{t("date")}</TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t("loading")}</TableCell></TableRow>
              : rows.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t("noData")}</TableCell></TableRow>
              : rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.title}<div className="text-xs text-muted-foreground">{r.file_type}</div></TableCell>
                  <TableCell>{r.patients?.full_name ?? "–"}</TableCell>
                  <TableCell className="whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => download(r)}><Download className="h-4 w-4" /></Button>
                    {canDelete(r) && (
                      <Button variant="ghost" size="icon" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
