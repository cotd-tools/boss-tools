import { indexImages } from "./image-index";

export const maps = [
  { id: 1, points: 3 },
  { id: 2, points: 4 },
  { id: 3, points: 3 },
  { id: 4, points: 4 },
  { id: 5, points: 4 },
  { id: 6, points: 6 },
  { id: 7, points: 4 },
  { id: 8, points: 4 },
] as const;

const files = import.meta.glob<string>(
  "/images/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);
export const images = indexImages(files);
export const referencesFor = (map: number, point: number) =>
  images.filter((image) => image.map === map && image.point === point);
export const pointsFor = (map: (typeof maps)[number]) =>
  [
    ...new Set([
      ...Array.from({ length: map.points }, (_, i) => i + 1),
      ...images
        .filter((image) => image.map === map.id)
        .map((image) => image.point),
    ]),
  ].sort((a, b) => a - b);
