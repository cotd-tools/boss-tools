import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { effectScope } from "vue";
import {
  normalizeTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  useTheme,
} from "../src/lib/theme.ts";

function browser(
  saved: string | null,
  systemDark: boolean,
  storageBlocked = false,
) {
  const state = { dark: false, style: { colorScheme: "" }, meta: "", saved };
  const listeners = new Set<(event: { matches: boolean }) => void>();
  const media = {
    matches: systemDark,
    addEventListener: (
      _: string,
      listener: (event: { matches: boolean }) => void,
    ) => listeners.add(listener),
    removeEventListener: (
      _: string,
      listener: (event: { matches: boolean }) => void,
    ) => listeners.delete(listener),
  };
  const host = {
    window: { matchMedia: () => media },
    localStorage: {
      getItem(key: string) {
        assert.equal(key, THEME_STORAGE_KEY);
        if (storageBlocked) throw new Error("Storage blocked");
        return state.saved;
      },
      setItem(key: string, value: string) {
        assert.equal(key, THEME_STORAGE_KEY);
        if (storageBlocked) throw new Error("Storage blocked");
        state.saved = value;
      },
    },
    document: {
      documentElement: {
        classList: {
          toggle: (_: string, dark: boolean) => {
            state.dark = dark;
          },
        },
        style: state.style,
      },
      querySelector: () => ({
        set content(value: string) {
          state.meta = value;
        },
        setAttribute: (_: string, value: string) => {
          state.meta = value;
        },
      }),
    },
  };
  return {
    host,
    state,
    listeners,
    setSystem(dark: boolean) {
      media.matches = dark;
      listeners.forEach((listener) => listener({ matches: dark }));
    },
  };
}

function withTheme(
  saved: string | null,
  dark: boolean,
  blocked: boolean,
  check: (
    env: ReturnType<typeof browser>,
    theme: ReturnType<typeof useTheme>,
  ) => void,
) {
  const env = browser(saved, dark, blocked);
  const previous = Object.keys(env.host).map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  const scope = effectScope();
  try {
    for (const [key, value] of Object.entries(env.host)) {
      Object.defineProperty(globalThis, key, { value, configurable: true });
    }
    const theme = scope.run(useTheme)!;
    check(env, theme);
  } finally {
    scope.stop();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
  assert.equal(env.listeners.size, 0, "system listener is removed on unmount");
}

test("theme follows system changes until overridden and resumes when System is selected", () => {
  withTheme(null, false, false, (env, theme) => {
    assert.equal(theme.preference.value, "system");
    assert.equal(env.state.dark, false);
    env.setSystem(true);
    assert.equal(env.state.dark, true);
    theme.preference.value = "light";
    assert.equal(env.state.dark, false);
    assert.equal(env.state.saved, "light");
    env.setSystem(false);
    env.setSystem(true);
    assert.equal(env.state.dark, false);
    theme.preference.value = "system";
    assert.equal(env.state.dark, true);
    assert.equal(env.state.saved, "system");
    assert.equal(env.state.style.colorScheme, "dark");
    assert.equal(env.state.meta, "#101b16");
  });
  withTheme("dark", false, false, (env, theme) => {
    assert.equal(env.state.dark, true);
    assert.equal(theme.preference.value, "dark");
  });
});

test("invalid or unavailable storage falls back to system and still permits manual switching", () => {
  for (const blocked of [false, true]) {
    withTheme("invalid", true, blocked, (env, theme) => {
      assert.equal(theme.preference.value, "system");
      assert.equal(env.state.dark, true);
      theme.preference.value = "light";
      assert.equal(env.state.dark, false);
      assert.equal(env.state.style.colorScheme, "light");
      assert.equal(env.state.meta, "#f8f9f5");
    });
  }
});

test("pre-paint bootstrap matches the reactive theme for every preference and system setting", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
  for (const saved of [null, "light", "dark", "system", "invalid"]) {
    for (const systemDark of [false, true]) {
      for (const blocked of [false, true]) {
        const { host, state } = browser(saved, systemDark, blocked);
        runInNewContext(script, host);
        const expected = resolveTheme(
          normalizeTheme(blocked ? null : saved),
          systemDark,
        );
        assert.equal(state.dark, expected === "dark");
        assert.equal(state.style.colorScheme, expected);
        assert.equal(state.meta, expected === "dark" ? "#101b16" : "#f8f9f5");
      }
    }
  }
});
