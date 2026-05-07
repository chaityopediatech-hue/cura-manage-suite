import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">This page doesn't exist.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Go home</Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MediCore AI Specialized Clinic Management" },
      { name: "description", content: "MediCore is a modern clinic management system: appointments, patients, doctors, prescriptions, and an AI assistant." },
      { property: "og:title", content: "MediCore AI Specialized Clinic Management" },
      { name: "twitter:title", content: "MediCore AI Specialized Clinic Management" },
      { property: "og:description", content: "MediCore is a modern clinic management system: appointments, patients, doctors, prescriptions, and an AI assistant." },
      { name: "twitter:description", content: "MediCore is a modern clinic management system: appointments, patients, doctors, prescriptions, and an AI assistant." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d6f4788d-bcfc-41bc-af01-2cf9675ea5f7/id-preview-798785b2--f3657149-2fe3-42be-a5d7-90d281ca0e27.lovable.app-1778070904312.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d6f4788d-bcfc-41bc-af01-2cf9675ea5f7/id-preview-798785b2--f3657149-2fe3-42be-a5d7-90d281ca0e27.lovable.app-1778070904312.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: () => (
    <I18nProvider>
      <AuthProvider>
        <Outlet />
        <Toaster />
      </AuthProvider>
    </I18nProvider>
  ),
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}
