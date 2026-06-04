const configuredBase = import.meta.env.VITE_API_BASE;
export const API_BASE = configuredBase !== undefined ? configuredBase : "http://localhost:8000";

function buildUrl(path) {
  return `${API_BASE}${path}`;
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, value);
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(buildUrl(path), {
    credentials: "include",
    headers,
    ...options,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Request failed: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

export const api = {
  authMe: () => request("/auth/me"),
  demoLogin: (payload) => request("/auth/demo-login", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  loginUrl: () => buildUrl("/auth/login"),
  listRequirements: () => request("/api/requirements"),
  intakeRequirement: (payload) =>
    request("/api/requirements/intake", { method: "POST", body: JSON.stringify(payload) }),
  updateRequirement: (id, payload) =>
    request(`/api/requirements/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  clarifyRequirement: (id) => request(`/api/requirements/${id}/clarify`, { method: "POST" }),
  duplicateCheck: (id) => request(`/api/requirements/${id}/duplicates`),
  listTraceability: (id) => request(`/api/requirements/${id}/traceability`),
  addTraceLink: (id, payload) =>
    request(`/api/requirements/${id}/trace-links`, { method: "POST", body: JSON.stringify(payload) }),
  matrix: () => request("/api/traceability/matrix"),
  dashboardSummary: () => request("/api/dashboard/summary"),
  listAuditEvents: (filters = {}) => request(`/api/audit/events${buildQuery(filters)}`),
  auditExportUrl: (filters = {}) => buildUrl(`/api/audit/events/export.csv${buildQuery(filters)}`),
  exportBrd: () => request("/api/export/brd"),
  exportFrd: () => request("/api/export/frd"),
  versions: (id) => request(`/api/requirements/${id}/versions`),
};
