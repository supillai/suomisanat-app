import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [, , outputPathArg, ...inputPathArgs] = process.argv;

if (!outputPathArg || inputPathArgs.length === 0) {
  console.error("Usage: node scripts/build-word-dataset.mjs <output-json> <input-json...>");
  process.exit(1);
}

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const normalizeFinnishKey = (value) =>
  value
    .trim()
    .toLocaleLowerCase("fi-FI")
    .replace(/[.,!?;:\u2026'"`\u00b4\u2019\u2018\-()/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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

const normalizeEntry = (entry) => ({
  id: entry.id,
  fi: entry.fi.trim(),
  en: entry.en.trim(),
  fiSimple: entry.fiSimple.trim(),
  enSimple: entry.enSimple.trim(),
  topic: entry.topic.trim(),
  pos: entry.pos.trim()
});

const outputPath = path.resolve(outputPathArg);
const inputPaths = inputPathArgs.map((filePath) => path.resolve(filePath));

const merged = [];
const seenIds = new Set();
const seenFinnish = new Map();
const seenNormalizedFinnish = new Map();
const skippedDuplicates = [];

const preservedInputPath = inputPaths[0];
const preservedDataset = await readDataset(preservedInputPath);
let maxPreservedId = 0;

preservedDataset.forEach((entry, index) => {
  ensureValidEntry(entry, preservedInputPath, index);

  const normalizedEntry = normalizeEntry(entry);
  if (seenFinnish.has(normalizedEntry.fi)) {
    throw new Error(`Duplicate Finnish entry ${normalizedEntry.fi} in preserved dataset ${preservedInputPath}`);
  }

  if (seenIds.has(normalizedEntry.id)) {
    throw new Error(`Duplicate id ${normalizedEntry.id} in preserved dataset ${preservedInputPath}`);
  }

  seenIds.add(normalizedEntry.id);
  seenFinnish.set(normalizedEntry.fi, { id: normalizedEntry.id, source: preservedInputPath });
  if (!seenNormalizedFinnish.has(normalizeFinnishKey(normalizedEntry.fi))) {
    seenNormalizedFinnish.set(normalizeFinnishKey(normalizedEntry.fi), { id: normalizedEntry.id, source: preservedInputPath, fi: normalizedEntry.fi });
  }
  merged.push(normalizedEntry);
  maxPreservedId = Math.max(maxPreservedId, normalizedEntry.id);
});

let nextAssignedId = maxPreservedId + 1;

for (const inputPath of inputPaths.slice(1)) {
  const dataset = await readDataset(inputPath);

  dataset.forEach((entry, index) => {
    ensureValidEntry(entry, inputPath, index);

    const normalizedEntry = normalizeEntry(entry);
    const normalizedKey = normalizeFinnishKey(normalizedEntry.fi);
    const existingEntry = seenFinnish.get(normalizedEntry.fi) ?? seenNormalizedFinnish.get(normalizedKey);

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

    normalizedEntry.id = nextAssignedId;
    nextAssignedId += 1;

    seenIds.add(normalizedEntry.id);
    seenFinnish.set(normalizedEntry.fi, { id: normalizedEntry.id, source: inputPath });
    seenNormalizedFinnish.set(normalizedKey, { id: normalizedEntry.id, source: inputPath, fi: normalizedEntry.fi });
    merged.push(normalizedEntry);
  });
}

merged.sort((first, second) => first.id - second.id);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

console.log(`Wrote ${merged.length} entries to ${outputPath}`);
console.log(`Preserved ids 1..${maxPreservedId} from ${preservedInputPath}`);
console.log(`Assigned new ids ${maxPreservedId + 1}..${merged.length}`);
console.log(`Skipped ${skippedDuplicates.length} duplicate Finnish entries`);
