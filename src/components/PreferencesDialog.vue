<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { BookOpen, MapPin, Monitor, Moon, Sun } from "@lucide/vue";
import { languageOptions } from "@/i18n/locale";
import { themeOptions, type ThemePreference } from "@/lib/theme";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const open = defineModel<boolean>("open", { required: true });
const theme = defineModel<ThemePreference>("theme", { required: true });
const emit = defineEmits<{ help: [] }>();
const { t, locale } = useI18n();
const icons = { system: Monitor, light: Sun, dark: Moon };
const labels = { system: "themeSystem", light: "themeLight", dark: "themeDark" };
const canEditMaps = import.meta.env.DEV;
function showHelp() {
  open.value = false;
  emit("help");
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="preferences-dialog">
      <DialogHeader>
        <DialogTitle>{{ t("settings") }}</DialogTitle>
        <DialogDescription>{{ t("settingsDescription") }}</DialogDescription>
      </DialogHeader>
      <div class="preference-block">
        <h3>{{ t("theme") }}</h3>
        <div class="theme-options" role="group" :aria-label="t('theme')">
          <button v-for="option in themeOptions" :key="option" :aria-pressed="theme === option" @click="theme = option">
            <component :is="icons[option]" :size="18" />{{ t(labels[option]) }}
          </button>
        </div>
      </div>
      <div class="preference-language">
        <h3>{{ t("language") }}</h3>
        <Select v-model="locale">
          <SelectTrigger :aria-label="t('language')"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="option in languageOptions" :key="option.value" :value="option.value">
              <span :lang="option.value">{{ option.label }}</span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <button class="preference-link" @click="showHelp"><BookOpen :size="18" />{{ t("help") }}</button>
      <a v-if="canEditMaps" class="preference-link" href="?editor=1"><MapPin :size="18" />{{ t("editorLaunch") }}</a>
    </DialogContent>
  </Dialog>
</template>

<style>
.preferences-dialog { gap: 24px; }
.preference-block h3 { margin-bottom: 12px; }
.theme-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.theme-options button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 72px; border: 1px solid var(--border); border-radius: 10px; color: var(--text-secondary); font-size: 12px; }
.theme-options button[aria-pressed="true"] { background: var(--selected-surface); border-color: var(--selected-border); color: var(--selected-foreground); }
.preference-language { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.preference-language [data-slot="select-trigger"] { min-height: 44px; }
.preference-link { display: flex; align-items: center; gap: 10px; min-height: 44px; color: var(--text-secondary); font-size: 14px; }
</style>
