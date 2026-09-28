<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useElementSize, useWindowSize } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { Minus, Plus, RotateCcw } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { positionFromClient, type BoatMarker } from "@/lib/boat-locations";

const props = withDefaults(
  defineProps<{
    src: string;
    alt: string;
    markers: Record<string, BoatMarker>;
    selected: number;
    armed?: boolean;
  }>(),
  { armed: false },
);
const emit = defineEmits<{
  select: [point: number];
  place: [position: { x: number; y: number }];
}>();
const { t } = useI18n();
const zoom = ref(1);
const image = ref<HTMLImageElement | null>(null);
const scrollport = ref<HTMLElement | null>(null);
const { width: containerWidth } = useElementSize(scrollport);
const { height: windowHeight } = useWindowSize();
const aspect = ref(1);
const surfaceWidth = computed(() =>
  containerWidth.value
    ? `${Math.min(containerWidth.value, windowHeight.value * 0.55 * aspect.value) * zoom.value}px`
    : "100%",
);
let down = { x: 0, y: 0 };
watch(
  () => props.src,
  () => {
    zoom.value = 1;
  },
);
function place(event: PointerEvent) {
  if (
    !props.armed ||
    !image.value ||
    !image.value.naturalWidth ||
    (event.target as HTMLElement).closest("button")
  )
    return;
  if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 8) return;
  const position = positionFromClient(
    event.clientX,
    event.clientY,
    image.value.getBoundingClientRect(),
  );
  if (position) emit("place", position);
}
</script>

<template>
  <div class="boat-map">
    <div class="boat-map-tools">
      <span>{{ t(armed ? "markerPlaceHint" : "mapZoomHint") }}</span>
      <div>
        <Button
          variant="outline"
          size="icon"
          :aria-label="t('zoomOut')"
          :disabled="zoom <= 1"
          @click="zoom = Math.max(1, zoom - 0.5)"
          ><Minus :size="16"
        /></Button>
        <Button variant="ghost" :aria-label="t('resetZoom')" @click="zoom = 1"
          ><RotateCcw :size="13" />{{ zoom * 100 }}%</Button
        >
        <Button
          variant="outline"
          size="icon"
          :aria-label="t('zoomIn')"
          :disabled="zoom >= 4"
          @click="zoom = Math.min(4, zoom + 0.5)"
          ><Plus :size="16"
        /></Button>
      </div>
    </div>
    <div
      ref="scrollport"
      class="boat-map-scroll"
      tabindex="0"
      :aria-label="alt"
    >
      <div
        class="boat-map-surface"
        :class="{ armed }"
        :style="{ width: surfaceWidth }"
        @pointerdown="down = { x: $event.clientX, y: $event.clientY }"
        @pointerup="place"
      >
        <img
          ref="image"
          :src="src"
          :alt="alt"
          draggable="false"
          @load="aspect = image!.naturalWidth / image!.naturalHeight"
        />
        <button
          v-for="(marker, id) in markers"
          :key="id"
          type="button"
          class="boat-pin"
          :class="{
            selected: Number(id) === selected,
            draft: marker.status === 'draft',
          }"
          :style="{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }"
          :aria-label="
            t('markerPinLabel', {
              point: id,
              status: t(
                marker.status === 'confirmed'
                  ? 'markerConfirmed'
                  : 'markerDraft',
              ),
            })
          "
          :aria-pressed="Number(id) === selected"
          @click.stop="emit('select', Number(id))"
        >
          <span>{{ id }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style>
.boat-map {
  min-width: 0;
}
.boat-map-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}
.boat-map-tools > span {
  color: var(--text-secondary);
  font-size: 11px;
}
.boat-map-tools > div {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}
.boat-map-tools button {
  height: 40px;
  min-width: 36px;
  padding: 0 7px;
  font-size: 11px;
}
.boat-map-scroll {
  max-height: 65dvh;
  overflow: auto;
  overscroll-behavior: contain;
  background: var(--secondary);
}
.boat-map-surface {
  position: relative;
  margin: 0 auto;
}
.boat-map-surface.armed {
  cursor: crosshair;
}
.boat-map-surface > img {
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
}
.boat-pin {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  z-index: 1;
  cursor: pointer;
}
.boat-pin > span {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 2px solid white;
  border-radius: 50%;
  background: #203c35;
  color: white;
  font: bold 14px monospace;
  box-shadow: 0 2px 7px #0008;
}
.boat-pin.draft > span {
  background: #825213;
  border-style: dashed;
}
.boat-pin.selected {
  z-index: 2;
}
.boat-pin.selected > span {
  background: #cc491b;
  box-shadow:
    0 0 0 4px #fff9,
    0 2px 7px #0008;
}
.boat-pin:focus-visible {
  outline: 2px solid var(--ring);
  border-radius: 50%;
}
.boat-map-dialog[data-slot="dialog-content"] {
  width: min(1000px, calc(100vw - 24px));
  max-width: 1000px;
  max-height: 95dvh;
  overflow: auto;
  padding: 20px;
}
.boat-map-status {
  padding: 12px 16px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.7;
}
.boat-map-status strong {
  color: var(--text-strong);
  display: block;
}
.boat-map-status p {
  margin-top: 4px;
  white-space: pre-wrap;
}
.boat-map-expand {
  margin: 0 12px 12px;
}
@media (max-width: 760px) {
  .boat-map-tools button {
    height: 44px;
  }
  .boat-map-dialog[data-slot="dialog-content"] {
    padding: 14px;
  }
}
</style>
