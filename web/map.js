(() => {
  "use strict";
  const GREEN = "#2b9348", AMBER = "#b26a00", SLATE = "#8a96a3";
  const $ = id => document.getElementById(id);
  const fmt = n => Number(n).toLocaleString();

  const map = L.map("map", { preferCanvas: true }).setView([-13.1, 27.8], 6);
  L.control.scale({ imperial: false }).addTo(map);

  const layers = { border: null, ground: L.layerGroup().addTo(map), processing: L.layerGroup() };
  const byCode = new Map();
  let active = null;

  function style(p) {
    const base = p.lithium_listed ? GREEN : SLATE;
    const opening = p.opening_soon && p.lithium_listed ? AMBER : base;
    return {
      color: opening,
      weight: p.lithium_listed ? 2 : 1,
      fillColor: opening,
      fillOpacity: p.kind === "application" ? 0.08 : 0.25,
      dashArray: p.kind === "application" ? "5 4" : null,
    };
  }

  function describe(p) {
    const reasons = (p.opening_reasons || []).map(r => `<li>${r}</li>`).join("") || "<li>None flagged</li>";
    const minerals = (p.pegmatite_minerals || []).join(", ") || "None of the pegmatite minerals listed";
    return `
      <dl>
        <dt>Code</dt><dd>${p.code || "–"}</dd>
        <dt>Type</dt><dd>${p.licence_type || p.kind}</dd>
        <dt>Status</dt><dd>${p.status || "–"}</dd>
        <dt>Holder</dt><dd>${p.holder || "–"}</dd>
        <dt>Granted</dt><dd>${p.granted || "–"}</dd>
        <dt>Expires</dt><dd>${p.expires || "–"}</dd>
        <dt>Minerals</dt><dd>${minerals}</dd>
      </dl>
      <p style="margin:10px 0 4px"><b>Why it may open</b></p>
      <ul style="margin:0 0 0 18px;padding:0">${reasons}</ul>`;
  }

  function showDetails(p) {
    const box = $("details");
    box.hidden = false;
    box.innerHTML = `<b>${p.code || "Licence"}</b>` + describe(p);
    active = p.code;
    document.querySelectorAll(".shortlist li").forEach(li => li.classList.toggle("on", li.dataset.code === p.code));
  }

  function banner(text) {
    const b = $("banner");
    b.textContent = text || "";
    b.style.display = text ? "block" : "none";
  }

  async function loadGround() {
    const params = new URLSearchParams();
    if ($("tOpening").checked) params.set("opening", "true");
    if (!$("tAll").checked) params.set("lithium", "true");
    banner("Loading ground…");
    try {
      const r = await fetch("api/licences?" + params.toString());
      if (!r.ok) throw new Error(r.status);
      const fc = await r.json();
      layers.ground.clearLayers();
      byCode.clear();
      const gj = L.geoJSON(fc, {
        style: f => style(f.properties),
        onEachFeature: (f, layer) => {
          const p = f.properties;
          if (p.code) byCode.set(p.code, layer);
          layer.bindTooltip(`${p.code || ""} · ${p.status || ""}`);
          layer.on("click", () => showDetails(p));
        },
      });
      gj.eachLayer(l => layers.ground.addLayer(l));
      banner(fc.features.length ? "" : "No ground matches these filters.");
    } catch (e) {
      banner("Could not load licences. Is the server running?");
    }
  }

  async function loadBorder() {
    try {
      const r = await fetch("api/border");
      const fc = await r.json();
      if (layers.border) map.removeLayer(layers.border);
      layers.border = L.geoJSON(fc, { style: { color: "#1f2933", weight: 1.5, fill: false, opacity: 0.7 } });
      if ($("tBorder").checked) layers.border.addTo(map);
      if (fc.features.length) map.fitBounds(layers.border.getBounds(), { padding: [20, 20] });
    } catch (e) { /* border is decorative */ }
  }

  async function loadSummary() {
    try {
      const s = await (await fetch("api/summary")).json();
      $("cLithium").textContent = fmt(s.lithium_listed);
      $("cOpening").textContent = fmt(s.lithium_opening_soon);
    } catch (e) {
      $("cLithium").textContent = "–"; $("cOpening").textContent = "–";
    }
  }

  async function loadShortlist() {
    const list = $("list");
    try {
      const data = await (await fetch("api/shortlist")).json();
      list.innerHTML = "";
      if (!data.items.length) {
        list.innerHTML = `<li class="empty">No lithium-listed ground is opening soon.</li>`;
        return;
      }
      data.items.slice(0, 200).forEach(p => {
        const li = document.createElement("li");
        li.dataset.code = p.code;
        li.innerHTML = `<div class="code">${p.code || "–"}</div>
          <div class="why">${(p.opening_reasons || []).join(" · ")}</div>`;
        li.addEventListener("click", () => {
          showDetails(p);
          const layer = byCode.get(p.code);
          if (layer) { map.fitBounds(layer.getBounds(), { maxZoom: 11, padding: [40, 40] }); layer.openTooltip(); }
        });
        list.appendChild(li);
      });
      if (data.items.length > 200) {
        const more = document.createElement("li");
        more.className = "empty";
        more.textContent = `Showing 200 of ${fmt(data.count)}. Download the CSV for the full list.`;
        list.appendChild(more);
      }
    } catch (e) {
      list.innerHTML = `<li class="empty">Could not load the shortlist.</li>`;
    }
  }

  $("tLithium").addEventListener("change", () => { $("tLithium").checked = true; loadGround(); });
  $("tOpening").addEventListener("change", loadGround);
  $("tAll").addEventListener("change", loadGround);
  async function loadProcessing() {
    layers.processing.clearLayers();
    if (!$("tProcessing").checked) { map.removeLayer(layers.processing); return; }
    try {
      const fc = await (await fetch("api/licences?kind=processing")).json();
      L.geoJSON(fc, {
        style: { color: "#1f5f8b", weight: 2, fillColor: "#1f5f8b", fillOpacity: 0.35 },
        onEachFeature: (f, layer) => layer.bindTooltip(f.properties.code || "Processing site"),
      }).eachLayer(l => layers.processing.addLayer(l));
      layers.processing.addTo(map);
    } catch (e) { /* optional layer */ }
  }
  $("tProcessing").addEventListener("change", loadProcessing);
  $("tBorder").addEventListener("change", () => {
    if (!layers.border) return;
    $("tBorder").checked ? layers.border.addTo(map) : map.removeLayer(layers.border);
  });

  loadBorder();
  loadGround();
  loadSummary();
  loadShortlist();
  if (location.hash === "#shortlist") $("shortlist").scrollIntoView();
})();
