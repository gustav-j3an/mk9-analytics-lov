import { useTheme } from "./ThemeContext";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Palette, Sun, Moon, Laptop } from "lucide-react";

export const ThemeSettings = () => {
  const { theme, setTheme, accentColor, setAccentColor } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Palette className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-card border-border text-foreground">
        <DropdownMenuLabel>Aparência</DropdownMenuLabel>
        <div className="grid grid-cols-3 gap-2 p-2">
          <Button variant={theme === "light" ? "default" : "outline"} size="sm" onClick={() => setTheme("light")}>
            <Sun className="h-4 w-4" />
          </Button>
          <Button variant={theme === "dark" ? "default" : "outline"} size="sm" onClick={() => setTheme("dark")}>
            <Moon className="h-4 w-4" />
          </Button>
          <Button variant={theme === "system" ? "default" : "outline"} size="sm" onClick={() => setTheme("system")}>
            <Laptop className="h-4 w-4" />
          </Button>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Cor do Sistema</DropdownMenuLabel>
        <div className="grid grid-cols-6 gap-1 p-2">
          {(["purple", "blue", "cyan", "green", "orange", "red"] as const).map((color) => (
            <button
              key={color}
              className={`h-6 w-6 rounded-full border-2 ${accentColor === color ? "border-white" : "border-transparent"}`}
              style={{ backgroundColor: `var(--accent-${color})` }}
              onClick={() => setAccentColor(color)}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
