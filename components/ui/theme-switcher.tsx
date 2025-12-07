"use client";

import { Moon, Sun, Monitor } from "lucide-react";

import { useTheme } from "@/lib/theme";
import { Button } from "./button";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "./dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Theme Switcher - Dropdown for selecting light/dark/system theme.
 *
 * Uses next-themes for robust theme switching.
 */
export function ThemeSwitcher() {
    const { theme, setTheme, resolvedTheme } = useTheme();

    // Show the resolved theme's icon (handles system preference)
    const Icon = resolvedTheme === "dark" ? Moon : Sun;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="relative"
                    aria-label="Choose theme"
                >
                    <Icon className="size-4 text-foreground/70" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                    onClick={() => setTheme("light")}
                    className={cn("gap-3", theme === "light" && "bg-foreground/5")}
                >
                    <Sun className="size-4" />
                    <span>Light</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => setTheme("dark")}
                    className={cn("gap-3", theme === "dark" && "bg-foreground/5")}
                >
                    <Moon className="size-4" />
                    <span>Dark</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => setTheme("system")}
                    className={cn("gap-3", theme === "system" && "bg-foreground/5")}
                >
                    <Monitor className="size-4" />
                    <span>System</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
