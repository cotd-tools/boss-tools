import { test } from "node:test";
import assert from "node:assert/strict";
import { createAppI18n, messages } from "../src/i18n/index.ts";
import { resolveLocale, supportedLocales } from "../src/i18n/locale.ts";
import { formatDate } from "../src/lib/schedule.ts";

test("saved language takes priority; browser variants and unsupported languages fall back safely", () => {
  assert.equal(resolveLocale("zh-CN", ["en-US"]), "zh-CN");
  assert.equal(resolveLocale("en", ["zh-CN"]), "en");
  assert.equal(resolveLocale(null, ["fr-FR", "en-GB"]), "en");
  assert.equal(resolveLocale("unknown", ["zh-TW"]), "zh-CN");
  assert.equal(resolveLocale(null, ["EN_us"]), "en");
  assert.equal(resolveLocale(null, ["ja-JP"]), "zh-CN");
  assert.equal(resolveLocale(null, []), "zh-CN");
});

test("all languages provide the same keys and interpolation values", () => {
  const expected = messages["zh-CN"];
  const placeholders = (message: string) =>
    [
      ...new Set([...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1])),
    ].sort();
  for (const locale of supportedLocales) {
    const actual = messages[locale];
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort());
    for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
      assert.ok(actual[key].trim(), `${locale}.${key} is empty`);
      assert.deepEqual(
        placeholders(actual[key]),
        placeholders(expected[key]),
        `${locale}.${key}`,
      );
    }
  }
});

test("messages render without compiler errors and plural forms follow the selected language", () => {
  const warnings: string[] = [];
  const warn = console.warn;
  const error = console.error;
  console.warn = (...args) => warnings.push(args.join(" "));
  console.error = (...args) => warnings.push(args.join(" "));
  try {
    const i18n = createAppI18n("en");
    const values = {
      count: 2,
      date: "2026-09-24",
      region: "North America",
      hour: "05",
      name: "Thailand",
      map: 7,
      point: 3,
      index: 1,
      area: "approximate area",
    };
    for (const locale of supportedLocales) {
      i18n.global.locale.value = locale;
      for (const key of Object.keys(messages[locale])) {
        const text = i18n.global.t(key, values);
        assert.notEqual(text, key);
        assert.doesNotMatch(text, /\{\w+\}/);
        if (locale === "en") assert.doesNotMatch(text, /\p{Script=Han}/u);
      }
    }
    i18n.global.locale.value = "en";
    assert.equal(i18n.global.t("photoCount", 1), "1 photo");
    assert.equal(i18n.global.t("photoCount", 2), "2 photos");
    assert.equal(i18n.global.t("photoCount", 0), "0 photos");
    assert.equal(i18n.global.t("copyLine", values), "Map 7 — Thailand: spot 3");
    i18n.global.locale.value = "zh-CN";
    assert.equal(i18n.global.t("photoCount", 1), "1 张");
    assert.equal(i18n.global.t("close"), "关闭");
    i18n.dispose();
    assert.deepEqual(warnings, []);
  } finally {
    console.warn = warn;
    console.error = error;
  }
});

test("localized dates keep the same calendar day regardless of the device timezone", () => {
  const previous = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    const date = new Date("2026-09-24T00:00:00Z");
    assert.match(formatDate(date, "zh-CN", true), /2026年9月24日/);
    assert.match(formatDate(date, "en", true), /September 24, 2026/);
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
