export interface ShareSpot {
  mapLabel: string;
  name: string;
  pointLabel: string;
  imageUrl?: string;
}

export interface ShareImageContent {
  brand: string;
  subtitle: string;
  title: string;
  date: string;
  region: string;
  reset: string;
  count: string;
  reference: string;
  missing: string;
  instruction: string;
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
const GRID_TOP = 408;
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

function wrappedText(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, width: number, size: number, color: string) {
  ctx.font = `400 ${size}px ${FONT}`;
  ctx.fillStyle = color;
  let line = "";
  let baseline = y;
  // Keep English words together, while allowing CJK text to wrap naturally.
  const words = value.match(/\S+\s*|\s+/g) ?? [];
  for (const word of words) {
    const tokens = ctx.measureText(word).width > width ? Array.from(word) : [word];
    for (const token of tokens) {
      if (line && ctx.measureText(line + token).width > width) {
        ctx.fillText(line.trimEnd(), x, baseline);
        baseline += size * 1.5;
        line = "";
      }
      line += token;
    }
  }
  if (line) ctx.fillText(line.trimEnd(), x, baseline);
  return baseline;
}

/** Render one PNG, so pasting includes every daily spot on all platforms. */
export async function createShareImage(content: ShareImageContent): Promise<Blob> {
  if (!content.spots.length) throw new Error("No spots to share");
  const [photos] = await Promise.all([
    Promise.all(content.spots.map((spot) => spot.imageUrl ? loadImage(spot.imageUrl) : Promise.resolve(null))),
    document.fonts.ready,
  ]);
  const rows = Math.ceil(content.spots.length / 2);
  const gridBottom = GRID_TOP + rows * ROW_HEIGHT - 24;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = gridBottom + 288;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, WIDTH, canvas.height);

  // Swiss typography: an asymmetric masthead anchored to the photo grid.
  const secondColumn = PADDING + COLUMN_WIDTH + GUTTER;
  text(ctx, content.brand, PADDING, 64, 26, INK, 700, COLUMN_WIDTH);
  text(ctx, content.subtitle, secondColumn, 64, 18, MUTED, 400, COLUMN_WIDTH - 176);
  rule(ctx, PADDING, 88, WIDTH - PADDING * 2);
  text(ctx, content.title, PADDING - 4, 216, 100, INK, 700, 1192);
  ctx.textAlign = "right";
  text(ctx, String(content.spots.length).padStart(2, "0"), WIDTH - PADDING + 4, 216, 128, ACCENT, 700);
  text(ctx, content.count, WIDTH - PADDING, 256, 20, MUTED);
  ctx.textAlign = "left";
  text(ctx, content.date, PADDING, 312, 30, INK, 400, COLUMN_WIDTH);
  text(ctx, content.region, secondColumn, 312, 26, INK, 700, COLUMN_WIDTH);
  text(ctx, content.reset, secondColumn, 344, 20, MUTED, 400, COLUMN_WIDTH);
  rule(ctx, PADDING, 368, WIDTH - PADDING * 2, 4);

  content.spots.forEach((spot, index) => {
    const x = PADDING + (index % 2) * (COLUMN_WIDTH + GUTTER);
    const y = GRID_TOP + Math.floor(index / 2) * ROW_HEIGHT;
    rule(ctx, x, y, COLUMN_WIDTH);
    text(ctx, spot.mapLabel, x - 2, y + 48, 48, INK, 700, 72);
    text(ctx, spot.name, x + 88, y + 48, 32, INK, 700, COLUMN_WIDTH - 264);
    text(ctx, content.reference, x + 88, y + 76, 18, MUTED, 400, COLUMN_WIDTH - 264);
    ctx.textAlign = "right";
    text(ctx, spot.pointLabel, x + COLUMN_WIDTH, y + 48, 26, ACCENT, 700, 152);
    ctx.textAlign = "left";

    const photoY = y + 88;
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

  const footerY = gridBottom + 44;
  rule(ctx, PADDING, footerY, WIDTH - PADDING * 2, 4);
  wrappedText(ctx, content.instruction, PADDING, footerY + 48, COLUMN_WIDTH, 22, INK);
  wrappedText(ctx, content.disclaimer, secondColumn, footerY + 48, COLUMN_WIDTH, 20, MUTED);
  rule(ctx, PADDING, canvas.height - 80, WIDTH - PADDING * 2);
  text(ctx, content.brand, PADDING, canvas.height - 40, 20, INK, 700);
  text(ctx, content.subtitle, secondColumn, canvas.height - 40, 16, MUTED);
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
