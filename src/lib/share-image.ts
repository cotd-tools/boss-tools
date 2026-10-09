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
const PADDING = 72;
const GUTTER = 40;
const COLUMN_WIDTH = (WIDTH - PADDING * 2 - GUTTER) / 2;
const ROW_GAP = 24;
const PLACEHOLDER_HEIGHT = Math.round(COLUMN_WIDTH * 9 / 20);
const PHOTO_OFFSET = 88;
const GRID_TOP = 248;
const INK = "#171717";
const PAPER = "#fafaf7";
const MUTED = "#64645f";
const ACCENT = "#dc3027";
const HAIRLINE = "#d4d4ce";

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

function rule(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, thickness = 2, color = INK) {
  ctx.fillStyle = color;
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
  // Let each screenshot define its own height instead of adding letterbox bars.
  const photoHeights = photos.map((photo) => photo
    ? Math.round(COLUMN_WIDTH * photo.naturalHeight / photo.naturalWidth)
    : PLACEHOLDER_HEIGHT);
  let nextRowTop = GRID_TOP;
  const rowTops = Array.from({ length: rows }, (_, row) => {
    const top = nextRowTop;
    const height = Math.max(...photoHeights.slice(row * 2, row * 2 + 2));
    nextRowTop += PHOTO_OFFSET + height + ROW_GAP;
    return top;
  });
  const gridBottom = nextRowTop - ROW_GAP;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = gridBottom + 112;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, WIDTH, canvas.height);

  // The date and title share one baseline; supporting details follow the same grid.
  text(ctx, content.brand, PADDING, 60, 22, INK, 600, COLUMN_WIDTH);
  ctx.textAlign = "right";
  text(ctx, content.subtitle, WIDTH - PADDING, 60, 17, MUTED, 400, COLUMN_WIDTH);
  ctx.textAlign = "left";
  text(ctx, content.title, PADDING - 3, 154, 76, INK, 700, COLUMN_WIDTH);
  text(ctx, content.region, PADDING, 204, 22, MUTED, 400, COLUMN_WIDTH);
  ctx.textAlign = "right";
  text(ctx, content.date, WIDTH - PADDING, 154, 64, INK, 400, COLUMN_WIDTH);
  text(ctx, content.reset, WIDTH - PADDING, 204, 22, MUTED, 400, COLUMN_WIDTH);
  ctx.textAlign = "left";
  rule(ctx, PADDING, 232, WIDTH - PADDING * 2, 3);

  rowTops.slice(1).forEach((top) => {
    rule(ctx, PADDING, top - 8, WIDTH - PADDING * 2, 1, HAIRLINE);
  });

  content.spots.forEach((spot, index) => {
    const x = PADDING + (index % 2) * (COLUMN_WIDTH + GUTTER);
    const y = rowTops[Math.floor(index / 2)]!;
    // Put each point beside its map name, so they read as one heading.
    text(ctx, String(spot.point), x - 2, y + 68, 80, ACCENT, 700, 56);
    text(ctx, spot.name, x + 80, y + 68, 40, INK, 500, COLUMN_WIDTH - 80);

    const photoY = y + PHOTO_OFFSET;
    const photo = photos[index];
    const photoHeight = photoHeights[index]!;
    if (photo) {
      // Fill the column without cropping landmarks or painting a frame around the image.
      ctx.drawImage(photo, x, photoY, COLUMN_WIDTH, photoHeight);
    } else {
      ctx.fillStyle = "#efefeb";
      ctx.fillRect(x, photoY, COLUMN_WIDTH, photoHeight);
      text(ctx, content.missing, x + 32, photoY + photoHeight / 2, 24, MUTED, 400, COLUMN_WIDTH - 64);
    }
  });

  rule(ctx, PADDING, gridBottom + 32, WIDTH - PADDING * 2, 1, HAIRLINE);
  text(ctx, content.disclaimer, PADDING, gridBottom + 76, 18, MUTED, 400, WIDTH - PADDING * 2);
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
