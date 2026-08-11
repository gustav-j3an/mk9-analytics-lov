import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
type AccentColor = "purple" | "blue" | "cyan" | "green" | "orange" | "red";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  accentColor: AccentColor;
  setAccentColor: (color: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "system",
  setTheme: () => {},
  accentColor: "purple",
  setAccentColor: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(() => 
    (typeof window !== "undefined" ? (localStorage.getItem("mk9-theme") as Theme) : "system") || "system"
  );
  
  const [accentColor, setAccentColorState] = useState<AccentColor>(() => 
    (typeof window !== "undefined" ? (localStorage.getItem("mk9-accent") as AccentColor) : "purple") || "purple"
  );

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Apply theme
    root.classList.remove("light", "dark");
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
    localStorage.setItem("mk9-theme", theme);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    // Apply accent color (simplified: just store in attribute)
    root.setAttribute("data-accent", accentColor);
    localStorage.setItem("mk9-accent", accentColor);
  }, [accentColor]);

  const setTheme = (t: Theme) => setThemeState(t);
  const setAccentColor = (c: AccentColor) => setAccentColorState(c);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
