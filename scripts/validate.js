#!/usr/bin/env node
// Run: node scripts/validate.js
// No dependencies -- plain Node. Exits non-zero (and prints ERRORs) if
// anything is broken enough that it shouldn't be pushed. WARNINGs are
// judgment calls (e.g. missing sources) that don't block you, but are
// worth reading before you publish.

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const FILES = ["movements.json", "events.json", "people.json", "organizations.json", "texts.json", "places.json"];

let errors = [];
let warnings = [];
let allEntities = {};
let allIds = [];

FILES.forEach((file) => {
  const filePath = path.join(DATA_DIR, file);
  if (!fs.existsSync(filePath)) {
    errors.push(`${file}: file does not exist`);
    return;
  }

  let entities;
  try {
    entities = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    errors.push(`${file}: invalid JSON -- ${e.message}`);
    return;
  }

  entities.forEach((entity, i) => {
    const where = `${file}[${i}]`;

    if (!entity.id) {
      errors.push(`${where}: missing "id"`);
      return;
    }
    allIds.push(entity.id);
    if (allEntities[entity.id]) {
      errors.push(`${where}: duplicate id "${entity.id}" (also used in ${allEntities[entity.id]._file})`);
    }
    entity._file = file;
    allEntities[entity.id] = entity;

    if (!entity.type) errors.push(`${entity.id}: missing "type"`);
    if (!entity.title && !entity.name) errors.push(`${entity.id}: missing "title"/"name"`);
    if (!entity.summary_card) warnings.push(`${entity.id}: no summary_card -- explorer card will look empty`);

    if (entity.place) {
      const c = entity.place.coordinates;
      if (c) {
        if (!Array.isArray(c) || c.length !== 2 || typeof c[0] !== "number" || typeof c[1] !== "number") {
          errors.push(`${entity.id}: place.coordinates must be [lat, lng] numbers`);
        } else if (Math.abs(c[0]) > 90 || Math.abs(c[1]) > 180) {
          errors.push(`${entity.id}: place.coordinates [${c[0]}, ${c[1]}] out of valid lat/lng range`);
        }
      }
    }

    if (!entity.sources || entity.sources.length === 0) {
      warnings.push(`${entity.id}: no sources logged -- fine for a draft, but should not go live like this`);
    }
  });
});

// Second pass: relationships can only be checked once every id is known.
Object.values(allEntities).forEach((entity) => {
  (entity.relationships || []).forEach((rel) => {
    if (!rel.target) {
      errors.push(`${entity.id}: relationship missing "target"`);
      return;
    }
    if (!allEntities[rel.target]) {
      errors.push(`${entity.id}: relationship "${rel.type}" points to unknown id "${rel.target}"`);
    }
    if (!rel.type) {
      errors.push(`${entity.id}: relationship to "${rel.target}" is missing "type"`);
    }
  });
});

console.log(`Checked ${allIds.length} entities across ${FILES.length} files.\n`);

if (warnings.length) {
  console.log(`${warnings.length} warning(s):`);
  warnings.forEach((w) => console.log(`  - ${w}`));
  console.log("");
}

if (errors.length) {
  console.log(`${errors.length} ERROR(s) -- fix these before committing:`);
  errors.forEach((e) => console.log(`  ! ${e}`));
  process.exit(1);
} else {
  console.log("No errors. Safe to commit.");
  process.exit(0);
}
