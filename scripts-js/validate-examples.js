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

// Recursively collect all JSON schema files under schemasDir.
function collectSchemaFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSchemaFiles(full));
    } else if (entry.name.endsWith(".json")) {
      results.push(full);
    }
  }
  return results;
}

const allSchemaFiles = collectSchemaFiles(schemasDir);

// First pass: build absolutePath -> $id map so relative $refs can be resolved
// by file path (works for both "./common.1.0.schema.json" and "../../common.1.0.schema.json").
const pathToId = {};
for (const filePath of allSchemaFiles) {
  const schema = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (schema.$id) pathToId[filePath] = schema.$id;
}

// Second pass: load each schema into AJV, patching relative $refs to the
// absolute $id URI of the referenced schema so AJV can resolve them.
for (const filePath of allSchemaFiles) {
  let schemaText = fs.readFileSync(filePath, "utf8");
  const schemaDir = path.dirname(filePath);
  // Replace any relative file $ref (./file.json or ../../file.json etc.) with
  // the absolute $id URI of the target schema + the JSON pointer fragment.
  schemaText = schemaText.replace(
    /"((?:\.\.\/|\.\/)[^"]+\.json)(#[^"]*)?"/g,
    (_match, relPath, frag) => {
      const absRef = path.resolve(schemaDir, relPath);
      const id = pathToId[absRef];
      return id ? `"${id}${frag ?? ""}"` : _match;
    }
  );
  const schema = JSON.parse(schemaText);
  if (!schema.$id) continue;
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
  {
    example: "examples/evidence-risk-profile.example.json",
    schema: "schemas/evidence-risk-profile/1.0/schema.json",
  },
  {
    example: "examples/evidence-client-identity.example.json",
    schema: "schemas/evidence-client-identity/1.0/schema.json",
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
