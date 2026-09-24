<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { languageOptions } from "@/i18n/locale";
import {
  Anchor,
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
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
  Navigation,
  RotateCcw,
  Ship,
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
import { maps, images, pointsFor, referencesFor } from "@/lib/maps";
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
const mapName = (id: number) => t(`map${id}`);
const englishMapName = (id: number) => t(`map${id}`, {}, { locale: "en" });
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
const references = computed(() =>
  referencesFor(selectedMap.value, point.value),
);
const mapImage = computed(() =>
  references.value.find((item) => item.index === 0),
);
const waterImages = computed(() =>
  references.value.filter((item) => item.index > 0),
);
const waterIndex = ref(0);
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
  selectedMap.value = id;
  manualPoint.value = null;
}
function showDetail(id: number) {
  selectMap(id);
  document.getElementById("location-detail")?.scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
    block: "start",
  });
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
const viewerImage = computed(() => references.value[viewerIndex.value]);
function openImage(index: number) {
  viewerIndex.value = index;
  zoom.value = 1;
  viewerOpen.value = true;
}
function nextImage(delta: number) {
  viewerIndex.value =
    (viewerIndex.value + delta + references.value.length) %
    references.value.length;
  zoom.value = 1;
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
  <div class="app-shell" :data-locale="locale">
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
        <button :class="{ selected: view === 'daily' }" @click="view = 'daily'">
          <Compass :size="18" />{{ t("daily") }}<ArrowRight :size="15" />
        </button>
        <button :class="{ selected: view === 'atlas' }" @click="view = 'atlas'">
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
          @click="selectMap(item.id)"
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
        <span class="breadcrumb"
          >{{ t("tools") }}<ChevronRight :size="13" /><strong>{{
            t(view === "daily" ? "daily" : "atlas")
          }}</strong></span
        >
        <div class="topbar-actions">
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
      <section class="hero">
        <div class="contours" aria-hidden="true">
          <div />
          <div />
          <div />
          <div />
          <div />
          <div />
        </div>
        <div class="hero-content">
          <p class="eyebrow"><span /> CREATURES OF THE DEEP</p>
          <h1>{{ t("heroTitle") }}</h1>
          <p class="hero-description">{{ t("heroDescription") }}</p>
          <div class="hero-tags">
            <span><MapPin :size="14" />{{ t("mapCount", maps.length) }}</span
            ><span
              ><ImageIcon :size="14" />{{
                t("referenceCount", images.length)
              }}</span
            >
          </div>
        </div>
        <div class="reset-card">
          <div class="reset-label">
            <span class="status-dot" />{{
              t("activeDate", { date: formatDate(live, locale) })
            }}
          </div>
          <div class="reset-caption">{{ t("nextReset") }}</div>
          <div class="countdown">{{ countdown }}</div>
          <div class="reset-region">
            <Globe2 :size="13" />{{ regionName }} · {{ resetHour }}:00<span>{{
              t("deviceTime")
            }}</span>
          </div>
        </div>
      </section>
      <section
        v-if="view === 'daily'"
        class="daily-section"
        aria-labelledby="daily-heading"
      >
        <div class="section-heading">
          <div>
            <p class="section-kicker">{{ t("dailyKicker") }}</p>
            <h2 id="daily-heading">
              {{ t(followingLive ? "dailyTitle" : "queryTitle")
              }}<Badge v-if="followingLive" class="live-badge"
                ><span class="status-dot" />{{ t("effective") }}</Badge
              ><Badge v-else variant="outline">{{
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
                ><SelectValue /></SelectTrigger
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
        id="location-detail"
        class="detail-section"
        aria-labelledby="detail-heading"
      >
        <div class="section-heading detail-heading">
          <div>
            <p class="section-kicker">
              {{ t("guideKicker")
              }}<span>/ {{ String(selectedMap).padStart(2, "0") }}</span>
            </p>
            <h2 id="detail-heading">
              {{ mapName(selectedMap)
              }}<span
                v-if="locale === 'zh-CN'"
                class="english-name"
                lang="en"
                >{{ englishMapName(selectedMap) }}</span
              >
            </h2>
          </div>
          <Badge variant="outline" class="map-badge"
            ><MapPin :size="12" />{{
              t("mapNumber", { map: selectedMap })
            }}</Badge
          >
        </div>
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
          <span v-else class="point-context"
            ><span class="tiny-dot" />{{
              t("pointContext", {
                date: formatDate(selectedDate, locale),
                point,
              })
            }}</span
          >
        </div>
        <div class="guide-grid">
          <article class="water-panel">
            <div class="panel-title">
              <div>
                <span class="step-number">02</span>
                <h3>{{ t("waterTitle") }}</h3>
                <Badge variant="secondary">{{
                  t("photoCount", waterImages.length)
                }}</Badge>
              </div>
              <span>{{ t("waitBubbles") }}</span>
            </div>
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
              <span class="image-tag"
                ><Droplets :size="13" />{{
                  t("waterPosition", { index: waterImage.index })
                }}</span
              ><span class="expand-label"
                ><Expand :size="14" />{{ t("enlarge") }}</span
              >
            </button>
            <div v-else class="no-water">
              <ImageIcon :size="36" /><strong>{{ t("missingWater") }}</strong>
              <p>{{ t("missingWaterHint") }}</p>
            </div>
            <div class="image-strip">
              <div class="thumbnail-list">
                <button
                  v-for="(item, index) in waterImages"
                  :key="item.filename"
                  :class="{ active: waterIndex === index }"
                  :aria-label="t('switchWater', { index: item.index })"
                  :aria-pressed="waterIndex === index"
                  @click="waterIndex = index"
                >
                  <img :src="item.url" alt="" loading="lazy" /><span>{{
                    item.index
                  }}</span>
                </button>
              </div>
              <span
                >{{ waterImages.length ? waterIndex + 1 : 0 }} /
                {{ waterImages.length
                }}<small>{{ t("placementReference") }}</small></span
              >
            </div>
            <div class="image-footnote">
              <Info :size="14" /><i18n-t keypath="waterHint" tag="p" scope="global"
                ><template #area
                  ><strong>{{ t("approximateArea") }}</strong></template
                ></i18n-t
              >
            </div>
          </article>
          <aside class="location-side">
            <article class="map-panel">
              <div class="panel-title">
                <div>
                  <span class="step-number">01</span>
                  <h3>{{ t("mapTitle") }}</h3>
                </div>
                <Navigation :size="16" />
              </div>
              <button
                v-if="mapImage"
                class="map-preview"
                :aria-label="
                  t('enlargeMap', { name: mapName(selectedMap), point })
                "
                @click="openImage(references.indexOf(mapImage))"
              >
                <img
                  :src="mapImage.url"
                  :alt="t('mapAlt', { name: mapName(selectedMap), point })"
                /><span><Expand :size="13" />{{ t("viewMap") }}</span>
              </button>
              <div v-else class="missing-map">
                <div class="map-grid-art"><MapPin :size="28" /></div>
                <strong>{{ t("missingMap") }}</strong>
                <p>{{ t("missingMapHint") }}</p>
                <Badge variant="outline">{{
                  t("mapPoint", { map: selectedMap, point })
                }}</Badge>
              </div>
              <p v-if="mapImage" class="map-caption">
                <MapPin :size="13" />{{ t("mapCaption") }}
              </p>
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
            viewerImage?.index === 0
              ? t("viewerMapDescription")
              : t("viewerWaterDescription", { index: viewerImage?.index ?? 1 })
          }}</DialogDescription></DialogHeader
        >
        <div class="viewer-stage">
          <img
            v-if="viewerImage"
            :src="viewerImage.url"
            :alt="
              t(viewerImage.index === 0 ? 'mapAlt' : 'waterAlt', {
                name: mapName(selectedMap),
                point,
                index: viewerImage.index,
              })
            "
            :style="{
              width: `${zoom * 100}%`,
              height: `${zoom * 60}dvh`,
              maxWidth: 'none',
            }"
          />
        </div>
        <div class="viewer-toolbar">
          <div>
            <Button
              variant="outline"
              size="icon"
              :aria-label="t('previousImage')"
              :disabled="references.length < 2"
              @click="nextImage(-1)"
              ><ChevronLeft /></Button
            ><span>{{ viewerIndex + 1 }} / {{ references.length }}</span
            ><Button
              variant="outline"
              size="icon"
              :aria-label="t('nextImage')"
              :disabled="references.length < 2"
              @click="nextImage(1)"
              ><ChevronRight
            /></Button>
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
