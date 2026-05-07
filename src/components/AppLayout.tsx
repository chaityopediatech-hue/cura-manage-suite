import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useI18n, LANGS } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity, Users, Stethoscope, CalendarDays, FileText, Bot, LogOut, LayoutDashboard, Home,
  Building2, FileUp, Sun, Moon,
} from "lucide-react";
import { useEffect } from "react";

export function AppLayout() {
  const { user, role, loading, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);

  if (loading || !user) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">{t("loading")}</div>;
  }

  const items = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("dashboard") },
    { to: "/doctors", icon: Stethoscope, label: t("doctors") },
    { to: "/patients", icon: Users, label: t("patients") },
    { to: "/appointments", icon: CalendarDays, label: t("appointments") },
    { to: "/prescriptions", icon: FileText, label: t("prescriptions") },
    { to: "/reports", icon: FileUp, label: t("reports") },
    ...(role === "admin" ? [{ to: "/departments", icon: Building2, label: t("departments") }] : []),
    { to: "/assistant", icon: Bot, label: t("assistant") },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-60 flex-col border-r bg-sidebar">
        <Link to="/" className="flex items-center gap-2 px-5 h-16 border-b">
          <Activity className="h-5 w-5 text-primary" />
          <span className="font-semibold">MediCore</span>
        </Link>
        <nav className="flex-1 p-3 space-y-1">
          {items.map((it) => {
            const active = path === it.to || path.startsWith(it.to + "/");
            return (
              <Link key={it.to} to={it.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                }`}>
                <it.icon className="h-4 w-4" /> {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t text-xs text-muted-foreground">
          <div className="truncate">{user.email}</div>
          <div className="capitalize">{role ? t(role) : ""}</div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card flex items-center justify-between px-4 md:px-6 gap-3">
          <div className="md:hidden flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-semibold">MediCore</span>
          </div>
          <div className="hidden md:block text-sm text-muted-foreground">
            {t("appName")} · <span className="capitalize">{role ? t(role) : ""}</span>
          </div>
          <div className="flex items-center gap-2">
            <Select value={lang} onValueChange={(v) => setLang(v as never)}>
              <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGS.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={toggle} title={theme === "dark" ? t("lightMode") : t("darkMode")}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" asChild><Link to="/"><Home className="h-4 w-4" /></Link></Button>
            <Button variant="ghost" size="sm" onClick={() => signOut().then(() => nav({ to: "/" }))}>
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">{t("signOut")}</span>
            </Button>
          </div>
        </header>

        <nav className="md:hidden flex overflow-x-auto gap-1 px-3 py-2 border-b bg-card text-xs">
          {items.map((it) => (
            <Link key={it.to} to={it.to} className="px-3 py-1.5 rounded-md whitespace-nowrap hover:bg-muted">
              {it.label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
