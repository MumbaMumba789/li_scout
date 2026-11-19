(() => {
  "use strict";

  // ---------- Grading ----------
  // PLACEHOLDER: replace estimate() with the trained model.
  // Input: readings [{ minutes, volts }], cell { brand, chemistry, capacity, age }.
  // Output: { capacityPct, healthPct, grade: "reuse"|"weak"|"scrap", reason }.
  function estimate(readings) {
    const REFERENCE_MIN = 40;      // placeholder reference duration for a healthy cell
    const CUTOFF_V = 3.0;          // discharge cut-off voltage
    const above = readings.filter(r => r.volts >= CUTOFF_V);
    const span = above.length ? above[above.length - 1].minutes - above[0].minutes : 0;
    const capacityPct = Math.max(0, Math.min(100, Math.round((span / REFERENCE_MIN) * 100)));
    const healthPct = Math.max(0, capacityPct - 2);
    let grade, reason;
    if (healthPct >= 80) {
      grade = "reuse";
      reason = "This cell still holds good charge and can be reused in devices or solar kits.";
    } else if (healthPct >= 50) {
      grade = "weak";
      reason = "This cell holds less charge. It may suit low-demand uses only.";
    } else {
      grade = "scrap";
      reason = "This cell holds very little usable charge. It should go to recycling.";
    }
    return { capacityPct, healthPct, grade, reason };
  }

  // ---------- Parsing ----------
  function parseCsv(text) {
    const rows = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const readings = [];
    for (const row of rows) {
      const cols = row.split(/[,;\t]/).map(c => c.trim());
      if (cols.length < 2) continue;
      const minutes = Number(cols[0]);
      const volts = Number(cols[1]);
      if (Number.isFinite(minutes) && Number.isFinite(volts)) readings.push({ minutes, volts });
    }
    return readings.sort((a, b) => a.minutes - b.minutes);
  }

  // ---------- Navigation ----------
  const screens = document.querySelectorAll("[data-screen]");
  const newTest = document.getElementById("newTest");
  function show(name) {
    screens.forEach(s => { s.hidden = s.dataset.screen !== name; });
    newTest.hidden = name === "home";
    window.scrollTo({ top: 0 });
  }
  document.addEventListener("click", e => {
    const go = e.target.closest("[data-go]");
    if (go) { e.preventDefault(); show(go.dataset.go); }
  });

  // ---------- Table ----------
  const tbody = document.querySelector("#readingsTable tbody");
  function addRow(minutes = "", volts = "") {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="number" step="any" min="0" name="minutes" aria-label="Time in minutes" value="${minutes}"></td>
      <td><input type="number" step="0.01" min="0" name="volts" aria-label="Voltage in volts" value="${volts}"></td>
      <td><button class="row-del" type="button" aria-label="Remove row">×</button></td>`;
    tbody.appendChild(tr);
  }
  document.getElementById("addRow").addEventListener("click", () => addRow());
  tbody.addEventListener("click", e => {
    if (e.target.matches(".row-del")) e.target.closest("tr").remove();
  });
  for (const [m, v] of [[0, 4.2], [10, 4.05], [20, 3.85], [30, 3.6], [40, 3.3]]) addRow(m, v);

  function tableReadings() {
    return [...tbody.querySelectorAll("tr")].map(tr => ({
      minutes: Number(tr.querySelector('[name="minutes"]').value),
      volts: Number(tr.querySelector('[name="volts"]').value),
    })).filter(r => Number.isFinite(r.minutes) && Number.isFinite(r.volts) && r.volts > 0);
  }

  // ---------- Result ----------
  const entryError = document.getElementById("entryError");
  function renderResult(readings, cell) {
    const r = estimate(readings);
    const labels = { reuse: ["Reuse", "Good condition"], weak: ["Weak", "Use for low-demand jobs"], scrap: ["Scrap", "Send for recycling"] };
    const box = document.getElementById("gradeBox");
    box.className = "grade " + (r.grade === "reuse" ? "" : r.grade);
    document.getElementById("gradeLabel").textContent = labels[r.grade][0];
    document.getElementById("gradeSub").textContent = labels[r.grade][1];
    document.getElementById("capacityValue").textContent = r.capacityPct + "%";
    document.getElementById("healthValue").textContent = r.healthPct + "%";
    const reason = document.getElementById("reasonText");
    reason.className = "reason card " + r.grade;
    reason.textContent = r.reason + " (Placeholder estimate until the trained model is connected.)";
    drawCurve(readings);
    show("result");
  }

  function drawCurve(readings) {
    const svg = document.getElementById("curve");
    const W = 360, H = 200, L = 44, R = 12, T = 12, B = 34;
    const xs = readings.map(r => r.minutes), ys = readings.map(r => r.volts);
    const x0 = Math.min(...xs), x1 = Math.max(...xs, x0 + 1);
    const y0 = Math.floor(Math.min(...ys) * 10) / 10 - 0.1, y1 = Math.ceil(Math.max(...ys) * 10) / 10 + 0.1;
    const sx = m => L + ((m - x0) / (x1 - x0)) * (W - L - R);
    const sy = v => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
    const pts = readings.map(r => `${sx(r.minutes).toFixed(1)},${sy(r.volts).toFixed(1)}`).join(" ");
    const yTicks = [y0, (y0 + y1) / 2, y1].map(v => `<text x="${L - 6}" y="${sy(v) + 4}" text-anchor="end">${v.toFixed(1)}</text>`).join("");
    const xTicks = [x0, (x0 + x1) / 2, x1].map(m => `<text x="${sx(m)}" y="${H - 14}" text-anchor="middle">${Math.round(m)}</text>`).join("");
    svg.innerHTML = `
      <line class="axis" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"/>
      <line class="axis" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"/>
      ${yTicks}${xTicks}
      <text x="${W / 2}" y="${H - 1}" text-anchor="middle">Time (minutes)</text>
      <polyline class="line" points="${pts}"/>
      ${readings.map(r => `<circle class="dot" cx="${sx(r.minutes)}" cy="${sy(r.volts)}" r="3.5"/>`).join("")}`;
  }

  document.getElementById("entryForm").addEventListener("submit", e => {
    e.preventDefault();
    const readings = tableReadings();
    if (readings.length < 2) {
      entryError.textContent = "Please add at least two readings with a time and a voltage.";
      entryError.hidden = false;
      return;
    }
    entryError.hidden = true;
    const f = new FormData(e.target);
    renderResult(readings, Object.fromEntries(f));
  });

  // ---------- Upload ----------
  const uploadError = document.getElementById("uploadError");
  const fileInput = document.getElementById("fileInput");
  document.getElementById("uploadBtn").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    uploadError.hidden = true;
    if (file.size > 1024 * 1024) {
      uploadError.textContent = "That file is too large. Please upload a CSV under 1 MB.";
      uploadError.hidden = false;
      return;
    }
    const readings = parseCsv(await file.text());
    if (readings.length < 2) {
      uploadError.textContent = "We couldn't read that file. It needs two columns: time in minutes, then voltage in volts.";
      uploadError.hidden = false;
      return;
    }
    renderResult(readings, {});
  });

  show("home");
})();
