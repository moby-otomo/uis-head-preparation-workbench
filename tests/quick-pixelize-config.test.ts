import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  QUICK_PIXELIZE_ALGORITHM_IDENTITY,
  QUICK_PIXELIZE_ALGORITHM_VERSION,
  assertQuickPixelizeConfig,
  type QuickPixelizeConfig,
} from "../src/quick-pixelize/config.js";
import { SCHEMA_IDS, SchemaRegistry } from "../src/validation/schema-registry.js";

test("Quick Pixelize configuration schema accepts the supported explicit version", async () => {
  const schemas = await SchemaRegistry.create();
  const config = JSON.parse(
    await readFile("fixtures/contracts/valid/quick-pixelize-config.json", "utf8"),
  ) as QuickPixelizeConfig;

  assert.equal(schemas.validate(SCHEMA_IDS.quickPixelizeConfig, config).valid, true);
  assert.doesNotThrow(() => assertQuickPixelizeConfig(config));
  assert.equal(config.algorithmVersion, QUICK_PIXELIZE_ALGORITHM_VERSION);
  assert.equal(QUICK_PIXELIZE_ALGORITHM_IDENTITY, "quick-pixelize/1.0.0");
});

test("Quick Pixelize configuration fails closed for unsupported behavior", async () => {
  const schemas = await SchemaRegistry.create();
  const invalid = JSON.parse(
    await readFile("fixtures/contracts/invalid/quick-pixelize-config-unsupported-resampling.json", "utf8"),
  );
  const result = schemas.validate(SCHEMA_IDS.quickPixelizeConfig, invalid);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.instancePath === "/resampling"));
  assert.throws(
    () => assertQuickPixelizeConfig(invalid),
    /unsupported resampling configuration/,
  );
});

test("Quick Pixelize rejects impossible target regions and unknown algorithm versions", async () => {
  const valid = JSON.parse(
    await readFile("fixtures/contracts/valid/quick-pixelize-config.json", "utf8"),
  ) as QuickPixelizeConfig;

  assert.throws(
    () => assertQuickPixelizeConfig({
      ...valid,
      transparentPadding: { top: 0, right: 32, bottom: 0, left: 32 },
    }),
    /leaves no target content region/,
  );
  assert.throws(
    () => assertQuickPixelizeConfig({ ...valid, algorithmVersion: "1.0.1" }),
    /unsupported Quick Pixelize algorithm version/,
  );
});
