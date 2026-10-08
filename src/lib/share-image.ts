export interface ShareSpot {
  name: string;
  point: number;
  imageUrl?: string;
}

export interface ShareImageContent {
  brand: string;
  subtitle: string;
  title: string;
  date: string;
  region: string;
  reset: string;
  missing: string;
  disclaimer: string;
  spots: ShareSpot[];
}

const FONT = '"Helvetica Neue", Helvetica, Arial, "PingFang SC", "Microsoft YaHei", sans-serif';
const WIDTH = 1600;
const PADDING = 64;
const GUTTER = 32;
const COLUMN_WIDTH = (WIDTH - PADDING * 2 - GUTTER) / 2;
const ROW_HEIGHT = 448;
const PHOTO_HEIGHT = 336;
const PHOTO_OFFSET = 80;
const GRID_TOP = 264;
const INK = "#171717";
const PAPER = "#fafaf7";
const MUTED = "#64645f";
const ACCENT = "#dc3027";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => finish(new Error("Image load timed out")), 15000);
    function finish(error?: Error) {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (error) reject(error);
      else resolve(image);
    }
    image.onload = () => image.naturalWidth ? finish() : finish(new Error("Empty image"));
    image.onerror = () => finish(new Error("Could not load share image"));
    // All references are packaged with the site; preserve its base path.
    image.src = url;
  });
}

function rule(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, thickness = 2) {
  ctx.fillStyle = INK;
  ctx.fillRect(x, y, width, thickness);
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string, weight = 400, maxWidth?: number) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  if (maxWidth && ctx.measureText(value).width > maxWidth) {
    // Fit long localized labels without horizontally distorting the type.
    const fittedSize = size * maxWidth / ctx.measureText(value).width;
    ctx.font = `${weight} ${fittedSize}px ${FONT}`;
  }
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

/** Render one PNG, so pasting includes every daily spot on all platforms. */
export async function createShareImage(content: ShareImageContent): Promise<Blob> {
  if (!content.spots.length) throw new Error("No spots to share");
  const [photos] = await Promise.all([
    Promise.all(content.spots.map((spot) => spot.imageUrl ? loadImage(spot.imageUrl) : Promise.resolve(null))),
    document.fonts.ready,
  ]);
  const rows = Math.ceil(content.spots.length / 2);
  const gridBottom = GRID_TOP + (rows - 1) * ROW_HEIGHT + PHOTO_OFFSET + PHOTO_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = gridBottom + 144;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, WIDTH, canvas.height);

  // A restrained Swiss masthead leaves the reference photos and spot numbers dominant.
  text(ctx, content.brand, PADDING, 56, 22, INK, 600, COLUMN_WIDTH);
  ctx.textAlign = "right";
  text(ctx, content.subtitle, WIDTH - PADDING, 56, 17, MUTED, 400, COLUMN_WIDTH);
  ctx.textAlign = "left";
  text(ctx, content.title, PADDING - 3, 152, 84, INK, 700, WIDTH - PADDING * 2);
  text(ctx, content.date, PADDING, 200, 26, INK, 400, COLUMN_WIDTH);
  ctx.textAlign = "right";
  text(ctx, `${content.region}  ·  ${content.reset}`, WIDTH - PADDING, 200, 22, MUTED, 400, COLUMN_WIDTH);
  ctx.textAlign = "left";
  rule(ctx, PADDING, 224, WIDTH - PADDING * 2);

  content.spots.forEach((spot, index) => {
    const x = PADDING + (index % 2) * (COLUMN_WIDTH + GUTTER);
    const y = GRID_TOP + Math.floor(index / 2) * ROW_HEIGHT;
    text(ctx, spot.name, x, y + 60, 34, INK, 500, COLUMN_WIDTH - 112);
    ctx.textAlign = "right";
    text(ctx, String(spot.point), x + COLUMN_WIDTH, y + 60, 76, ACCENT, 400, 88);
    ctx.textAlign = "left";

    const photoY = y + PHOTO_OFFSET;
    ctx.fillStyle = INK;
    ctx.fillRect(x, photoY, COLUMN_WIDTH, PHOTO_HEIGHT);
    const photo = photos[index];
    if (photo) {
      // Show the complete screenshot, including landmarks and bait indicators.
      const scale = Math.min(COLUMN_WIDTH / photo.naturalWidth, PHOTO_HEIGHT / photo.naturalHeight);
      const w = photo.naturalWidth * scale;
      const h = photo.naturalHeight * scale;
      ctx.drawImage(photo, x + (COLUMN_WIDTH - w) / 2, photoY + (PHOTO_HEIGHT - h) / 2, w, h);
    } else {
      text(ctx, content.missing, x + 32, photoY + PHOTO_HEIGHT / 2, 24, PAPER, 400, COLUMN_WIDTH - 64);
    }
  });

  text(ctx, content.disclaimer, PADDING, gridBottom + 64, 18, MUTED, 400, WIDTH - PADDING * 2);
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Could not encode share image")),
    "image/png",
  ));
}

/** Call during the click, before rendering finishes, to retain user activation. */
export async function copyShareImage(image: Blob | Promise<Blob>): Promise<void> {
  if (!globalThis.navigator?.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Image clipboard unavailable");
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": image })]);
}
