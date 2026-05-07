import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
const Ctx = createContext<{ theme: Theme; setTheme: (t: Theme) => void; toggle: () => void }>({
  theme: "light", setTheme: () => {}, toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem("medicore_theme")) as Theme | null;
    const sys = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setThemeState(saved ?? sys);
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  const setTheme = (t: Theme) => {
    setThemeState(t);
    if (typeof localStorage !== "undefined") localStorage.setItem("medicore_theme", t);
  };
  return <Ctx.Provider value={{ theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
