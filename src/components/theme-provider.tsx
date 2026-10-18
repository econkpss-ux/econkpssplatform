import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const ThemeContext = createContext({ dark: false, toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const read = () => {
      const saved = window.localStorage.getItem("econkpss-theme");
      setDark(saved ? saved === "dark" : media.matches);
    };
    read();
    media.addEventListener("change", read);
    window.addEventListener("storage", read);
    return () => {
      media.removeEventListener("change", read);
      window.removeEventListener("storage", read);
    };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  function toggle() {
    const next = !dark;
    window.localStorage.setItem("econkpss-theme", next ? "dark" : "light");
    setDark(next);
  }
  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const { dark, toggle } = useContext(ThemeContext);
  const label = dark ? "Açık temaya geç" : "Karanlık temaya geç";
  return <Button variant="ghost" size="icon" className="shrink-0" aria-label={label} title={label} onClick={toggle}>
    {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
  </Button>;
}