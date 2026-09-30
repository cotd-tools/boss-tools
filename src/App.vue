<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { languageOptions } from "@/i18n/locale";
import { themeOptions, useTheme } from "@/lib/theme";
import {
  Anchor,
  ArrowDownToLine,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock3,
  Compass,
  Copy,
  Droplets,
  Expand,
  Fish,
  Globe2,
  ImageIcon,
  Info,
  Languages,
  MapPin,
  Map as MapIcon,
  Monitor,
  Moon,
  Navigation,
  RotateCcw,
  Ship,
  Settings2,
  Sun,
  Waves,
  ZoomIn,
  ZoomOut,
} from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { maps, images, baseMaps, pointsFor, referencesFor } from "@/lib/maps";
import BoatMap from "@/components/BoatMap.vue";
import BoatMapPreview from "@/components/BoatMapPreview.vue";
import PreferencesDialog from "@/components/PreferencesDialog.vue";
import locationData from "@/data/boat-locations.json";
import { confirmedMarkers, validateLocations } from "@/lib/boat-locations";
import { createImageGestureTracker, imageSwipeDirection } from "@/lib/image-gestures";
import {
  bossCode,
  dateKey,
  duration,
  effectiveDate,
  formatDate,
  guessRegion,
  nextReset,
  parseDate,
  REGIONS,
  shiftDate,
  type RegionKey,
} from "@/lib/schedule";

const { t, locale } = useI18n();
const canEditMaps = import.meta.env.DEV;
const locations = validateLocations(locationData);
const mapViewerOpen = ref(false);
const isMobile = useMediaQuery("(max-width: 760px)");
const mapPickerOpen = ref(false);
const referenceView = ref("water");
const settingsOpen = ref(false);
const { preference: themePreference } = useTheme();
const themeIcons = { system: Monitor, light: Sun, dark: Moon };
const themeLabels = {
  system: "themeSystem",
  light: "themeLight",
  dark: "themeDark",
};
const mapName = (id: number) => t(`map${id}`);
const regionName = computed(() =>
  t(region.value === "us_ca" ? "regionNorthAmerica" : "regionOther"),
);
const resetHour = computed(() =>
  String(REGIONS[region.value].hour).padStart(2, "0"),
);

function loadRegion(): RegionKey {
  try {
    const saved = localStorage.getItem("cotd-region-pref");
    if (saved === "other" || saved === "us_ca") return saved;
  } catch {
    /* Storage may be unavailable in private browsing. */
  }
  return guessRegion();
}
const region = ref<RegionKey>(loadRegion());
const now = ref(new Date());
const live = computed(() =>
  effectiveDate(REGIONS[region.value].hour, now.value),
);
const followingLive = ref(true);
const selectedDate = ref(live.value);
const countdown = computed(() =>
  duration(
    nextReset(REGIONS[region.value].hour, now.value).getTime() -
      now.value.getTime(),
  ),
);
const code = computed(() => bossCode(selectedDate.value));
const view = ref("daily");
const selectedMap = ref(1);
const map = computed(() => maps.find((item) => item.id === selectedMap.value)!);
const activePoint = computed(() => Number(code.value[selectedMap.value - 1]));
const manualPoint = ref<number | null>(null);
const point = computed(() => manualPoint.value ?? activePoint.value);
const detailContext = computed(() => t(point.value === activePoint.value ? "guideDatePoint" : "browsingPoint", {
  date: followingLive.value ? t("today") : formatDate(selectedDate.value, locale.value),
  point: point.value,
}));
const references = computed(() =>
  referencesFor(selectedMap.value, point.value),
);
const baseMap = computed(() => baseMaps[selectedMap.value]!);
const boatMarkers = computed(() =>
  confirmedMarkers(locations, selectedMap.value, baseMap.value.revision),
);
const boatMarker = computed(() => boatMarkers.value[point.value]);
const waterImages = computed(() =>
  references.value.filter((item) => item.index > 0),
);
const waterIndex = ref(0);
const thumbnailList = ref<HTMLElement | null>(null);
watch(
  [waterIndex, () => waterImages.value[waterIndex.value]?.url, referenceView, view],
  () => {
    const list = thumbnailList.value;
    const active = list?.querySelector<HTMLElement>("button.active");
    if (!list || !active) return;
    const left =
      active.getBoundingClientRect().left -
      list.getBoundingClientRect().left +
      list.scrollLeft;
    list.scrollTo({
      left: left - (list.clientWidth - active.clientWidth) / 2,
      behavior: "instant",
    });
  },
  { flush: "post" },
);
const waterImage = computed(() => waterImages.value[waterIndex.value]);
const toast = ref<"copied" | "">("");
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function notify(message: "copied") {
  toast.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = ""), 3200);
}

watch(region, (value) => {
  try {
    localStorage.setItem("cotd-region-pref", value);
  } catch {
    /* Best effort. */
  }
});
watch(
  () => dateKey(live.value),
  () => {
    if (followingLive.value) selectedDate.value = live.value;
  },
);
watch([selectedMap, selectedDate], () => {
  manualPoint.value = null;
});
watch(point, () => {
  waterIndex.value = 0;
});
watch(selectedMap, () => {
  waterIndex.value = 0;
});
const ticker = setInterval(() => (now.value = new Date()), 1000);
onUnmounted(() => {
  clearInterval(ticker);
  clearTimeout(toastTimer);
});

function chooseDate(date: Date, follow = false) {
  selectedDate.value = date;
  followingLive.value = follow;
  manualPoint.value = null;
}
function handleDate(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = parseDate(input.value);
  if (value) chooseDate(value);
  else input.value = dateKey(selectedDate.value);
}
function quickDate(offset: number) {
  chooseDate(shiftDate(live.value, offset), offset === 0);
}
function selectMap(id: number) {
  if (selectedMap.value === id) return;
  selectedMap.value = id;
  manualPoint.value = null;
  referenceView.value = "water";
}
async function showDetail(id: number, preserveSelection = false) {
  selectMap(id);
  if (!preserveSelection) {
    manualPoint.value = null;
    referenceView.value = "water";
  }
  view.value = "atlas";
  await nextTick();
  window.scrollTo({ top: 0, behavior: "instant" });
  document.getElementById("detail-heading")?.focus({ preventScroll: true });
}
async function showOverview() {
  view.value = "daily";
  await nextTick();
  window.scrollTo({ top: 0, behavior: "instant" });
  document.getElementById("daily-heading")?.focus({ preventScroll: true });
}
function chooseMobileMap(id: number) {
  mapPickerOpen.value = false;
  showDetail(id, true);
}
async function showBait() {
  referenceView.value = "water";
  await nextTick();
  window.scrollTo({ top: 0, behavior: "instant" });
  document.getElementById("detail-heading")?.focus({ preventScroll: true });
}
function changeWater(delta: number) {
  if (waterImages.value.length < 2) return;
  waterIndex.value =
    (waterIndex.value + delta + waterImages.value.length) %
    waterImages.value.length;
}

const copyOpen = ref(false);
const copyText = computed(() =>
  [
    t("copyHeader", {
      date: formatDate(selectedDate.value, locale.value, true),
      region: regionName.value,
      hour: resetHour.value,
    }),
    ...maps.map((item) =>
      t("copyLine", {
        map: item.id,
        name: mapName(item.id),
        point: code.value[item.id - 1],
      }),
    ),
    t("copyFooter"),
  ].join("\n"),
);
async function copyPositions() {
  try {
    await navigator.clipboard.writeText(copyText.value);
    notify("copied");
  } catch {
    copyOpen.value = true;
  }
}

const viewerOpen = ref(false);
const viewerIndex = ref(0);
const zoom = ref(1);
const viewerStage = ref<HTMLElement | null>(null);
const viewerGesture = createImageGestureTracker();
function startViewerGesture(event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0) {
    viewerGesture.start(null);
    return;
  }
  viewerGesture.start({
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    left: viewerStage.value?.scrollLeft ?? 0,
    top: viewerStage.value?.scrollTop ?? 0,
    pan: zoom.value > 1 && event.pointerType === "mouse" && !(event.target as HTMLElement).closest("button"),
  });
  // Keep a swipe alive outside the frame, without retargeting a button's click.
  const target = (event.target as Element).closest("button") ?? (event.currentTarget as HTMLElement);
  target.setPointerCapture(event.pointerId);
}
function moveViewerGesture(event: PointerEvent) {
  const movement = viewerGesture.move(event.pointerId, event.clientX, event.clientY);
  if (!movement) return;
  const { gesture, dx, dy } = movement;
  if (gesture.pan && viewerStage.value) {
    viewerStage.value.scrollLeft = gesture.left - dx;
    viewerStage.value.scrollTop = gesture.top - dy;
  }
}
function endViewerGesture(event: PointerEvent) {
  const movement = viewerGesture.end(event.pointerId, event.clientX, event.clientY);
  if (!movement) return;
  const { dx, dy } = movement;
  const direction = imageSwipeDirection(dx, dy, zoom.value, references.value.length);
  if (direction) nextImage(direction);
}
function cancelViewerGesture(event: PointerEvent) {
  viewerGesture.cancel(event.pointerId);
}
function preventDragClick(event: MouseEvent) {
  if (viewerGesture.consumeClick(event.detail)) {
    event.preventDefault();
    event.stopPropagation();
  }
}
watch([viewerOpen, viewerIndex], () => {
  viewerStage.value?.scrollTo({ left: 0, top: 0, behavior: "instant" });
  viewerGesture.reset();
}, { flush: "post" });
watch(zoom, async (value, previous) => {
  const stage = viewerStage.value;
  if (!stage) return;
  const left = (stage.scrollLeft + stage.clientWidth / 2) * value / previous - stage.clientWidth / 2;
  const top = (stage.scrollTop + stage.clientHeight / 2) * value / previous - stage.clientHeight / 2;
  await nextTick();
  stage.scrollTo({ left: value === 1 ? 0 : left, top: value === 1 ? 0 : top, behavior: "instant" });
});
const viewerImage = computed(() => references.value[viewerIndex.value]);
function openImage(index: number) {
  viewerIndex.value = index;
  zoom.value = 1;
  viewerOpen.value = true;
}
function nextImage(delta: number) {
  if (references.value.length < 2) return;
  viewerIndex.value =
    (viewerIndex.value + delta + references.value.length) %
    references.value.length;
  zoom.value = 1;
  waterIndex.value = waterImages.value.findIndex((item) => item === viewerImage.value);
}
function viewerKeys(event: KeyboardEvent) {
  if (event.key === "ArrowRight") {
    event.preventDefault();
    nextImage(1);
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    nextImage(-1);
  }
}
const helpOpen = ref(false);
</script>

<template>
  <div class="app-shell field-guide" :data-locale="locale" :data-view="view">
    <aside class="sidebar">
      <a
        class="brand"
        href="#"
        :aria-label="t('home')"
        @click.prevent="
          view = 'daily';
          quickDate(0);
        "
      >
        <span class="brand-mark"><Waves :size="25" /></span>
        <span
          ><strong>{{ t("brandName") }}</strong
          ><small>{{ t("brandSubtitle") }}</small></span
        >
      </a>
      <div class="sidebar-label">{{ t("tools") }} <span>01 — 08</span></div>
      <nav class="primary-nav" :aria-label="t('mainNav')">
        <button :class="{ selected: view === 'daily' }" @click="showOverview">
          <Compass :size="18" />{{ t("daily") }}<ArrowRight :size="15" />
        </button>
        <button :class="{ selected: view === 'atlas' }" @click="showDetail(selectedMap, true)">
          <BookOpen :size="18" />{{ t("atlas")
          }}<Badge variant="secondary">{{ images.length }}</Badge>
        </button>
      </nav>
      <div class="sidebar-label map-label">
        {{ t("destinations") }} <span>01 — 08</span>
      </div>
      <nav class="map-nav" :aria-label="t('mapNav')">
        <button
          v-for="item in maps"
          :key="item.id"
          :class="{ selected: selectedMap === item.id }"
          :aria-current="selectedMap === item.id ? 'true' : undefined"
          @click="showDetail(item.id, true)"
        >
          <span class="map-number">{{ String(item.id).padStart(2, "0") }}</span
          ><span>{{ mapName(item.id) }}</span
          ><span class="nav-point">{{ code[item.id - 1] }}</span>
        </button>
      </nav>
      <div class="sidebar-bottom">
        <div class="field-note">
          <Anchor :size="20" /><strong>{{ t("fieldTitle") }}</strong>
          <p>{{ t("fieldBody") }}</p>
        </div>
        <button class="help-link" @click="helpOpen = true">
          <Info :size="16" />{{ t("help") }}<ArrowRight :size="14" />
        </button>
        <div class="community-label">
          <span class="status-dot" />{{ t("community") }}
        </div>
      </div>
    </aside>
    <main class="main-content">
      <header class="topbar">
        <button v-if="isMobile && view === 'atlas'" class="guide-back" @click="showOverview" :aria-label="t('mobileOverview')">
          <ArrowLeft :size="20" /><span>{{ t('dailyTitle') }}</span>
        </button>
        <button
          class="mobile-brand"
          :aria-label="t('mobileOverview')"
          @click="showOverview"
        >
          <Waves :size="23" /><strong>{{ t("brandName") }}</strong>
        </button>
        <span class="breadcrumb"
          >{{ t("tools") }}<ChevronRight :size="13" /><strong>{{
            t(view === "daily" ? "daily" : "atlas")
          }}</strong></span
        >
        <button v-if="isMobile" class="mobile-settings" :aria-label="t('settings')" @click="settingsOpen = true"><Settings2 :size="20" /></button>
        <div v-else class="topbar-actions">
          <a
            v-if="canEditMaps"
            class="editor-launch"
            href="?editor=1"
            :aria-label="t('editorTitle')"
            ><MapPin :size="16" /><span>{{ t("editorLaunch") }}</span></a
          >
          <Select v-model="themePreference">
            <SelectTrigger
              class="theme-select"
              :aria-label="t('theme')"
              :title="`${t('theme')}: ${t(themeLabels[themePreference])}`"
            >
              <component
                :is="themeIcons[themePreference]"
                :size="16"
                aria-hidden="true"
              />
              <SelectValue class="sr-only">{{
                t(themeLabels[themePreference])
              }}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in themeOptions"
                :key="option"
                :value="option"
              >
                <component
                  :is="themeIcons[option]"
                  :size="15"
                  aria-hidden="true"
                />
                {{ t(themeLabels[option]) }}
              </SelectItem>
            </SelectContent>
          </Select>
          <div class="language-select">
            <Languages :size="15" />
            <Select v-model="locale"
              ><SelectTrigger :aria-label="t('language')"
                ><SelectValue /></SelectTrigger
              ><SelectContent
                ><SelectItem
                  v-for="option in languageOptions"
                  :key="option.value"
                  :value="option.value"
                  ><span :lang="option.value">{{
                    option.label
                  }}</span></SelectItem
                ></SelectContent
              ></Select
            >
          </div>
          <button
            class="guide-button"
            @click="helpOpen = true"
            :aria-label="t('help')"
          >
            <Info :size="15" /><span>{{ t("help") }}</span>
          </button>
        </div>
      </header>
      <div v-if="view === 'daily'" class="daily-intro">
        <p>{{ t('heroDescription') }}</p>
        <span><Clock3 :size="14" />{{ t('nextReset') }} <strong>{{ countdown }}</strong></span>
      </div>
      <section
        v-if="view === 'daily'"
        class="daily-section"
        aria-labelledby="daily-heading"
      >
        <div class="section-heading">
          <div>
            <p class="section-kicker">{{ t("dailyKicker") }}</p>
            <h2 id="daily-heading" tabindex="-1">
              {{ t(followingLive ? "dailyTitle" : "queryTitle")
              }}<Badge v-if="followingLive && !isMobile" class="live-badge"
                ><span class="status-dot" />{{ t("effective") }}</Badge
              ><Badge v-else-if="!followingLive" variant="outline">{{
                formatDate(selectedDate, locale)
              }}</Badge>
            </h2>
          </div>
          <Button variant="outline" class="copy-button" @click="copyPositions"
            ><Copy :size="15" />{{ t("copyAll") }}</Button
          >
        </div>
        <div class="date-toolbar">
          <div class="date-controls">
            <Button
              variant="ghost"
              size="icon"
              :aria-label="t('previousDay')"
              @click="chooseDate(shiftDate(selectedDate, -1))"
              ><ChevronLeft
            /></Button>
            <input
              :aria-label="t('queryDate')"
              :lang="locale"
              type="date"
              :value="dateKey(selectedDate)"
              min="0001-01-01"
              max="9999-12-31"
              @change="handleDate"
            />
            <Button
              variant="ghost"
              size="icon"
              :aria-label="t('nextDay')"
              @click="chooseDate(shiftDate(selectedDate, 1))"
              ><ChevronRight
            /></Button>
            <div class="quick-dates">
              <button
                :class="{
                  active:
                    dateKey(selectedDate) === dateKey(shiftDate(live, -1)),
                }"
                @click="quickDate(-1)"
              >
                {{ t("yesterday") }}
              </button>
              <button :class="{ active: followingLive }" @click="quickDate(0)">
                {{ t("today") }}
              </button>
              <button
                :class="{
                  active: dateKey(selectedDate) === dateKey(shiftDate(live, 1)),
                }"
                @click="quickDate(1)"
              >
                {{ t("tomorrow") }}
              </button>
            </div>
          </div>
          <div class="region-select">
            <Globe2 :size="15" /><Select v-model="region"
              ><SelectTrigger :aria-label="t('serverRegion')"
                ><SelectValue
                  >{{ regionName }} · {{ resetHour }}:00</SelectValue
                ></SelectTrigger
              ><SelectContent
                ><SelectItem value="other"
                  >{{ t("regionOther") }} · 04:00</SelectItem
                ><SelectItem value="us_ca"
                  >{{ t("regionNorthAmerica") }} · 05:00</SelectItem
                ></SelectContent
              ></Select
            >
          </div>
        </div>
        <div class="coordinates-grid">
          <button
            v-for="item in maps"
            :key="item.id"
            class="coordinate-card"
            :class="{ selected: selectedMap === item.id }"
            :aria-label="
              t('viewSpot', {
                map: item.id,
                name: mapName(item.id),
                point: code[item.id - 1],
              })
            "
            @click="showDetail(item.id)"
          >
            <div class="coordinate-top">
              <span>{{
                t("mapNumber", { map: String(item.id).padStart(2, "0") })
              }}</span
              ><ArrowRight :size="15" />
            </div>
            <div class="coordinate-middle">
              <strong>{{ mapName(item.id) }}</strong
              ><span class="coordinate-value"
                >{{ code[item.id - 1] }}<small>{{ t("spotUnit") }}</small></span
              >
            </div>
            <div class="coordinate-bottom">
              <span class="tiny-dot" />{{
                t(
                  selectedMap === item.id && point === Number(code[item.id - 1])
                    ? "viewing"
                    : "viewDaily",
                )
              }}
            </div>
          </button>
        </div>
        <p class="date-hint"><Clock3 :size="13" />{{ t("dateHint") }}</p>
      </section>
      <section
        v-if="view === 'atlas'"
        id="location-detail"
        class="detail-section"
        aria-labelledby="detail-heading"
      >
        <div class="guide-heading">
          <h1 id="detail-heading" tabindex="-1">
            <button class="guide-destination" :aria-label="t('selectDestination', { name: mapName(selectedMap) })" aria-haspopup="dialog" @click="mapPickerOpen = true">
              <MapPin :size="23" /><span>{{ mapName(selectedMap) }}</span><ChevronDown :size="20" />
            </button>
          </h1>
          <div class="guide-context"><span>{{ t('mapNumber', { map: String(selectedMap).padStart(2, '0') }) }}</span><span>{{ detailContext }}</span></div>
        </div>
        <div class="detail-controls">
        <div class="detail-toolbar">
          <div class="point-selector">
            <span>{{ t("choosePoint") }}</span
            ><button
              v-for="n in pointsFor(map)"
              :key="n"
              :class="{ active: point === n }"
              :aria-pressed="point === n"
              :aria-label="
                t(n === activePoint ? 'activePointLabel' : 'pointLabel', {
                  point: n,
                })
              "
              @click="manualPoint = n"
            >
              {{ n }}<span v-if="n === activePoint" class="point-marker" />
            </button>
          </div>
          <button
            v-if="point !== activePoint"
            class="return-point"
            @click="manualPoint = null"
          >
            <RotateCcw :size="13" />{{
              t("returnPoint", { point: activePoint })
            }}
          </button>
        </div>
        <div class="guide-tabs" role="group" :aria-label="t('referenceType')">
          <button :aria-pressed="referenceView === 'water'" @click="referenceView = 'water'">
            <ImageIcon :size="20" />{{ t('waterTab') }}
          </button>
          <button :aria-pressed="referenceView === 'map'" @click="referenceView = 'map'">
            <MapIcon :size="20" />{{ t('mapTab') }}
          </button>
        </div>
        </div>
        <div class="guide-grid" :data-reference="referenceView">
          <article v-show="referenceView === 'water'" class="water-panel">
            <div class="panel-title"><h2>{{ t('waterTitle') }}</h2><span>{{ t('photoCount', waterImages.length) }}</span></div>
            <button
              v-if="waterImage"
              class="reference-stage"
              :aria-label="
                t('enlargeWater', {
                  name: mapName(selectedMap),
                  point,
                  index: waterImage.index,
                })
              "
              @click="openImage(references.indexOf(waterImage))"
              @keydown.right.prevent="changeWater(1)"
              @keydown.left.prevent="changeWater(-1)"
            >
              <img
                :key="waterImage.url"
                :src="waterImage.url"
                :alt="
                  t('waterAlt', {
                    name: mapName(selectedMap),
                    point,
                    index: waterImage.index,
                  })
                "
              />
              <span class="guide-expand" aria-hidden="true"><Expand :size="22" /></span>
            </button>
            <div v-else class="no-water">
              <ImageIcon :size="36" /><strong>{{ t("missingWater") }}</strong>
              <p>{{ t("missingWaterHint") }}</p>
            </div>
            <div v-if="waterImages.length > 1" class="photo-navigation">
              <Button variant="outline" :aria-label="t('previousImage')" @click="changeWater(-1)"><ArrowLeft :size="19" />{{ t('viewerPrevious') }}</Button>
              <span role="status" aria-live="polite" aria-atomic="true">{{ waterIndex + 1 }} / {{ waterImages.length }}</span>
              <Button :aria-label="t('nextImage')" @click="changeWater(1)">{{ t('viewerNext') }}<ArrowRight :size="19" /></Button>
            </div>
            <div v-if="waterImages.length > 1" ref="thumbnailList" class="photo-thumbnails" :aria-label="t('placementReference')">
              <button v-for="(item, index) in waterImages" :key="item.filename"
                :class="{ active: waterIndex === index }" :aria-label="t('switchWater', { index: item.index })"
                :aria-pressed="waterIndex === index" @click="waterIndex = index">
                <img :src="item.url" alt="" loading="lazy" /><span>{{ item.index }}</span>
              </button>
            </div>
            <p class="guide-photo-hint"><Info :size="17" />{{ t('photoInstruction') }}</p>
            <button class="map-summary" @click="referenceView = 'map'" :aria-label="t('viewBoatPosition')">
              <BoatMapPreview :src="baseMap.url" :markers="boatMarkers" :selected="point" />
              <span class="map-summary-copy"><strong><MapPin :size="20" />{{ t('mapTitle') }}</strong><span>{{ t(boatMarker ? 'mapPreviewHint' : 'markerPendingHint') }}</span></span>
              <ChevronRight :size="20" />
            </button>
          </article>
          <aside v-show="referenceView === 'map'" class="location-side">
            <article class="map-panel">
              <div class="panel-title">
                <div>
                  <span class="step-number">01</span>
                  <h3>{{ t("mapTitle") }}</h3>
                </div>
                <Navigation :size="16" />
              </div>
              <BoatMap
                :src="baseMap.url"
                :alt="t('baseMapAlt', { name: mapName(selectedMap) })"
                :markers="boatMarkers"
                :selected="point"
                @select="manualPoint = $event"
              />
              <div class="map-actions">
                <Button variant="outline" @click="mapViewerOpen = true"><Expand :size="14" />{{ t("viewMap") }}</Button>
                <Button @click="showBait"><Droplets :size="14" />{{ t("viewBait") }}<ArrowRight :size="14" /></Button>
              </div>
              <div class="boat-map-status">
                <strong>{{
                  t(boatMarker ? "markerSelected" : "markerPending", { point })
                }}</strong>
                <p>
                  {{ boatMarker ? t("mapCaption") : t("markerPendingHint") }}
                </p>
                <p v-if="boatMarker?.note">{{ boatMarker.note }}</p>
              </div>
            </article>
            <article class="fishing-note">
              <div class="note-heading">
                <Fish :size="18" />
                <h3>{{ t("stepsTitle") }}</h3>
              </div>
              <ol>
                <li v-for="step in 3" :key="step">
                  <span>{{ step }}</span
                  >{{ t(`step${step}`) }}
                </li>
              </ol>
              <div class="note-bottom">
                <Waves :size="16" /><span>{{ t("stepsNote") }}</span>
              </div>
            </article>
          </aside>
        </div>
      </section>
      <footer>
        <span
          ><Waves :size="16" />{{ t("brandName")
          }}<span class="footer-divider">/</span>{{ t("footerTagline") }}</span
        ><span>{{ t("disclaimer") }}</span>
      </footer>
    </main>
    <nav class="mobile-dock" :aria-label="t('mainNav')">
      <button :aria-current="view === 'daily' ? 'page' : undefined" @click="showOverview">
        <MapPin :size="23" /><span>{{ t('dailyTitle') }}</span>
      </button>
      <button :aria-current="view === 'atlas' ? 'page' : undefined" @click="showDetail(selectedMap, true)">
        <BookOpen :size="23" /><span>{{ t('atlas') }}</span>
      </button>
    </nav>
    <PreferencesDialog v-model:open="settingsOpen" v-model:theme="themePreference" @help="helpOpen = true" />
    <Dialog v-model:open="mapViewerOpen">
      <DialogContent class="boat-map-dialog">
        <DialogHeader
          ><DialogTitle>{{
            t("mapAlt", { name: mapName(selectedMap), point })
          }}</DialogTitle
          ><DialogDescription>{{
            t("mapCaption")
          }}</DialogDescription></DialogHeader
        >
        <BoatMap
          :src="baseMap.url"
          :alt="t('baseMapAlt', { name: mapName(selectedMap) })"
          :markers="boatMarkers"
          :selected="point"
          @select="manualPoint = $event"
        />
        <p class="boat-map-status">
          {{ t(boatMarker ? "markerSelected" : "markerPending", { point })
          }}<span v-if="boatMarker?.note"> · {{ boatMarker.note }}</span>
        </p>
      </DialogContent>
    </Dialog>
    <Dialog v-model:open="mapPickerOpen">
      <DialogContent class="map-picker-dialog">
        <DialogHeader>
          <DialogTitle>{{ t("destinations") }}</DialogTitle>
          <DialogDescription>{{
            t("mapPickerHint", { date: formatDate(selectedDate, locale) })
          }}</DialogDescription>
        </DialogHeader>
        <div class="map-picker-grid">
          <button
            v-for="item in maps"
            :key="item.id"
            :aria-pressed="selectedMap === item.id"
            @click="chooseMobileMap(item.id)"
          >
            <span class="map-number">{{
              t("mapNumber", { map: item.id })
            }}</span>
            <strong>{{ mapName(item.id) }}</strong>
            <span class="picker-point"
              >{{ t("pointLabel", { point: selectedMap === item.id ? point : code[item.id - 1] })
              }}<ArrowRight :size="15"
            /></span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
    <Transition name="toast"
      ><div v-if="toast" class="toast-message" role="status">
        <Check :size="17" />{{ t(toast) }}
      </div></Transition
    >
    <Dialog v-model:open="viewerOpen">
      <DialogContent class="image-dialog" @keydown="viewerKeys">
        <DialogHeader
          ><DialogTitle>{{
            t("viewerTitle", { name: mapName(selectedMap), point })
          }}</DialogTitle
          ><DialogDescription>{{
            t("viewerWaterDescription", { index: viewerImage?.index ?? 1 })
          }}</DialogDescription></DialogHeader
        >
        <div
          class="viewer-frame"
          :class="{ 'is-zoomed': zoom > 1 }"
          @pointerdown="startViewerGesture"
          @pointermove="moveViewerGesture"
          @pointerup="endViewerGesture"
          @pointercancel="cancelViewerGesture"
          @lostpointercapture="cancelViewerGesture"
          @click.capture="preventDragClick"
        >
        <div ref="viewerStage" class="viewer-stage">
          <img
            v-if="viewerImage"
            :src="viewerImage.url"
            draggable="false"
            :alt="
              t('waterAlt', {
                name: mapName(selectedMap),
                point,
                index: viewerImage.index,
              })
            "
            :style="{
              width: `${zoom * 100}%`,
              height: `${zoom * 100}%`,
              maxWidth: 'none',
            }"
          />
        </div>
        <template v-if="references.length > 1">
          <button class="viewer-edge viewer-edge-previous" :aria-label="t('previousImage')" :title="t('previousImage')" @click="nextImage(-1)"><span><ChevronLeft :size="28" /></span></button>
          <button class="viewer-edge viewer-edge-next" :aria-label="t('nextImage')" :title="t('nextImage')" @click="nextImage(1)"><span><ChevronRight :size="28" /></span></button>
        </template>
        </div>
        <div v-if="isMobile && references.length > 1" class="viewer-navigation">
          <Button variant="outline" :aria-label="t('previousImage')" @click="nextImage(-1)"><ChevronLeft />{{ t('viewerPrevious') }}</Button>
          <span role="status" aria-live="polite" aria-atomic="true">{{ viewerIndex + 1 }} / {{ references.length }}</span>
          <Button variant="outline" :aria-label="t('nextImage')" @click="nextImage(1)">{{ t('viewerNext') }}<ChevronRight /></Button>
        </div>
        <div class="viewer-toolbar">
          <div v-if="!isMobile || references.length < 2" class="viewer-progress">
            <span role="status" aria-live="polite" aria-atomic="true">{{ viewerIndex + 1 }} / {{ references.length }}</span>
          </div>
          <div>
            <Button
              variant="ghost"
              size="icon"
              :aria-label="t('zoomOut')"
              :disabled="zoom <= 1"
              @click="zoom = Math.max(1, zoom - 0.5)"
              ><ZoomOut /></Button
            ><button
              class="zoom-reset"
              :aria-label="t('resetZoom')"
              @click="zoom = 1"
            >
              {{ Math.round(zoom * 100) }}%</button
            ><Button
              variant="ghost"
              size="icon"
              :aria-label="t('zoomIn')"
              :disabled="zoom >= 3"
              @click="zoom = Math.min(3, zoom + 0.5)"
              ><ZoomIn /></Button
            ><Button variant="outline" size="icon" as-child
              ><a
                :href="viewerImage?.url"
                target="_blank"
                rel="noopener"
                :aria-label="t('openOriginal')"
                ><ArrowDownToLine /></a
            ></Button>
          </div>
        </div>
        <p class="viewer-hint">{{ t(zoom > 1 ? 'viewerPanHint' : references.length > 1 ? (isMobile ? 'viewerSwipeHint' : 'viewerNavigationHint') : 'viewerSingleHint') }}</p>
      </DialogContent>
    </Dialog>
    <Dialog v-model:open="copyOpen"
      ><DialogContent
        ><DialogHeader
          ><DialogTitle>{{ t("copyTitle") }}</DialogTitle
          ><DialogDescription>{{
            t("copyDescription")
          }}</DialogDescription></DialogHeader
        ><textarea
          class="copy-fallback"
          readonly
          :value="copyText"
          :aria-label="t('copyTextLabel')"
          @focus="($event.target as HTMLTextAreaElement).select()"
        /></DialogContent
    ></Dialog>
    <Dialog v-model:open="helpOpen"
      ><DialogContent class="help-dialog"
        ><DialogHeader
          ><DialogTitle>{{ t("helpTitle") }}</DialogTitle
          ><DialogDescription>{{
            t("helpSubtitle")
          }}</DialogDescription></DialogHeader
        >
        <div class="help-section">
          <Ship />
          <div>
            <h3>{{ t("helpPositionTitle") }}</h3>
            <p>{{ t("helpPositionBody") }}</p>
          </div>
        </div>
        <div class="help-section">
          <Droplets />
          <div>
            <h3>{{ t("helpBaitTitle") }}</h3>
            <p>{{ t("helpBaitBody") }}</p>
            <p>{{ t("helpBaitOptional") }}</p>
          </div>
        </div>
        <div class="help-section">
          <Clock3 />
          <div>
            <h3>{{ t("helpResetTitle") }}</h3>
            <p>{{ t("helpResetBody") }}</p>
          </div>
        </div>
        <div class="help-section">
          <BookOpen />
          <div>
            <h3>{{ t("helpAtlasTitle") }}</h3>
            <p>{{ t("helpAtlasBody") }}</p>
          </div>
        </div>
        <p class="help-disclaimer">{{ t("helpDataNote") }}</p>
      </DialogContent></Dialog
    >
  </div>
</template>
