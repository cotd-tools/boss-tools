import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  confirmedMarkers,
  positionFromClient,
  validateLocations,
} from "../src/lib/boat-locations.ts";
import catalog from "../src/data/map-catalog.json" with { type: "json" };
const data = () =>
  validateLocations(
    JSON.parse(
      readFileSync(
        new URL("../src/data/boat-locations.json", import.meta.url),
        "utf8",
      ),
    ),
  );

test("coordinates are relative to actual rendered map bounds at any zoom and scroll offset", () => {
  assert.deepEqual(
    positionFromClient(250, 125, {
      left: 50,
      top: 25,
      width: 400,
      height: 200,
    }),
    { x: 0.5, y: 0.5 },
  );
  assert.deepEqual(
    positionFromClient(300, 250, {
      left: -100,
      top: 50,
      width: 800,
      height: 400,
    }),
    { x: 0.5, y: 0.5 },
  );
  assert.equal(
    positionFromClient(20, 30, { left: 50, top: 25, width: 400, height: 200 }),
    null,
  );
  assert.equal(
    positionFromClient(20, 30, { left: 0, top: 0, width: 0, height: 200 }),
    null,
  );
});
test("only confirmed markers on the same base revision reach the public map", () => {
  const doc = data();
  doc.maps["1"]!.points = {
    "1": { x: 0, y: 1, status: "confirmed", note: "" },
    "2": { x: 0.4, y: 0.8, status: "draft", note: "Review" },
  };
  assert.deepEqual(
    Object.keys(confirmedMarkers(doc, 1, doc.maps["1"]!.imageRevision)),
    ["1"],
  );
  assert.deepEqual(confirmedMarkers(doc, 1, "changed"), {});
});
test("marker data rejects malformed imports, unknown points, unsafe coordinates and statuses", () => {
  for (const bad of [-0.1, 1.1, NaN, Infinity, "0.5", null]) {
    const doc = data();
    doc.maps["1"]!.points["1"] = {
      x: bad as number,
      y: 0.3,
      status: "confirmed",
      note: "",
    };
    assert.throws(() => validateLocations(doc), /coordinates/);
  }
  const doc = data();
  doc.maps["1"]!.points["4"] = {
    x: 0.2,
    y: 0.3,
    status: "confirmed",
    note: "",
  };
  assert.throws(() => validateLocations(doc), /point/);
  delete doc.maps["1"]!.points["4"];
  doc.maps["1"]!.points["1"] = {
    x: 0.2,
    y: 0.3,
    status: "invalid" as "draft",
    note: "",
  };
  assert.throws(() => validateLocations(doc), /status/);
  delete doc.maps["1"];
  assert.throws(() => validateLocations(doc), /8 maps/);
  assert.throws(() => validateLocations({ version: 2, maps: {} }), /version/);
});
test("checked-in coordinates match all eight current base images without original files", () => {
  const doc = data();
  const report = JSON.parse(
    readFileSync(
      new URL("../images/optimization-report.json", import.meta.url),
      "utf8",
    ),
  );
  for (const map of catalog)
    assert.equal(
      doc.maps[map.id]!.imageRevision,
      report.images.find((i: { key: string }) => i.key === map.slug)
        .sourceSha256,
      `Review changed base ${map.slug}`,
    );
});
