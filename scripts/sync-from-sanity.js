#!/usr/bin/env node
// Pulls published documents from the Sanity backend (protyaym/left-history-backend)
// and writes them into data/*.json in the shape the frontend already reads.
//
// Run:  node scripts/sync-from-sanity.js            (fetch live)
//       node scripts/sync-from-sanity.js dump.json  (use a saved GROQ response)
// Then: node scripts/validate.js
//
// Why a snapshot instead of fetching Sanity from the browser: one small static
// file per type loads fast on phones, the site keeps working if the Sanity
// project changes, and every content change lands in git history, which is
// the audit trail a contested archive needs.

const fs = require("fs");
const path = require("path");

const PROJECT_ID = "p90vg6so";
const DATASET = "production";
const QUERY = '*[_type in ["movement","event","person","organization","textContent","text","place"] && !(_id in path("drafts.**"))]';
const URL = `https://${PROJECT_ID}.apicdn.sanity.io/v2024-01-01/data/query/${DATASET}?query=${encodeURIComponent(QUERY)}`;

const OUT_DIR = path.join(__dirname, "..", "data");
const FILE_FOR_TYPE = {
  movement: "movements.json",
  event: "events.json",
  person: "people.json",
  organization: "organizations.json",
  text: "texts.json",
  place: "places.json",
};

const latLng = (g) => (g && typeof g.lat === "number" ? [g.lat, g.lng] : undefined);

function placeEmbed(p) {
  if (!p) return undefined;
  return { name: p.name, note: p.note, coordinates: latLng(p.coordinates) };
}

function strip(obj) {
  Object.keys(obj).forEach((k) => obj[k] === undefined && delete obj[k]);
  return obj;
}

function convert(doc, publishedIds, dropped) {
  const type = doc._type === "textContent" ? "text" : doc._type;
  const relationships = (doc.relationships || [])
    .filter((r) => {
      const ok = r.target && publishedIds.has(r.target._ref);
      if (!ok) dropped.push(`${doc._id} -[${r.relationType}]-> ${r.target && r.target._ref}`);
      return ok;
    })
    .map((r) => ({ type: r.relationType, target: r.target._ref }));

  const base = {
    id: doc._id,
    type,
    title: doc.title,
    name: doc.name,
    summary_card: doc.summaryCard,
    full_entry: doc.fullEntry,
    relationships,
    sources: (doc.sources || []).map((s) => strip({ citation: s.citation, type: s.sourceType, url: s.url })),
    contested: doc.contested,
    editor_note: doc.editorNote,
  };

  if (type === "movement") {
    base.period = strip({ start: doc.periodStart, end: doc.periodEnd, era: doc.era });
    base.place = placeEmbed(doc.place);
  }
  if (type === "event") {
    base.date = doc.date;
    base.place = placeEmbed(doc.place);
  }
  if (type === "person") base.role = doc.role;
  if (type === "organization") base.founded = doc.founded;
  if (type === "text") {
    base.date = doc.date;
    base.source_class = doc.sourceClass;
  }
  if (type === "place") {
    base.coordinates = latLng(doc.coordinates);
    base.admin_pre1947 = doc.adminPre1947;
    base.admin_post1947 = doc.adminPost1947;
    base.note = doc.note;
  }
  return strip(base);
}

async function main() {
  const fromFile = process.argv[2];
  const body = fromFile
    ? JSON.parse(fs.readFileSync(fromFile, "utf8"))
    : await fetch(URL).then((r) => {
        if (!r.ok) throw new Error(`Sanity returned HTTP ${r.status}`);
        return r.json();
      });

  const docs = body.result;
  const published = docs.filter((d) => d.published === true);
  const publishedIds = new Set(published.map((d) => d._id));
  const dropped = [];

  const buckets = Object.fromEntries(Object.values(FILE_FOR_TYPE).map((f) => [f, []]));
  published.forEach((doc) => {
    const entity = convert(doc, publishedIds, dropped);
    buckets[FILE_FOR_TYPE[entity.type]].push(entity);
  });

  Object.entries(buckets).forEach(([file, list]) => {
    list.sort((a, b) => a.id.localeCompare(b.id));
    fs.writeFileSync(path.join(OUT_DIR, file), JSON.stringify(list, null, 2) + "\n");
    console.log(`${file}: ${list.length}`);
  });

  console.log(`\n${published.length} published of ${docs.length} documents.`);
  if (dropped.length) {
    console.log(`${dropped.length} relationship(s) dropped because the target is unpublished or missing:`);
    dropped.forEach((d) => console.log(`  - ${d}`));
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
