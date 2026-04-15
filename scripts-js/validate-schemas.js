const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const schemasDir = path.join(__dirname, "..", "schemas");
const schemaFiles = [
  "common.1.0.schema.json",
  "evidence-item-result.1.0.schema.json",
  "ingestion-status.1.0.schema.json",
  "ingestion-request.1.0.schema.json"
];

const ajv = new Ajv({ allErrors: true, strict: true, loadSchema: loadSchema });
addFormats(ajv);

async function loadSchema(uri) {
  // supports relative refs like "common.1.0.schema.json"
  const filePath = path.join(schemasDir, uri);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

(async () => {
  try {
    for (const f of schemaFiles) {
      const raw = fs.readFileSync(path.join(schemasDir, f), "utf8");
      const schema = JSON.parse(raw);
      await ajv.compileAsync(schema);
      console.log(`OK schema: ${f}`);
    }
    process.exit(0);
  } catch (e) {
    console.error("Schema validation/compilation failed:");
    console.error(e);
    process.exit(1);
  }
})();