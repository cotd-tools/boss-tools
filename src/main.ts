import { createApp, watch } from "vue";
import App from "./App.vue";
import "./style.css";
import { createAppI18n } from "./i18n";
import { LOCALE_STORAGE_KEY, resolveLocale } from "./i18n/locale";

let savedLanguage: string | null = null;
try {
  savedLanguage = localStorage.getItem(LOCALE_STORAGE_KEY);
} catch {
  /* Optional preference. */
}
const i18n = createAppI18n(resolveLocale(savedLanguage, navigator.languages));
watch(
  i18n.global.locale,
  (locale) => {
    document.documentElement.lang = locale;
    document.title = i18n.global.t("pageTitle");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", i18n.global.t("pageDescription"));
  },
  { immediate: true },
);
watch(i18n.global.locale, (locale) => {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* Keep switching available without storage. */
  }
});
createApp(App).use(i18n).mount("#app");
