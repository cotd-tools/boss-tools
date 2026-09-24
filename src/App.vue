<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
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
const toast = ref("");
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function notify(message: string) {
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
  document
    .getElementById("location-detail")
    ?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
}

const copyOpen = ref(false);
const copyText = computed(
  () =>
    `${dateKey(selectedDate.value)} Boss 点位｜${REGIONS[region.value].name}（设备本地 ${String(REGIONS[region.value].hour).padStart(2, "0")}:00 刷新）\n${maps.map((item) => `图${item.id} ${item.name}：${code.value[item.id - 1]}号点位`).join("\n")}\n黑水投放后，等待冒泡再垂钓。社区参考，请以游戏内实际情况为准。`,
);
async function copyPositions() {
  try {
    await navigator.clipboard.writeText(copyText.value);
    notify("已复制八张地图的点位");
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
  <div class="app-shell">
    <aside class="sidebar">
      <a
        class="brand"
        href="#"
        aria-label="深潮观测站首页"
        @click.prevent="
          view = 'daily';
          quickDate(0);
        "
      >
        <span class="brand-mark"><Waves :size="25" /></span>
        <span
          ><strong>深潮观测站</strong><small>DEEP TIDE OBSERVATORY</small></span
        >
      </a>
      <div class="sidebar-label">探索工具 <span>01 — 08</span></div>
      <nav class="primary-nav" aria-label="主导航">
        <button :class="{ selected: view === 'daily' }" @click="view = 'daily'">
          <Compass :size="18" />每日速查<ArrowRight :size="15" />
        </button>
        <button :class="{ selected: view === 'atlas' }" @click="view = 'atlas'">
          <BookOpen :size="18" />点位图鉴<Badge variant="secondary">{{
            images.length
          }}</Badge>
        </button>
      </nav>
      <div class="sidebar-label map-label">目的地 <span>MAPS</span></div>
      <nav class="map-nav" aria-label="地图选择">
        <button
          v-for="item in maps"
          :key="item.id"
          :class="{ selected: selectedMap === item.id }"
          :aria-current="selectedMap === item.id ? 'true' : undefined"
          @click="selectMap(item.id)"
        >
          <span class="map-number">{{ String(item.id).padStart(2, "0") }}</span
          ><span>{{ item.name }}</span
          ><span class="nav-point">{{ code[item.id - 1] }}</span>
        </button>
      </nav>
      <div class="sidebar-bottom">
        <div class="field-note">
          <Anchor :size="20" /><strong>每一次出航，都有方向。</strong>
          <p>找到点位，投下黑水。<br />等待水面冒泡，再开始垂钓。</p>
        </div>
        <button class="help-link" @click="helpOpen = true">
          <Info :size="16" /> 使用说明 <ArrowRight :size="14" />
        </button>
        <div class="community-label">
          <span class="status-dot" /> 社区共建 · 非官方工具
        </div>
      </div>
    </aside>

    <main class="main-content">
      <header class="topbar">
        <span class="breadcrumb"
          >探索工具 <ChevronRight :size="13" />
          <strong>{{
            view === "daily" ? "每日速查" : "点位图鉴"
          }}</strong></span
        ><button @click="helpOpen = true">
          <Info :size="15" /><span>使用指南</span>
        </button>
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
          <h1>深海有迹，出航有据<span>。</span></h1>
          <p class="hero-description">
            八张地图，一站定位。你的下一条 Boss，从这里开始。
          </p>
          <div class="hero-tags">
            <span><MapPin :size="14" /> 8 张探索地图</span
            ><span
              ><ImageIcon :size="14" /> {{ images.length }} 张实景参考</span
            >
          </div>
        </div>
        <div class="reset-card">
          <div class="reset-label">
            <span class="status-dot" /> 当前生效 · {{ formatDate(live) }}
          </div>
          <div class="reset-caption">距离下次点位刷新</div>
          <div class="countdown">{{ countdown }}</div>
          <div class="reset-region">
            <Globe2 :size="13" /> {{ REGIONS[region].name }} ·
            {{ String(REGIONS[region].hour).padStart(2, "0") }}:00
            <span>本地时间</span>
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
            <p class="section-kicker">DAILY COORDINATES</p>
            <h2 id="daily-heading">
              {{ followingLive ? "今日出航点位" : "点位日期查询" }}
              <Badge v-if="followingLive" class="live-badge"
                ><span class="status-dot" /> 当前生效</Badge
              ><Badge v-else variant="outline">{{
                dateKey(selectedDate)
              }}</Badge>
            </h2>
          </div>
          <Button variant="outline" class="copy-button" @click="copyPositions"
            ><Copy :size="15" />复制全部点位</Button
          >
        </div>
        <div class="date-toolbar">
          <div class="date-controls">
            <Button
              variant="ghost"
              size="icon"
              aria-label="前一天"
              @click="chooseDate(shiftDate(selectedDate, -1))"
              ><ChevronLeft /></Button
            ><input
              aria-label="查询日期"
              type="date"
              :value="dateKey(selectedDate)"
              min="0001-01-01"
              max="9999-12-31"
              @change="handleDate"
            /><Button
              variant="ghost"
              size="icon"
              aria-label="后一天"
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
                昨天</button
              ><button :class="{ active: followingLive }" @click="quickDate(0)">
                今天</button
              ><button
                :class="{
                  active: dateKey(selectedDate) === dateKey(shiftDate(live, 1)),
                }"
                @click="quickDate(1)"
              >
                明天
              </button>
            </div>
          </div>
          <div class="region-select">
            <Globe2 :size="15" /><Select v-model="region"
              ><SelectTrigger aria-label="服务器地区"
                ><SelectValue /></SelectTrigger
              ><SelectContent
                ><SelectItem value="other">其他地区服 · 04:00</SelectItem
                ><SelectItem value="us_ca"
                  >北美服 · 05:00</SelectItem
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
            :aria-label="`查看图${item.id} ${item.name} ${code[item.id - 1]}号点位`"
            @click="showDetail(item.id)"
          >
            <div class="coordinate-top">
              <span>图 {{ String(item.id).padStart(2, "0") }}</span
              ><ArrowRight :size="15" />
            </div>
            <div class="coordinate-middle">
              <strong>{{ item.name }}</strong
              ><span class="coordinate-value"
                >{{ code[item.id - 1] }}<small>号点位</small></span
              >
            </div>
            <div class="coordinate-bottom">
              <span class="tiny-dot" />{{
                selectedMap === item.id && point === Number(code[item.id - 1])
                  ? "正在查看"
                  : "查看当日点位"
              }}
            </div>
          </button>
        </div>
        <p class="date-hint">
          <Clock3
            :size="13"
          />“今天”按服务器刷新时刻换日；刷新前仍显示前一天点位。时间均以当前设备为准。
        </p>
      </section>

      <section
        id="location-detail"
        class="detail-section"
        aria-labelledby="detail-heading"
      >
        <div class="section-heading detail-heading">
          <div>
            <p class="section-kicker">
              LOCATION FIELD GUIDE
              <span>/ {{ String(selectedMap).padStart(2, "0") }}</span>
            </p>
            <h2 id="detail-heading">
              {{ map.name }} <span class="english-name">{{ map.en }}</span>
            </h2>
          </div>
          <Badge variant="outline" class="map-badge"
            ><MapPin :size="12" />图 {{ selectedMap }}</Badge
          >
        </div>
        <div class="detail-toolbar">
          <div class="point-selector">
            <span>选择点位</span
            ><button
              v-for="n in pointsFor(map)"
              :key="n"
              :class="{ active: point === n }"
              :aria-pressed="point === n"
              :aria-label="`${n}号点位${n === activePoint ? '，查询日期点位' : ''}`"
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
            <RotateCcw :size="13" />返回当日点位 {{ activePoint }}</button
          ><span v-else class="point-context"
            ><span class="tiny-dot" />{{ dateKey(selectedDate) }} ·
            {{ point }} 号点位</span
          >
        </div>

        <div class="guide-grid">
          <article class="water-panel">
            <div class="panel-title">
              <div>
                <span class="step-number">02</span>
                <h3>黑水投放参考</h3>
                <Badge variant="secondary">{{ waterImages.length }} 张</Badge>
              </div>
              <span>冒泡后垂钓</span>
            </div>
            <button
              v-if="waterImage"
              class="reference-stage"
              :aria-label="`放大${map.name}${point}号点位黑水参考图${waterImage.index}`"
              @click="openImage(references.indexOf(waterImage))"
            >
              <img
                :key="waterImage.url"
                :src="waterImage.url"
                :alt="`${map.name} ${point}号点位 · 黑水投放位置 ${waterImage.index}（大概范围）`"
              /><span class="image-tag"
                ><Droplets :size="13" />黑水位置 {{ waterImage.index }}</span
              ><span class="expand-label"><Expand :size="14" />点击放大</span>
            </button>
            <div v-else class="no-water">
              <ImageIcon :size="36" /><strong>这个点位的参考图待补充</strong>
              <p>可以先查看其他点位。</p>
            </div>
            <div class="image-strip">
              <div class="thumbnail-list">
                <button
                  v-for="(item, index) in waterImages"
                  :key="item.filename"
                  :class="{ active: waterIndex === index }"
                  :aria-label="`切换黑水位置${item.index}`"
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
                {{ waterImages.length }}<small>投放参考</small></span
              >
            </div>
            <div class="image-footnote">
              <Info :size="14" />
              <p>
                图片展示黑水投放的<strong>大概范围</strong>，请结合场景中的岸线、岛屿与建筑定位。
              </p>
            </div>
          </article>

          <aside class="location-side">
            <article class="map-panel">
              <div class="panel-title">
                <div>
                  <span class="step-number">01</span>
                  <h3>船停在哪里</h3>
                </div>
                <Navigation :size="16" />
              </div>
              <button
                v-if="mapImage"
                class="map-preview"
                :aria-label="`放大${map.name}${point}号点位地图定位图`"
                @click="openImage(references.indexOf(mapImage))"
              >
                <img
                  :src="mapImage.url"
                  :alt="`${map.name} ${point}号点位 · 船停靠的地图位置`"
                /><span><Expand :size="13" />查看地图位置</span>
              </button>
              <div v-else class="missing-map">
                <div class="map-grid-art"><MapPin :size="28" /></div>
                <strong>地图定位图待补充</strong>
                <p>先对照实景参考图中的地形，<br />找到船的大致停靠位置。</p>
                <Badge variant="outline"
                  >图 {{ selectedMap }} · {{ point }} 号点位</Badge
                >
              </div>
              <p v-if="mapImage" class="map-caption">
                <MapPin :size="13" />先在地图上确认船的位置，再对照实景投放。
              </p>
            </article>
            <article class="fishing-note">
              <div class="note-heading">
                <Fish :size="18" />
                <h3>出航小贴士</h3>
              </div>
              <ol>
                <li><span>1</span>对照地图或实景，停好船。</li>
                <li><span>2</span>在参考范围内投放黑水。</li>
                <li><span>3</span>等待水面冒泡，再开始垂钓。</li>
              </ol>
              <div class="note-bottom">
                <Waves :size="16" /><span>慢一点，好运正在水面下。</span>
              </div>
            </article>
          </aside>
        </div>
      </section>
      <footer>
        <span
          ><Waves :size="16" />深潮观测站
          <span class="footer-divider">/</span> 为每一位深海钓手而建</span
        ><span>社区参考数据 · 请以游戏内实际情况为准</span>
      </footer>
    </main>
    <Transition name="toast"
      ><div v-if="toast" class="toast-message" role="status">
        <Check :size="17" />{{ toast }}
      </div></Transition
    >

    <Dialog v-model:open="viewerOpen"
      ><DialogContent class="image-dialog" @keydown="viewerKeys"
        ><DialogHeader
          ><DialogTitle>{{ map.name }} · {{ point }} 号点位</DialogTitle
          ><DialogDescription>{{
            viewerImage?.index === 0
              ? "地图定位 · 判断船停在哪里"
              : `黑水位置 ${viewerImage?.index} · 大概投放范围，冒泡后垂钓`
          }}</DialogDescription></DialogHeader
        >
        <div class="viewer-stage">
          <img
            v-if="viewerImage"
            :src="viewerImage.url"
            :alt="`${map.name}${point}号点位${viewerImage.index === 0 ? '地图定位' : '黑水参考'}`"
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
              aria-label="上一张参考图"
              :disabled="references.length < 2"
              @click="nextImage(-1)"
              ><ChevronLeft /></Button
            ><span>{{ viewerIndex + 1 }} / {{ references.length }}</span
            ><Button
              variant="outline"
              size="icon"
              aria-label="下一张参考图"
              :disabled="references.length < 2"
              @click="nextImage(1)"
              ><ChevronRight
            /></Button>
          </div>
          <div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="缩小"
              :disabled="zoom <= 1"
              @click="zoom = Math.max(1, zoom - 0.5)"
              ><ZoomOut /></Button
            ><button class="zoom-reset" aria-label="重置缩放" @click="zoom = 1">
              {{ Math.round(zoom * 100) }}%</button
            ><Button
              variant="ghost"
              size="icon"
              aria-label="放大"
              :disabled="zoom >= 3"
              @click="zoom = Math.min(3, zoom + 0.5)"
              ><ZoomIn /></Button
            ><Button variant="outline" size="icon" as-child
              ><a
                :href="viewerImage?.url"
                target="_blank"
                rel="noopener"
                aria-label="打开原图"
                ><ArrowDownToLine /></a
            ></Button>
          </div></div></DialogContent
    ></Dialog>
    <Dialog v-model:open="copyOpen"
      ><DialogContent
        ><DialogHeader
          ><DialogTitle>手动复制点位</DialogTitle
          ><DialogDescription
            >浏览器暂不允许访问剪贴板，可长按或全选下方文本复制。</DialogDescription
          ></DialogHeader
        ><textarea
          class="copy-fallback"
          readonly
          :value="copyText"
          aria-label="点位文本"
          @focus="($event.target as HTMLTextAreaElement).select()"
        /></DialogContent
    ></Dialog>
    <Dialog v-model:open="helpOpen"
      ><DialogContent class="help-dialog"
        ><DialogHeader
          ><DialogTitle>出航前，了解这三件事</DialogTitle
          ><DialogDescription
            >深潮观测站 · 使用指南</DialogDescription
          ></DialogHeader
        >
        <div class="help-section">
          <Ship />
          <div>
            <h3>先停船，再投放</h3>
            <p>
              地图定位图用来判断船停在哪里；实景图是扔黑水的大概范围。投放后等到水面冒泡再垂钓。地图图未补齐的点位，可先参考实景地形。
            </p>
          </div>
        </div>
        <div class="help-section">
          <Clock3 />
          <div>
            <h3>点位以刷新时刻换日</h3>
            <p>
              沿用原版规则：北美服本地 05:00，其他地区服本地
              04:00。请按实际服务器手动选择地区。“昨天 /
              明天”以当前生效日期为基准。
            </p>
          </div>
        </div>
        <div class="help-section">
          <BookOpen />
          <div>
            <h3>所有点位，随时查阅</h3>
            <p>
              选择地图和点位数字查看参考图；小圆点标记查询日期的点位。点击图片可放大，多张图可在缩略图或大图窗口中切换。
            </p>
          </div>
        </div>
        <p class="help-disclaimer">
          点位轮换沿用原版的 26
          天周期数据，属于社区参考，请以游戏内实际情况为准。
        </p></DialogContent
      ></Dialog
    >
  </div>
</template>
