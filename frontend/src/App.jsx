import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import Dashboard from "./components/Dashboard";
import IntakeForm from "./components/IntakeForm";
import RequirementDetail from "./components/RequirementDetail";
import RequirementList from "./components/RequirementList";
import TraceabilityMatrix from "./components/TraceabilityMatrix";

const defaultAuthState = {
  auth_required: true,
  oauth_ready: false,
  demo_login_enabled: false,
  user: null,
  permissions: { can_write: false, can_export_audit: false },
};

const emptyAuditFilters = { actor: "", action: "", from_date: "", to_date: "", q: "", limit: 20 };

export default function App() {
  const [requirements, setRequirements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [traceLinks, setTraceLinks] = useState([]);
  const [versions, setVersions] = useState([]);
  const [clarification, setClarification] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [matrix, setMatrix] = useState([]);
  const [summary, setSummary] = useState({ by_priority: {}, by_status: {} });
  const [authState, setAuthState] = useState(defaultAuthState);
  const [auditEvents, setAuditEvents] = useState([]);
  const [auditFilters, setAuditFilters] = useState(emptyAuditFilters);
  const [error, setError] = useState("");

  const selectedRequirement = useMemo(
    () => requirements.find((r) => r.id === selectedId) || null,
    [requirements, selectedId]
  );

  const loadAuthState = async () => {
    try {
      const data = await api.authMe();
      setAuthState(data);
    } catch (e) {
      setError(e.message);
    }
  };

  const loadAll = async () => {
    try {
      const [reqs, mx, dash, audit] = await Promise.all([
        api.listRequirements(),
        api.matrix(),
        api.dashboardSummary(),
        api.listAuditEvents(auditFilters),
      ]);
      setRequirements(reqs);
      setMatrix(mx);
      setSummary(dash);
      setAuditEvents(audit);
      if (!selectedId && reqs.length > 0) setSelectedId(reqs[0].id);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };

  const loadRequirementMeta = async (id) => {
    if (!id) return;
    try {
      const [trace, vers] = await Promise.all([api.listTraceability(id), api.versions(id)]);
      setTraceLinks(trace);
      setVersions(vers);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    Promise.all([loadAuthState(), loadAll()]);
  }, []);

  useEffect(() => {
    loadRequirementMeta(selectedId);
    setClarification(null);
    setDuplicates([]);
  }, [selectedId]);

  const intake = async (payload) => {
    try {
      await api.intakeRequirement(payload);
      await loadAll();
    } catch (e) {
      setError(e.message);
    }
  };

  const saveRequirement = async (id, payload) => {
    try {
      await api.updateRequirement(id, payload);
      await loadAll();
      await loadRequirementMeta(id);
    } catch (e) {
      setError(e.message);
    }
  };

  const clarify = async (id) => {
    try {
      const result = await api.clarifyRequirement(id);
      setClarification(result);
    } catch (e) {
      setError(e.message);
    }
  };

  const duplicateCheck = async (id) => {
    try {
      const result = await api.duplicateCheck(id);
      setDuplicates(result.possible_duplicates || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const addTrace = async (id, payload) => {
    try {
      await api.addTraceLink(id, payload);
      await loadAll();
      await loadRequirementMeta(id);
    } catch (e) {
      setError(e.message);
    }
  };

  const downloadDoc = async (type) => {
    try {
      const text = type === "brd" ? await api.exportBrd() : await api.exportFrd();
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tracewise_${type}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  };

  const startOAuthLogin = () => {
    window.location.href = api.loginUrl();
  };

  const startDemoLogin = async (role) => {
    try {
      const email = `${role}@tracewise.local`;
      const name = role === "admin" ? "Demo Admin" : "Demo Analyst";
      await api.demoLogin({ email, name, role });
      await Promise.all([loadAuthState(), loadAll()]);
    } catch (e) {
      setError(e.message);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
      setClarification(null);
      setDuplicates([]);
      await Promise.all([loadAuthState(), loadAll()]);
    } catch (e) {
      setError(e.message);
    }
  };

  const exportAudit = () => {
    const link = document.createElement("a");
    link.href = api.auditExportUrl({ ...auditFilters, limit: 1000 });
    link.download = "tracewise_audit_events.csv";
    link.click();
  };

  const applyAuditFilters = async (event) => {
    event.preventDefault();
    await loadAll();
  };

  const resetAuditFilters = async () => {
    const next = { ...emptyAuditFilters };
    setAuditFilters(next);
    try {
      const audit = await api.listAuditEvents(next);
      setAuditEvents(audit);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };

  const authSummary = authState.user
    ? `${authState.user.name} (${authState.user.role})`
    : authState.auth_required
      ? authState.oauth_ready
        ? "Sign in with Google to create or update requirements."
        : "Use demo access to create or update requirements. Google sign-in is not configured yet."
      : "Authentication optional.";

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-grid">
          <div>
            <h1>TraceWise</h1>
            <p>Requirement Intelligence And End-To-End Traceability Platform</p>
            <p className="hero-note">React frontend, FastAPI backend, PostgreSQL-first runtime, OAuth-first access.</p>
          </div>
          <div className="auth-card">
            <div className="auth-label">Access</div>
            <div className="auth-summary">{authSummary}</div>
            <div className="toolbar">
              {authState.oauth_ready && (
                <button type="button" onClick={startOAuthLogin}>
                  Google Login
                </button>
              )}
              {authState.demo_login_enabled && (
                <>
                  <button type="button" className="secondary" onClick={() => startDemoLogin("analyst")}>
                    Demo Analyst
                  </button>
                  <button type="button" className="secondary" onClick={() => startDemoLogin("admin")}>
                    Demo Admin
                  </button>
                </>
              )}
              {authState.user && (
                <button type="button" className="secondary" onClick={logout}>
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="toolbar">
          <button onClick={() => downloadDoc("brd")}>Export BRD</button>
          <button onClick={() => downloadDoc("frd")}>Export FRD</button>
          <button onClick={exportAudit} disabled={!authState.permissions?.can_export_audit}>
            Export Audit CSV
          </button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <main className="grid">
        <div className="column">
          <IntakeForm onSubmit={intake} canWrite={authState.permissions?.can_write} />
          <RequirementList requirements={requirements} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        <div className="column wide">
          <RequirementDetail
            requirement={selectedRequirement}
            canWrite={authState.permissions?.can_write}
            onClarify={clarify}
            clarification={clarification}
            duplicateIds={duplicates}
            onDuplicateCheck={duplicateCheck}
            onSave={saveRequirement}
            onAddTrace={addTrace}
            traceLinks={traceLinks}
            versions={versions}
          />
          <TraceabilityMatrix matrix={matrix} />
        </div>
      </main>

      <Dashboard summary={summary} />

      <section className="card audit-card-section">
        <div className="section-head">
          <h2>Audit Feed</h2>
          <span className="muted">Filter operational history by actor, action, date, or keyword.</span>
        </div>
        <form className="audit-filters" onSubmit={applyAuditFilters}>
          <label>
            Actor
            <input
              value={auditFilters.actor}
              onChange={(e) => setAuditFilters({ ...auditFilters, actor: e.target.value })}
              placeholder="email or name"
            />
          </label>
          <label>
            Action
            <input
              value={auditFilters.action}
              onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value })}
              placeholder="requirement.created"
            />
          </label>
          <label>
            From
            <input
              type="datetime-local"
              value={auditFilters.from_date}
              onChange={(e) => setAuditFilters({ ...auditFilters, from_date: e.target.value })}
            />
          </label>
          <label>
            To
            <input
              type="datetime-local"
              value={auditFilters.to_date}
              onChange={(e) => setAuditFilters({ ...auditFilters, to_date: e.target.value })}
            />
          </label>
          <label>
            Keyword
            <input
              value={auditFilters.q}
              onChange={(e) => setAuditFilters({ ...auditFilters, q: e.target.value })}
              placeholder="title, target, detail"
            />
          </label>
          <div className="audit-actions">
            <button type="submit">Apply</button>
            <button type="button" className="secondary" onClick={resetAuditFilters}>
              Reset
            </button>
          </div>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.created_at).toLocaleString()}</td>
                  <td>{event.user_name || event.user_email || "system"}</td>
                  <td>{event.action}</td>
                  <td>{event.target_type}:{event.target_id}</td>
                  <td className="detail-cell">{event.details_json}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {auditEvents.length === 0 && <p className="muted">No audit events match the current filter.</p>}
      </section>
    </div>
  );
}
