<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  ArrowLeft,
  Check,
  Download,
  MapPin,
  Save,
  Undo2,
  Upload,
} from "@lucide/vue";
import BoatMap from "./BoatMap.vue";
import { Button } from "@/components/ui/button";
import { maps, baseMaps, referencesFor } from "@/lib/maps";
import {
  confirmedMarkers,
  validateLocations,
  type BoatLocations,
  type BoatMarker,
} from "@/lib/boat-locations";
import { useTheme } from "@/lib/theme";

const { t } = useI18n();
useTheme();
const document = ref<BoatLocations | null>(null);
const baseline = ref("");
const revision = ref("");
const mapId = ref(1);
const point = ref(1);
const photo = ref(0);
const armed = ref(false);
const preview = ref(false);
const busy = ref(false);
const error = ref("");
const message = ref("");
const storageWarning = ref(false);
const recovered = ref<{ data: BoatLocations; baseRevision: string } | null>(
  null,
);
const importInput = ref<HTMLInputElement | null>(null);
const history = ref<string[]>([]);
const localKey = "cotd-marker-workspace-v1";
const map = computed(() => maps.find((m) => m.id === mapId.value)!);
const entry = computed(() => document.value?.maps[mapId.value]);
const marker = computed(() => entry.value?.points[point.value]);
const base = computed(() => baseMaps[mapId.value]!);
const stale = computed(
  () => entry.value?.imageRevision !== base.value.revision,
);
const anyStale = computed(
  () =>
    !!document.value &&
    maps.some(
      (m) =>
        document.value!.maps[m.id]!.imageRevision !== baseMaps[m.id]!.revision,
    ),
);
const references = computed(() => referencesFor(mapId.value, point.value));
const displayMarkers = computed(() =>
  !document.value
    ? {}
    : preview.value
      ? confirmedMarkers(document.value, mapId.value, base.value.revision)
      : entry.value!.points,
);
const dirty = computed(
  () => !!document.value && JSON.stringify(document.value) !== baseline.value,
);
const confirmed = computed(() =>
  !document.value
    ? 0
    : maps.reduce(
        (sum, m) =>
          sum +
          Object.keys(
            confirmedMarkers(document.value!, m.id, baseMaps[m.id]!.revision),
          ).length,
        0,
      ),
);
const total = maps.reduce((sum, m) => sum + m.points, 0);

watch(mapId, () => {
  point.value = 1;
  armed.value = false;
});
watch([point, mapId], () => {
  photo.value = 0;
  armed.value = false;
});
watch(preview, () => {
  armed.value = false;
});
watch(
  document,
  () => {
    if (!document.value || recovered.value) return;
    try {
      localStorage.setItem(
        localKey,
        JSON.stringify({ data: document.value, baseRevision: revision.value }),
      );
    } catch {
      storageWarning.value = true;
    }
  },
  { deep: true },
);

onMounted(async () => {
  try {
    const response = await fetch("/__marker-editor");
    if (!response.ok) throw new Error(t("editorLocalOnly"));
    const result = await response.json();
    const data = validateLocations(result.data);
    baseline.value = JSON.stringify(data);
    revision.value = result.revision;
    try {
      const cache = localStorage.getItem(localKey);
      if (cache) {
        const parsed = JSON.parse(cache);
        const candidate = validateLocations(parsed.data);
        if (JSON.stringify(candidate) !== baseline.value)
          recovered.value = {
            data: candidate,
            baseRevision: parsed.baseRevision,
          };
      }
    } catch {
      storageWarning.value = true;
    }
    document.value = data;
  } catch (e) {
    error.value = String(e);
  }
});
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) {
    event.preventDefault();
    event.returnValue = "";
  }
}
window.addEventListener("beforeunload", beforeUnload);
onUnmounted(() => window.removeEventListener("beforeunload", beforeUnload));
function checkpoint() {
  if (!document.value) return;
  history.value = [...history.value.slice(-49), JSON.stringify(document.value)];
  message.value = "";
}
function undo() {
  const previous = history.value.pop();
  if (previous) document.value = validateLocations(JSON.parse(previous));
}
function place(position: { x: number; y: number }) {
  if (!entry.value || stale.value || preview.value || busy.value) return;
  checkpoint();
  entry.value.points[point.value] = {
    ...position,
    note: marker.value?.note ?? "",
    status: "draft",
  };
  armed.value = false;
}
function updateCoordinate(axis: "x" | "y", event: Event) {
  const input = event.target as HTMLInputElement;
  const value = Number(input.value);
  if (
    input.value.trim() &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100 &&
    marker.value
  )
    place({ x: marker.value.x, y: marker.value.y, [axis]: value / 100 });
  else input.value = String((marker.value?.[axis] ?? 0) * 100);
}
function updateNote(event: Event) {
  if (!marker.value) return;
  checkpoint();
  marker.value.note = (event.target as HTMLTextAreaElement).value.trim();
  marker.value.status = "draft";
}
function setStatus(status: BoatMarker["status"]) {
  if (!marker.value || stale.value) return;
  checkpoint();
  marker.value.status = status;
}
function remove() {
  if (!entry.value || !marker.value) return;
  checkpoint();
  delete entry.value.points[point.value];
}
function reviewBase() {
  if (!entry.value) return;
  checkpoint();
  entry.value.imageRevision = base.value.revision;
  Object.values(entry.value.points).forEach((marker) => {
    marker.status = "draft";
  });
}
function exportData(data = document.value) {
  if (!data) return;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2) + "\n"], {
      type: "application/json",
    }),
  );
  const link = window.document.createElement("a");
  link.href = url;
  link.download = "boat-locations.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importData(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 128 * 1024) throw new Error(t("editorImportInvalid"));
    const data = validateLocations(JSON.parse(await file.text()));
    checkpoint();
    document.value = data;
    error.value = "";
    message.value = t("editorImported");
  } catch {
    error.value = t("editorImportInvalid");
  }
  input.value = "";
}
function restore() {
  if (!recovered.value || recovered.value.baseRevision !== revision.value)
    return;
  checkpoint();
  document.value = recovered.value.data;
  recovered.value = null;
}
function dismissRecovery() {
  recovered.value = null;
  try {
    localStorage.setItem(
      localKey,
      JSON.stringify({ data: document.value, baseRevision: revision.value }),
    );
  } catch {
    storageWarning.value = true;
  }
}
async function save() {
  if (!document.value || anyStale.value) return;
  busy.value = true;
  error.value = "";
  message.value = "";
  try {
    const data = validateLocations(document.value);
    const response = await fetch("/__marker-editor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, baseRevision: revision.value }),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        `${t(response.status === 409 ? "editorConflict" : "editorSaveFailed")} ${result.error ?? ""}`,
      );
    revision.value = result.revision;
    baseline.value = JSON.stringify(result.data);
    document.value = result.data;
    message.value = t("editorSaved");
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("editorSaveFailed");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="marker-editor">
    <header class="editor-header">
      <a href="./" class="editor-back"
        ><ArrowLeft :size="18" />{{ t("editorBack") }}</a
      >
      <div>
        <span class="editor-eyebrow">{{ t("editorLocal") }}</span>
        <h1>{{ t("editorTitle") }}</h1>
        <p>{{ t("editorIntro") }}</p>
      </div>
      <div class="editor-progress">
        <strong
          >{{ confirmed }} <small>/ {{ total }}</small></strong
        ><span>{{ t("markerConfirmed") }}</span>
      </div>
    </header>
    <p v-if="error" class="editor-alert" role="alert">{{ error }}</p>
    <p v-if="storageWarning" class="editor-alert">
      {{ t("editorStorageWarning") }}
    </p>
    <section v-if="recovered" class="editor-recovery">
      <p>
        {{
          t(
            recovered.baseRevision === revision
              ? "editorRecoverHint"
              : "editorRecoverConflict",
          )
        }}
      </p>
      <Button v-if="recovered.baseRevision === revision" @click="restore">{{
        t("editorRecover")
      }}</Button>
      <Button variant="outline" @click="exportData(recovered.data)">{{
        t("editorExport")
      }}</Button>
      <Button variant="ghost" @click="dismissRecovery">{{
        t("editorDismiss")
      }}</Button>
    </section>
    <template v-if="document">
      <nav class="editor-map-list" :aria-label="t('mapNav')">
        <button
          v-for="m in maps"
          :key="m.id"
          :aria-pressed="mapId === m.id"
          @click="mapId = m.id"
        >
          <span>{{ String(m.id).padStart(2, "0") }}</span
          ><strong>{{ t(`map${m.id}`) }}</strong>
          <small
            >{{
              Object.keys(
                confirmedMarkers(document, m.id, baseMaps[m.id]!.revision),
              ).length
            }}/{{ m.points }}</small
          >
        </button>
      </nav>
      <div class="editor-actions">
        <div>
          <Button
            variant="outline"
            :disabled="!history.length || busy"
            @click="undo"
            ><Undo2 :size="16" />{{ t("editorUndo") }}</Button
          >
          <Button
            variant="outline"
            :aria-pressed="preview"
            @click="preview = !preview"
            >{{ t(preview ? "editorResume" : "editorPreview") }}</Button
          >
        </div>
        <span>{{ t(dirty ? "editorUnsaved" : "editorSynced") }}</span>
        <div>
          <Button variant="ghost" @click="exportData()"
            ><Download :size="16" />{{ t("editorExport") }}</Button
          >
          <Button variant="ghost" :disabled="busy" @click="importInput?.click()"
            ><Upload :size="16" />{{ t("editorImport") }}</Button
          >
          <input
            ref="importInput"
            type="file"
            accept="application/json,.json"
            hidden
            @change="importData"
          />
          <Button :disabled="busy || !dirty || anyStale" @click="save"
            ><Save :size="16" />{{
              t(busy ? "editorSaving" : "editorSave")
            }}</Button
          >
        </div>
      </div>
      <div v-if="stale" class="editor-alert">
        <p>{{ t("editorBaseChanged") }}</p>
        <Button variant="outline" @click="reviewBase">{{
          t("editorReviewBase")
        }}</Button>
      </div>
      <p v-if="preview" class="editor-preview-hint">
        {{ t("editorPreviewHint") }}
      </p>
      <section class="editor-workspace" :aria-label="t('editorTitle')">
        <article class="editor-map-card">
          <div class="editor-card-heading">
            <h2>
              {{ t(`map${mapId}`) }}
              <small>{{ t("pointLabel", { point }) }}</small>
            </h2>
            <span>{{
              t(
                marker?.status === "confirmed" && !stale
                  ? "markerConfirmed"
                  : marker
                    ? "markerDraft"
                    : "markerMissing",
              )
            }}</span>
          </div>
          <nav class="editor-point-list" :aria-label="t('choosePoint')">
            <button
              v-for="p in map.points"
              :key="p"
              :aria-pressed="point === p"
              @click="point = p"
            >
              <strong>{{ p }}</strong
              ><span>{{
                t(
                  entry?.points[p]?.status === "confirmed" && !stale
                    ? "markerConfirmed"
                    : entry?.points[p]
                      ? "markerDraft"
                      : "markerMissing",
                )
              }}</span>
            </button>
          </nav>
          <Button
            v-if="!preview"
            class="editor-mobile-place"
            :variant="armed ? 'secondary' : 'default'"
            :disabled="stale || busy"
            @click="armed = !armed"
            ><MapPin :size="16" />{{
              t(
                armed
                  ? "editorCancelPlace"
                  : marker
                    ? "editorReposition"
                    : "editorPlace",
              )
            }}</Button
          >
          <BoatMap
            :src="base.url"
            :alt="t('baseMapAlt', { name: t(`map${mapId}`) })"
            :markers="displayMarkers"
            :selected="point"
            :armed="armed && !preview && !stale && !busy"
            @place="place"
            @select="point = $event"
          />
        </article>
        <aside class="editor-inspector">
          <section v-if="!preview" class="editor-card">
            <h2>{{ t("editorPosition") }}</h2>
            <p>{{ t("editorPlaceHelp") }}</p>
            <Button
              class="editor-place"
              :variant="armed ? 'secondary' : 'default'"
              :disabled="stale || busy"
              @click="armed = !armed"
              ><MapPin :size="16" />{{
                t(
                  armed
                    ? "editorCancelPlace"
                    : marker
                      ? "editorReposition"
                      : "editorPlace",
                )
              }}</Button
            >
            <template v-if="marker">
              <div class="editor-coordinates">
                <label
                  >X %<input
                    type="number"
                    min="0"
                    max="100"
                    step=".1"
                    :disabled="stale || busy"
                    :value="Number((marker.x * 100).toFixed(4))"
                    @change="updateCoordinate('x', $event)" /></label
                ><label
                  >Y %<input
                    type="number"
                    min="0"
                    max="100"
                    step=".1"
                    :disabled="stale || busy"
                    :value="Number((marker.y * 100).toFixed(4))"
                    @change="updateCoordinate('y', $event)"
                /></label>
              </div>
              <label class="editor-note"
                >{{ t("editorNote")
                }}<textarea
                  :value="marker.note"
                  maxlength="400"
                  rows="3"
                  :disabled="busy || stale"
                  :placeholder="t('editorNoteHint')"
                  @change="updateNote"
                />
              </label>
              <p class="editor-confirm-hint">{{ t("editorConfirmHint") }}</p>
              <Button
                :disabled="stale || busy || marker.status === 'confirmed'"
                @click="setStatus('confirmed')"
                ><Check :size="16" />{{ t("editorConfirm") }}</Button
              >
              <Button
                v-if="marker.status === 'confirmed'"
                variant="ghost"
                :disabled="busy"
                @click="setStatus('draft')"
                >{{ t("editorUnconfirm") }}</Button
              >
              <Button variant="ghost" :disabled="busy" @click="remove">{{
                t("editorRemove")
              }}</Button>
            </template>
          </section>
          <section class="editor-card editor-reference">
            <h2>{{ t("waterTitle") }}</h2>
            <p>{{ t("editorReferenceHelp") }}</p>
            <img
              v-if="references[photo]"
              :src="references[photo]!.url"
              :alt="
                t('waterAlt', {
                  name: t(`map${mapId}`),
                  point,
                  index: references[photo]!.index,
                })
              "
            />
            <p v-else>{{ t("missingWater") }}</p>
            <div class="editor-reference-tabs">
              <button
                v-for="(refImage, index) in references"
                :key="refImage.filename"
                :aria-pressed="photo === index"
                @click="photo = index"
              >
                {{ refImage.index }}
              </button>
            </div>
          </section>
          <section class="editor-card editor-publish">
            <h2>{{ t("editorPublishTitle") }}</h2>
            <ol>
              <li>{{ t("editorPublish1") }}</li>
              <li>{{ t("editorPublish2") }}</li>
              <li>{{ t("editorPublish3") }}</li>
            </ol>
            <code>src/data/boat-locations.json</code>
          </section>
        </aside>
      </section>
      <p v-if="message" class="editor-message" role="status">{{ message }}</p>
    </template>
  </main>
</template>

<style>
.marker-editor {
  max-width: 1500px;
  margin: auto;
  padding: 28px;
  color: var(--foreground);
}
.editor-header {
  display: flex;
  gap: 24px;
  align-items: center;
  margin-bottom: 26px;
}
.editor-back {
  display: flex;
  gap: 6px;
  font-size: 13px;
  align-items: center;
  flex-shrink: 0;
}
.editor-eyebrow {
  font: 11px monospace;
  letter-spacing: 2px;
  color: var(--text-secondary);
}
.editor-header h1 {
  font-size: 27px;
  font-weight: 700;
  margin: 6px 0;
}
.editor-header p,
.editor-card p {
  font-size: 12px;
  line-height: 1.8;
  color: var(--text-secondary);
}
.editor-progress {
  margin-left: auto;
  text-align: right;
  flex-shrink: 0;
  display: grid;
  gap: 4px;
  font-size: 12px;
}
.editor-progress strong {
  font-size: 30px;
}
.editor-progress small {
  font-size: 18px;
  color: var(--text-secondary);
}
.editor-map-list {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 8px;
}
.editor-map-list > button {
  display: grid;
  grid-template-columns: 1fr auto;
  text-align: left;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--card);
  gap: 7px;
}
.editor-map-list strong {
  grid-row: 2;
  grid-column: 1/-1;
  font-size: 13px;
}
.editor-map-list span,
.editor-map-list small {
  font: 11px monospace;
  color: var(--text-secondary);
}
.editor-map-list small {
  grid-column: 2;
  grid-row: 1;
}
.editor-map-list > button[aria-pressed="true"],
.editor-point-list > button[aria-pressed="true"],
.editor-reference-tabs > button[aria-pressed="true"] {
  border-color: var(--selected-border);
  background: var(--selected-surface);
  color: var(--selected-foreground);
}
.editor-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 0;
  flex-wrap: wrap;
}
.editor-actions > div {
  display: flex;
  gap: 8px;
}
.editor-actions > span {
  font-size: 12px;
  color: var(--text-secondary);
}
.editor-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 20px;
  align-items: start;
}
.editor-map-card,
.editor-card {
  border: 1px solid var(--border);
  background: var(--card);
  border-radius: 12px;
  overflow: hidden;
}
.editor-card {
  padding: 18px;
}
.editor-inspector {
  display: grid;
  gap: 16px;
  min-width: 0;
}
.editor-card h2 {
  font-size: 15px;
  font-weight: 650;
  margin-bottom: 6px;
}
.editor-card p {
  margin-bottom: 12px;
}
.editor-card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 20px;
}
.editor-card-heading h2 {
  font-size: 21px;
  font-weight: 650;
}
.editor-card-heading small {
  display: inline-block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-left: 8px;
}
.editor-card-heading > span {
  font-size: 12px;
}
.editor-point-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 16px 14px;
}
.editor-point-list button {
  display: grid;
  gap: 4px;
  min-width: 64px;
  padding: 7px;
  border: 1px solid var(--border);
  border-radius: 7px;
}
.editor-point-list span {
  font-size: 10px;
  color: var(--text-secondary);
}
.editor-point-list strong {
  font-size: 17px;
}
.editor-map-card .boat-map-scroll {
  max-height: 75dvh;
}
.editor-mobile-place {
  display: none;
}
.editor-place {
  width: 100%;
  margin-bottom: 16px;
}
.editor-coordinates {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.editor-coordinates label,
.editor-note {
  font-size: 12px;
  display: grid;
  gap: 6px;
}
.editor-coordinates input,
.editor-note textarea {
  min-width: 0;
  width: 100%;
  background: var(--background);
  padding: 9px;
  border: 1px solid var(--border);
  border-radius: 6px;
}
.editor-note {
  margin: 14px 0;
}
.editor-note textarea {
  resize: vertical;
}
.editor-confirm-hint {
  font-size: 11px !important;
}
.editor-reference > img {
  display: block;
  width: 100%;
  border-radius: 6px;
}
.editor-reference-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.editor-reference-tabs button {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 5px;
}
.editor-publish ol {
  list-style: decimal;
  padding-left: 17px;
  font-size: 12px;
  line-height: 2;
  color: var(--text-secondary);
}
.editor-publish code {
  display: block;
  font-size: 11px;
  margin-top: 12px;
  overflow-wrap: anywhere;
}
.editor-alert,
.editor-recovery,
.editor-preview-hint {
  background: var(--secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 14px;
  font-size: 13px;
  line-height: 1.8;
}
.editor-alert {
  border-color: #b67d35;
}
.editor-recovery button {
  margin: 8px 8px 0 0;
}
.editor-message {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  max-width: 90vw;
  background: var(--primary);
  color: var(--primary-foreground);
  border-radius: 10px;
  box-shadow: 0 4px 18px #0003;
  padding: 16px 22px;
  z-index: 60;
  font-size: 13px;
}
@media (max-width: 1000px) {
  .editor-map-list {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .editor-workspace {
    grid-template-columns: minmax(0, 1fr) 300px;
  }
}
@media (max-width: 760px) {
  .editor-mobile-place {
    display: flex;
    margin: 0 16px 12px;
    min-height: 44px;
  }
  .marker-editor {
    padding: 16px;
  }
  .editor-header {
    flex-wrap: wrap;
    gap: 14px;
  }
  .editor-back {
    width: 100%;
  }
  .editor-header h1 {
    font-size: 22px;
  }
  .editor-progress {
    margin-left: 0;
  }
  .editor-workspace {
    grid-template-columns: 1fr;
  }
  .editor-map-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .editor-actions > div {
    flex-wrap: wrap;
  }
  .editor-actions button,
  .editor-card button {
    min-height: 44px;
  }
  .editor-map-card .boat-map-scroll {
    max-height: 60dvh;
  }
}
</style>
