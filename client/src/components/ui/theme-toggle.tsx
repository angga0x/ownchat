import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "./button"

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("dark")

  useEffect(() => {
    const currentTheme = localStorage.getItem("vite-ui-theme") as "light" | "dark" | "system" | null

    if (currentTheme) {
      setTheme(currentTheme)
    } else {
      setTheme("dark")
      localStorage.setItem("vite-ui-theme", "dark")
    }
  }, [])

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)
  }, [theme])

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark"
    setTheme(newTheme)
    localStorage.setItem("vite-ui-theme", newTheme)
  }

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={toggleTheme}
      className="rounded-full w-9 h-9 bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400"
    >
      {theme === "dark" ? (
        <Sun className="h-5 w-5 text-messenger-yellow" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}