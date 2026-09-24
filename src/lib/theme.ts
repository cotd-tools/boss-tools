import { onScopeDispose, ref, watch } from "vue";

export const THEME_STORAGE_KEY = "cotd-theme-pref";
export const themeOptions = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof themeOptions)[number];

export function normalizeTheme(value: string | null): ThemePreference {
  return themeOptions.includes(value as ThemePreference)
    ? (value as ThemePreference)
    : "system";
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean) {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}

export function useTheme() {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    /* The theme still works when storage is unavailable. */
  }
  const preference = ref(normalizeTheme(saved));
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const systemDark = ref(media.matches);
  const updateSystem = (event: MediaQueryListEvent) => {
    systemDark.value = event.matches;
  };
  media.addEventListener("change", updateSystem);
  onScopeDispose(() => media.removeEventListener("change", updateSystem));

  watch(
    [preference, systemDark],
    ([value, dark]) => {
      const theme = resolveTheme(value, dark);
      const root = document.documentElement;
      root.classList.toggle("dark", theme === "dark");
      root.style.colorScheme = theme;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", theme === "dark" ? "#101b16" : "#f8f9f5");
    },
    { immediate: true, flush: "sync" },
  );

  watch(
    preference,
    (value) => {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, value);
      } catch {
        /* Keep the current session usable without persistence. */
      }
    },
    { flush: "sync" },
  );
  return { preference };
}
