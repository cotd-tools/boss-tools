export interface ReferenceImage {
  map: number;
  point: number;
  index: number;
  url: string;
  filename: string;
}

// A zero suffix is a boat/map location; positive suffixes are black-water references.
export function indexImages(files: Record<string, string>): ReferenceImage[] {
  return Object.entries(files)
    .flatMap(([path, url]) => {
      const filename = path.split("/").pop() ?? "";
      const match = /^(\d+)-(\d+)-(\d+)\.(jpe?g|png|webp|avif)$/i.exec(
        filename,
      );
      if (!match) return [];
      const [, map, point, index] = match;
      if (+map! < 1 || +map! > 8 || +point! < 1) return [];
      return [{ map: +map!, point: +point!, index: +index!, url, filename }];
    })
    .sort(
      (a, b) =>
        a.map - b.map ||
        a.point - b.point ||
        a.index - b.index ||
        a.filename.localeCompare(b.filename),
    );
}
