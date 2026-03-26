import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [, , outputPathArg, ...inputPathArgs] = process.argv;

if (!outputPathArg || inputPathArgs.length === 0) {
  console.error("Usage: node scripts/build-word-dataset.mjs <output-json> <input-json...>");
  process.exit(1);
}

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const readDataset = async (filePath) => {
  const file = await readFile(filePath, "utf8");
  const value = JSON.parse(file);

  if (!Array.isArray(value)) {
    throw new Error(`Dataset must be an array: ${filePath}`);
  }

  return value;
};

const ensureValidEntry = (entry, filePath, index) => {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`Entry ${index + 1} is not an object in ${filePath}`);
  }

  if (!Number.isInteger(entry.id) || entry.id <= 0) {
    throw new Error(`Entry ${index + 1} has an invalid id in ${filePath}`);
  }

  for (const field of ["fi", "en", "fiSimple", "enSimple", "topic", "pos"]) {
    if (!isNonEmptyString(entry[field])) {
      throw new Error(`Entry ${entry.id} is missing ${field} in ${filePath}`);
    }
  }
};

const outputPath = path.resolve(outputPathArg);
const inputPaths = inputPathArgs.map((filePath) => path.resolve(filePath));

const merged = [];
const seenIds = new Set();
const seenFinnish = new Map();
const skippedDuplicates = [];

for (const inputPath of inputPaths) {
  const dataset = await readDataset(inputPath);

  dataset.forEach((entry, index) => {
    ensureValidEntry(entry, inputPath, index);

    const normalizedEntry = {
      id: entry.id,
      fi: entry.fi.trim(),
      en: entry.en.trim(),
      fiSimple: entry.fiSimple.trim(),
      enSimple: entry.enSimple.trim(),
      topic: entry.topic.trim(),
      pos: entry.pos.trim()
    };

    const existingEntry = seenFinnish.get(normalizedEntry.fi);
    if (existingEntry) {
      skippedDuplicates.push({
        fi: normalizedEntry.fi,
        keptId: existingEntry.id,
        skippedId: normalizedEntry.id,
        keptSource: existingEntry.source,
        skippedSource: inputPath
      });
      return;
    }

    if (seenIds.has(normalizedEntry.id)) {
      throw new Error(`Duplicate id ${normalizedEntry.id} encountered while keeping ${normalizedEntry.fi}`);
    }

    seenIds.add(normalizedEntry.id);
    seenFinnish.set(normalizedEntry.fi, { id: normalizedEntry.id, source: inputPath });
    merged.push(normalizedEntry);
  });
}

merged.sort((first, second) => first.id - second.id);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

console.log(`Wrote ${merged.length} entries to ${outputPath}`);
console.log(`Skipped ${skippedDuplicates.length} duplicate Finnish entries`);
