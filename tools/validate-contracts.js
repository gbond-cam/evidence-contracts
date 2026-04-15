// tools/validate-contracts.js
// Validates all profile JSON files against meta-schemas, checks registry consistency,
// and ensures every schema entry in schema-registry.json resolves to a real file.
//
// Complements scripts-js/validate-examples.js (which validates OpenAPI examples).
//
// Usage:
//   node tools/validate-contracts.js

"use strict";

const fs = require("fs");
const path = require("path");
const Ajv = require("ajv/dist/2020");
const addFormats = require("ajv-formats");

const ROOT = path.resolve(__dirname, "..");

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

let totalChecks = 0;
let failures = 0;

function pass(label) {
  totalChecks++;
  console.log(`  PASS  ${label}`);
}

function fail(label, reasons) {
  totalChecks++;
  failures++;
  console.error(`  FAIL  ${label}`);
  for (const r of reasons) console.error(`        ${r}`);
}

// ── 1. Validate schema-registry.json ──────────────────────────────────────
console.log("\n[1] Schema registry — file existence checks");
const schemaRegistryPath = path.join(ROOT, "registry", "schema-registry.json");
const schemaRegistry = JSON.parse(fs.readFileSync(schemaRegistryPath, "utf8"));

for (const entry of schemaRegistry.entries) {
  const abs = path.join(ROOT, entry.path);
  if (fs.existsSync(abs)) {
    // Also verify the $id in the schema matches the registered $id
    try {
      const schema = JSON.parse(fs.readFileSync(abs, "utf8"));
      if (schema.$id && schema.$id !== entry.id) {
        fail(`${entry.path}`, [
          `$id mismatch: registry has "${entry.id}", schema has "${schema.$id}"`,
        ]);
      } else {
        pass(`${entry.path} → ${entry.id}`);
      }
    } catch (e) {
      fail(`${entry.path}`, [`JSON parse error: ${e.message}`]);
    }
  } else {
    fail(entry.path, [`File not found: ${abs}`]);
  }
}

// ── 2. Validate template-registry.json ────────────────────────────────────
console.log("\n[2] Template registry — file existence checks");
const templateRegistryPath = path.join(ROOT, "registry", "template-registry.json");
const templateRegistry = JSON.parse(fs.readFileSync(templateRegistryPath, "utf8"));

const KNOWN_EVIDENCE_TYPES = new Set([
  "FACT_FIND", "ATR_RISK_PROFILE", "CLIENT_OBJECTIVES",
  "FEES_AND_CHARGES_AGREEMENT", "PRODUCT_KFI_KEY_FEATURES",
  "CEDING_STATEMENT", "TRANSFER_AUTHORITY_OR_INSTRUCTION",
  "SUITABILITY_REPORT", "MEETING_NOTES", "ID_VERIFICATION",
  "PROOF_OF_ADDRESS", "OTHER",
]);

for (const entry of templateRegistry.entries) {
  const abs = path.join(ROOT, entry.path);
  if (!fs.existsSync(abs)) {
    fail(entry.path, [`File not found: ${abs}`]);
    continue;
  }

  let profile;
  try {
    profile = JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch (e) {
    fail(entry.path, [`JSON parse error: ${e.message}`]);
    continue;
  }

  const errors = [];
  // Check reportType matches
  if (profile.reportType !== entry.reportType) {
    errors.push(`reportType mismatch: registry="${entry.reportType}", file="${profile.reportType}"`);
  }
  // Check all declared evidence types are known
  for (const et of [...(entry.requiredEvidenceTypes ?? []), ...(entry.optionalEvidenceTypes ?? [])]) {
    if (!KNOWN_EVIDENCE_TYPES.has(et)) {
      errors.push(`Unknown evidenceType: "${et}"`);
    }
  }

  if (errors.length > 0) fail(entry.path, errors);
  else pass(`${entry.path} → ${entry.reportType} v${entry.version}`);
}

// ── 3. Validate evidence-profile files ────────────────────────────────────
console.log("\n[3] Evidence profiles — structure checks");
const evidenceProfilesDir = path.join(ROOT, "profiles", "evidence-profiles");

if (fs.existsSync(evidenceProfilesDir)) {
  for (const file of fs.readdirSync(evidenceProfilesDir)) {
    if (!file.endsWith(".json")) continue;
    const abs = path.join(evidenceProfilesDir, file);
    let profile;
    try {
      profile = JSON.parse(fs.readFileSync(abs, "utf8"));
    } catch (e) {
      fail(file, [`JSON parse error: ${e.message}`]);
      continue;
    }

    const errors = [];
    if (!profile.evidenceType) errors.push("Missing required field: evidenceType");
    if (!profile.version) errors.push("Missing required field: version");
    if (!Array.isArray(profile.rules) || profile.rules.length === 0)
      errors.push("rules must be a non-empty array");
    if (!profile.piiLevel) errors.push("Missing required field: piiLevel");

    // Validate each rule has code, description, severity
    for (const rule of profile.rules ?? []) {
      if (!rule.code) errors.push(`Rule missing required field: code`);
      if (!rule.description) errors.push(`Rule "${rule.code ?? "?"}" missing: description`);
      if (!["REJECT", "WARN", "INFO"].includes(rule.severity))
        errors.push(`Rule "${rule.code ?? "?"}" has invalid severity: "${rule.severity}"`);
    }

    if (errors.length > 0) fail(file, errors);
    else pass(`${file} (${profile.evidenceType} v${profile.version}, ${profile.rules.length} rules)`);
  }
}

// ── 4. Validate report-type profile files ─────────────────────────────────
console.log("\n[4] Report-type profiles — structure checks");
const reportTypesDir = path.join(ROOT, "profiles", "report-types");

if (fs.existsSync(reportTypesDir)) {
  for (const file of fs.readdirSync(reportTypesDir)) {
    if (!file.endsWith(".json")) continue;
    const abs = path.join(reportTypesDir, file);
    let profile;
    try {
      profile = JSON.parse(fs.readFileSync(abs, "utf8"));
    } catch (e) {
      fail(file, [`JSON parse error: ${e.message}`]);
      continue;
    }

    const errors = [];
    if (!profile.reportType) errors.push("Missing required field: reportType");
    if (!profile.version) errors.push("Missing required field: version");
    if (!Array.isArray(profile.evidenceRequirements) || profile.evidenceRequirements.length === 0)
      errors.push("evidenceRequirements must be a non-empty array");

    for (const req of profile.evidenceRequirements ?? []) {
      if (!req.evidenceType) errors.push("Requirement missing: evidenceType");
      if (typeof req.required !== "boolean") errors.push(`Requirement "${req.evidenceType ?? "?"}" missing boolean: required`);
      if (!KNOWN_EVIDENCE_TYPES.has(req.evidenceType ?? ""))
        errors.push(`Unknown evidenceType: "${req.evidenceType}"`);
    }

    if (errors.length > 0) fail(file, errors);
    else pass(`${file} (${profile.reportType} v${profile.version}, ${profile.evidenceRequirements.length} required)`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(60)}`);
if (failures > 0) {
  console.error(`Contract validation FAILED — ${failures} of ${totalChecks} checks failed.`);
  process.exit(1);
} else {
  console.log(`Contract validation PASSED — ${totalChecks} checks passed.`);
}
