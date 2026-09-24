import { indexImages } from "./image-index";

export const maps = [
  { id: 1, name: "天堂岛", en: "PARADISE ISLAND", points: 3 },
  { id: 2, name: "北美五大湖", en: "GREAT LAKES", points: 4 },
  { id: 3, name: "哥斯达黎加", en: "COSTA RICA", points: 3 },
  { id: 4, name: "阿拉斯加", en: "ALASKA", points: 4 },
  { id: 5, name: "澳大利亚", en: "AUSTRALIA", points: 4 },
  { id: 6, name: "苏格兰", en: "SCOTLAND", points: 6 },
  { id: 7, name: "泰国", en: "THAILAND", points: 4 },
  { id: 8, name: "亚马逊", en: "AMAZON", points: 4 },
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
