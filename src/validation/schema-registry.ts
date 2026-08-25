import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import type { ErrorObject, ValidateFunction } from "ajv";
import * as Ajv2020Module from "ajv/dist/2020.js";
import * as AddFormatsModule from "ajv-formats";

export const SCHEMA_IDS = {
  sourceAsset: "https://moby-otomo.local/schemas/head-preparation/v1/source-asset.schema.json",
  preparationRun: "https://moby-otomo.local/schemas/head-preparation/v1/preparation-run.schema.json",
  candidateAsset: "https://moby-otomo.local/schemas/head-preparation/v1/candidate-asset.schema.json",
  reviewEvent: "https://moby-otomo.local/schemas/head-preparation/v1/review-event.schema.json",
  validationReport: "https://moby-otomo.local/schemas/head-preparation/v1/validation-report.schema.json",
  fixture: "https://moby-otomo.local/schemas/head-preparation/v1/fixture.schema.json",
  compatibilityProfile: "https://moby-otomo.local/schemas/head-preparation/v1/compatibility-profile.schema.json",
} as const;

export interface SchemaResult {
  valid: boolean;
  errors: ErrorObject[];
}

export class SchemaRegistry {
  private constructor(private readonly validators: Map<string, ValidateFunction>) {}

  static async create(schemaDirectory = path.resolve("schemas/v1")): Promise<SchemaRegistry> {
    const Ajv2020 = Ajv2020Module.default as unknown as typeof Ajv2020Module.Ajv2020;
    const addFormats = AddFormatsModule.default as unknown as AddFormatsModule.FormatsPlugin;
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const files = (await readdir(schemaDirectory)).filter((name) => name.endsWith(".schema.json")).sort();
    for (const file of files) {
      const schema = JSON.parse(await readFile(path.join(schemaDirectory, file), "utf8")) as object;
      ajv.addSchema(schema);
    }
    const validators = new Map<string, ValidateFunction>();
    for (const schemaId of Object.values(SCHEMA_IDS)) {
      const validator = ajv.getSchema(schemaId);
      if (!validator) throw new Error(`schema was not registered: ${schemaId}`);
      validators.set(schemaId, validator);
    }
    return new SchemaRegistry(validators);
  }

  validate(schemaId: string, document: unknown): SchemaResult {
    const validator = this.validators.get(schemaId);
    if (!validator) throw new Error(`unknown schema: ${schemaId}`);
    const valid = validator(document);
    return { valid, errors: validator.errors ? structuredClone(validator.errors) : [] };
  }
}
