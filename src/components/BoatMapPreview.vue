<script setup lang="ts">
import type { BoatMarker } from "@/lib/boat-locations";

defineProps<{
  src: string;
  markers: Record<string, BoatMarker>;
  selected: number;
}>();
</script>

<template>
  <span class="boat-map-preview" aria-hidden="true"
    :style="{ '--preview-focus': Math.max(0.26, Math.min(0.74, markers[selected]?.y ?? 0.5)) }">
    <span class="boat-map-preview-canvas">
    <img :src="src" alt="" loading="lazy" />
    <span
      v-for="(marker, id) in markers"
      :key="id"
      class="preview-pin"
      :class="{ selected: Number(id) === selected }"
      :style="{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }"
    >{{ id }}</span>
    </span>
  </span>
</template>
