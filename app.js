const state = {
  activeView: "dashboard",
  activeCategory: "All",
  selectedAssetId: null,
  confidence: 60,
  reportSections: {
    financial: true,
    legal: true,
    insurance: true,
    memory: true,
    medical: true,
    subscription: true
  },
  assets: [],
  timeline: [],
  beneficiaries: [],
  auditLog: [],
  findings: [],
  metrics: {
    totalAssets: 0,
    highConfidence: 0,
    recurringPayments: 0,
    beneficiaries: 0
  }
};

const categories = ["All", "Financial", "Insurance", "Legal", "Subscription", "Memory", "Medical", "Personal"];
const icons = {
  Financial: "$",
  Insurance: "I",
  Legal: "L",
  Subscription: "R",
  Memory: "M",
  Medical: "+",
  Personal: "P"
};

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return [...document.querySelectorAll(selector)];
}

function setView(view) {
  state.activeView = view;
  qsa(".view").forEach((section) => section.classList.toggle("active", section.id === view));
  qsa(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  qs("#view-title").textContent = view.charAt(0).toUpperCase() + view.slice(1);
}

function toast(message) {
  const element = qs("#toast");
  element.textContent = message;
  element.classList.add("show");
  window.setTimeout(() => element.classList.remove("show"), 2600);
}

async function apiJson(path, options = {}) {
  const response = await fetch(path, options);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(payload.error || response.statusText);
  }
  return response.json();
}

async function loadState() {
  const payload = await apiJson("/api/state");
  Object.assign(state, payload);
  if (!state.selectedAssetId && state.assets[0]) state.selectedAssetId = state.assets[0].id;
  renderAll();
}

function renderMetrics() {
  const metrics = [
    ["Total assets", state.metrics.totalAssets.toString(), "Persisted in local storage"],
    ["High confidence", state.metrics.highConfidence.toString(), "Ready for review"],
    ["Recurring payments", state.metrics.recurringPayments.toString(), "Detected receipt records"],
    ["Beneficiaries", state.metrics.beneficiaries.toString(), "Role-scoped access"]
  ];

  qs("#metric-grid").innerHTML = metrics
    .map(([label, value, caption]) => `
      <article class="metric-card">
        <span>${label}</span>
        <strong>${value}</strong>
        <span>${caption}</span>
      </article>
    `)
    .join("");

  const organized = state.assets.length
    ? Math.round((state.assets.filter((asset) => asset.reviewed || asset.confidence >= 85).length / state.assets.length) * 100)
    : 0;
  qs(".vault-core strong").textContent = `${organized}%`;
}

function renderFindings() {
  qs("#findings-list").innerHTML = state.findings
    .map(([title, text]) => `<article class="finding"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></article>`)
    .join("");
}

function renderCategoryTabs() {
  qs("#category-tabs").innerHTML = categories
    .map((category) => `<button class="${category === state.activeCategory ? "active" : ""}" data-category="${category}">${category}</button>`)
    .join("");
}

function filteredAssets() {
  const search = qs("#global-search").value.trim().toLowerCase();
  return state.assets.filter((asset) => {
    const matchesCategory = state.activeCategory === "All" || asset.category === state.activeCategory;
    const haystack = `${asset.name} ${asset.source} ${asset.category} ${asset.summary} ${asset.entities.join(" ")}`.toLowerCase();
    return matchesCategory && (!search || haystack.includes(search));
  });
}

function renderAssets() {
  const assets = filteredAssets();
  qs("#asset-count").textContent = `${assets.length} shown`;
  qs("#asset-table").innerHTML = assets
    .map((asset) => `
      <button class="asset-row ${asset.id === state.selectedAssetId ? "selected" : ""}" data-asset-id="${asset.id}">
        <span class="file-icon">${icons[asset.category] || "A"}</span>
        <span class="asset-name">
          <strong>${escapeHtml(asset.name)}</strong>
          <span class="asset-meta">${escapeHtml(asset.source)} | ${escapeHtml(asset.date)} | ${formatBytes(asset.size || 0)}</span>
        </span>
        <span class="pill">${escapeHtml(asset.category)}</span>
        <span class="confidence" title="${asset.confidence}% confidence"><span style="width:${asset.confidence}%"></span></span>
        <span class="asset-meta">${asset.reviewed ? "Reviewed" : escapeHtml(asset.sensitivity)}</span>
      </button>
    `)
    .join("") || `<p class="muted">No assets match the current filters.</p>`;

  if (!assets.some((asset) => asset.id === state.selectedAssetId) && assets[0]) {
    state.selectedAssetId = assets[0].id;
  }
  renderInspector();
}

function renderInspector() {
  const asset = state.assets.find((item) => item.id === state.selectedAssetId);
  if (!asset) {
    qs("#asset-inspector").innerHTML = `<h3>Inspector</h3><p class="muted">Upload or select an asset to review extraction.</p>`;
    return;
  }

  qs("#asset-inspector").innerHTML = `
    <div class="panel-heading">
      <h3>Inspector</h3>
      <span class="pill">${asset.confidence}% confidence</span>
    </div>
    <p class="eyebrow">${escapeHtml(asset.category)}</p>
    <h2>${escapeHtml(asset.name)}</h2>
    <p class="muted">${escapeHtml(asset.summary)}</p>
    <ul class="inspector-list">
      ${asset.entities.map((entity) => `<li>${escapeHtml(entity)}</li>`).join("")}
    </ul>
    ${asset.textPreview ? `<p class="muted text-preview">${escapeHtml(asset.textPreview)}</p>` : ""}
    <div class="inspector-actions">
      <button class="primary-button" id="mark-reviewed">${asset.reviewed ? "Reviewed" : "Mark reviewed"}</button>
      <button class="secondary-button" id="delete-asset">Delete</button>
      ${asset.storedName ? `<a class="secondary-button download-link" href="/api/assets/${asset.id}/download">Download</a>` : ""}
    </div>
  `;
}

function renderTimeline() {
  qs("#confidence-value").textContent = `${state.confidence}%`;
  const visibleEvents = state.timeline.filter((event) => event.confidence >= state.confidence);
  qs("#timeline-list").innerHTML = visibleEvents
    .map((event) => `
      <article class="timeline-card">
        <div class="timeline-date">${escapeHtml(event.date)}</div>
        <div>
          <div class="panel-heading">
            <h3>${escapeHtml(event.title)}</h3>
            <span class="pill">${event.confidence}%</span>
          </div>
          <p>${escapeHtml(event.text)}</p>
        </div>
      </article>
    `)
    .join("") || `<p class="muted">No timeline events meet the selected confidence threshold. Upload memory assets such as photo albums, travel notes, or event documents.</p>`;
}

function renderBeneficiaries() {
  qs("#beneficiary-grid").innerHTML = state.beneficiaries.length
    ? state.beneficiaries
    .map((person) => `
      <article class="beneficiary-card">
        <div class="avatar">${escapeHtml(person.name.split(" ").map((part) => part[0]).join("").slice(0, 2))}</div>
        <h3>${escapeHtml(person.name)}</h3>
        <p>${escapeHtml(person.role)}</p>
        <span class="pill">${escapeHtml(person.status)}</span>
        <div class="access-list">
          ${person.access.map((scope) => `<span class="pill">${escapeHtml(scope)}</span>`).join("")}
        </div>
        <button class="text-button delete-beneficiary" data-beneficiary-id="${person.id}">Remove</button>
      </article>
    `)
    .join("")
    : `<article class="beneficiary-card"><h3>No beneficiaries configured</h3><p>Add beneficiary management before using this for a real inheritance workflow.</p><span class="pill">Not configured</span></article>`;
}

function renderAuditLog() {
  qs("#audit-log").innerHTML = state.auditLog.length
    ? state.auditLog
        .map((entry) => `
          <article class="audit-entry">
            <strong>${escapeHtml(entry.action)}</strong>
            <span>${escapeHtml(entry.detail)}</span>
            <time>${new Date(entry.createdAt).toLocaleString()}</time>
          </article>
        `)
        .join("")
    : `<p class="muted">No audit events yet.</p>`;
}

function enabledReportSections() {
  return Object.entries(state.reportSections)
    .filter(([, enabled]) => enabled)
    .map(([section]) => section);
}

function renderReport() {
  const selected = enabledReportSections();
  const labels = {
    financial: "Financial",
    legal: "Legal",
    insurance: "Insurance",
    memory: "Memory",
    medical: "Medical",
    subscription: "Subscription"
  };

  qs("#report-preview").innerHTML = `
    <p class="eyebrow">Generated inheritance packet</p>
    <h2>Digital Estate Summary</h2>
    <p class="muted">Built from locally uploaded files and saved metadata. Review source files before financial or legal action.</p>
    ${selected.map((key) => reportSection(labels[key])).join("")}
  `;
}

function reportSection(category) {
  const assets = state.assets.filter((asset) => asset.category === category);
  const body = assets.length
    ? `<ul>${assets.map((asset) => `<li><strong>${escapeHtml(asset.name)}</strong>: ${escapeHtml(asset.summary)}</li>`).join("")}</ul>`
    : `<p>No ${escapeHtml(category.toLowerCase())} assets uploaded yet.</p>`;
  return `<section class="report-section"><h3>${escapeHtml(category)} Assets</h3>${body}</section>`;
}

function addChatMessage(text, type = "assistant", sources = []) {
  const log = qs("#chat-log");
  const message = document.createElement("div");
  message.className = `message ${type}`;
  message.textContent = text;
  log.appendChild(message);

  if (sources.length) {
    const list = document.createElement("div");
    list.className = "message sources";
    list.innerHTML = sources.map((source) => `<button data-asset-id="${source.id}">${escapeHtml(source.name)} (${escapeHtml(source.category)})</button>`).join("");
    log.appendChild(list);
  }

  log.scrollTop = log.scrollHeight;
}

async function uploadFiles(files) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const payload = await apiJson("/api/assets", {
    method: "POST",
    body: formData
  });
  Object.assign(state, payload.state);
  if (payload.assets[0]) state.selectedAssetId = payload.assets[0].id;
  renderAll();
  toast(`${files.length} file${files.length === 1 ? "" : "s"} saved and indexed`);
}

async function markReviewed() {
  const asset = state.assets.find((item) => item.id === state.selectedAssetId);
  if (!asset || asset.reviewed) return;
  const payload = await apiJson(`/api/assets/${asset.id}/review`, { method: "POST" });
  Object.assign(state, payload.state);
  renderAll();
  toast("Asset marked as reviewed");
}

async function deleteSelectedAsset() {
  const asset = state.assets.find((item) => item.id === state.selectedAssetId);
  if (!asset) return;
  const confirmed = window.confirm(`Delete ${asset.name}? This removes its saved file and metadata.`);
  if (!confirmed) return;
  const payload = await apiJson(`/api/assets/${asset.id}`, { method: "DELETE" });
  Object.assign(state, payload.state);
  state.selectedAssetId = state.assets[0] ? state.assets[0].id : null;
  renderAll();
  toast("Asset deleted");
}

async function addBeneficiary(form) {
  const formData = new FormData(form);
  const access = formData.getAll("access");
  const payload = await apiJson("/api/beneficiaries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: qs("#beneficiary-name").value,
      role: qs("#beneficiary-role").value,
      access
    })
  });
  Object.assign(state, payload.state);
  form.reset();
  renderAll();
  toast("Beneficiary added");
}

async function deleteBeneficiary(id) {
  const payload = await apiJson(`/api/beneficiaries/${id}`, { method: "DELETE" });
  Object.assign(state, payload.state);
  renderAll();
  toast("Beneficiary removed");
}

async function downloadReport() {
  const response = await fetch("/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sections: enabledReportSections() })
  });
  if (!response.ok) throw new Error("Report generation failed");
  const html = await response.text();
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "digital-estate-report.html";
  link.click();
  URL.revokeObjectURL(url);
  toast("Report downloaded from backend");
}

function bindEvents() {
  qsa(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  qsa("[data-view-jump]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.viewJump)));

  qs("#category-tabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.activeCategory = button.dataset.category;
    renderCategoryTabs();
    renderAssets();
  });

  qs("#asset-table").addEventListener("click", (event) => {
    const row = event.target.closest("[data-asset-id]");
    if (!row) return;
    state.selectedAssetId = row.dataset.assetId;
    renderAssets();
  });

  qs("#chat-log").addEventListener("click", (event) => {
    const button = event.target.closest("[data-asset-id]");
    if (!button) return;
    state.selectedAssetId = button.dataset.assetId;
    setView("assets");
    renderAssets();
  });

  qs("#asset-inspector").addEventListener("click", (event) => {
    if (event.target.id === "mark-reviewed") {
      markReviewed().catch((error) => toast(error.message));
    }
    if (event.target.id === "delete-asset") {
      deleteSelectedAsset().catch((error) => toast(error.message));
    }
  });

  qs("#beneficiary-form").addEventListener("submit", (event) => {
    event.preventDefault();
    addBeneficiary(event.currentTarget).catch((error) => toast(error.message));
  });

  qs("#beneficiary-grid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-beneficiary-id]");
    if (!button) return;
    deleteBeneficiary(button.dataset.beneficiaryId).catch((error) => toast(error.message));
  });

  qs("#global-search").addEventListener("input", () => {
    renderAssets();
    if (state.activeView !== "assets") setView("assets");
  });

  qs("#file-upload").addEventListener("change", (event) => {
    const files = [...event.target.files];
    if (files.length) uploadFiles(files).catch((error) => toast(error.message));
    event.target.value = "";
  });

  qs("#confidence-slider").addEventListener("input", (event) => {
    state.confidence = Number(event.target.value);
    renderTimeline();
  });

  qsa("[data-report-section]").forEach((input) => {
    state.reportSections[input.dataset.reportSection] = input.checked;
    input.addEventListener("change", () => {
      state.reportSections[input.dataset.reportSection] = input.checked;
      renderReport();
    });
  });

  qs("#export-report").addEventListener("click", () => downloadReport().catch((error) => toast(error.message)));
  qs("#lock-button").addEventListener("click", () => toast("Local vault session locked visually. Add authentication before production use."));

  qs("#chat-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = qs("#chat-input");
    const question = input.value.trim();
    if (!question) return;
    addChatMessage(question, "user");
    input.value = "";
    try {
      const payload = await apiJson("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
      });
      addChatMessage(payload.answer, "assistant", payload.sources || []);
    } catch (error) {
      addChatMessage(error.message);
    }
  });
}

function renderAll() {
  renderMetrics();
  renderFindings();
  renderCategoryTabs();
  renderAssets();
  renderTimeline();
  renderBeneficiaries();
  renderAuditLog();
  renderReport();
}

function formatBytes(bytes) {
  if (!bytes) return "sample";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

bindEvents();
renderAll();
loadState()
  .then(() => addChatMessage("The backend is connected. Upload real files, then ask me to search the saved estate."))
  .catch((error) => {
    toast(error.message);
    addChatMessage("The backend is not reachable. Start the project server with npm.cmd start.");
  });
