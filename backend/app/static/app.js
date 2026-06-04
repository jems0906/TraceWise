const statusEl = document.getElementById("status");
const reqTableBody = document.querySelector("#requirements-table tbody");
const matrixBody = document.querySelector("#matrix-table tbody");
const selectedEl = document.getElementById("selected-requirement");
const outputEl = document.getElementById("action-output");
const authStatusEl = document.getElementById("auth-status");
const loginBtn = document.getElementById("btn-login");
const demoLoginBtn = document.getElementById("btn-demo-login");
const logoutBtn = document.getElementById("btn-logout");
const demoRoleEl = document.getElementById("demo-role");
const auditTableBody = document.querySelector("#audit-table tbody");
const versionTableBody = document.querySelector("#version-table tbody");
const traceTableBody = document.querySelector("#trace-table tbody");
const auditFilterForm = document.getElementById("audit-filter-form");
const auditActorEl = document.getElementById("audit-actor");
const auditActionEl = document.getElementById("audit-action");
const auditFromEl = document.getElementById("audit-from");
const auditToEl = document.getElementById("audit-to");
const auditQEl = document.getElementById("audit-q");
const auditResetEl = document.getElementById("audit-reset");

let selectedRequirementId = null;
let priorityChart = null;
let authState = {
  auth_required: false,
  oauth_ready: false,
  demo_login_enabled: true,
  user: null,
  permissions: { can_write: true, can_export_audit: false },
};
let auditFilters = { actor: "", action: "", from_date: "", to_date: "", q: "" };

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res.text();
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = `alert mt-4 mb-0 ${isError ? "alert-danger" : "alert-light border"}`;
}

function writeControls() {
  return [
    document.querySelector("#intake-form button[type='submit']"),
    document.querySelector("#trace-form button[type='submit']"),
    document.getElementById("btn-clarify"),
  ];
}

function updateAuthUI() {
  const user = authState.user;
  const loggedIn = Boolean(user);
  const authRequired = Boolean(authState.auth_required);

  authStatusEl.textContent = loggedIn
    ? `Signed in as ${user.name || user.email} (${user.role || "analyst"})`
    : authRequired
      ? "Sign-in required for write actions"
      : "Auth optional: guest mode active";

  loginBtn.disabled = !authState.oauth_ready;
  demoLoginBtn.disabled = !authState.demo_login_enabled;
  logoutBtn.disabled = !loggedIn;

  const canWrite = Boolean(authState.permissions?.can_write);
  const disableWrites = authRequired ? !loggedIn || !canWrite : !canWrite;
  writeControls().forEach((el) => {
    if (el) el.disabled = disableWrites;
  });

  const exportAuditBtn = document.getElementById("export-audit");
  if (exportAuditBtn) {
    exportAuditBtn.disabled = !Boolean(authState.permissions?.can_export_audit);
  }

  if (loggedIn && user.role === "viewer") {
    setStatus("Viewer role active: write actions are disabled.");
  }
}

async function loadAuthState() {
  authState = await api("/auth/me");
  updateAuthUI();
}

function renderRequirements(rows) {
  reqTableBody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.id}</td>
      <td>${row.title}</td>
      <td>${row.priority}</td>
      <td>${row.impact}</td>
      <td>${row.created_by || "system"}</td>
      <td>${row.updated_by || "system"}</td>
      <td><button class="btn btn-sm btn-outline-primary">Select</button></td>
    `;
    tr.querySelector("button").addEventListener("click", () => {
      selectedRequirementId = row.id;
      selectedEl.textContent = `Selected: #${row.id} ${row.title}`;
      setStatus(`Selected requirement #${row.id}`);
      loadSelectedRequirementDetails().catch((error) => setStatus(error.message, true));
    });
    reqTableBody.appendChild(tr);
  });
}

function renderMatrix(rows) {
  matrixBody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>#${row.requirement_id} ${row.requirement_title}</td>
      <td>${row.user_story}</td>
      <td>${row.task}</td>
      <td>${row.test_case}</td>
    `;
    matrixBody.appendChild(tr);
  });
}

function renderDashboard(summary) {
  document.getElementById("kpi-total").textContent = summary.total_requirements || 0;
  document.getElementById("kpi-coverage").textContent = `${summary.trace_coverage_percent || 0}%`;

  const ctx = document.getElementById("priority-chart");
  const labels = Object.keys(summary.by_priority || {});
  const values = labels.map((key) => summary.by_priority[key]);

  if (priorityChart) priorityChart.destroy();
  priorityChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Requirements by Priority",
        data: values,
        backgroundColor: "#2a9d8f",
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
    },
  });
}

function renderAuditEvents(rows) {
  if (!auditTableBody) return;
  auditTableBody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(row.created_at).toLocaleString()}</td>
      <td>${row.user_name || row.user_email}</td>
      <td>${row.user_role}</td>
      <td>${row.action}</td>
      <td>${row.target_type}:${row.target_id}</td>
    `;
    auditTableBody.appendChild(tr);
  });
}

function renderSelectedVersions(rows) {
  if (!versionTableBody) return;
  versionTableBody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>v${row.version}</td>
      <td>${row.change_note}</td>
      <td>${row.created_by || "system"}</td>
    `;
    versionTableBody.appendChild(tr);
  });
}

function renderSelectedTraceLinks(rows) {
  if (!traceTableBody) return;
  traceTableBody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.user_story}</td>
      <td>${row.task}</td>
      <td>${row.test_case}</td>
      <td>${row.created_by || "system"}</td>
    `;
    traceTableBody.appendChild(tr);
  });
}

function clearSelectedTables() {
  if (versionTableBody) versionTableBody.innerHTML = "";
  if (traceTableBody) traceTableBody.innerHTML = "";
}

async function loadSelectedRequirementDetails() {
  if (!selectedRequirementId) {
    clearSelectedTables();
    return;
  }
  const [versions, traceLinks] = await Promise.all([
    api(`/api/requirements/${selectedRequirementId}/versions`),
    api(`/api/requirements/${selectedRequirementId}/traceability`),
  ]);
  renderSelectedVersions(versions);
  renderSelectedTraceLinks(traceLinks);
}

async function loadAll() {
  const params = new URLSearchParams({ limit: "20" });
  Object.entries(auditFilters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const [requirements, matrix, dashboard, auditEvents] = await Promise.all([
    api("/api/requirements"),
    api("/api/traceability/matrix"),
    api("/api/dashboard/summary"),
    api(`/api/audit/events?${params.toString()}`),
  ]);
  renderRequirements(requirements);
  renderMatrix(matrix);
  renderDashboard(dashboard);
  renderAuditEvents(auditEvents);
  await loadSelectedRequirementDetails();
}

async function downloadDoc(endpoint, filename) {
  const text = await api(endpoint);
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

document.getElementById("intake-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = {
      stakeholder: document.getElementById("stakeholder").value,
      priority: document.getElementById("priority").value,
      raw_input: document.getElementById("raw").value,
    };
    await api("/api/requirements/intake", { method: "POST", body: JSON.stringify(payload) });
    setStatus("Requirement created successfully.");
    event.target.reset();
    document.getElementById("stakeholder").value = "Business Team";
    document.getElementById("priority").value = "Medium";
    await loadAll();
    await loadSelectedRequirementDetails();
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.getElementById("trace-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedRequirementId) {
    setStatus("Select a requirement before adding trace links.", true);
    return;
  }
  try {
    const payload = {
      user_story: document.getElementById("trace-user-story").value,
      task: document.getElementById("trace-task").value,
      test_case: document.getElementById("trace-test").value,
    };
    await api(`/api/requirements/${selectedRequirementId}/trace-links`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setStatus("Trace link added.");
    event.target.reset();
    await loadAll();
    await loadSelectedRequirementDetails();
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.getElementById("btn-clarify").addEventListener("click", async () => {
  if (!selectedRequirementId) {
    setStatus("Select a requirement first.", true);
    return;
  }
  try {
    const data = await api(`/api/requirements/${selectedRequirementId}/clarify`, { method: "POST" });
    outputEl.textContent = `Missing: ${data.missing_information.join(" | ") || "None"}\nQuestions: ${data.clarification_questions.join(" | ")}\nAmbiguity: ${data.ambiguity_flags.join(" | ") || "None"}\nRisks: ${data.potential_risks.join(" | ") || "None"}`;
    setStatus("Clarification generated.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.getElementById("btn-duplicates").addEventListener("click", async () => {
  if (!selectedRequirementId) {
    setStatus("Select a requirement first.", true);
    return;
  }
  try {
    const data = await api(`/api/requirements/${selectedRequirementId}/duplicates`);
    outputEl.textContent = data.possible_duplicates.length
      ? `Possible duplicates: ${data.possible_duplicates.join(", ")}`
      : "No duplicates found.";
    setStatus("Duplicate check completed.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.getElementById("btn-activity").addEventListener("click", async () => {
  if (!selectedRequirementId) {
    setStatus("Select a requirement first.", true);
    return;
  }
  try {
    const events = await api(`/api/requirements/${selectedRequirementId}/activity?limit=10`);
    outputEl.textContent = events.length
      ? events.map((e) => `${new Date(e.created_at).toLocaleString()} | ${e.user_name} (${e.user_role}) | ${e.action}`).join("\n")
      : "No activity for this requirement yet.";
    setStatus("Requirement activity loaded.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.getElementById("export-brd").addEventListener("click", async () => {
  try {
    await downloadDoc("/api/export/brd", "tracewise_brd.txt");
    setStatus("BRD exported.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.getElementById("export-frd").addEventListener("click", async () => {
  try {
    await downloadDoc("/api/export/frd", "tracewise_frd.txt");
    setStatus("FRD exported.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.getElementById("export-audit").addEventListener("click", async () => {
  try {
    const params = new URLSearchParams({ limit: "1000" });
    Object.entries(auditFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    await downloadDoc(`/api/audit/events/export.csv?${params.toString()}`, "tracewise_audit_events.csv");
    setStatus("Audit CSV exported.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

auditFilterForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  auditFilters = {
    actor: (auditActorEl?.value || "").trim(),
    action: (auditActionEl?.value || "").trim(),
    from_date: auditFromEl?.value || "",
    to_date: auditToEl?.value || "",
    q: (auditQEl?.value || "").trim(),
  };
  await loadAll();
  setStatus("Audit filters applied.");
});

auditResetEl?.addEventListener("click", async () => {
  auditFilters = { actor: "", action: "", from_date: "", to_date: "", q: "" };
  if (auditActorEl) auditActorEl.value = "";
  if (auditActionEl) auditActionEl.value = "";
  if (auditFromEl) auditFromEl.value = "";
  if (auditToEl) auditToEl.value = "";
  if (auditQEl) auditQEl.value = "";
  await loadAll();
  setStatus("Audit filters reset.");
});

loginBtn.addEventListener("click", () => {
  window.location.href = "/auth/login";
});

demoLoginBtn.addEventListener("click", async () => {
  try {
    await api("/auth/demo-login", {
      method: "POST",
      body: JSON.stringify({
        email: `${demoRoleEl.value}@tracewise.local`,
        name: `Demo ${demoRoleEl.value.charAt(0).toUpperCase()}${demoRoleEl.value.slice(1)}`,
        role: demoRoleEl.value,
      }),
    });
    await loadAuthState();
    await loadAll();
    setStatus("Demo login successful.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await api("/auth/logout", { method: "POST" });
    await loadAuthState();
    await loadAll();
    setStatus("Logged out.");
  } catch (error) {
    setStatus(error.message, true);
  }
});

Promise.all([loadAuthState(), loadAll()])
  .then(() => setStatus("Loaded TraceWise dashboard."))
  .catch((error) => setStatus(error.message, true));
