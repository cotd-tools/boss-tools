import { createI18n } from "vue-i18n";
import zhCN from "./locales/zh-CN.json" with { type: "json" };
import en from "./locales/en.json" with { type: "json" };
import type { AppLocale } from "./locale.ts";

export const messages = { "zh-CN": zhCN, en };

export function createAppI18n(locale: AppLocale) {
  return createI18n<[typeof zhCN], AppLocale, false>({
    legacy: false,
    locale,
    fallbackLocale: "zh-CN",
    messages,
  });
}
