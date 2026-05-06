import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, BarChart3, FileText, ShieldCheck, Bot, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n, LANGS } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MediCore — Clinic management made simple" },
      { name: "description", content: "MediCore helps clinics manage doctors, patients, appointments and digital prescriptions in one secure place." },
    ],
  }),
  component: Home,
});

function Home() {
  const { t, lang, setLang } = useI18n();
  const { user } = useAuth();

  const features = [
    { icon: BarChart3, title: t("featureAnalytics"), desc: "Daily totals for appointments, doctors and patients across the clinic." },
    { icon: FileText, title: t("featureRx"), desc: "Create structured prescriptions linked to each visit." },
    { icon: ShieldCheck, title: t("featureAccess"), desc: "Role-based access for admins, doctors and patients." },
    { icon: Bot, title: t("featureAI"), desc: t("aiDisclaimer") },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto h-16 px-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-semibold">MediCore</span>
          </Link>
          <div className="flex items-center gap-2">
            <Select value={lang} onValueChange={(v) => setLang(v as never)}>
              <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGS.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {user ? (
              <Button asChild><Link to="/dashboard">{t("dashboard")}</Link></Button>
            ) : (
              <>
                <Button variant="ghost" asChild><Link to="/login">{t("signIn")}</Link></Button>
                <Button asChild><Link to="/register">{t("signUp")}</Link></Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-16 md:py-24 text-center">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
          {t("appName")}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">{t("tagline")}</p>
        <div className="mt-8 flex justify-center gap-3">
          <Button size="lg" asChild>
            <Link to={user ? "/dashboard" : "/register"}>
              {t("getStarted")} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild><a href="#features">{t("learnMore")}</a></Button>
        </div>
      </section>

      <section id="features" className="max-w-6xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-semibold mb-8 text-center">{t("features")}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg border bg-card p-5 hover:shadow-sm transition-shadow">
              <div className="h-10 w-10 rounded-md bg-accent text-accent-foreground flex items-center justify-center mb-3">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-medium">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} MediCore
      </footer>
    </div>
  );
}
