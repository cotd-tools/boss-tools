import sharp from "sharp";
import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const reportName = "optimization-report.json";
const digest = (buffer) => createHash("sha256").update(buffer).digest("hex");
const imagePattern = /^([1-8])-([1-9]\d*)-(\d+)\.(jpe?g|png|webp|avif)$/i;
const referenceKey = (name) => {
  const match = imagePattern.exec(name);
  return match ? match.slice(1, 4).map(Number).join("-") : null;
};

async function optionalFile(path) {
  try { return await readFile(path); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

async function atomicWrite(path, data) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, data, { flag: "wx" });
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch((error) => { if (error.code !== "ENOENT") throw error; });
  }
}

export function encodingFor(key, format) {
  if (format === "avif") return { quality: key.endsWith("-0") ? 70 : 65, effort: 6, chromaSubsampling: "4:4:4" };
  if (format === "webp") return { quality: 90, effort: 6, smartSubsample: true };
  throw new Error(`Unsupported format: ${format}. Use avif or webp.`);
}

export async function optimizeImages(directory, { format = "avif", log = console.log } = {}) {
  encodingFor("1-1-1", format);
  const outputDir = resolve(directory);
  const originalDir = join(outputDir, "original");
  const sourceEntries = await readdir(originalDir, { withFileTypes: true });
  const sources = sourceEntries.filter((entry) => entry.isFile() && referenceKey(entry.name));
  if (!sources.length) throw new Error("No reference images in images/original/. Add originals before running this command.");
  sources.sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));

  const previousBytes = await optionalFile(join(outputDir, reportName));
  const previous = previousBytes ? JSON.parse(previousBytes) : { images: [] };
  const rootFiles = (await readdir(outputDir, { withFileTypes: true })).filter((entry) => referenceKey(entry.name));
  const keys = new Set();
  const jobs = [];
  // Validate the whole batch before creating or replacing any website assets.
  for (const entry of sources) {
    const key = referenceKey(entry.name);
    if (keys.has(key)) throw new Error(`Duplicate original for ${key}. Keep one source per map/spot/image number.`);
    keys.add(key);
    const source = await readFile(join(originalDir, entry.name));
    const sourceHash = digest(source);
    const old = previous.images.find((image) => image.key === key);
    const rootCopies = [];
    for (const candidate of rootFiles.filter((file) => referenceKey(file.name) === key)) {
      if (!candidate.isFile()) throw new Error(`Refusing to replace non-file: ${candidate.name}`);
      const bytes = await readFile(join(outputDir, candidate.name));
      const hash = digest(bytes);
      if (hash !== sourceHash && !(old?.output === candidate.name && old.outputSha256 === hash)) {
        throw new Error(`Unrecognized file images/${candidate.name}. Preserve it in original/ and resolve this conflict before processing.`);
      }
      rootCopies.push({ name: candidate.name, hash });
    }
    const options = encodingFor(key, format);
    const recipe = JSON.stringify({ format, options, sharp: sharp.versions.sharp, vips: sharp.versions.vips, pipeline: 1 });
    const cached = old?.source === entry.name && old.sourceSha256 === sourceHash && old.recipe === recipe &&
      rootCopies.some((file) => file.name === old.output && file.hash === old.outputSha256);
    jobs.push({ key, name: entry.name, source, sourceHash, rootCopies, options, recipe, cached: cached ? old : null });
  }

  const completed = [];
  for (const job of jobs) {
    if (job.cached) {
      completed.push({ job, record: job.cached, data: null });
      log(`Cached ${job.cached.output}`);
      continue;
    }
    const metadata = await sharp(job.source).metadata();
    if ((metadata.pages ?? 1) > 1) throw new Error(`Animated image is not supported: ${job.name}`);
    // Full resolution, no crop or resampling. Normalize orientation and sRGB before stripping metadata.
    const encoded = await sharp(job.source).autoOrient().toColourspace("srgb")[format](job.options).toBuffer();
    const keepSource = encoded.length >= job.source.length;
    const data = keepSource ? job.source : encoded;
    const output = keepSource ? job.name : `${job.key}.${format}`;
    const decoded = await sharp(data).autoOrient().raw().toBuffer({ resolveWithObject: true });
    const size = metadata.autoOrient ?? metadata;
    if (decoded.info.width !== size.width || decoded.info.height !== size.height) throw new Error(`Dimensions changed: ${job.name}`);
    const record = {
      key: job.key, source: job.name, output, sourceSha256: job.sourceHash, outputSha256: digest(data),
      sourceBytes: job.source.length, outputBytes: data.length, width: decoded.info.width, height: decoded.info.height,
      format: keepSource ? metadata.format : format, quality: keepSource ? null : job.options.quality,
      sourceKept: keepSource, recipe: job.recipe,
    };
    completed.push({ job, record, data });
    log(`${job.name} → ${output}: ${job.source.length} → ${data.length} bytes (${(100 * (1 - data.length / job.source.length)).toFixed(1)}% smaller)`);
  }

  // Catch edits made while encoding. Never overwrite an original or an unknown root file.
  for (const { job } of completed) {
    if (digest(await readFile(join(originalDir, job.name))) !== job.sourceHash) throw new Error(`Original changed during processing: ${job.name}`);
    for (const copy of job.rootCopies) {
      if (digest(await readFile(join(outputDir, copy.name))) !== copy.hash) throw new Error(`Website image changed during processing: ${copy.name}`);
    }
  }
  for (const { record, data, job } of completed) {
    if (!data) continue;
    const target = join(outputDir, record.output);
    if (!job.rootCopies.some((copy) => copy.name === record.output) && await optionalFile(target)) {
      throw new Error(`Output appeared during processing: ${record.output}`);
    }
    await atomicWrite(target, data);
  }
  const images = completed.map(({ record }) => record);
  const totals = images.reduce((sum, image) => ({ sourceBytes: sum.sourceBytes + image.sourceBytes, outputBytes: sum.outputBytes + image.outputBytes }), { sourceBytes: 0, outputBytes: 0 });
  const report = { version: 1, format, ...totals, images };
  await atomicWrite(join(outputDir, reportName), JSON.stringify(report, null, 2) + "\n");
  // Only remove verified source copies / previous generated outputs, after their replacements exist.
  for (const { job, record } of completed) {
    for (const copy of job.rootCopies) {
      if (copy.name !== record.output) {
        const path = join(outputDir, copy.name);
        if (digest(await readFile(path)) !== copy.hash) throw new Error(`Refusing to remove modified file: ${copy.name}`);
        await unlink(path);
      }
    }
  }
  log(`Total: ${images.length} images, ${(totals.sourceBytes / 1e6).toFixed(2)} MB → ${(totals.outputBytes / 1e6).toFixed(2)} MB, ${(100 * (1 - totals.outputBytes / totals.sourceBytes)).toFixed(1)}% smaller.`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.some((arg) => !/^--format=(avif|webp)$/.test(arg)) || args.length > 1) {
    console.error("Usage: npm run images:optimize [-- --format=avif|webp]");
    process.exitCode = 1;
  } else {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../images");
    optimizeImages(root, { format: args[0]?.split("=")[1] ?? "avif" }).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
}
