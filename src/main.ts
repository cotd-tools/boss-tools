import { createApp, defineAsyncComponent, watch } from "vue";
import "./style.css";
import "./mobile.css";
import "./field-guide.css";
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
const Root = defineAsyncComponent(
  import.meta.env.DEV &&
    new URLSearchParams(location.search).get("editor") === "1"
    ? () => import("./components/MapEditor.vue")
    : () => import("./App.vue"),
);
createApp(Root).use(i18n).mount("#app");
