// Shared between index.html (map/timeline explorer) and entity.html (permalink
// pages). Load this script before app.js or entity.js in the HTML.

const DATA_FILES = [
  "data/movements.json",
  "data/events.json",
  "data/people.json",
  "data/organizations.json",
  "data/texts.json",
  "data/places.json",
];

let allEntities = {}; // id -> entity, across every type

async function loadData() {
  const files = await Promise.all(DATA_FILES.map((f) => fetch(f).then((r) => r.json())));
  files.flat().forEach((entity) => { allEntities[entity.id] = entity; });
}

function entityName(entity) {
  return entity ? (entity.title || entity.name) : null;
}

// Decimal year (e.g. 1946.75) so month-level dates place sensibly on the timeline
// and so two events in the same year don't automatically collide.
function entityDecimalYear(entity) {
  const raw = (entity.period && entity.period.start) || entity.date;
  if (!raw) return null;
  const parts = raw.split("-");
  const year = parseInt(parts[0], 10);
  const month = parts[1] ? parseInt(parts[1], 10) : 1;
  const day = parts[2] ? parseInt(parts[2], 10) : 1;
  if (Number.isNaN(year)) return null;
  return year + (month - 1) / 12 + (day - 1) / 365;
}

function entityDateLabel(entity) {
  return entity.date || (entity.period ? `${entity.period.start} – ${entity.period.end}` : "");
}

function markerColor(entity) {
  if (entity.contested) return "#A33B2E"; // oxide -- flags contested content at a glance
  if (entity.type === "movement") return "#C99A3E"; // gold
  return "#5B6B4F"; // leaf, for events
}

function tagsHtml(entity) {
  const tags = [`<span class="tag type-${entity.type}">${entity.type}</span>`];
  if (entity.contested) tags.push(`<span class="tag contested">contested / verify sources</span>`);
  return tags.join("");
}

// asLink=true renders each relationship's target as a real link to its permalink
// page (entity.html?id=...). asLink=false renders plain text -- used in the
// inline map/timeline card, where navigating away mid-exploration isn't ideal.
function relationshipsHtml(entity, asLink) {
  const rels = entity.relationships || [];
  if (rels.length === 0) return "<li>None recorded yet.</li>";
  return rels.map((rel) => {
    const target = allEntities[rel.target];
    const name = target ? entityName(target) : rel.target;
    const label = rel.type.replace(/_/g, " ");
    const value = asLink && target
      ? `<a href="entity.html?id=${encodeURIComponent(rel.target)}">${name}</a>`
      : name;
    return `<li><strong>${label}</strong> — ${value}</li>`;
  }).join("");
}

function sourcesHtml(entity) {
  const sources = entity.sources || [];
  if (sources.length === 0) return "<div>No sources logged yet -- do not treat as verified.</div>";
  return sources
    .map((s) => `<div>&middot; <a href="${s.url}" target="_blank" rel="noopener">${s.citation}</a> (${s.type})</div>`)
    .join("");
}
