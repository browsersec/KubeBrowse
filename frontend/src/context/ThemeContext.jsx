import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Get theme preference from localStorage or default to 'system'
  const getInitialPreference = () => {
    const savedPreference = localStorage.getItem("themePreference");
    return savedPreference || "system";
  };

  // Get resolved theme based on preference and system media query
  const getResolvedTheme = (preference) => {
    if (preference === "system") {
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        return "dark";
      }
      return "light";
    }
    return preference;
  };

  const [themePreference, setThemePreference] = useState(getInitialPreference);
  const [resolvedTheme, setResolvedTheme] = useState(() =>
    getResolvedTheme(getInitialPreference())
  );

  // Update resolved theme when preference changes
  useEffect(() => {
    const newResolvedTheme = getResolvedTheme(themePreference);
    setResolvedTheme(newResolvedTheme);
  }, [themePreference]);

  // Update document class when resolved theme changes
  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      const pref = localStorage.getItem("themePreference") || "system";
      if (pref === "system") setTheme(mediaQuery.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themePreference]);

  // Store preference to localStorage
  const setPreference = (preference) => {
    setThemePreference(preference);
    localStorage.setItem("themePreference", preference);
  };

  // Convenience method for setting concrete themes
  const setTheme = (theme) => {
    setPreference(theme);
  };

  const toggleTheme = () => {
    const newTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: resolvedTheme,
        themePreference,
        setTheme,
        setPreference,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
