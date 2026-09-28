import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { validateLocations } from "../src/lib/boat-locations.ts";
import catalog from "../src/data/map-catalog.json" with { type: "json" };

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
export function markerMiddleware(root: string) {
  let saving = false;
  return async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) => {
    if (req.url?.split("?")[0] !== "/__marker-editor") return next();
    const reply = (status: number, data: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
    };
    // This endpoint exists only in Vite dev and accepts loopback, same-origin writes.
    const host = req.headers.host ?? "";
    if (
      !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ||
      !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
        req.socket.remoteAddress ?? "",
      )
    )
      return reply(403, { error: "Local editor only" });
    const target = join(root, "src/data/boat-locations.json");
    try {
      if (req.method === "GET") {
        const content = await readFile(target, "utf8");
        return reply(200, {
          data: validateLocations(JSON.parse(content)),
          revision: hash(content),
        });
      }
      if (req.method !== "POST")
        return reply(405, { error: "Method not allowed" });
      if (
        req.headers.origin !== `http://${host}` ||
        !req.headers["content-type"]?.startsWith("application/json")
      )
        return reply(403, { error: "Same-origin JSON required" });
      if (saving) return reply(409, { error: "Another save is in progress" });
      saving = true;
      try {
        let body = "";
        for await (const chunk of req) {
          body += chunk.toString();
          if (Buffer.byteLength(body) > 128 * 1024)
            return reply(413, { error: "Data too large" });
        }
        const payload = JSON.parse(body);
        const data = validateLocations(payload.data);
        const previous = await readFile(target, "utf8");
        if (payload.baseRevision !== hash(previous))
          return reply(409, {
            error:
              "File changed. Export your draft, then reload before saving.",
          });
        const report = JSON.parse(
          await readFile(join(root, "images/optimization-report.json"), "utf8"),
        );
        for (const map of catalog) {
          const asset = report.images.find(
            (image: { key: string }) => image.key === map.slug,
          );
          if (!asset || data.maps[map.id]!.imageRevision !== asset.sourceSha256)
            return reply(409, {
              error: `Base map ${map.id} changed. Review its markers first.`,
            });
        }
        const backups = join(root, ".local/marker-backups");
        await mkdir(backups, { recursive: true });
        await writeFile(
          join(backups, `${Date.now()}-${randomUUID()}.json`),
          previous,
          { flag: "wx" },
        );
        const text = JSON.stringify(data, null, 2) + "\n";
        const temporary = `${target}.${randomUUID()}.tmp`;
        try {
          await writeFile(temporary, text, { flag: "wx" });
          if (hash(await readFile(target, "utf8")) !== payload.baseRevision)
            return reply(409, { error: "File changed during save" });
          await rename(temporary, target);
        } finally {
          await unlink(temporary).catch(() => {});
        }
        return reply(200, { data, revision: hash(text) });
      } finally {
        saving = false;
      }
    } catch (error) {
      return reply(400, {
        error: error instanceof Error ? error.message : "Save failed",
      });
    }
  };
}

export function markerEditorPlugin(): Plugin {
  return {
    name: "local-marker-editor",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(markerMiddleware(server.config.root));
    },
  };
}
