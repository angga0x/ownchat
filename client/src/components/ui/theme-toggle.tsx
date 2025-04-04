import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

// Create a global theme manager
export const ThemeManager = {
  getTheme: (): "light" | "dark" => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) return savedTheme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  },
  
  setTheme: (theme: "light" | "dark") => {
    const root = document.documentElement;
    
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    
    localStorage.setItem("theme", theme);
    
    // Dispatch event for other components to react
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  },
  
  toggle: () => {
    const currentTheme = ThemeManager.getTheme();
    const newTheme = currentTheme === "light" ? "dark" : "light";
    ThemeManager.setTheme(newTheme);
    return newTheme;
  },
  
  // Initialize theme on page load
  initialize: () => {
    const theme = ThemeManager.getTheme();
    ThemeManager.setTheme(theme);
    
    // Watch for system theme changes if no preference is saved
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("theme")) {
        const newTheme = e.matches ? "dark" : "light";
        ThemeManager.setTheme(newTheme);
      }
    };
    
    mediaQuery.addEventListener("change", handleChange);
  }
};

// Initialize theme on module load
if (typeof window !== 'undefined') {
  ThemeManager.initialize();
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(ThemeManager.getTheme());

  useEffect(() => {
    // Listen for theme changes from other components
    const handleThemeChange = (e: CustomEvent<{theme: "light" | "dark"}>) => {
      setTheme(e.detail.theme);
    };
    
    window.addEventListener('themechange', handleThemeChange as EventListener);
    return () => window.removeEventListener('themechange', handleThemeChange as EventListener);
  }, []);

  const toggleTheme = () => {
    const newTheme = ThemeManager.toggle();
    setTheme(newTheme);
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      className="theme-toggle transition-colors duration-200"
    >
      {theme === "light" ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5 text-yellow-300" />
      )}
      <span className="sr-only">
        {theme === 'light' ? 'Dark' : 'Light'} mode
      </span>
    </Button>
  );
}