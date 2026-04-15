// validate-examples.js
// Validates each example file against its JSON Schema using AJV (JSON Schema 2020-12).
// Examples are stored with a { summary, value } wrapper; only "value" is validated.
// Run: node scripts-js/validate-examples.js

"use strict";

const fs = require("fs");
const path = require("path");
// Must use the 2020-12 build — the schemas declare "$schema": "...draft/2020-12/schema"
const Ajv = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const ROOT = path.resolve(__dirname, "..");
const schemasDir = path.join(ROOT, "schemas");

// strict: false — allows "nullable", "example", and other annotation keywords
// that appear in the schemas without causing compilation errors.
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Pre-load all sibling schemas so relative $refs resolve correctly.
for (const file of fs.readdirSync(schemasDir)) {
  if (!file.endsWith(".json")) continue;
  const abs = path.join(schemasDir, file);
  const schema = JSON.parse(fs.readFileSync(abs, "utf8"));
  try {
    ajv.addSchema(schema, schema.$id);
  } catch {
    // Already registered — ignore.
  }
}

// Map: example file -> schema file that should validate its "value" node.
const EXAMPLE_SCHEMA_MAP = [
  {
    example: "examples/ingestion-pull.example.json",
    schema: "schemas/ingestion-request.1.0.schema.json",
  },
  {
    example: "examples/ingestion-push-inline.example.json",
    schema: "schemas/ingestion-request.1.0.schema.json",
  },
  {
    example: "examples/ingestion-reference-sharepoint.example.json",
    schema: "schemas/ingestion-request.1.0.schema.json",
  },
  {
    example: "examples/content-complete.example.json",
    schema: "schemas/ingestion-status.1.0.schema.json",
  },
];

let allPassed = true;

for (const { example, schema } of EXAMPLE_SCHEMA_MAP) {
  const examplePath = path.join(ROOT, example);
  const schemaPath = path.join(ROOT, schema);

  const wrapper = JSON.parse(fs.readFileSync(examplePath, "utf8"));
  // Unwrap the OpenAPI example envelope; fall back to the whole object if no wrapper.
  const data = Object.prototype.hasOwnProperty.call(wrapper, "value")
    ? wrapper.value
    : wrapper;

  // Schemas were pre-loaded by $id — retrieve the compiled validator directly
  // rather than calling ajv.compile() again (which would throw a duplicate-id error).
  const schemaObj = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const validate = ajv.getSchema(schemaObj.$id) ?? ajv.compile(schemaObj);
  const valid = validate(data);

  const label = `${example.padEnd(60)} vs ${path.basename(schema)}`;
  if (valid) {
    console.log(`  PASS  ${label}`);
  } else {
    console.error(`  FAIL  ${label}`);
    for (const err of validate.errors) {
      console.error(`         - ${err.instancePath || "/"} ${err.message}`);
    }
    allPassed = false;
  }
}

if (!allPassed) {
  console.error("\nOne or more example validations failed.");
  process.exit(1);
}

console.log("\nAll example validations passed.");
