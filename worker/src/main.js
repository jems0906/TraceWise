const SESSION_COOKIE = "tw_session";
const OAUTH_STATE_COOKIE = "tw_oauth_state";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function boolEnv(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function origins(env) {
  const configured = String(env.CORS_ORIGINS || "").trim();
  if (!configured) {
    return ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8011", "http://127.0.0.1:8011"];
  }
  return configured.split(",").map((value) => value.trim()).filter(Boolean);
}

function originForRequest(request, env) {
  const origin = request.headers.get("Origin") || "";
  return origin && origins(env).includes(origin) ? origin : "";
}

function applyCors(headers, origin) {
  if (!origin) return;
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  headers.set("Vary", "Origin");
}

function json(data, init = {}, origin = "") {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  applyCors(headers, origin);
  return new Response(JSON.stringify(data), { ...init, headers });
}

function text(body, init = {}, origin = "") {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type")) headers.set("Content-Type", "text/plain; charset=utf-8");
  applyCors(headers, origin);
  return new Response(body, { ...init, headers });
}

function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  return Object.fromEntries(
    header.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
      const index = part.indexOf("=");
      if (index === -1) return [part, ""];
      return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    })
  );
}

function b64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64UrlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function signValue(secret, value) {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return b64UrlEncode(new Uint8Array(signature));
}

async function verifyValue(secret, value, signature) {
  const key = await hmacKey(secret);
  return crypto.subtle.verify("HMAC", key, b64UrlDecode(signature), encoder.encode(value));
}

function sessionSecret(env) {
  return String(env.SESSION_SECRET || "tracewise-worker-dev-secret").trim();
}

function oauthReady(env) {
  return Boolean(String(env.GOOGLE_CLIENT_ID || "").trim() && String(env.GOOGLE_CLIENT_SECRET || "").trim());
}

function workerBaseUrl(request, env) {
  const configured = String(env.WORKER_BASE_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}

function frontendBaseUrl(request, env) {
  const configured = String(env.FRONTEND_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");
  const allowed = origins(env);
  if (allowed.length) return allowed[0].replace(/\/$/, "");
  return new URL(request.url).origin;
}

function googleRedirectUri(request, env) {
  const configured = String(env.GOOGLE_REDIRECT_URI || "").trim();
  if (configured) return configured;
  return `${workerBaseUrl(request, env)}/auth/callback`;
}

function oauthStateToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return b64UrlEncode(bytes);
}

function emailListEnv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function roleForUser(env, email) {
  const target = String(email || "").trim().toLowerCase();
  if (!target) return "analyst";
  if (emailListEnv(env.ADMIN_EMAILS).includes(target)) return "admin";
  if (emailListEnv(env.VIEWER_EMAILS).includes(target)) return "viewer";
  return "analyst";
}

async function exchangeGoogleCode(request, env, code) {
  const params = new URLSearchParams({
    code,
    client_id: String(env.GOOGLE_CLIENT_ID || "").trim(),
    client_secret: String(env.GOOGLE_CLIENT_SECRET || "").trim(),
    redirect_uri: googleRedirectUri(request, env),
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${text || res.status}`);
  }

  return res.json();
}

async function googleUserInfo(accessToken) {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google userinfo failed: ${text || res.status}`);
  }

  return res.json();
}

async function encodeSession(env, user) {
  const payload = {
    email: String(user?.email || ""),
    name: String(user?.name || "User"),
    role: String(user?.role || "analyst").toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const serialized = b64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await signValue(sessionSecret(env), serialized);
  return `${serialized}.${signature}`;
}

async function decodeSession(env, token) {
  if (!token || !token.includes(".")) return null;
  const [serialized, signature] = token.split(".", 2);
  const valid = await verifyValue(sessionSecret(env), serialized, signature);
  if (!valid) return null;
  try {
    const payload = JSON.parse(decoder.decode(b64UrlDecode(serialized)));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return { email: payload.email || "", name: payload.name || "User", role: String(payload.role || "analyst").toLowerCase() };
  } catch {
    return null;
  }
}

function cookieAttrs({ sameSite = "None", secure = true, httpOnly = true, maxAge = SESSION_TTL_SECONDS, path = "/" } = {}) {
  return [
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    `SameSite=${sameSite}`,
    secure ? "Secure" : null,
    httpOnly ? "HttpOnly" : null,
  ].filter(Boolean).join("; ");
}

function setCookie(name, value, attrs = {}) {
  return `${name}=${encodeURIComponent(value)}; ${cookieAttrs(attrs)}`;
}

function clearCookie(name, attrs = {}) {
  return `${name}=; ${cookieAttrs({ ...attrs, maxAge: 0 })}`;
}

function roleOf(user) {
  return String(user?.role || "analyst").toLowerCase();
}

function canWrite(user, env) {
  if (user && roleOf(user) === "viewer") return false;
  if (!boolEnv(env.AUTH_REQUIRED, false)) return true;
  return Boolean(user) && ["analyst", "admin"].includes(roleOf(user));
}

function canExportAudit(user) {
  return Boolean(user) && roleOf(user) === "admin";
}

async function currentUser(request, env) {
  const cookies = parseCookies(request);
  return decodeSession(env, cookies[SESSION_COOKIE] || "");
}

function authState(user, env) {
  return {
    auth_required: boolEnv(env.AUTH_REQUIRED, false),
    oauth_ready: oauthReady(env),
    demo_login_enabled: boolEnv(env.DEMO_LOGIN_ENABLED, true),
    user: user || null,
    permissions: {
      can_write: canWrite(user, env),
      can_export_audit: canExportAudit(user),
    },
  };
}

function nowIso() {
  return new Date().toISOString();
}

function requirementRow(row) {
  return {
    id: row.id,
    stakeholder: row.stakeholder,
    title: row.title,
    raw_input: row.raw_input,
    business_requirement: row.business_requirement,
    functional_requirement: row.functional_requirement,
    non_functional_requirement: row.non_functional_requirement,
    user_story: row.user_story,
    priority: row.priority,
    impact: row.impact,
    status: row.status,
    version: row.version,
    created_by: row.created_by,
    updated_by: row.updated_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function traceLinkRow(row) {
  return {
    id: row.id,
    requirement_id: row.requirement_id,
    user_story: row.user_story,
    task: row.task,
    test_case: row.test_case,
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

function versionRow(row) {
  return {
    version: row.version,
    change_note: row.change_note,
    created_by: row.created_by,
    created_at: row.created_at,
    snapshot_json: row.snapshot_json,
  };
}

function auditRow(row) {
  return {
    id: row.id,
    user_email: row.user_email,
    user_name: row.user_name,
    user_role: row.user_role,
    action: row.action,
    target_type: row.target_type,
    target_id: row.target_id,
    details_json: row.details_json,
    created_at: row.created_at,
  };
}

function inferRequirement(rawInput, stakeholder) {
  const text = String(rawInput || "").trim();
  const firstSentence = text.split(/[.!?]/)[0].trim();
  const title = (firstSentence || text || "Untitled Requirement").slice(0, 120).replace(/^we need\s+/i, "");
  const lower = text.toLowerCase();
  return {
    title,
    business_requirement: `Stakeholders need ${text.endsWith(".") ? text : `${text}.`}`,
    functional_requirement: `The system must support the request and capture the required business data for ${stakeholder || "the stakeholder"}.`,
    non_functional_requirement: lower.includes("security") || lower.includes("access")
      ? "The solution must enforce role-based access and maintain auditable behavior."
      : "The solution must remain responsive, traceable, and maintainable.",
    user_story: `As a ${stakeholder || "business user"}, I want ${title.toLowerCase()} so that I can achieve the intended business outcome.`,
    impact: lower.includes("security") || lower.includes("audit") ? "High" : lower.includes("report") ? "Medium" : "Medium",
  };
}

function inferClarification(rawInput) {
  const lower = String(rawInput || "").toLowerCase();
  const missing_information = [];
  const clarification_questions = [];
  const ambiguity_flags = [];
  const potential_risks = [];

  if (!/who|stakeholder|role/.test(lower)) {
    missing_information.push("target_user");
    clarification_questions.push("Who will use this capability most often?");
    ambiguity_flags.push("user role is not specified");
  }
  if (!/when|frequency|daily|weekly|monthly|real-time/.test(lower)) {
    missing_information.push("timing");
    clarification_questions.push("When should this be used or how often should it run?");
  }
  if (!/success|accept|output|report|dashboard|export/.test(lower)) {
    missing_information.push("success_criteria");
    clarification_questions.push("What does a successful outcome look like?");
  }
  if (/security|access|permission|private/.test(lower)) {
    ambiguity_flags.push("security requirements need role detail");
    potential_risks.push("Access control expectations may be interpreted differently by implementers.");
  }
  if (/report|dashboard|analytics/.test(lower)) {
    potential_risks.push("Reporting scope and data freshness may need explicit acceptance criteria.");
  }
  if (!missing_information.length) {
    missing_information.push("acceptance_criteria");
    clarification_questions.push("What should the acceptance criteria be for this requirement?");
  }
  return { missing_information, clarification_questions, ambiguity_flags, potential_risks };
}

async function openAiJson(env, systemPrompt, userPrompt) {
  const apiKey = String(env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return null;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: String(env.OPENAI_MODEL || "gpt-4o-mini"),
      temperature: 0.2,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    }),
  });
  if (!response.ok) return null;
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || "";
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function parseRequirement(env, rawInput, stakeholder) {
  const fallback = inferRequirement(rawInput, stakeholder);
  const result = await openAiJson(
    env,
    "Return only JSON with keys title, business_requirement, functional_requirement, non_functional_requirement, user_story, impact.",
    `Transform this stakeholder request into structured requirement artifacts. Stakeholder: ${stakeholder || "Unknown"}\nRequest: ${rawInput}`
  );
  if (!result) return fallback;
  return {
    title: result.title || fallback.title,
    business_requirement: result.business_requirement || fallback.business_requirement,
    functional_requirement: result.functional_requirement || fallback.functional_requirement,
    non_functional_requirement: result.non_functional_requirement || fallback.non_functional_requirement,
    user_story: result.user_story || fallback.user_story,
    impact: result.impact || fallback.impact,
  };
}

async function clarifyRequirement(env, rawInput) {
  const fallback = inferClarification(rawInput);
  const result = await openAiJson(
    env,
    "Return only JSON with keys missing_information, clarification_questions, ambiguity_flags, potential_risks. Each value must be an array of strings.",
    `Analyze this requirement and suggest clarification points: ${rawInput}`
  );
  if (!result) return fallback;
  return {
    missing_information: Array.isArray(result.missing_information) ? result.missing_information : fallback.missing_information,
    clarification_questions: Array.isArray(result.clarification_questions) ? result.clarification_questions : fallback.clarification_questions,
    ambiguity_flags: Array.isArray(result.ambiguity_flags) ? result.ambiguity_flags : fallback.ambiguity_flags,
    potential_risks: Array.isArray(result.potential_risks) ? result.potential_risks : fallback.potential_risks,
  };
}

async function auditInsert(env, { action, targetType, targetId, details = {}, user = null }) {
  const actor = user || { email: "system", name: "System", role: "system" };
  await env.DB.prepare(
    `INSERT INTO audit_events (user_email, user_name, user_role, action, target_type, target_id, details_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(actor.email || "system", actor.name || "System", actor.role || "system", action, targetType, String(targetId), JSON.stringify(details || {}), nowIso()).run();
}

async function listRequirements(env) {
  const rows = await env.DB.prepare("SELECT * FROM requirements ORDER BY updated_at DESC").all();
  return rows.results.map(requirementRow);
}

async function getRequirement(env, id) {
  return env.DB.prepare("SELECT * FROM requirements WHERE id = ?").bind(id).first();
}

async function listVersions(env, requirementId) {
  const rows = await env.DB.prepare("SELECT version, change_note, created_by, created_at, snapshot_json FROM requirement_versions WHERE requirement_id = ? ORDER BY version DESC").bind(requirementId).all();
  return rows.results.map(versionRow);
}

async function listTraceLinks(env, requirementId) {
  const rows = await env.DB.prepare("SELECT * FROM trace_links WHERE requirement_id = ? ORDER BY created_at DESC").bind(requirementId).all();
  return rows.results.map(traceLinkRow);
}

async function listAudit(env, filters, limitMax) {
  const clauses = [];
  const values = [];
  if (filters.actor) {
    clauses.push("(LOWER(user_email) LIKE ? OR LOWER(user_name) LIKE ?)");
    const like = `%${String(filters.actor).toLowerCase()}%`;
    values.push(like, like);
  }
  if (filters.action) {
    clauses.push("LOWER(action) LIKE ?");
    values.push(`%${String(filters.action).toLowerCase()}%`);
  }
  if (filters.from_date) {
    clauses.push("created_at >= ?");
    values.push(new Date(filters.from_date).toISOString());
  }
  if (filters.to_date) {
    clauses.push("created_at <= ?");
    values.push(new Date(filters.to_date).toISOString());
  }
  if (filters.q) {
    clauses.push("(LOWER(details_json) LIKE ? OR LOWER(target_type) LIKE ? OR LOWER(target_id) LIKE ?)");
    const like = `%${String(filters.q).toLowerCase()}%`;
    values.push(like, like, like);
  }
  const limit = Math.max(1, Math.min(Number(filters.limit || 30), limitMax));
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await env.DB.prepare(`SELECT * FROM audit_events ${where} ORDER BY created_at DESC LIMIT ?`).bind(...values, limit).all();
  return rows.results.map(auditRow);
}

function brdExport(requirements) {
  const lines = ["TraceWise BRD", ""];
  for (const req of requirements) {
    lines.push(`# ${req.id} ${req.title}`);
    lines.push(`Stakeholder: ${req.stakeholder}`);
    lines.push(`Priority: ${req.priority}`);
    lines.push(`Impact: ${req.impact}`);
    lines.push(`Status: ${req.status}`);
    lines.push(req.business_requirement);
    lines.push("");
  }
  return lines.join("\n");
}

function frdExport(requirements) {
  const lines = ["TraceWise FRD", ""];
  for (const req of requirements) {
    lines.push(`# ${req.id} ${req.title}`);
    lines.push(`Functional: ${req.functional_requirement}`);
    lines.push(`Non-Functional: ${req.non_functional_requirement}`);
    lines.push(`User Story: ${req.user_story}`);
    lines.push("");
  }
  return lines.join("\n");
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

async function summarizeDashboard(env) {
  const total = (await env.DB.prepare("SELECT COUNT(id) AS total FROM requirements").first())?.total || 0;
  const priorityRows = await env.DB.prepare("SELECT priority, COUNT(id) AS count FROM requirements GROUP BY priority").all();
  const statusRows = await env.DB.prepare("SELECT status, COUNT(id) AS count FROM requirements GROUP BY status").all();
  const covered = (await env.DB.prepare("SELECT COUNT(DISTINCT requirement_id) AS count FROM trace_links").first())?.count || 0;
  return {
    total_requirements: total,
    by_priority: Object.fromEntries(priorityRows.results.map((row) => [row.priority, row.count])),
    by_status: Object.fromEntries(statusRows.results.map((row) => [row.status, row.count])),
    trace_coverage_percent: total ? Math.round(((covered / total) * 100) * 100) / 100 : 0,
  };
}

async function handleIntake(request, env, origin) {
  const user = await currentUser(request, env);
  if (!canWrite(user, env)) return json({ detail: boolEnv(env.AUTH_REQUIRED, false) ? "Authentication required" : "Viewer role is read-only" }, { status: user ? 403 : 401 }, origin);
  const body = await request.json().catch(() => null);
  if (!body?.raw_input || String(body.raw_input).trim().length < 10) return json({ detail: "raw_input must be at least 10 characters" }, { status: 400 }, origin);
  const parsed = await parseRequirement(env, body.raw_input, body.stakeholder || "Unknown");
  const now = nowIso();
  const actor = user?.email || "system";
  const inserted = await env.DB.prepare(
    `INSERT INTO requirements (stakeholder, title, raw_input, business_requirement, functional_requirement, non_functional_requirement, user_story, priority, impact, status, version, created_by, updated_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`
  ).bind(body.stakeholder || "Unknown", parsed.title, body.raw_input, parsed.business_requirement, parsed.functional_requirement, parsed.non_functional_requirement, parsed.user_story, body.priority || "Medium", parsed.impact || "Medium", "Draft", actor, actor, now, now).run();
  const id = inserted.meta.last_row_id;
  await env.DB.prepare(`INSERT INTO requirement_versions (requirement_id, version, change_note, snapshot_json, created_by, created_at) VALUES (?, 1, ?, ?, ?, ?)`)
    .bind(id, "Initial creation", JSON.stringify({ title: parsed.title, business_requirement: parsed.business_requirement, functional_requirement: parsed.functional_requirement, non_functional_requirement: parsed.non_functional_requirement, user_story: parsed.user_story, priority: body.priority || "Medium", impact: parsed.impact || "Medium", status: "Draft" }), actor, now)
    .run();
  const created = await getRequirement(env, id);
  await auditInsert(env, { action: "requirement.created", targetType: "requirement", targetId: String(id), details: { title: parsed.title, priority: body.priority || "Medium" }, user });
  return json(requirementRow(created), { status: 201 }, origin);
}

async function handleUpdateRequirement(request, env, origin, id) {
  const user = await currentUser(request, env);
  if (!canWrite(user, env)) return json({ detail: boolEnv(env.AUTH_REQUIRED, false) ? "Authentication required" : "Viewer role is read-only" }, { status: user ? 403 : 401 }, origin);
  const existing = await getRequirement(env, id);
  if (!existing) return json({ detail: "Requirement not found" }, { status: 404 }, origin);
  const body = await request.json().catch(() => null);
  const fields = ["title", "business_requirement", "functional_requirement", "non_functional_requirement", "user_story", "priority", "impact", "status"];
  const updates = [];
  const values = [];
  for (const field of fields) {
    if (body?.[field] !== undefined && body?.[field] !== null) {
      updates.push(`${field} = ?`);
      values.push(body[field]);
    }
  }
  const now = nowIso();
  const nextVersion = Number(existing.version || 1) + 1;
  updates.push("version = ?", "updated_by = ?", "updated_at = ?");
  values.push(nextVersion, user?.email || "system", now, id);
  await env.DB.prepare(`UPDATE requirements SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
  const updated = await getRequirement(env, id);
  await env.DB.prepare(`INSERT INTO requirement_versions (requirement_id, version, change_note, snapshot_json, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(id, nextVersion, body?.change_note || "Updated requirement", JSON.stringify({ title: updated.title, business_requirement: updated.business_requirement, functional_requirement: updated.functional_requirement, non_functional_requirement: updated.non_functional_requirement, user_story: updated.user_story, priority: updated.priority, impact: updated.impact, status: updated.status }), user?.email || "system", now)
    .run();
  await auditInsert(env, { action: "requirement.updated", targetType: "requirement", targetId: String(id), details: { version: nextVersion, change_note: body?.change_note || "Updated requirement" }, user });
  return json(requirementRow(updated), {}, origin);
}

async function handleClarify(request, env, origin, id) {
  const user = await currentUser(request, env);
  if (!canWrite(user, env)) return json({ detail: boolEnv(env.AUTH_REQUIRED, false) ? "Authentication required" : "Viewer role is read-only" }, { status: user ? 403 : 401 }, origin);
  const requirement = await getRequirement(env, id);
  if (!requirement) return json({ detail: "Requirement not found" }, { status: 404 }, origin);
  const result = await clarifyRequirement(env, requirement.raw_input);
  await auditInsert(env, { action: "requirement.clarified", targetType: "requirement", targetId: String(id), details: { questions: result.clarification_questions.length }, user });
  return json(result, {}, origin);
}

async function handleAddTraceLink(request, env, origin, id) {
  const user = await currentUser(request, env);
  if (!canWrite(user, env)) return json({ detail: boolEnv(env.AUTH_REQUIRED, false) ? "Authentication required" : "Viewer role is read-only" }, { status: user ? 403 : 401 }, origin);
  const requirement = await getRequirement(env, id);
  if (!requirement) return json({ detail: "Requirement not found" }, { status: 404 }, origin);
  const body = await request.json().catch(() => null);
  const now = nowIso();
  const inserted = await env.DB.prepare(`INSERT INTO trace_links (requirement_id, user_story, task, test_case, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, body?.user_story || "", body?.task || "", body?.test_case || "", user?.email || "system", now).run();
  const created = await env.DB.prepare("SELECT * FROM trace_links WHERE id = ?").bind(inserted.meta.last_row_id).first();
  await auditInsert(env, { action: "trace_link.created", targetType: "trace_link", targetId: String(created.id), details: { requirement_id: id }, user });
  return json(traceLinkRow(created), { status: 201 }, origin);
}

async function handleDuplicateCheck(env, id) {
  const requirement = await getRequirement(env, id);
  if (!requirement) return null;
  const rows = await env.DB.prepare("SELECT id FROM requirements WHERE id != ? AND (LOWER(title) = ? OR LOWER(raw_input) LIKE ?)").bind(id, requirement.title.toLowerCase(), `%${requirement.title.slice(0, 20).toLowerCase()}%`).all();
  return { possible_duplicates: rows.results.map((row) => row.id) };
}

async function handleMatrix(env) {
  const rows = await env.DB.prepare(`SELECT r.id AS requirement_id, r.title AS requirement_title, t.user_story, t.task, t.test_case FROM requirements r INNER JOIN trace_links t ON t.requirement_id = r.id ORDER BY r.updated_at DESC, t.created_at DESC`).all();
  return rows.results.map((row) => ({ requirement_id: row.requirement_id, requirement_title: row.requirement_title, user_story: row.user_story, task: row.task, test_case: row.test_case }));
}

async function handleRequirementActivity(env, id) {
  const rows = await env.DB.prepare("SELECT * FROM audit_events WHERE target_type = 'requirement' AND target_id = ? ORDER BY created_at DESC LIMIT 30").bind(String(id)).all();
  return rows.results.map(auditRow);
}

async function handleRequest(request, env) {
  const origin = originForRequest(request, env);
  if (request.method === "OPTIONS") {
    const headers = new Headers();
    applyCors(headers, origin);
    return new Response(null, { status: 204, headers });
  }

  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/health") return json({ status: "ok", service: "TraceWise Worker API" }, {}, origin);
  if (path === "/") return json({ status: "ok", service: "TraceWise Worker API" }, {}, origin);

  if (path === "/auth/me" && request.method === "GET") return json(authState(await currentUser(request, env), env), {}, origin);
  if (path === "/auth/login" && request.method === "GET") {
    if (!oauthReady(env)) return json({ detail: "OAuth is not configured" }, { status: 503 }, origin);
    const state = oauthStateToken();
    const redirect = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    redirect.searchParams.set("client_id", String(env.GOOGLE_CLIENT_ID || "").trim());
    redirect.searchParams.set("redirect_uri", googleRedirectUri(request, env));
    redirect.searchParams.set("response_type", "code");
    redirect.searchParams.set("scope", "openid email profile");
    redirect.searchParams.set("state", state);
    redirect.searchParams.set("prompt", "select_account");

    const headers = new Headers();
    headers.set("Location", redirect.toString());
    headers.append(
      "Set-Cookie",
      setCookie(OAUTH_STATE_COOKIE, state, {
        sameSite: "Lax",
        secure: boolEnv(env.SESSION_COOKIE_SECURE, true),
        maxAge: 60 * 10,
      })
    );
    return new Response(null, { status: 302, headers });
  }
  if (path === "/auth/callback" && request.method === "GET") {
    const frontend = frontendBaseUrl(request, env);
    const urlError = url.searchParams.get("error");
    if (urlError) {
      return new Response(null, { status: 302, headers: { Location: `${frontend}?auth_error=${encodeURIComponent(urlError)}` } });
    }
    const code = String(url.searchParams.get("code") || "").trim();
    const state = String(url.searchParams.get("state") || "").trim();
    const cookies = parseCookies(request);
    const expectedState = String(cookies[OAUTH_STATE_COOKIE] || "");

    if (!code || !state || !expectedState || state !== expectedState) {
      const headers = new Headers();
      headers.set("Location", `${frontend}?auth_error=invalid_state`);
      headers.append(
        "Set-Cookie",
        clearCookie(OAUTH_STATE_COOKIE, {
          sameSite: "Lax",
          secure: boolEnv(env.SESSION_COOKIE_SECURE, true),
        })
      );
      return new Response(null, { status: 302, headers });
    }

    try {
      const token = await exchangeGoogleCode(request, env, code);
      const profile = await googleUserInfo(token.access_token);
      const user = {
        email: String(profile.email || ""),
        name: String(profile.name || profile.given_name || "Google User"),
        role: roleForUser(env, profile.email),
      };

      await auditInsert(env, {
        action: "auth.oauth_login",
        targetType: "session",
        targetId: user.email || "unknown",
        details: { provider: "google", role: user.role },
        user,
      });

      const headers = new Headers();
      headers.set("Location", frontend);
      headers.append(
        "Set-Cookie",
        setCookie(SESSION_COOKIE, await encodeSession(env, user), {
          sameSite: "None",
          secure: boolEnv(env.SESSION_COOKIE_SECURE, true),
        })
      );
      headers.append(
        "Set-Cookie",
        clearCookie(OAUTH_STATE_COOKIE, {
          sameSite: "Lax",
          secure: boolEnv(env.SESSION_COOKIE_SECURE, true),
        })
      );
      return new Response(null, { status: 302, headers });
    } catch {
      const headers = new Headers();
      headers.set("Location", `${frontend}?auth_error=oauth_failed`);
      headers.append(
        "Set-Cookie",
        clearCookie(OAUTH_STATE_COOKIE, {
          sameSite: "Lax",
          secure: boolEnv(env.SESSION_COOKIE_SECURE, true),
        })
      );
      return new Response(null, { status: 302, headers });
    }
  }
  if (path === "/auth/demo-login" && request.method === "POST") {
    if (!boolEnv(env.DEMO_LOGIN_ENABLED, true)) return json({ detail: "Demo login is disabled" }, { status: 403 }, origin);
    const body = await request.json().catch(() => null);
    const user = { email: String(body?.email || "demo@tracewise.local"), name: String(body?.name || "Business Analyst"), role: String(body?.role || "analyst").toLowerCase() };
    await auditInsert(env, { action: "auth.demo_login", targetType: "session", targetId: user.email, details: { role: user.role }, user });
    const headers = { "Set-Cookie": setCookie(SESSION_COOKIE, await encodeSession(env, user), { sameSite: "None", secure: boolEnv(env.SESSION_COOKIE_SECURE, true) }) };
    return json({ ok: true, user }, { headers }, origin);
  }
  if (path === "/auth/logout" && request.method === "POST") {
    const user = await currentUser(request, env);
    await auditInsert(env, { action: "auth.logout", targetType: "session", targetId: user?.email || "unknown", user });
    const headers = { "Set-Cookie": clearCookie(SESSION_COOKIE, { sameSite: "None", secure: boolEnv(env.SESSION_COOKIE_SECURE, true) }) };
    return json({ ok: true }, { headers }, origin);
  }

  if (path === "/api/requirements/intake" && request.method === "POST") return handleIntake(request, env, origin);
  if (path === "/api/requirements" && request.method === "GET") return json(await listRequirements(env), {}, origin);

  const requirementMatch = path.match(/^\/api\/requirements\/(\d+)$/);
  if (requirementMatch && request.method === "GET") {
    const requirement = await getRequirement(env, Number(requirementMatch[1]));
    if (!requirement) return json({ detail: "Requirement not found" }, { status: 404 }, origin);
    return json(requirementRow(requirement), {}, origin);
  }
  if (requirementMatch && request.method === "PUT") return handleUpdateRequirement(request, env, origin, Number(requirementMatch[1]));

  const versionsMatch = path.match(/^\/api\/requirements\/(\d+)\/versions$/);
  if (versionsMatch && request.method === "GET") return json(await listVersions(env, Number(versionsMatch[1])), {}, origin);

  const clarifyMatch = path.match(/^\/api\/requirements\/(\d+)\/clarify$/);
  if (clarifyMatch && request.method === "POST") return handleClarify(request, env, origin, Number(clarifyMatch[1]));

  const traceLinksMatch = path.match(/^\/api\/requirements\/(\d+)\/trace-links$/);
  if (traceLinksMatch && request.method === "POST") return handleAddTraceLink(request, env, origin, Number(traceLinksMatch[1]));

  const traceabilityMatch = path.match(/^\/api\/requirements\/(\d+)\/traceability$/);
  if (traceabilityMatch && request.method === "GET") return json(await listTraceLinks(env, Number(traceabilityMatch[1])), {}, origin);

  const duplicatesMatch = path.match(/^\/api\/requirements\/(\d+)\/duplicates$/);
  if (duplicatesMatch && request.method === "GET") {
    const result = await handleDuplicateCheck(env, Number(duplicatesMatch[1]));
    if (!result) return json({ detail: "Requirement not found" }, { status: 404 }, origin);
    return json(result, {}, origin);
  }

  const activityMatch = path.match(/^\/api\/requirements\/(\d+)\/activity$/);
  if (activityMatch && request.method === "GET") return json(await handleRequirementActivity(env, Number(activityMatch[1])), {}, origin);

  if (path === "/api/traceability/matrix" && request.method === "GET") return json(await handleMatrix(env), {}, origin);
  if (path === "/api/dashboard/summary" && request.method === "GET") return json(await summarizeDashboard(env), {}, origin);
  if (path === "/api/export/brd" && request.method === "GET") return text(brdExport(await listRequirements(env)), { headers: { "Content-Disposition": "attachment; filename=tracewise_brd.txt" } }, origin);
  if (path === "/api/export/frd" && request.method === "GET") return text(frdExport(await listRequirements(env)), { headers: { "Content-Disposition": "attachment; filename=tracewise_frd.txt" } }, origin);
  if (path === "/api/audit/events" && request.method === "GET") return json(await listAudit(env, Object.fromEntries(url.searchParams.entries()), 200), {}, origin);
  if (path === "/api/audit/events/export.csv" && request.method === "GET") {
    const user = await currentUser(request, env);
    if (!canExportAudit(user)) return json({ detail: user ? "Admin role required" : "Authentication required" }, { status: user ? 403 : 401 }, origin);
    const rows = await listAudit(env, Object.fromEntries(url.searchParams.entries()), 5000);
    const lines = ["id,created_at,user_email,user_name,user_role,action,target_type,target_id,details_json"];
    for (const row of rows) {
      lines.push([
        row.id,
        csvEscape(row.created_at),
        csvEscape(row.user_email),
        csvEscape(row.user_name),
        csvEscape(row.user_role),
        csvEscape(row.action),
        csvEscape(row.target_type),
        csvEscape(row.target_id),
        csvEscape(row.details_json),
      ].join(","));
    }
    return text(`${lines.join("\n")}\n`, { headers: { "Content-Disposition": "attachment; filename=tracewise_audit_events.csv" } }, origin);
  }

  return json({ detail: "Not found" }, { status: 404 }, origin);
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      return json({ detail: error?.message || "Internal Server Error" }, { status: 500 }, originForRequest(request, env));
    }
  },
};
