function getRequestedId() {
  return new URLSearchParams(window.location.search).get("id");
}

function renderEntityPage(entity) {
  const page = document.getElementById("entry-page");

  if (!entity) {
    page.innerHTML = `
      <p class="not-found">No entity found for id "${getRequestedId() || ""}".
      Check the id, or <a href="index.html">go back to the map</a>.</p>
    `;
    return;
  }

  document.title = `${entityName(entity)} — Left history archive`;
  document.getElementById("page-catalog-id").textContent = entity.id;

  page.innerHTML = `
    <div class="entry-header">
      <div>${tagsHtml(entity)}</div>
      <h2>${entityName(entity)}</h2>
      <div class="meta">${entityDateLabel(entity)}${entity.place ? " · " + entity.place.name : ""}</div>
    </div>

    <p class="entry-summary">${entity.summary_card || ""}</p>

    <div class="entry-body">
      <p>${entity.full_entry || "Full entry not written yet."}</p>
    </div>

    ${entity.editor_note ? `<p class="editor-note"><em>Editor note: ${entity.editor_note}</em></p>` : ""}

    <h3>Related</h3>
    <ul class="rel-list entry-rel-list">${relationshipsHtml(entity, true)}</ul>

    <h3>Sources</h3>
    <div class="sources entry-sources">${sourcesHtml(entity)}</div>

    <a class="back-link" href="index.html">&larr; Back to the map</a>
  `;
}

async function main() {
  await loadData();
  const entity = allEntities[getRequestedId()];
  renderEntityPage(entity);
}

main();
