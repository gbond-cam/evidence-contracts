// tools/compute-hashes.js
// Computes SHA-256 hashes for all contract artefacts (schemas, profiles, openapi, examples)
// and writes a hash manifest to dist/contract-manifest.json.
//
// Usage:
//   node tools/compute-hashes.js              # writes to dist/contract-manifest.json
//   node tools/compute-hashes.js --check      # verifies artefacts match existing manifest
//   node tools/compute-hashes.js --stdout     # prints manifest JSON to stdout only

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(ROOT, "dist", "contract-manifest.json");

const CHECK_MODE = process.argv.includes("--check");
const STDOUT_MODE = process.argv.includes("--stdout");

/** Directories (relative to ROOT) to include in the manifest. */
const INCLUDE_DIRS = ["schemas", "profiles", "openapi", "examples", "registry"];

/** File extensions to hash. */
const INCLUDE_EXTS = new Set([".json", ".yaml", ".yml"]);

/**
 * Recursively collect all files under a directory.
 * @param {string} dir  Absolute path
 * @param {string} base Root path for computing relative keys
 * @returns {string[]}  Absolute file paths
 */
function collectFiles(dir, base) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, base));
    } else if (INCLUDE_EXTS.has(path.extname(entry.name).toLowerCase())) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Compute the SHA-256 hash of a file's contents.
 * @param {string} filePath  Absolute path
 * @returns {string}  Hex-encoded SHA-256 digest
 */
function sha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

// Collect all files
const allFiles = INCLUDE_DIRS.flatMap((dir) =>
  collectFiles(path.join(ROOT, dir), ROOT)
);

// Build entries sorted by relative path for stable output
const entries = allFiles
  .map((abs) => ({
    path: path.relative(ROOT, abs).replace(/\\/g, "/"),
    sha256: sha256(abs),
    sizeBytes: fs.statSync(abs).size,
  }))
  .sort((a, b) => a.path.localeCompare(b.path));

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

const manifest = {
  name: pkg.name,
  version: pkg.version,
  artefactCount: entries.length,
  artefacts: entries,
};

if (CHECK_MODE) {
  // Verify against existing manifest
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error("ERROR: No manifest found at dist/contract-manifest.json — run without --check first.");
    process.exit(1);
  }
  const existing = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const existingMap = Object.fromEntries(existing.artefacts.map((e) => [e.path, e.sha256]));

  let ok = true;
  for (const entry of entries) {
    const expectedHash = existingMap[entry.path];
    if (!expectedHash) {
      console.warn(`  NEW:      ${entry.path}`);
    } else if (entry.sha256 !== expectedHash) {
      console.error(`  CHANGED:  ${entry.path}`);
      console.error(`            was:  ${expectedHash}`);
      console.error(`            now:  ${entry.sha256}`);
      ok = false;
    }
  }
  const currentPaths = new Set(entries.map((e) => e.path));
  for (const p of Object.keys(existingMap)) {
    if (!currentPaths.has(p)) console.warn(`  REMOVED:  ${p}`);
  }

  if (!ok) {
    console.error("\nHash check FAILED — artefacts have changed since the manifest was generated.");
    process.exit(1);
  }
  console.log(`Hash check PASSED — ${entries.length} artefacts verified.`);
} else {
  const json = JSON.stringify(manifest, null, 2);

  if (STDOUT_MODE) {
    process.stdout.write(json + "\n");
  } else {
    fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });
    fs.writeFileSync(MANIFEST_PATH, json, "utf8");
    console.log(`Wrote ${entries.length} entries to dist/contract-manifest.json`);
  }
}
