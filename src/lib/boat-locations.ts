import catalog from "../data/map-catalog.json" with { type: "json" };

export interface BoatMarker {
  x: number;
  y: number;
  status: "draft" | "confirmed";
  note: string;
}
export interface BoatLocations {
  version: 1;
  maps: Record<
    string,
    { imageRevision: string; points: Record<string, BoatMarker> }
  >;
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

// Also used by the local save endpoint and CI. Never trust browser/imported JSON.
export function validateLocations(input: unknown): BoatLocations {
  if (!record(input) || input.version !== 1 || !record(input.maps))
    throw new Error("Invalid map data version");
  if (Object.keys(input.maps).length !== catalog.length)
    throw new Error("Exactly 8 maps are required");
  const maps: BoatLocations["maps"] = {};
  for (const map of catalog) {
    const entry = input.maps[map.id];
    if (
      !record(entry) ||
      typeof entry.imageRevision !== "string" ||
      !/^[a-f0-9]{64}$/.test(entry.imageRevision) ||
      !record(entry.points)
    )
      throw new Error(`Invalid base map ${map.id}`);
    const points: Record<string, BoatMarker> = {};
    for (const [id, value] of Object.entries(entry.points)) {
      if (!/^[1-9]\d*$/.test(id) || Number(id) > map.points || !record(value))
        throw new Error(`Invalid point ${map.id}-${id}`);
      if (
        typeof value.x !== "number" ||
        typeof value.y !== "number" ||
        !Number.isFinite(value.x) ||
        !Number.isFinite(value.y) ||
        value.x < 0 ||
        value.x > 1 ||
        value.y < 0 ||
        value.y > 1
      )
        throw new Error(`Invalid coordinates ${map.id}-${id}`);
      if (value.status !== "draft" && value.status !== "confirmed")
        throw new Error(`Invalid status ${map.id}-${id}`);
      if (typeof value.note !== "string" || value.note.length > 400)
        throw new Error(`Invalid note ${map.id}-${id}`);
      points[id] = {
        x: value.x,
        y: value.y,
        status: value.status,
        note: value.note.trim(),
      };
    }
    maps[map.id] = { imageRevision: entry.imageRevision, points };
  }
  return { version: 1, maps };
}

export function confirmedMarkers(
  data: BoatLocations,
  map: number,
  revision: string,
) {
  const entry = data.maps[map];
  if (!entry || entry.imageRevision !== revision) return {};
  return Object.fromEntries(
    Object.entries(entry.points).filter(
      ([, marker]) => marker.status === "confirmed",
    ),
  );
}

export function positionFromClient(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
) {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x: Math.round(x * 1e6) / 1e6, y: Math.round(y * 1e6) / 1e6 };
}
