import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Stethoscope, Users, Clock, Plus, FileText, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — MediCore" }] }),
  component: Dashboard,
});

type Stats = { doctors: number; patients: number; today: number; pending: number; emergency: number };

function Dashboard() {
  const { role, user } = useAuth();
  const { t } = useI18n();
  const [stats, setStats] = useState<Stats>({ doctors: 0, patients: 0, today: 0, pending: 0, emergency: 0 });
  const [recent, setRecent] = useState<Array<{ id: string; scheduled_at: string; status: string; reason: string | null; priority: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setHours(23, 59, 59, 999);

      const [d, p, today, pending, emergency, rec] = await Promise.all([
        supabase.from("doctors").select("*", { count: "exact", head: true }),
        supabase.from("patients").select("*", { count: "exact", head: true }),
        supabase.from("appointments").select("*", { count: "exact", head: true })
          .gte("scheduled_at", start.toISOString()).lte("scheduled_at", end.toISOString()),
        supabase.from("appointments").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("appointments").select("*", { count: "exact", head: true })
          .eq("priority", "emergency").in("status", ["pending", "confirmed"]),
        supabase.from("appointments").select("id,scheduled_at,status,reason,priority").order("created_at", { ascending: false }).limit(6),
      ]);
      setStats({
        doctors: d.count ?? 0, patients: p.count ?? 0,
        today: today.count ?? 0, pending: pending.count ?? 0,
        emergency: emergency.count ?? 0,
      });
      setRecent(rec.data ?? []);
      setLoading(false);
    })();
  }, [user?.id]);

  const cards = [
    { label: t("totalDoctors"), value: stats.doctors, icon: Stethoscope, tone: "" },
    { label: t("totalPatients"), value: stats.patients, icon: Users, tone: "" },
    { label: t("todayAppts"), value: stats.today, icon: CalendarDays, tone: "" },
    { label: t("pendingAppts"), value: stats.pending, icon: Clock, tone: "" },
    { label: t("emergencyAlerts"), value: stats.emergency, icon: AlertTriangle, tone: "destructive" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("dashboard")}</h1>
        <p className="text-sm text-muted-foreground">
          {role === "admin" ? "Clinic-wide overview." : role === "doctor" ? "Your appointments and patients." : "Your healthcare overview."}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className={`hover:shadow-sm transition-shadow ${c.tone === "destructive" && c.value > 0 ? "border-destructive/40" : ""}`}>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{c.label}</div>
                <div className={`text-2xl font-semibold mt-1 ${c.tone === "destructive" && c.value > 0 ? "text-destructive" : ""}`}>{loading ? "–" : c.value}</div>
              </div>
              <div className={`h-10 w-10 rounded-md flex items-center justify-center ${c.tone === "destructive" && c.value > 0 ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground"}`}>
                <c.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">{t("recentActivity")}</CardTitle></CardHeader>
          <CardContent>
            {loading ? <div className="text-sm text-muted-foreground">{t("loading")}</div>
              : recent.length === 0 ? <div className="text-sm text-muted-foreground">{t("noData")}</div>
              : <ul className="divide-y">
                  {recent.map((r) => (
                    <li key={r.id} className="py-3 flex items-center justify-between text-sm gap-2">
                      <span className="truncate flex items-center gap-2">
                        {r.priority === "emergency" && <span className="px-1.5 py-0.5 rounded text-[10px] bg-destructive text-destructive-foreground uppercase">SOS</span>}
                        {r.reason || t("appointments")}
                      </span>
                      <span className="flex items-center gap-3 shrink-0">
                        <span className="text-muted-foreground hidden sm:inline">{new Date(r.scheduled_at).toLocaleString()}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-muted capitalize">{r.status}</span>
                      </span>
                    </li>
                  ))}
                </ul>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("quickActions")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/appointments"><Plus className="h-4 w-4" /> {t("book")}</Link>
            </Button>
            {(role === "admin" || role === "doctor") && (
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/patients"><Users className="h-4 w-4" /> {t("patients")}</Link>
              </Button>
            )}
            {role === "admin" && (
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/doctors"><Stethoscope className="h-4 w-4" /> {t("doctors")}</Link>
              </Button>
            )}
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/prescriptions"><FileText className="h-4 w-4" /> {t("prescriptions")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
