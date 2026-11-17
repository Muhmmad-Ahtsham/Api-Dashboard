"use strict";

/* ============================================================
   Lab 8: API Dashboard
   JSON + Fetch API + jQuery AJAX
   Loading, empty and error states, search, filter, pagination
   ============================================================ */

const DATA_URL = "data/sample.json";
const MISSING_URL = "data/missing.json";   // used to demonstrate the error state

let courses = [];        // data returned by the API
let currentPage = 1;

const byId = id => document.getElementById(id);

/* ---------- Helpers ---------- */

function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;                      // prevents XSS when using innerHTML
}

/* ---------- UI states ---------- */

function showStatus(type, html) {
  const box = byId("statusBox");
  box.className = "status " + type;
  box.innerHTML = html;
  box.hidden = false;
  byId("tablePanel").hidden = true;
}

function hideStatus() {
  byId("statusBox").hidden = true;
  byId("tablePanel").hidden = false;
}

function showLoading(methodName) {
  byId("refreshBtn").disabled = true;
  showStatus("loading", `<span class="spinner"></span>Loading data using ${methodName}...`);
}

function showError(message, methodName) {
  byId("refreshBtn").disabled = false;
  byId("requestInfo").textContent = `${methodName} request failed.`;
  showStatus("error", `<strong>Could not load data.</strong><br>${escapeHTML(message)}<br><br>
    <button type="button" class="btn" id="retryBtn">Try again</button>`);
}

/* ---------- Request 1: Fetch API ---------- */

function loadWithFetch(url, started) {
  fetch(url)
    .then(response => {
      // fetch only rejects on network failure, so HTTP errors must be checked manually
      if (!response.ok) throw new Error(`Request failed (HTTP ${response.status} for ${url})`);
      return response.json();
    })
    .then(json => handleSuccess(json, "Fetch", started))
    .catch(error => showError(error.message, "Fetch"));
}

/* ---------- Request 2: jQuery AJAX ---------- */

function loadWithAjax(url, started) {
  $.ajax({ url: url, method: "GET", dataType: "json", cache: false })
    .done(json => handleSuccess(json, "jQuery AJAX", started))
    .fail((xhr, status, errorText) => {
      let message;
      if (status === "parsererror") message = "The response was not valid JSON.";
      else if (xhr.status) message = `Request failed (HTTP ${xhr.status} ${errorText} for ${url})`;
      else message = "Network error. Run the project through http://localhost/ (not file://).";
      showError(message, "jQuery AJAX");
    });
}

/* ---------- Load controller ---------- */

function loadData() {
  const method = document.querySelector('input[name="method"]:checked').value;
  const methodName = method === "fetch" ? "Fetch" : "jQuery AJAX";
  const url = byId("errorToggle").checked ? MISSING_URL : DATA_URL;
  const delay = byId("slowToggle").checked ? 1500 : 0;

  showLoading(methodName);
  const started = performance.now();
  setTimeout(() => {
    if (method === "fetch") loadWithFetch(url, started);
    else loadWithAjax(url, started);
  }, delay);
}

function handleSuccess(json, methodName, started) {
  byId("refreshBtn").disabled = false;
  // Troubleshooting: always inspect the returned structure before rendering
  if (!json || !Array.isArray(json.courses)) {
    showError("Unexpected JSON structure: expected an object with a 'courses' array.", methodName);
    return;
  }
  courses = json.courses;
  buildDepartmentFilter();

  const ms = Math.round(performance.now() - started);
  byId("requestInfo").textContent =
    `Loaded ${courses.length} records via ${methodName} in ${ms} ms | Last updated: ${new Date().toLocaleTimeString()}`;

  currentPage = 1;
  render();
}

/* ---------- Filters ---------- */

function buildDepartmentFilter() {
  const select = byId("deptFilter");
  const previous = select.value;
  const departments = [...new Set(courses.map(c => c.department))].sort();
  select.innerHTML = `<option value="">All departments</option>` +
    departments.map(d => `<option value="${escapeHTML(d)}">${escapeHTML(d)}</option>`).join("");
  select.value = departments.includes(previous) ? previous : "";
}

function getFiltered() {
  const term = byId("searchInput").value.trim().toLowerCase();
  const dept = byId("deptFilter").value;
  const status = byId("statusFilter").value;
  return courses.filter(c =>
    (!term || [c.code, c.title, c.instructor].some(v => v.toLowerCase().includes(term))) &&
    (!dept || c.department === dept) &&
    (!status || c.status === status)
  );
}

/* ---------- Render ---------- */

function render() {
  // KPI cards
  const filtered = getFiltered();
  byId("kpiTotal").textContent = courses.length;
  byId("kpiShown").textContent = filtered.length;
  byId("kpiDepts").textContent = new Set(courses.map(c => c.department)).size;
  byId("kpiEnrolled").textContent = courses.reduce((sum, c) => sum + c.enrolled, 0);

  // Empty state: API returned no records
  if (courses.length === 0) {
    showStatus("empty", "The API returned no records.");
    return;
  }
  hideStatus();

  // Pagination
  const size = Number(byId("pageSize").value);
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * size;
  const pageRows = filtered.slice(start, start + size);

  byId("tableBody").innerHTML = pageRows.length
    ? pageRows.map(c => `
      <tr>
        <td>${escapeHTML(c.code)}</td>
        <td>${escapeHTML(c.title)}</td>
        <td>${escapeHTML(c.instructor)}</td>
        <td>${escapeHTML(c.department)}</td>
        <td>${escapeHTML(c.credits)}</td>
        <td>${escapeHTML(c.enrolled)} / ${escapeHTML(c.capacity)}</td>
        <td><span class="badge ${escapeHTML(c.status)}">${escapeHTML(c.status)}</span></td>
      </tr>`).join("")
    : `<tr><td colspan="7" style="text-align:center;color:#64748b">No courses match your search or filters.</td></tr>`;

  renderPagination(filtered.length, totalPages, start, pageRows.length);
}

function renderPagination(totalItems, totalPages, start, shown) {
  const nav = byId("pagination");
  if (totalItems === 0) { nav.innerHTML = ""; return; }

  let html = `<button class="btn" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>&laquo; Prev</button>`;
  for (let p = 1; p <= totalPages; p++) {
    html += `<button class="btn ${p === currentPage ? "active" : ""}" data-page="${p}" aria-label="Page ${p}"
             ${p === currentPage ? 'aria-current="page"' : ""}>${p}</button>`;
  }
  html += `<button class="btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>Next &raquo;</button>`;
  html += `<span class="info">Showing ${start + 1}-${start + shown} of ${totalItems}</span>`;
  nav.innerHTML = html;
}

/* ---------- Events ---------- */

byId("refreshBtn").addEventListener("click", loadData);

// Delegated handler: the Retry button is created dynamically inside the status box
byId("statusBox").addEventListener("click", e => {
  if (e.target.id === "retryBtn") loadData();
});

byId("pagination").addEventListener("click", e => {
  const btn = e.target.closest("button[data-page]");
  if (!btn || btn.disabled) return;
  currentPage = Number(btn.dataset.page);
  render();
});

["searchInput", "deptFilter", "statusFilter", "pageSize"].forEach(id =>
  byId(id).addEventListener(id === "searchInput" ? "input" : "change", () => { currentPage = 1; if (courses.length) render(); }));

byId("clearBtn").addEventListener("click", () => {
  byId("searchInput").value = "";
  byId("deptFilter").value = "";
  byId("statusFilter").value = "";
  currentPage = 1;
  if (courses.length) render();
});

// Switching method reloads so you can compare both in the Network tab
document.querySelectorAll('input[name="method"]').forEach(r => r.addEventListener("change", loadData));

/* ---------- Init ---------- */
loadData();
