// This file deliberately has no build step and no framework -- open it directly
// and read top to bottom. Every entity type is fetched, merged into one lookup
// table by id, then the map only cares about entities that have coordinates.

const DATA_FILES = [
  "data/movements.json",
  "data/events.json",
  "data/people.json",
  "data/organizations.json",
  "data/texts.json",
  "data/places.json",
];

let allEntities = {};   // id -> entity, across every type
let mapMarkers = [];    // { entity, marker } for everything currently plotted
let map, markerLayer;

async function loadData() {
  const files = await Promise.all(DATA_FILES.map((f) => fetch(f).then((r) => r.json())));
  files.flat().forEach((entity) => { allEntities[entity.id] = entity; });
}

function entityYear(entity) {
  const raw = (entity.period && entity.period.start) || entity.date;
  if (!raw) return null;
  return parseInt(raw.slice(0, 4), 10);
}

function markerColor(entity) {
  if (entity.contested) return "#A33B2E"; // oxide -- flags contested content at a glance
  if (entity.type === "movement") return "#C99A3E"; // gold
  return "#5B6B4F"; // leaf, for events
}

function initMap() {
  map = L.map("map").setView([24.5, 88.7], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 12,
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
}

function renderMarkers() {
  markerLayer.clearLayers();
  mapMarkers = [];

  const showMovements = document.getElementById("filter-movements").checked;
  const showEvents = document.getElementById("filter-events").checked;
  const yearCutoff = parseInt(document.getElementById("decade").value, 10);
  const regionFilter = document.getElementById("region").value;

  Object.values(allEntities).forEach((entity) => {
    if (!entity.place || !entity.place.coordinates) return;
    if (entity.type === "movement" && !showMovements) return;
    if (entity.type === "event" && !showEvents) return;
    if (entity.type !== "movement" && entity.type !== "event") return;

    const year = entityYear(entity);
    if (year && year > yearCutoff) return;

    if (regionFilter !== "all") {
      const placeName = entity.place.name.toLowerCase();
      if (regionFilter === "bengal_india" && placeName.includes("pakistan")) return;
      if (regionFilter === "east_pakistan" && !placeName.includes("pakistan") && !placeName.includes("nachole")) return;
    }

    const marker = L.circleMarker(entity.place.coordinates, {
      radius: entity.type === "movement" ? 9 : 6,
      color: markerColor(entity),
      fillColor: markerColor(entity),
      fillOpacity: 0.85,
      weight: 1.5,
    }).addTo(markerLayer);

    marker.bindTooltip(entity.title, { direction: "top" });
    marker.on("click", () => openCard(entity));
    mapMarkers.push({ entity, marker });
  });
}

function relationshipLabel(rel) {
  const target = allEntities[rel.target];
  const name = target ? (target.title || target.name) : rel.target;
  return `<li><strong>${rel.type.replace(/_/g, " ")}</strong> — ${name}</li>`;
}

function openCard(entity) {
  const card = document.getElementById("card");
  const tags = [`<span class="tag type-${entity.type}">${entity.type}</span>`];
  if (entity.contested) tags.push(`<span class="tag contested">contested / verify sources</span>`);

  const rels = (entity.relationships || []).map(relationshipLabel).join("");
  const sources = (entity.sources || [])
    .map((s) => `<div>&middot; <a href="${s.url}" target="_blank" rel="noopener">${s.citation}</a> (${s.type})</div>`)
    .join("") || "<div>No sources logged yet -- do not treat as verified.</div>";

  const dateLabel = entity.date || (entity.period ? `${entity.period.start} – ${entity.period.end}` : "");

  card.innerHTML = `
    <span class="catalog-id">${entity.id}</span>
    <h3>${entity.title || entity.name}</h3>
    <div class="meta">${dateLabel}${entity.place ? " · " + entity.place.name : ""}</div>
    <div>${tags.join("")}</div>
    <p>${entity.summary_card}</p>
    <button id="toggle-entry">Open full entry</button>
    <button id="close-card">Close</button>
    <div class="full-entry" id="full-entry-body">
      <p>${entity.full_entry || "Full entry not written yet."}</p>
      <ul class="rel-list">${rels}</ul>
      <div class="sources">${sources}</div>
      ${entity.editor_note ? `<p style="color:#A33B2E"><em>Editor note: ${entity.editor_note}</em></p>` : ""}
    </div>
  `;
  card.classList.add("open");

  document.getElementById("toggle-entry").onclick = (e) => {
    const body = document.getElementById("full-entry-body");
    body.classList.toggle("open");
    e.target.textContent = body.classList.contains("open") ? "Hide full entry" : "Open full entry";
  };
  document.getElementById("close-card").onclick = () => card.classList.remove("open");
}

async function main() {
  initMap();
  await loadData();
  renderMarkers();

  document.getElementById("filter-movements").addEventListener("change", renderMarkers);
  document.getElementById("filter-events").addEventListener("change", renderMarkers);
  document.getElementById("region").addEventListener("change", renderMarkers);
  document.getElementById("decade").addEventListener("input", (e) => {
    document.getElementById("decade-readout").textContent = "up to " + e.target.value;
    renderMarkers();
  });
}

main();
