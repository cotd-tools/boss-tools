import { indexImages } from "./image-index";
import catalog from "../data/map-catalog.json";
import report from "../../images/optimization-report.json";

export const maps = catalog;

const files = import.meta.glob<string>(
  [
    "/images/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}",
    "!/images/*-0.*",
  ],
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);
export const images = indexImages(files);
export const baseMaps = Object.fromEntries(
  maps.map((map) => {
    const asset = report.images.find((image) => image.key === map.slug);
    if (!asset)
      throw new Error(
        `Missing base map ${map.slug}. Run npm run images:optimize.`,
      );
    return [
      map.id,
      {
        url: files[`/images/${asset.output}`]!,
        revision: asset.sourceSha256,
        width: asset.width,
        height: asset.height,
      },
    ];
  }),
);
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
