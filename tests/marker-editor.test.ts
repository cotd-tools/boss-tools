import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  readdir,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { markerMiddleware } from "../scripts/marker-editor-plugin.ts";

test("local editor saves atomically with backup; rejects stale revisions, foreign origins and invalid data", async () => {
  const root = await mkdtemp(join(tmpdir(), "cotd-marker-test-"));
  const server = createServer();
  try {
    await mkdir(join(root, "src/data"), { recursive: true });
    await mkdir(join(root, "images"));
    const source = await readFile(
      new URL("../src/data/boat-locations.json", import.meta.url),
      "utf8",
    );
    await writeFile(join(root, "src/data/boat-locations.json"), source);
    await writeFile(
      join(root, "images/optimization-report.json"),
      await readFile(
        new URL("../images/optimization-report.json", import.meta.url),
      ),
    );
    const middleware = markerMiddleware(root);
    server.on("request", (req, res) => {
      void middleware(req, res, () => {
        res.writeHead(404);
        res.end();
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing address");
    const origin = `http://127.0.0.1:${address.port}`;
    const url = origin + "/__marker-editor";
    const current = await (await fetch(url)).json();
    const changed = structuredClone(current.data);
    changed.maps["1"].points["1"] = {
      x: 0.2,
      y: 0.3,
      status: "draft",
      note: "Fixture only",
    };
    const send = (
      data: unknown,
      baseRevision: string,
      requestOrigin = origin,
    ) =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: requestOrigin },
        body: JSON.stringify({ data, baseRevision }),
      });
    assert.equal(
      (await send(changed, current.revision, "https://foreign.example")).status,
      403,
    );
    const saved = await send(changed, current.revision);
    assert.equal(saved.status, 200);
    const result = await saved.json();
    assert.equal(result.data.maps["1"].points["1"].x, 0.2);
    assert.equal((await send(current.data, current.revision)).status, 409);
    const invalid = structuredClone(changed);
    invalid.maps["1"].points["1"].x = 2;
    assert.equal((await send(invalid, result.revision)).status, 400);
    const changedBase = structuredClone(changed);
    changedBase.maps["1"].imageRevision = "0".repeat(64);
    assert.equal((await send(changedBase, result.revision)).status, 409);
    assert.deepEqual(
      JSON.parse(
        await readFile(join(root, "src/data/boat-locations.json"), "utf8"),
      ),
      changed,
    );
    const backups = await readdir(join(root, ".local/marker-backups"));
    assert.equal(backups.length, 1);
    assert.equal(
      await readFile(join(root, ".local/marker-backups", backups[0]!), "utf8"),
      source,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const absolute = resolve(root);
    assert.ok(
      absolute.startsWith(resolve(tmpdir()) + sep) &&
        absolute.includes("cotd-marker-test-"),
    );
    await rm(absolute, { recursive: true });
  }
});
