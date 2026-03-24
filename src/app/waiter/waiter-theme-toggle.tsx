"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import {
  DEFAULT_RESTAURANT_THEME,
  normalizeRestaurantTheme,
  RESTAURANT_THEME_STORAGE_KEY,
  type RestaurantThemeMode,
} from "@/app/restaurant/theme/restaurant-theme";

function applyTheme(theme: RestaurantThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.querySelector<HTMLElement>(".restaurant-panel.waiter-panel");
  if (!root) return;
  root.setAttribute("data-restaurant-theme", theme);
}

export default function WaiterThemeToggle() {
  const [theme, setTheme] = useState<RestaurantThemeMode>(() =>
    normalizeRestaurantTheme(
      typeof window !== "undefined"
        ? window.localStorage.getItem(RESTAURANT_THEME_STORAGE_KEY)
        : DEFAULT_RESTAURANT_THEME,
    ),
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setThemeWithPersist = (nextTheme: RestaurantThemeMode) => {
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RESTAURANT_THEME_STORAGE_KEY, nextTheme);
    }
    applyTheme(nextTheme);
  };

  return (
    <div className="restaurant-theme-toggle" role="group" aria-label="Panel tema seçimi">
      <button
        type="button"
        className={`restaurant-theme-option ${theme === "day" ? "restaurant-theme-option-active" : ""}`}
        onClick={() => setThemeWithPersist("day")}
        aria-pressed={theme === "day"}
      >
        <Sun className="h-3.5 w-3.5" />
        Gündüz
      </button>
      <button
        type="button"
        className={`restaurant-theme-option ${theme === "night" ? "restaurant-theme-option-active" : ""}`}
        onClick={() => setThemeWithPersist("night")}
        aria-pressed={theme === "night"}
      >
        <Moon className="h-3.5 w-3.5" />
        Gece
      </button>
    </div>
  );
}
