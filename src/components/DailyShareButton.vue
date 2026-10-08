<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ArrowDownToLine, Copy, ImageIcon, LoaderCircle, RotateCcw } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { maps, referencesFor } from "@/lib/maps";
import { bossCode, dateKey, REGIONS, type RegionKey } from "@/lib/schedule";
import { copyShareImage, createShareImage, type ShareImageContent } from "@/lib/share-image";

const props = defineProps<{ date: Date; region: RegionKey }>();
const emit = defineEmits<{ copied: [] }>();
const { t, locale } = useI18n();
const busy = ref(false);
const open = ref(false);
const imageUrl = ref("");
const filename = ref("");
const failed = ref(false);
let imageBlob: Blob | null = null;
let disposed = false;

onUnmounted(() => {
  disposed = true;
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value);
});

function snapshot(): ShareImageContent {
  const code = bossCode(props.date);
  return {
    brand: t("brandName"),
    subtitle: t("brandSubtitle"),
    title: t("shareImageTitle"),
    date: dateKey(props.date).replaceAll("-", "."),
    region: t(props.region === "us_ca" ? "regionNorthAmerica" : "regionOther"),
    reset: t("shareImageReset", { hour: String(REGIONS[props.region].hour).padStart(2, "0") }),
    missing: t("missingWater"),
    disclaimer: t("disclaimer"),
    spots: maps.map((map) => {
      const point = Number(code[map.id - 1]);
      return {
        name: t(`map${map.id}`),
        point,
        imageUrl: referencesFor(map.id, point)[0]?.url,
      };
    }),
  };
}

async function share() {
  if (busy.value) return;
  busy.value = true;
  failed.value = false;
  imageBlob = null;
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value);
  imageUrl.value = "";
  filename.value = `monster-spots-${dateKey(props.date)}-${props.region}-${locale.value}.png`;
  try {
    // Capture date, region and language together, even if they change while loading.
    const rendering = createShareImage(snapshot());
    const copying = copyShareImage(rendering).then(() => true, () => false);
    const [blob, copied] = await Promise.all([rendering, copying]);
    if (disposed) return;
    imageBlob = blob;
    imageUrl.value = URL.createObjectURL(blob);
    if (copied) {
      open.value = false;
      emit("copied");
    } else {
      open.value = true;
    }
  } catch {
    if (disposed) return;
    failed.value = true;
    open.value = true;
  } finally {
    busy.value = false;
  }
}

async function retryCopy() {
  if (!imageBlob || busy.value) return;
  busy.value = true;
  try {
    await copyShareImage(imageBlob);
    open.value = false;
    emit("copied");
  } catch {
    // Keep the generated image available for downloading or long-press saving.
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Button class="share-image-button" :disabled="busy" :aria-busy="busy" @click="share">
    <LoaderCircle v-if="busy" :size="15" class="share-image-spinner" aria-hidden="true" />
    <ImageIcon v-else :size="15" aria-hidden="true" />
    {{ t(busy ? 'shareImageGenerating' : 'shareImage') }}
  </Button>
  <Dialog v-model:open="open">
    <DialogContent class="share-image-dialog">
      <DialogHeader>
        <DialogTitle>{{ t('shareImagePreviewTitle') }}</DialogTitle>
        <DialogDescription>{{ t(failed ? 'shareImageError' : 'shareImageFallback') }}</DialogDescription>
      </DialogHeader>
      <div v-if="imageUrl" class="share-image-preview">
        <img :src="imageUrl" :alt="t('shareImageAlt')" />
      </div>
      <div class="share-image-actions">
        <Button v-if="failed" :disabled="busy" @click="share">
          <RotateCcw :size="16" />{{ t(busy ? 'shareImageGenerating' : 'shareImageRetry') }}
        </Button>
        <template v-else-if="imageUrl">
          <Button variant="outline" :disabled="busy" @click="retryCopy">
            <Copy :size="16" />{{ t('shareImageCopy') }}
          </Button>
          <Button as-child>
            <a :href="imageUrl" :download="filename"><ArrowDownToLine :size="16" />{{ t('shareImageSave') }}</a>
          </Button>
        </template>
      </div>
    </DialogContent>
  </Dialog>
</template>
