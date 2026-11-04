// The map/timeline explorer. Entity loading, colors, and the relationship/source
// rendering helpers now live in js/data.js (shared with entity.html) -- this
// file only handles the map, the timeline, the card overlay, and filters.

let map, markerLayer;
let timelineRange = { min: 1900, max: 2020 }; // recomputed from data once loaded

// Shared by both the map and the timeline, so filters behave identically in both views.
function getVisibleEntities() {
  const showMovements = document.getElementById("filter-movements").checked;
  const showEvents = document.getElementById("filter-events").checked;
  const yearCutoff = parseInt(document.getElementById("decade").value, 10);
  const regionFilter = document.getElementById("region").value;

  return Object.values(allEntities).filter((entity) => {
    if (!entity.place || !entity.place.coordinates) return false;
    if (entity.type === "movement" && !showMovements) return false;
    if (entity.type === "event" && !showEvents) return false;
    if (entity.type !== "movement" && entity.type !== "event") return false;

    const year = entityDecimalYear(entity);
    if (year && year > yearCutoff) return false;

    if (regionFilter !== "all") {
      const placeName = entity.place.name.toLowerCase();
      if (regionFilter === "bengal_india" && placeName.includes("pakistan")) return false;
      if (regionFilter === "east_pakistan" && !placeName.includes("pakistan") && !placeName.includes("nachole")) return false;
    }
    return true;
  });
}

// The inline card: a quick preview while exploring, deliberately kept lighter
// than the full entity.html page -- it does not link relationships away, so
// browsing the map doesn't accidentally navigate you off it.
function openCard(entity) {
  const card = document.getElementById("card");

  card.innerHTML = `
    <span class="catalog-id">${entity.id}</span>
    <h3>${entityName(entity)}</h3>
    <div class="meta">${entityDateLabel(entity)}${entity.place ? " · " + entity.place.name : ""}</div>
    <div>${tagsHtml(entity)}</div>
    <p>${entity.summary_card}</p>
    <button id="toggle-entry">Open full entry</button>
    <button id="close-card">Close</button>
    <div class="full-entry" id="full-entry-body">
      <p>${entity.full_entry || "Full entry not written yet."}</p>
      <ul class="rel-list">${relationshipsHtml(entity, false)}</ul>
      <div class="sources">${sourcesHtml(entity)}</div>
      ${entity.editor_note ? `<p style="color:#A33B2E"><em>Editor note: ${entity.editor_note}</em></p>` : ""}
      <a class="permalink" href="entity.html?id=${encodeURIComponent(entity.id)}">View full page &rarr;</a>
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

// ---------- MAP VIEW ----------

function initMap() {
  map = L.map("map").setView([24.5, 88.7], 6);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap, &copy; CARTO",
    maxZoom: 18,
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  window.addEventListener("resize", () => map.invalidateSize());
}

// Fix for the overlapping-marker bug: entities that share (near-)identical
// coordinates -- e.g. a movement and the event that kicked it off, both
// pinned to the same town -- get spread into a small circle around the true
// point instead of stacking exactly on top of each other, where only the
// topmost one was ever clickable.
function renderMarkers() {
  markerLayer.clearLayers();
  const visible = getVisibleEntities();

  // Group by rounded coordinate so near-duplicates cluster together too.
  const groups = {};
  visible.forEach((entity) => {
    const [lat, lng] = entity.place.coordinates;
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    (groups[key] = groups[key] || []).push(entity);
  });

  Object.values(groups).forEach((group) => {
    group.forEach((entity, i) => {
      let latlng = L.latLng(entity.place.coordinates);

      if (group.length > 1) {
        const angle = (2 * Math.PI * i) / group.length;
        const spreadPx = 14;
        const basePoint = map.latLngToLayerPoint(latlng);
        const offsetPoint = L.point(
          basePoint.x + Math.cos(angle) * spreadPx,
          basePoint.y + Math.sin(angle) * spreadPx
        );
        latlng = map.layerPointToLatLng(offsetPoint);
      }

      const marker = L.circleMarker(latlng, {
        radius: entity.type === "movement" ? 9 : 6,
        color: markerColor(entity),
        fillColor: markerColor(entity),
        fillOpacity: 0.85,
        weight: 1.5,
      }).addTo(markerLayer);

      marker.bindTooltip(entity.title, { direction: "top" });
      marker.on("click", () => openCard(entity));
    });
  });
}

// ---------- TIMELINE VIEW ----------

function computeTimelineRange() {
  // Only types that are drawn on the timeline: a text's publication date
  // (e.g. a 2026 article) must not stretch the axis.
  const years = Object.values(allEntities)
    .filter((e) => e.type === "movement" || e.type === "event")
    .map(entityDecimalYear)
    .filter((y) => y !== null);
  if (years.length === 0) return;
  timelineRange = {
    min: Math.floor(Math.min(...years)) - 1,
    max: Math.ceil(Math.max(...years)) + 1,
  };
}

function renderTimeline() {
  const container = document.getElementById("timeline");
  container.innerHTML = "";
  const visible = getVisibleEntities();

  const { min, max } = timelineRange;
  const span = max - min;
  const axisY = 240;
  const usableWidth = Math.max(container.clientWidth - 80, 600);

  const xForYear = (year) => 40 + ((year - min) / span) * usableWidth;

  const axisLine = document.createElement("div");
  axisLine.className = "tl-axis-line";
  axisLine.style.left = "40px";
  axisLine.style.width = usableWidth + "px";
  axisLine.style.right = "auto";
  container.appendChild(axisLine);

  const tickStep = span > 60 ? 10 : span > 20 ? 5 : 2;
  for (let y = Math.ceil(min / tickStep) * tickStep; y <= max; y += tickStep) {
    const x = xForYear(y);
    const tick = document.createElement("div");
    tick.className = "tl-tick";
    tick.style.left = x + "px";
    container.appendChild(tick);

    const label = document.createElement("div");
    label.className = "tl-tick-label";
    label.style.left = x + "px";
    label.textContent = y;
    container.appendChild(label);
  }

  const laneLabelTop = document.createElement("div");
  laneLabelTop.className = "tl-lane-label";
  laneLabelTop.style.top = (axisY - 70) + "px";
  laneLabelTop.textContent = "Movements";
  container.appendChild(laneLabelTop);

  const laneLabelBottom = document.createElement("div");
  laneLabelBottom.className = "tl-lane-label";
  laneLabelBottom.style.top = (axisY + 60) + "px";
  laneLabelBottom.textContent = "Events";
  container.appendChild(laneLabelBottom);

  const minGapPx = 16;
  const lanes = { movement: [], event: [] };

  visible.forEach((entity) => {
    const year = entityDecimalYear(entity);
    if (year === null) return;
    const lane = entity.type === "movement" ? "movement" : "event";
    lanes[lane].push({ entity, x: xForYear(year) });
  });

  Object.keys(lanes).forEach((laneName) => {
    lanes[laneName].sort((a, b) => a.x - b.x);
    let lastX = -Infinity;
    let row = 0;
    lanes[laneName].forEach((item) => {
      row = (item.x - lastX < minGapPx) ? row + 1 : 0;
      lastX = item.x;

      const rowOffset = 24 + row * 18;
      const y = laneName === "movement" ? axisY - rowOffset : axisY + rowOffset;

      const dot = document.createElement("div");
      dot.className = "tl-dot";
      dot.style.left = item.x + "px";
      dot.style.top = y + "px";
      dot.style.background = markerColor(item.entity);
      dot.title = item.entity.title;
      dot.addEventListener("click", () => openCard(item.entity));
      container.appendChild(dot);
    });
  });
}

// ---------- VIEW SWITCHING ----------

function switchView(view) {
  document.querySelectorAll(".view-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
  document.getElementById("map").style.display = view === "map" ? "block" : "none";
  document.getElementById("timeline").style.display = view === "timeline" ? "block" : "none";

  if (view === "map") {
    setTimeout(() => map.invalidateSize(), 0);
    renderMarkers();
  } else {
    renderTimeline();
  }
}

function currentView() {
  const active = document.querySelector(".view-tab.active");
  return active ? active.dataset.view : "map";
}

function rerenderCurrentView() {
  if (currentView() === "map") renderMarkers();
  else renderTimeline();
}

function buildFilterToggles() {
  document.querySelectorAll(".filter-header").forEach((header) => {
    header.addEventListener("click", () => {
      const section = header.closest(".filter-section");
      const isOpen = section.classList.contains("open");
      document.querySelectorAll(".filter-section.open").forEach((s) => {
        if (s !== section) s.classList.remove("open");
      });
      section.classList.toggle("open", !isOpen);
    });
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".filter-section")) {
      document.querySelectorAll(".filter-section.open").forEach((s) => s.classList.remove("open"));
    }
  });
}

// The slider range comes from the data, so new entities outside the pilot's
// 1938-1950 window don't silently fall off the start of the range.
function syncYearSliderToData() {
  const slider = document.getElementById("decade");
  slider.min = timelineRange.min;
  slider.max = timelineRange.max;
  slider.value = timelineRange.max;
  document.getElementById("decade-readout").textContent = "up to " + timelineRange.max;
}

async function main() {
  initMap();
  await loadData();
  computeTimelineRange();
  syncYearSliderToData();
  renderMarkers();
  buildFilterToggles();

  document.getElementById("filter-movements").addEventListener("change", rerenderCurrentView);
  document.getElementById("filter-events").addEventListener("change", rerenderCurrentView);
  document.getElementById("region").addEventListener("change", rerenderCurrentView);
  document.getElementById("decade").addEventListener("input", (e) => {
    document.getElementById("decade-readout").textContent = "up to " + e.target.value;
    rerenderCurrentView();
  });

  document.querySelectorAll(".view-tab").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });
}

main();
