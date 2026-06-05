const DEFAULT_SESSION_SECRET = "tracewise-dev-session-secret-change-me";
const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8011",
  "http://127.0.0.1:8011",
];

const textEncoder = new TextEncoder();
let cachedDiscovery = null;

function envBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function getAllowedOrigins(env) {
  const configured = (env.CORS_ORIGINS || "").trim();
  if (!configured) return DEFAULT_CORS_ORIGINS;
  return configured.split(",").map((item) => item.trim()).filter(Boolean);
}

function getFrontendUrl(env, requestUrl) {
  const configured = (env.FRONTEND_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");
  return new URL(requestUrl).origin;
}

function getSessionSecret(env) {
  return (env.SESSION_SECRET || DEFAULT_SESSION_SECRET).trim();
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
const SESSION_COOKIE = "tw_session";
const OAuthStateCookie = "tw_oauth_state";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function boolEnv(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function normalizeRole(role) {
  return String(role || "analyst").toLowerCase();
}

function getRole(user) {
  return normalizeRole(user?.role);
}

function canWrite(user, env) {
  if (user && getRole(user) === "viewer") return false;
  if (!boolEnv(env.AUTH_REQUIRED, false)) return true;
  return Boolean(user) && ["analyst", "admin"].includes(getRole(user));
}

function canExportAudit(user) {
  return Boolean(user) && getRole(user) === "admin";
}

function corsOrigins(env) {
  const configured = String(env.CORS_ORIGINS || "").trim();
  if (!configured) {
    return [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:8011",
      "http://127.0.0.1:8011",
    ];
  }
  return configured.split(",").map((item) => item.trim()).filter(Boolean);
}

function corsOriginForRequest(request, env) {
  const origin = request.headers.get("Origin") || "";
  if (!origin) return "";
  const allowed = corsOrigins(env);
  return allowed.includes(origin) ? origin : "";
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

async function handleRequest(request, env) {
  const origin = corsOriginForRequest(request, env);
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "OPTIONS") {
    const headers = new Headers();
    applyCors(headers, origin);
    return new Response(null, { status: 204, headers });
  }

  if (path === "/health") {
    return json({ status: "ok", service: "TraceWise Worker API" }, {}, origin);
  }
  if (path === "/") {
    return json({ status: "ok", service: "TraceWise Worker API" }, {}, origin);
  }

  // Additional routes and logic...

}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      const origin = corsOriginForRequest(request, env);
      return json({ detail: error?.message || "Internal Server Error" }, { status: 500 }, origin);
    }
  },
};
}

function normalizeRole(role) {
  return (role || "analyst").toLowerCase();
}

function getRole(user) {
  return normalizeRole(user?.role);
}

function canWrite(user, env) {
  if (user && getRole(user) === "viewer") return false;
  if (!envBool(env.AUTH_REQUIRED, false)) return true;
  return Boolean(user) && ["analyst", "admin"].includes(getRole(user));
}

function canExportAudit(user) {
  return Boolean(user) && getRole(user) === "admin";
}

function serializeUser(user) {
  return JSON.stringify({
    email: user?.email || "",
    name: user?.name || "User",
    role: normalizeRole(user?.role),
  });
}

function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  return Object.fromEntries(
    header.split(/;\s*/).filter(Boolean).map((entry) => {
      const index = entry.indexOf("=");
      if (index === -1) return [entry, ""];
      return [entry.slice(0, index), decodeURIComponent(entry.slice(index + 1))];
    })
  );
}

function base64UrlEncode(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signValue(secret, value) {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

async function verifyValue(secret, value, signature) {
  const key = await importHmacKey(secret);
  return crypto.subtle.verify("HMAC", key, base64UrlDecode(signature), textEncoder.encode(value));
}

async function encodeSession(secret, user) {
  const payload = base64UrlEncode(textEncoder.encode(serializeUser(user)));
  const signature = await signValue(secret, payload);
  return `${payload}.${signature}`;
}

async function decodeSession(secret, token) {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".", 2);
  const valid = await verifyValue(secret, payload, signature);
  if (!valid) return null;
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
  } catch {
    return null;
  }
}

function cookieOptions({ maxAge = 86400, path = "/", sameSite = "None", secure = true, httpOnly = true } = {}) {
  return [
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    `SameSite=${sameSite}`,
    secure ? "Secure" : null,
    httpOnly ? "HttpOnly" : null,
  ].filter(Boolean).join("; ");
}

function json(data, init = {}, cors = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");
  applyCors(headers, cors);
  return new Response(JSON.stringify(data), { ...init, headers });
}

function text(body, init = {}, cors = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type")) headers.set("Content-Type", "text/plain; charset=utf-8");
  applyCors(headers, cors);
  return new Response(body, { ...init, headers });
}

function applyCors(headers, cors = {}) {
  if (cors.origin) {
    headers.set("Access-Control-Allow-Origin", cors.origin);
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
}

function corsOriginForRequest(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return "";
  const allowed = getAllowedOrigins(env);
  return allowed.includes(origin) ? origin : "";
}

function isOptions(request) {
  return request.method === "OPTIONS";
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function clampLimit(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function lower(value) {
  return String(value || "").toLowerCase();
}

function inferTitle(rawInput) {
  const trimmed = String(rawInput || "").trim();
  if (!trimmed) return "Untitled Requirement";
  const firstSentence = trimmed.split(/[.!?]/)[0].trim();
  const candidate = firstSentence || trimmed;
  const words = candidate.split(/\s+/).slice(0, 10).join(" ");
  return words.replace(/^we need\s+/i, "").replace(/^need\s+/i, "").replace(/^to\s+/i, "") || "Untitled Requirement";
}

function inferRequirementArtifacts(rawInput, stakeholder) {
  const text = String(rawInput || "").trim();
  const title = inferTitle(text);
  const lowerText = text.toLowerCase();
  const impact = lowerText.includes("critical") || lowerText.includes("must") ? "High" : lowerText.includes("report") ? "Medium" : "Medium";
  const business_requirement = `Stakeholders need ${text.endsWith(".") ? text : `${text}.`}`;
  const functional_requirement = `The system must support the workflow described in the request and capture the needed information for ${stakeholder || "the stakeholder"}.`;
  const non_functional_requirement = lowerText.includes("security") || lowerText.includes("access")
    ? "The solution must enforce role-based access, maintain traceability, and respond reliably under normal business usage."
    : "The solution must remain responsive, traceable, and maintainable for business users.";
  const user_story = `As a ${stakeholder || "business user"}, I want ${title.toLowerCase()} so that I can complete the requested business outcome.`;
  return { title, impact, business_requirement, functional_requirement, non_functional_requirement, user_story };
}

function clarifyRequirement(rawInput) {
  const text = String(rawInput || "").trim();
  const lowerText = text.toLowerCase();
  const missing_information = [];
  const clarification_questions = [];
  const ambiguity_flags = [];
  const potential_risks = [];

  if (!/who|stakeholder|role/.test(lowerText)) {
    missing_information.push("target_user");
    clarification_questions.push("Who will use this capability most often?");
    ambiguity_flags.push("user role is not specified");
  }

  if (!/when|frequency|daily|weekly|monthly|real-time/.test(lowerText)) {
    missing_information.push("timing");
    clarification_questions.push("When should this be used or how often should it run?");
  }

  if (!/success|accept|output|report|dashboard|export/.test(lowerText)) {
    missing_information.push("success_criteria");
    clarification_questions.push("What does a successful outcome look like?");
  }

  if (/security|access|permission|private/i.test(text)) {
    ambiguity_flags.push("security requirements need role detail");
    potential_risks.push("Access control expectations may be interpreted differently by implementers.");
  }

  if (/report|dashboard|analytics/i.test(text)) {
    potential_risks.push("Reporting scope and data freshness may need explicit acceptance criteria.");
  }

  if (!missing_information.length) {
    missing_information.push("acceptance_criteria");
    clarification_questions.push("What should the acceptance criteria be for this requirement?");
  }

  return {
    missing_information,
    clarification_questions,
    ambiguity_flags,
    potential_risks,
  };
}

async function callOpenAIJson(env, systemPrompt, userPrompt) {
  const apiKey = (env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return null;
  const model = (env.OPENAI_MODEL || "gpt-4o-mini").trim();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) return null;
  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content || "";
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function parseRequirement(env, rawInput, stakeholder) {
  const fallback = inferRequirementArtifacts(rawInput, stakeholder);
  const openai = await callOpenAIJson(
    env,
    "Return only JSON with keys title, business_requirement, functional_requirement, non_functional_requirement, user_story, impact.",
    `Transform the following stakeholder request into structured requirement artifacts. Stakeholder: ${stakeholder || "Unknown"}\nRequest: ${rawInput}`
  );
  if (!openai) return fallback;
  return {
    title: openai.title || fallback.title,
    business_requirement: openai.business_requirement || fallback.business_requirement,
    functional_requirement: openai.functional_requirement || fallback.functional_requirement,
    non_functional_requirement: openai.non_functional_requirement || fallback.non_functional_requirement,
    user_story: openai.user_story || fallback.user_story,
    impact: openai.impact || fallback.impact,
  };
}

async function clarifyWithAI(env, rawInput) {
  const fallback = clarifyRequirement(rawInput);
  const openai = await callOpenAIJson(
    env,
    "Return only JSON with keys missing_information, clarification_questions, ambiguity_flags, potential_risks. Each key must map to an array of strings.",
    `Analyze this requirement and suggest clarification points: ${rawInput}`
  );
  if (!openai) return fallback;
  return {
    missing_information: Array.isArray(openai.missing_information) ? openai.missing_information : fallback.missing_information,
    clarification_questions: Array.isArray(openai.clarification_questions) ? openai.clarification_questions : fallback.clarification_questions,
    ambiguity_flags: Array.isArray(openai.ambiguity_flags) ? openai.ambiguity_flags : fallback.ambiguity_flags,
    potential_risks: Array.isArray(openai.potential_risks) ? openai.potential_risks : fallback.potential_risks,
  };
}

async function getDiscovery(env) {
  if (cachedDiscovery && cachedDiscovery.issuer === env.GOOGLE_DISCOVERY_URL) {
    return cachedDiscovery;
  }
  const discoveryUrl = (env.GOOGLE_DISCOVERY_URL || "https://accounts.google.com/.well-known/openid-configuration").trim();
  const response = await fetch(discoveryUrl);
  if (!response.ok) throw new Error("OAuth discovery failed");
  cachedDiscovery = await response.json();
  cachedDiscovery.issuer = discoveryUrl;
  return cachedDiscovery;
}

async function authUserFromSession(request, env) {
  const cookies = parseCookies(request);
  const secret = getSessionSecret(env);
  return decodeSession(secret, cookies.tw_session || "");
}

function auditActor(user) {
  return user || { email: "system", name: "System", role: "system" };
}

async function logAuditEvent(env, action, targetType, targetId, details = {}, request = null, user = null) {
  const actor = auditActor(user || (request ? await authUserFromSession(request, env) : null));
  const createdAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO audit_events (user_email, user_name, user_role, action, target_type, target_id, details_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      actor.email || "system",
      actor.name || "System",
      actor.role || "system",
      action,
      targetType,
      String(targetId),
      JSON.stringify(details || {}),
      createdAt
    )
    .run();
}

function rowToRequirement(row) {
  if (!row) return null;
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

function rowToTraceLink(row) {
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

function rowToVersion(row) {
  return {
    version: row.version,
    change_note: row.change_note,
    created_by: row.created_by,
    created_at: row.created_at,
    snapshot_json: row.snapshot_json,
  };
}

function rowToAuditEvent(row) {
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

async function fetchRequirement(env, id) {
  return env.DB.prepare("SELECT * FROM requirements WHERE id = ?").bind(id).first();
}

async function fetchVersions(env, requirementId) {
  return env.DB.prepare("SELECT version, change_note, created_by, created_at, snapshot_json FROM requirement_versions WHERE requirement_id = ? ORDER BY version DESC")
    .bind(requirementId)
    .all();
}

async function fetchTraceLinks(env, requirementId) {
  return env.DB.prepare("SELECT * FROM trace_links WHERE requirement_id = ? ORDER BY created_at DESC")
    .bind(requirementId)
    .all();
}

async function getAuditFilteredQuery(env, { actor, action, fromDate, toDate, q, limit }) {
  const conditions = [];
  const values = [];

  if (actor) {
    conditions.push("(LOWER(user_email) LIKE ? OR LOWER(user_name) LIKE ?)");
    const value = `%${String(actor).toLowerCase()}%`;
    values.push(value, value);
  }
  if (action) {
    conditions.push("LOWER(action) LIKE ?");
    values.push(`%${String(action).toLowerCase()}%`);
  }
  if (fromDate) {
    conditions.push("created_at >= ?");
    values.push(new Date(fromDate).toISOString());
  }
  if (toDate) {
    conditions.push("created_at <= ?");
    values.push(new Date(toDate).toISOString());
  }
  if (q) {
    conditions.push("(LOWER(details_json) LIKE ? OR LOWER(target_type) LIKE ? OR LOWER(target_id) LIKE ?)");
    const value = `%${String(q).toLowerCase()}%`;
    values.push(value, value, value);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT * FROM audit_events ${whereClause} ORDER BY created_at DESC LIMIT ?`;
  values.push(limit);
  return env.DB.prepare(sql).bind(...values).all();
}

async function handleAuthMe(request, env) {
  const user = await authUserFromSession(request, env);
  const role = getRole(user);
  return json({
    auth_required: envBool(env.AUTH_REQUIRED, false),
    oauth_ready: Boolean((env.GOOGLE_CLIENT_ID || "").trim() && (env.GOOGLE_CLIENT_SECRET || "").trim()),
    demo_login_enabled: envBool(env.DEMO_LOGIN_ENABLED, true),
    user: user || null,
    permissions: {
      can_write: role === "analyst" || role === "admin",
      can_export_audit: role === "admin",
    },
  }, {}, { origin: corsOriginForRequest(request, env) });
}

async function setSessionCookie(user, env) {
  const secret = getSessionSecret(env);
  const token = await encodeSession(secret, user);
  return `${token}; ${cookieOptions({ sameSite: env.SESSION_COOKIE_SAMESITE || "None", secure: envBool(env.SESSION_COOKIE_SECURE, true), maxAge: 60 * 60 * 24 * 7 })}`;
}

async function clearSessionCookie(env) {
  return `; ${cookieOptions({ sameSite: env.SESSION_COOKIE_SAMESITE || "None", secure: envBool(env.SESSION_COOKIE_SECURE, true), maxAge: 0 })}`;
}

async function handleDemoLogin(request, env) {
  if (!envBool(env.DEMO_LOGIN_ENABLED, true)) {
    return json({ detail: "Demo login is disabled" }, { status: 403 }, { origin: corsOriginForRequest(request, env) });
  }
  const body = await readJson(request);
  const role = normalizeRole(body?.role || "analyst");
  const user = {
    email: String(body?.email || "demo@tracewise.local"),
    name: String(body?.name || "Business Analyst"),
    role,
  };
  await logAuditEvent(env, "auth.demo_login", "session", user.email, { role }, request, user);
  const headers = { "Set-Cookie": `tw_session=${await setSessionCookie(user, env)}` };
  return json({ ok: true, user }, { headers }, { origin: corsOriginForRequest(request, env) });
}

async function handleLogout(request, env) {
  const user = await authUserFromSession(request, env);
  await logAuditEvent(env, "auth.logout", "session", user?.email || "unknown", {}, request, user);
  const headers = { "Set-Cookie": `tw_session=${await clearSessionCookie(env)}` };
  return json({ ok: true }, { headers }, { origin: corsOriginForRequest(request, env) });
}

async function handleLogin(request, env) {
  const clientId = (env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = (env.GOOGLE_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) {
    return json({ detail: "OAuth is not configured" }, { status: 503 }, { origin: corsOriginForRequest(request, env) });
  }

  const discovery = await getDiscovery(env);
  const state = crypto.randomUUID();
  const redirectUri = new URL("/auth/callback", request.url).toString();
  const authorizeUrl = new URL(discovery.authorization_endpoint);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "openid email profile");
  authorizeUrl.searchParams.set("state", state);

  const headers = new Headers({
    Location: authorizeUrl.toString(),
    "Set-Cookie": `tw_oauth_state=${state}; ${cookieOptions({ sameSite: "Lax", secure: true, maxAge: 600 })}`,
  });
  applyCors(headers, { origin: corsOriginForRequest(request, env) });
  return new Response(null, { status: 302, headers });
}

async function handleCallback(request, env) {
  const clientId = (env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = (env.GOOGLE_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) {
    return json({ detail: "OAuth is not configured" }, { status: 503 }, { origin: corsOriginForRequest(request, env) });
  }

  const url = new URL(request.url);
  const cookies = parseCookies(request);
  if (!url.searchParams.get("code") || url.searchParams.get("state") !== cookies.tw_oauth_state) {
    return text("OAuth state validation failed", { status: 400 }, { origin: corsOriginForRequest(request, env) });
  }

  const discovery = await getDiscovery(env);
  const redirectUri = new URL("/auth/callback", request.url).toString();
  const tokenResponse = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: url.searchParams.get("code"),
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    return text("OAuth token exchange failed", { status: 502 }, { origin: corsOriginForRequest(request, env) });
  }

  const token = await tokenResponse.json();
  const userInfoResponse = await fetch(discovery.userinfo_endpoint, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const userInfo = userInfoResponse.ok ? await userInfoResponse.json() : {};
  const user = {
    email: userInfo.email || "",
    name: userInfo.name || "User",
    role: "analyst",
  };

  await logAuditEvent(env, "auth.oauth_login", "session", user.email || "", { provider: "google" }, request, user);
  const headers = new Headers({
    "Set-Cookie": `tw_session=${await setSessionCookie(user, env)}`,
  });
  headers.append("Set-Cookie", `tw_oauth_state=; ${cookieOptions({ sameSite: "Lax", secure: true, maxAge: 0 })}`);
  headers.set("Location", `${getFrontendUrl(env, request.url)}/`);
  applyCors(headers, { origin: corsOriginForRequest(request, env) });
  return new Response(null, { status: 302, headers });
}

async function handleListRequirements(env) {
  const rows = await env.DB.prepare("SELECT * FROM requirements ORDER BY updated_at DESC").all();
  return rows.results.map(rowToRequirement);
}

async function handleIntake(request, env) {
  const user = await authUserFromSession(request, env);
  if (!canWrite(user, env)) {
    return json({ detail: envBool(env.AUTH_REQUIRED, false) ? "Authentication required" : "Viewer role is read-only" }, { status: user ? 403 : 401 }, { origin: corsOriginForRequest(request, env) });
  }

  const body = await readJson(request);
  if (!body?.raw_input || String(body.raw_input).trim().length < 10) {
    return json({ detail: "raw_input must be at least 10 characters" }, { status: 400 }, { origin: corsOriginForRequest(request, env) });
  }

  const parsed = await parseRequirement(env, body.raw_input, body.stakeholder || "Unknown");
  const createdBy = user?.email || "system";
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `INSERT INTO requirements
     (stakeholder, title, raw_input, business_requirement, functional_requirement, non_functional_requirement, user_story, priority, impact, status, version, created_by, updated_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`
  )
    .bind(
      body.stakeholder || "Unknown",
      parsed.title,
      body.raw_input,
      parsed.business_requirement,
      parsed.functional_requirement,
      parsed.non_functional_requirement,
      parsed.user_story,
      body.priority || "Medium",
      parsed.impact || "Medium",
      "Draft",
      createdBy,
      createdBy,
      now,
      now
    )
    .run();

  const id = result.meta.last_row_id;
  await env.DB.prepare(
    `INSERT INTO requirement_versions (requirement_id, version, change_note, snapshot_json, created_by, created_at)
     VALUES (?, 1, ?, ?, ?, ?)`
  )
    .bind(
      id,
      "Initial creation",
      JSON.stringify({
        title: parsed.title,
        business_requirement: parsed.business_requirement,
        functional_requirement: parsed.functional_requirement,
        non_functional_requirement: parsed.non_functional_requirement,
        user_story: parsed.user_story,
        priority: body.priority || "Medium",
        impact: parsed.impact || "Medium",
        status: "Draft",
      }),
      createdBy,
      now
    )
    .run();

  await logAuditEvent(env, "requirement.created", "requirement", String(id), { title: parsed.title, priority: body.priority || "Medium" }, request, user);
  return rowToRequirement(await fetchRequirement(env, id));
}

async function handleUpdateRequirement(request, env, id) {
  const user = await authUserFromSession(request, env);
  if (!canWrite(user, env)) {
    return json({ detail: envBool(env.AUTH_REQUIRED, false) ? "Authentication required" : "Viewer role is read-only" }, { status: user ? 403 : 401 }, { origin: corsOriginForRequest(request, env) });
  }

  const req = await fetchRequirement(env, id);
  if (!req) return json({ detail: "Requirement not found" }, { status: 404 }, { origin: corsOriginForRequest(request, env) });
  const body = await readJson(request);
  const fields = ["title", "business_requirement", "functional_requirement", "non_functional_requirement", "user_story", "priority", "impact", "status"];
  const updates = [];
  const values = [];
  for (const field of fields) {
    if (body?.[field] !== undefined && body?.[field] !== null) {
      updates.push(`${field} = ?`);
      values.push(body[field]);
    }
  }
  const changeNote = body?.change_note || "Updated requirement";
  const now = new Date().toISOString();
  const nextVersion = Number(req.version || 1) + 1;
  updates.push("version = ?", "updated_by = ?", "updated_at = ?");
  values.push(nextVersion, user?.email || "system", now, id);
  await env.DB.prepare(`UPDATE requirements SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();

  const refreshed = await fetchRequirement(env, id);
  await env.DB.prepare(
    `INSERT INTO requirement_versions (requirement_id, version, change_note, snapshot_json, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      nextVersion,
      changeNote,
      JSON.stringify({
        title: refreshed.title,
        business_requirement: refreshed.business_requirement,
        functional_requirement: refreshed.functional_requirement,
        non_functional_requirement: refreshed.non_functional_requirement,
        user_story: refreshed.user_story,
        priority: refreshed.priority,
        impact: refreshed.impact,
        status: refreshed.status,
      }),
      user?.email || "system",
      now
    )
    .run();

  await logAuditEvent(env, "requirement.updated", "requirement", String(id), { version: nextVersion, change_note: changeNote }, request, user);
  return rowToRequirement(await fetchRequirement(env, id));
}

async function handleClarifyRequirement(request, env, id) {
  const user = await authUserFromSession(request, env);
  if (!canWrite(user, env)) {
    return json({ detail: envBool(env.AUTH_REQUIRED, false) ? "Authentication required" : "Viewer role is read-only" }, { status: user ? 403 : 401 }, { origin: corsOriginForRequest(request, env) });
  }
  const req = await fetchRequirement(env, id);
  if (!req) return json({ detail: "Requirement not found" }, { status: 404 }, { origin: corsOriginForRequest(request, env) });
  const result = await clarifyWithAI(env, req.raw_input);
  await logAuditEvent(env, "requirement.clarified", "requirement", String(id), { questions: result.clarification_questions.length }, request, user);
  return result;
}

async function handleAddTraceLink(request, env, id) {
  const user = await authUserFromSession(request, env);
  if (!canWrite(user, env)) {
    return json({ detail: envBool(env.AUTH_REQUIRED, false) ? "Authentication required" : "Viewer role is read-only" }, { status: user ? 403 : 401 }, { origin: corsOriginForRequest(request, env) });
  }
  const req = await fetchRequirement(env, id);
  if (!req) return json({ detail: "Requirement not found" }, { status: 404 }, { origin: corsOriginForRequest(request, env) });
  const body = await readJson(request);
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `INSERT INTO trace_links (requirement_id, user_story, task, test_case, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, body?.user_story || "", body?.task || "", body?.test_case || "", user?.email || "system", now)
    .run();
  const created = await env.DB.prepare("SELECT * FROM trace_links WHERE id = ?").bind(result.meta.last_row_id).first();
  await logAuditEvent(env, "trace_link.created", "trace_link", String(created.id), { requirement_id: id }, request, user);
  return rowToTraceLink(created);
}

async function handleDuplicateCheck(env, id) {
  const req = await fetchRequirement(env, id);
  if (!req) return null;
  const titlePrefix = req.title.slice(0, 20);
  const rows = await env.DB.prepare(
    `SELECT id FROM requirements WHERE id != ? AND (LOWER(title) = ? OR LOWER(raw_input) LIKE ?)`
  )
    .bind(id, lower(req.title), `%${lower(titlePrefix)}%`)
    .all();
  return { possible_duplicates: rows.results.map((row) => row.id) };
}

async function handleMatrix(env) {
  const rows = await env.DB.prepare(
    `SELECT r.id AS requirement_id, r.title AS requirement_title, t.user_story, t.task, t.test_case
     FROM requirements r
     INNER JOIN trace_links t ON t.requirement_id = r.id
     ORDER BY r.updated_at DESC, t.created_at DESC`
  ).all();
  return rows.results.map((row) => ({
    requirement_id: row.requirement_id,
    requirement_title: row.requirement_title,
    user_story: row.user_story,
    task: row.task,
    test_case: row.test_case,
  }));
}

async function handleDashboardSummary(env) {
  const total = (await env.DB.prepare("SELECT COUNT(id) AS total FROM requirements").first())?.total || 0;
  const priorityRows = await env.DB.prepare("SELECT priority, COUNT(id) AS count FROM requirements GROUP BY priority").all();
  const statusRows = await env.DB.prepare("SELECT status, COUNT(id) AS count FROM requirements GROUP BY status").all();
  const covered = (await env.DB.prepare("SELECT COUNT(DISTINCT requirement_id) AS count FROM trace_links").first())?.count || 0;
  const coverage = total ? (covered / total) * 100 : 0;
  return {
    total_requirements: total,
    by_priority: Object.fromEntries(priorityRows.results.map((row) => [row.priority, row.count])),
    by_status: Object.fromEntries(statusRows.results.map((row) => [row.status, row.count])),
    trace_coverage_percent: Math.round(coverage * 100) / 100,
  };
}

async function handleAuditEvents(request, env, { requireAdmin = false, limitMax = 200 }) {
  const user = await authUserFromSession(request, env);
  if (requireAdmin && !canExportAudit(user)) {
    return json({ detail: user ? "Admin role required" : "Authentication required" }, { status: user ? 403 : 401 }, { origin: corsOriginForRequest(request, env) });
  }
  const url = new URL(request.url);
  const limit = clampLimit(url.searchParams.get("limit"), 1, limitMax, 30);
  const rows = await getAuditFilteredQuery(env, {
    actor: url.searchParams.get("actor"),
    action: url.searchParams.get("action"),
    fromDate: url.searchParams.get("from_date"),
    toDate: url.searchParams.get("to_date"),
    q: url.searchParams.get("q"),
    limit,
  });
  return rows.results.map(rowToAuditEvent);
}

function auditCsv(rows) {
  const lines = [
    ["id", "created_at", "user_email", "user_name", "user_role", "action", "target_type", "target_id", "details_json"].join(","),
    ...rows.map((row) => [
      row.id,
      row.created_at,
      row.user_email,
      row.user_name,
      row.user_role,
      row.action,
      row.target_type,
      row.target_id,
      JSON.stringify(row.details_json || "{}"),
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}

async function handleExportDoc(env, kind) {
  const requirements = await env.DB.prepare("SELECT * FROM requirements ORDER BY updated_at DESC").all();
  const rows = requirements.results;
  const sections = rows.map((req) => {
    const title = `${req.id}. ${req.title}`;
    if (kind === "brd") {
      return `${title}\nStakeholder: ${req.stakeholder}\nBusiness Requirement: ${req.business_requirement}\nPriority: ${req.priority}\nImpact: ${req.impact}\nStatus: ${req.status}\n`;
    }
    return `${title}\nFunctional Requirement: ${req.functional_requirement}\nNon-Functional Requirement: ${req.non_functional_requirement}\nUser Story: ${req.user_story}\nTraceability: ${req.status}\n`;
  });
  return sections.length ? sections.join("\n") : "No requirements available.";
}

async function handleRequirementActivity(env, id) {
  const rows = await env.DB.prepare(
    `SELECT * FROM audit_events WHERE target_type = 'requirement' AND target_id = ? ORDER BY created_at DESC LIMIT 30`
  ).bind(String(id)).all();
  return rows.results.map(rowToAuditEvent);
}

async function handleRequirementVersions(env, id) {
  const rows = await fetchVersions(env, id);
  return rows.results.map(rowToVersion);
}

async function handleRequirementTraceLinks(env, id) {
  const rows = await fetchTraceLinks(env, id);
  return rows.results.map(rowToTraceLink);
}

async function handleGetRequirement(env, id) {
  const row = await fetchRequirement(env, id);
  return row ? rowToRequirement(row) : null;
}

async function handleListRequirementsRequest(env) {
  const rows = await env.DB.prepare("SELECT * FROM requirements ORDER BY updated_at DESC").all();
  return rows.results.map(rowToRequirement);
}

async function routeApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const corsOrigin = corsOriginForRequest(request, env);
  if (isOptions(request)) return new Response(null, { status: 204, headers: new Headers() });

  if (path === "/health") {
    return json({ status: "ok", service: "TraceWise Worker API" }, {}, { origin: corsOrigin });
  }
  if (path === "/") {
    return json({ status: "ok", service: "TraceWise Worker API", docs: ["/health", "/auth/me", "/api/requirements"] }, {}, { origin: corsOrigin });
  }

  if (path === "/auth/me" && request.method === "GET") return handleAuthMe(request, env);
  if (path === "/auth/login" && request.method === "GET") return handleLogin(request, env);
  if (path === "/auth/callback" && request.method === "GET") return handleCallback(request, env);
  if (path === "/auth/demo-login" && request.method === "POST") return handleDemoLogin(request, env);
  if (path === "/auth/logout" && request.method === "POST") return handleLogout(request, env);

  if (path === "/api/requirements/intake" && request.method === "POST") return handleIntake(request, env);
  if (path === "/api/requirements" && request.method === "GET") return json(await handleListRequirementsRequest(env), {}, { origin: corsOrigin });
  if (/^\/api\/requirements\/\d+$/.test(path) && request.method === "GET") {
    const id = Number(path.split("/").pop());
    const requirement = await handleGetRequirement(env, id);
    if (!requirement) return json({ detail: "Requirement not found" }, { status: 404 }, { origin: corsOrigin });
    return json(requirement, {}, { origin: corsOrigin });
  }
  if (/^\/api\/requirements\/\d+$/.test(path) && request.method === "PUT") {
    const id = Number(path.split("/").pop());
    return handleUpdateRequirement(request, env, id);
  }
  if (/^\/api\/requirements\/\d+\/versions$/.test(path) && request.method === "GET") {
    const id = Number(path.split("/").slice(-2)[0]);
    return json(await handleRequirementVersions(env, id), {}, { origin: corsOrigin });
  }
  if (/^\/api\/requirements\/\d+\/clarify$/.test(path) && request.method === "POST") {
    const id = Number(path.split("/").slice(-2)[0]);
    return handleClarifyRequirement(request, env, id);
  }
  if (/^\/api\/requirements\/\d+\/trace-links$/.test(path) && request.method === "POST") {
    const id = Number(path.split("/").slice(-2)[0]);
    return handleAddTraceLink(request, env, id);
  }
  if (/^\/api\/requirements\/\d+\/traceability$/.test(path) && request.method === "GET") {
    const id = Number(path.split("/").slice(-2)[0]);
    return json(await handleRequirementTraceLinks(env, id), {}, { origin: corsOrigin });
  }
  if (/^\/api\/requirements\/\d+\/duplicates$/.test(path) && request.method === "GET") {
    const id = Number(path.split("/").slice(-2)[0]);
    const result = await handleDuplicateCheck(env, id);
    return result ? json(result, {}, { origin: corsOrigin }) : json({ detail: "Requirement not found" }, { status: 404 }, { origin: corsOrigin });
  }
  if (/^\/api\/requirements\/\d+\/activity$/.test(path) && request.method === "GET") {
    const id = Number(path.split("/").slice(-2)[0]);
    return json(await handleRequirementActivity(env, id), {}, { origin: corsOrigin });
  }
  if (path === "/api/traceability/matrix" && request.method === "GET") return json(await handleMatrix(env), {}, { origin: corsOrigin });
  if (path === "/api/dashboard/summary" && request.method === "GET") return json(await handleDashboardSummary(env), {}, { origin: corsOrigin });
  if (path === "/api/export/brd" && request.method === "GET") return text(await handleExportDoc(env, "brd"), { headers: { "Content-Disposition": "attachment; filename=tracewise_brd.txt" } }, { origin: corsOrigin });
  if (path === "/api/export/frd" && request.method === "GET") return text(await handleExportDoc(env, "frd"), { headers: { "Content-Disposition": "attachment; filename=tracewise_frd.txt" } }, { origin: corsOrigin });
  if (path === "/api/audit/events" && request.method === "GET") return json(await handleAuditEvents(request, env, { requireAdmin: false, limitMax: 200 }), {}, { origin: corsOrigin });
  if (path === "/api/audit/events/export.csv" && request.method === "GET") {
    const rows = await handleAuditEvents(request, env, { requireAdmin: true, limitMax: 5000 });
    if (rows?.detail) return rows;
    return text(auditCsv(rows), { headers: { "Content-Disposition": "attachment; filename=tracewise_audit_events.csv", "Content-Type": "text/csv; charset=utf-8" } }, { origin: corsOrigin });
  }

  return json({ detail: "Not found" }, { status: 404 }, { origin: corsOrigin });
}

export default {
  async fetch(request, env) {
    try {
      return await routeApi(request, env);
    } catch (error) {
      return json({ detail: error?.message || "Internal Server Error" }, { status: 500 }, { origin: corsOriginForRequest(request, env) });
    }
  },
};
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
const SESSION_COOKIE = "tw_session";
const STATE_COOKIE = "tw_oauth_state";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function jsonResponse(data, init = {}, cors = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  applyCors(headers, cors);
  return new Response(JSON.stringify(data), { ...init, headers });
}

function textResponse(text, init = {}, cors = {}) {
  const headers = new Headers(init.headers || {});
  applyCors(headers, cors);
  return new Response(text, { ...init, headers });
}

function notFound(cors = {}) {
  return jsonResponse({ detail: "Not Found" }, { status: 404 }, cors);
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

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(input) {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacSign(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    TEXT_ENCODER.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, TEXT_ENCODER.encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

async function signPayload(secret, payload) {
  const body = base64UrlEncode(TEXT_ENCODER.encode(JSON.stringify(payload)));
  const signature = await hmacSign(secret, body);
  return `${body}.${signature}`;
}

async function verifyPayload(secret, token) {
  const [body, signature] = (token || "").split(".");
  if (!body || !signature) return null;
  const expected = await hmacSign(secret, body);
  if (expected !== signature) return null;
  try {
    const payload = JSON.parse(TEXT_DECODER.decode(base64UrlDecode(body)));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function readRequestBody(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return request.json();
  return request.text();
}

function normalizeRole(role) {
  return String(role || "analyst").toLowerCase();
}

function getRole(user) {
  return normalizeRole(user?.role);
}

function canWrite(user, env) {
  if (user && getRole(user) === "viewer") return false;
  if (String(env.AUTH_REQUIRED || "false").toLowerCase() !== "true") return true;
  return Boolean(user) && ["analyst", "admin"].includes(getRole(user));
}

function canExportAudit(user) {
  return Boolean(user) && getRole(user) === "admin";
}

function getCorsConfig(env) {
  const configured = String(env.CORS_ORIGINS || "").trim();
  const origins = configured
    ? configured.split(",").map((origin) => origin.trim()).filter(Boolean)
    : [];
  return { origins };
}

function corsOriginAllowed(origin, corsConfig) {
  if (!origin) return false;
  if (!corsConfig.origins.length) return true;
  return corsConfig.origins.includes(origin);
}

function applyCors(headers, cors) {
  if (!cors.origin) return;
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Origin", cors.origin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
}

function corsFromRequest(request, env) {
  const origin = request.headers.get("Origin") || "";
  const corsConfig = getCorsConfig(env);
  if (corsOriginAllowed(origin, corsConfig)) return { origin };
  if (!corsConfig.origins.length && origin) return { origin };
  return {};
}

function buildSetCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || "/"}`);
  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join("; ");
}

function buildDeleteCookie(name, options = {}) {
  return buildSetCookie(name, "", { ...options, maxAge: 0 });
}

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function rowToRequirement(row) {
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

function rowToTraceLink(row) {
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

function rowToVersion(row) {
  return {
    version: row.version,
    change_note: row.change_note,
    created_by: row.created_by,
    created_at: row.created_at,
    snapshot_json: row.snapshot_json,
  };
}

function rowToAudit(row) {
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

function snapshotForRequirement(req) {
  return JSON.stringify({
    title: req.title,
    business_requirement: req.business_requirement,
    functional_requirement: req.functional_requirement,
    non_functional_requirement: req.non_functional_requirement,
    user_story: req.user_story,
    priority: req.priority,
    impact: req.impact,
    status: req.status,
  });
}

function findTitle(rawInput) {
  const firstSentence = String(rawInput || "").trim().split(/[.\n]/)[0] || "";
  const cleaned = firstSentence.replace(/^we need\s+/i, "").replace(/^please\s+/i, "").trim();
  return cleaned ? cleaned.slice(0, 120) : "TraceWise Requirement";
}

function sentenceCase(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

async function parseRequirementWithAI(env, rawInput) {
  const apiKey = String(env.OPENAI_API_KEY || "").trim();
  const model = String(env.OPENAI_MODEL || "gpt-4o-mini").trim();
  if (!apiKey) return parseRequirementFallback(rawInput);

  try {
    const prompt = [
      "Convert the following business input into JSON with keys title, business_requirement, functional_requirement, non_functional_requirement, user_story, impact.",
      "Return only valid JSON.",
      `Input: ${rawInput}`,
    ].join("\n");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You produce concise requirement analysis JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!response.ok) return parseRequirementFallback(rawInput);
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    const parsed = safeJsonParse(content, null);
    if (!parsed) return parseRequirementFallback(rawInput);
    return {
      title: parsed.title || findTitle(rawInput),
      business_requirement: parsed.business_requirement || `The business needs ${sentenceCase(findTitle(rawInput).toLowerCase())}.`,
      functional_requirement: parsed.functional_requirement || `The system should support ${sentenceCase(findTitle(rawInput).toLowerCase())}.`,
      non_functional_requirement: parsed.non_functional_requirement || "The solution should remain secure, responsive, and auditable.",
      user_story: parsed.user_story || `As a stakeholder, I want ${sentenceCase(findTitle(rawInput).toLowerCase())} so that I can achieve the business goal.`,
      impact: parsed.impact || inferImpact(rawInput),
    };
  } catch {
    return parseRequirementFallback(rawInput);
  }
}

function parseRequirementFallback(rawInput) {
  const title = findTitle(rawInput);
  const lower = String(rawInput || "").toLowerCase();
  return {
    title,
    business_requirement: `The business needs ${sentenceCase(title.toLowerCase())}.`,
    functional_requirement: `The system should support ${sentenceCase(title.toLowerCase())}.`,
    non_functional_requirement: "The solution should remain secure, auditable, and responsive.",
    user_story: `As a stakeholder, I want ${sentenceCase(title.toLowerCase())} so that I can deliver the requested outcome.`,
    impact: inferImpact(lower),
  };
}

function inferImpact(text) {
  const lower = String(text || "").toLowerCase();
  if (lower.includes("compliance") || lower.includes("security") || lower.includes("audit")) return "High";
  if (lower.includes("report") || lower.includes("dashboard") || lower.includes("analytics")) return "Medium";
  return "Medium";
}

function clarifyRequirementFallback(rawInput) {
  const lower = String(rawInput || "").toLowerCase();
  const questions = [];
  const missing = [];
  const risks = [];
  const flags = [];

  if (!lower.includes("who") && !lower.includes("stakeholder")) {
    missing.push("Primary user or stakeholder");
    questions.push("Who is the primary user or stakeholder for this requirement?");
  }
  if (!lower.includes("when") && !lower.includes("deadline") && !lower.includes("frequency")) {
    missing.push("Timing or usage frequency");
    questions.push("When should this capability be used or how often will it run?");
  }
  if (!lower.includes("success") && !lower.includes("acceptance")) {
    missing.push("Acceptance criteria");
    questions.push("What does success look like and what acceptance criteria should we use?");
  }
  if (lower.includes("secure") || lower.includes("compliance") || lower.includes("audit")) {
    flags.push("Security or compliance sensitivity detected");
    risks.push("Access control, logging, and data retention expectations should be explicit.");
  }
  if (lower.includes("dashboard") || lower.includes("report")) {
    flags.push("Reporting requirement detected");
    risks.push("Reporting definitions and refresh frequency should be confirmed.");
  }

  if (questions.length === 0) {
    questions.push("Can you confirm the exact scope and success criteria?");
  }
  if (risks.length === 0) {
    risks.push("Ambiguity could cause implementation drift if the business outcome is not clarified.");
  }
  return {
    missing_information: missing.length ? missing : ["Scope", "Acceptance criteria"],
    clarification_questions: questions,
    ambiguity_flags: flags.length ? flags : ["Requirement phrasing is high-level and may hide edge cases"],
    potential_risks: risks,
  };
}

async function clarifyRequirement(env, rawInput) {
  const apiKey = String(env.OPENAI_API_KEY || "").trim();
  const model = String(env.OPENAI_MODEL || "gpt-4o-mini").trim();
  if (!apiKey) return clarifyRequirementFallback(rawInput);

  try {
    const prompt = [
      "Review the following requirement and return JSON with keys missing_information, clarification_questions, ambiguity_flags, potential_risks.",
      "Return only valid JSON arrays of strings.",
      `Input: ${rawInput}`,
    ].join("\n");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You produce concise clarification JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!response.ok) return clarifyRequirementFallback(rawInput);
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    const parsed = safeJsonParse(content, null);
    if (!parsed) return clarifyRequirementFallback(rawInput);
    return {
      missing_information: Array.isArray(parsed.missing_information) ? parsed.missing_information : [],
      clarification_questions: Array.isArray(parsed.clarification_questions) ? parsed.clarification_questions : [],
      ambiguity_flags: Array.isArray(parsed.ambiguity_flags) ? parsed.ambiguity_flags : [],
      potential_risks: Array.isArray(parsed.potential_risks) ? parsed.potential_risks : [],
    };
  } catch {
    return clarifyRequirementFallback(rawInput);
  }
}

async function logAuditEvent(env, details = {}, context = {}) {
  const user = context.user || {};
  const stmt = env.DB.prepare(
    "INSERT INTO audit_events (user_email, user_name, user_role, action, target_type, target_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  await stmt.bind(
    user.email || "system",
    user.name || "System",
    user.role || "system",
    context.action || "event",
    context.targetType || "entity",
    String(context.targetId || ""),
    JSON.stringify(details || {}),
    nowIso()
  ).run();
}

async function getRequirementById(env, id) {
  return env.DB.prepare("SELECT * FROM requirements WHERE id = ?").bind(id).first();
}

async function listRequirements(env) {
  const result = await env.DB.prepare("SELECT * FROM requirements ORDER BY updated_at DESC").all();
  return result.results.map(rowToRequirement);
}

function buildRequirementPayload(req) {
  return {
    title: req.title,
    business_requirement: req.business_requirement,
    functional_requirement: req.functional_requirement,
    non_functional_requirement: req.non_functional_requirement,
    user_story: req.user_story,
    priority: req.priority,
    impact: req.impact,
    status: req.status,
  };
}

async function createRequirement(env, user, payload) {
  const parsed = await parseRequirementWithAI(env, payload.raw_input);
  const actor = user?.email || "system";
  const now = nowIso();
  const insert = await env.DB.prepare(
    `INSERT INTO requirements
      (stakeholder, title, raw_input, business_requirement, functional_requirement, non_functional_requirement, user_story, priority, impact, status, version, created_by, updated_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    payload.stakeholder || "Unknown",
    parsed.title,
    payload.raw_input,
    parsed.business_requirement,
    parsed.functional_requirement,
    parsed.non_functional_requirement,
    parsed.user_story,
    payload.priority || "Medium",
    parsed.impact,
    "Draft",
    1,
    actor,
    actor,
    now,
    now
  ).run();

  const id = insert.meta.last_row_id;
  await env.DB.prepare(
    "INSERT INTO requirement_versions (requirement_id, version, change_note, snapshot_json, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, 1, "Initial creation", snapshotForRequirement({ ...parsed, status: "Draft", priority: payload.priority || "Medium" }), actor, now).run();

  await logAuditEvent(env, { title: parsed.title, priority: payload.priority || "Medium" }, {
    user,
    action: "requirement.created",
    targetType: "requirement",
    targetId: String(id),
  });

  return getRequirementById(env, id);
}

async function updateRequirement(env, user, id, payload) {
  const req = await getRequirementById(env, id);
  if (!req) return null;

  const next = {
    ...req,
    ...Object.fromEntries(Object.entries(payload).filter(([key, value]) => key !== "change_note" && value !== undefined && value !== null)),
  };
  const version = Number(req.version || 1) + 1;
  const actor = user?.email || "system";
  const now = nowIso();

  await env.DB.prepare(
    `UPDATE requirements SET
      title = ?, business_requirement = ?, functional_requirement = ?, non_functional_requirement = ?, user_story = ?, priority = ?, impact = ?, status = ?, version = ?, updated_by = ?, updated_at = ?
     WHERE id = ?`
  ).bind(
    next.title,
    next.business_requirement,
    next.functional_requirement,
    next.non_functional_requirement,
    next.user_story,
    next.priority,
    next.impact,
    next.status,
    version,
    actor,
    now,
    id
  ).run();

  await env.DB.prepare(
    "INSERT INTO requirement_versions (requirement_id, version, change_note, snapshot_json, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, version, payload.change_note || "Updated requirement", snapshotForRequirement({ ...next, status: next.status }), actor, now).run();

  await logAuditEvent(env, { version, change_note: payload.change_note || "Updated requirement" }, {
    user,
    action: "requirement.updated",
    targetType: "requirement",
    targetId: String(id),
  });

  return getRequirementById(env, id);
}

async function addTraceLink(env, user, requirementId, payload) {
  const req = await getRequirementById(env, requirementId);
  if (!req) return null;
  const actor = user?.email || "system";
  const now = nowIso();
  const insert = await env.DB.prepare(
    "INSERT INTO trace_links (requirement_id, user_story, task, test_case, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(requirementId, payload.user_story, payload.task, payload.test_case, actor, now).run();
  const id = insert.meta.last_row_id;
  await logAuditEvent(env, { requirement_id: requirementId }, {
    user,
    action: "trace_link.created",
    targetType: "trace_link",
    targetId: String(id),
  });
  return env.DB.prepare("SELECT * FROM trace_links WHERE id = ?").bind(id).first();
}

async function listAudit(env, filters = {}, limit = 30) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 30, 200));
  const clauses = [];
  const args = [];

  if (filters.actor) {
    clauses.push("(LOWER(user_email) LIKE ? OR LOWER(user_name) LIKE ?)");
    const like = `%${String(filters.actor).toLowerCase()}%`;
    args.push(like, like);
  }
  if (filters.action) {
    clauses.push("LOWER(action) LIKE ?");
    args.push(`%${String(filters.action).toLowerCase()}%`);
  }
  if (filters.from_date) {
    clauses.push("created_at >= ?");
    args.push(String(filters.from_date).replace("Z", "") );
  }
  if (filters.to_date) {
    clauses.push("created_at <= ?");
    args.push(String(filters.to_date).replace("Z", "") );
  }
  if (filters.q) {
    clauses.push("(LOWER(details_json) LIKE ? OR LOWER(target_type) LIKE ? OR LOWER(target_id) LIKE ?)");
    const like = `%${String(filters.q).toLowerCase()}%`;
    args.push(like, like, like);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await env.DB.prepare(`SELECT * FROM audit_events ${where} ORDER BY created_at DESC LIMIT ?`).bind(...args, safeLimit).all();
  return result.results.map(rowToAudit);
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

async function dashboardSummary(env) {
  const total = (await env.DB.prepare("SELECT COUNT(id) AS total FROM requirements").first())?.total || 0;
  const byPriority = await env.DB.prepare("SELECT priority, COUNT(id) AS count FROM requirements GROUP BY priority").all();
  const byStatus = await env.DB.prepare("SELECT status, COUNT(id) AS count FROM requirements GROUP BY status").all();
  const covered = (await env.DB.prepare("SELECT COUNT(DISTINCT requirement_id) AS covered FROM trace_links").first())?.covered || 0;
  const coverage = total ? Math.round((covered / total) * 10000) / 100 : 0;
  return {
    total_requirements: total,
    by_priority: Object.fromEntries(byPriority.results.map((row) => [row.priority, row.count])),
    by_status: Object.fromEntries(byStatus.results.map((row) => [row.status, row.count])),
    trace_coverage_percent: coverage,
  };
}

async function getCurrentUser(request, env) {
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  return verifyPayload(env.SESSION_SECRET || "tracewise-worker-dev-secret", token);
}

async function setSessionCookie(user, env) {
  const secret = env.SESSION_SECRET || "tracewise-worker-dev-secret";
  const payload = {
    ...user,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  return signPayload(secret, payload);
}

function authContext(env, user) {
  const authRequired = String(env.AUTH_REQUIRED || "false").toLowerCase() === "true";
  const oauthReady = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const role = getRole(user);
  return {
    auth_required: authRequired,
    oauth_ready: oauthReady,
    demo_login_enabled: String(env.DEMO_LOGIN_ENABLED || "true").toLowerCase() === "true",
    user,
    permissions: {
      can_write: canWrite(user, env),
      can_export_audit: canExportAudit(user),
    },
  };
}

async function oauthDiscovery(env) {
  const url = String(env.GOOGLE_DISCOVERY_URL || "https://accounts.google.com/.well-known/openid-configuration");
  const response = await fetch(url);
  if (!response.ok) throw new Error("OAuth discovery failed");
  return response.json();
}

async function handleAuthLogin(request, env, cors) {
  if (!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)) {
    return jsonResponse({ detail: "OAuth is not configured" }, { status: 503 }, cors);
  }
  const discovery = await oauthDiscovery(env);
  const redirectUri = new URL("/auth/callback", request.url).toString();
  const state = crypto.randomUUID();
  const authorizationUrl = new URL(discovery.authorization_endpoint);
  authorizationUrl.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", "openid email profile");
  authorizationUrl.searchParams.set("state", state);
  const headers = new Headers({ Location: authorizationUrl.toString() });
  headers.append(
    "Set-Cookie",
    buildSetCookie(STATE_COOKIE, state, { sameSite: "None", secure: true, httpOnly: true, maxAge: 600 })
  );
  applyCors(headers, cors);
  return new Response(null, { status: 302, headers });
}

async function handleAuthCallback(request, env, cors) {
  if (!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)) {
    return jsonResponse({ detail: "OAuth is not configured" }, { status: 503 }, cors);
  }
  const discovery = await oauthDiscovery(env);
  const url = new URL(request.url);
  const cookies = parseCookies(request);
  const state = url.searchParams.get("state");
  if (!state || state !== cookies[STATE_COOKIE]) {
    return jsonResponse({ detail: "Invalid OAuth state" }, { status: 400 }, cors);
  }
  const code = url.searchParams.get("code");
  if (!code) {
    return jsonResponse({ detail: "Missing code" }, { status: 400 }, cors);
  }

  const redirectUri = new URL("/auth/callback", request.url).toString();
  const tokenResponse = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) {
    return jsonResponse({ detail: "OAuth token exchange failed" }, { status: 400 }, cors);
  }
  const token = await tokenResponse.json();
  const userInfoResponse = await fetch(discovery.userinfo_endpoint, {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  if (!userInfoResponse.ok) {
    return jsonResponse({ detail: "OAuth userinfo failed" }, { status: 400 }, cors);
  }
  const userInfo = await userInfoResponse.json();
  const user = {
    email: userInfo.email || "",
    name: userInfo.name || "User",
    role: "analyst",
  };
  const cookie = await setSessionCookie(user, env);
  const headers = new Headers({ Location: "/" });
  headers.append("Set-Cookie", buildSetCookie(SESSION_COOKIE, cookie, { sameSite: "None", secure: true, httpOnly: true, maxAge: SESSION_TTL_SECONDS }));
  headers.append("Set-Cookie", buildDeleteCookie(STATE_COOKIE, { sameSite: "None", secure: true, httpOnly: true }));
  applyCors(headers, cors);
  return new Response(null, { status: 302, headers });
}

async function handleDemoLogin(request, env, cors) {
  if (String(env.DEMO_LOGIN_ENABLED || "true").toLowerCase() !== "true") {
    return jsonResponse({ detail: "Demo login is disabled" }, { status: 403 }, cors);
  }
  const payload = await request.json();
  const user = {
    email: String(payload.email || "demo@tracewise.local"),
    name: String(payload.name || "Business Analyst"),
    role: normalizeRole(payload.role || "analyst"),
  };
  const cookie = await setSessionCookie(user, env);
  const headers = new Headers();
  headers.append("Set-Cookie", buildSetCookie(SESSION_COOKIE, cookie, { sameSite: "None", secure: true, httpOnly: true, maxAge: SESSION_TTL_SECONDS }));
  applyCors(headers, cors);
  return jsonResponse({ ok: true, user }, { headers }, cors);
}

async function handleLogout(request, env, cors) {
  const headers = new Headers();
  headers.append("Set-Cookie", buildDeleteCookie(SESSION_COOKIE, { sameSite: "None", secure: true, httpOnly: true }));
  applyCors(headers, cors);
  const currentUser = await getCurrentUser(request, env);
  await logAuditEvent(env, {}, {
    user: currentUser || {},
    action: "auth.logout",
    targetType: "session",
    targetId: currentUser?.email || "unknown",
  });
  return jsonResponse({ ok: true }, { headers }, cors);
}

async function requireReadBody(request) {
  const body = await readRequestBody(request);
  return typeof body === "string" ? body : body;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

async function handleRequest(request, env, cors) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();
  const currentUser = await getCurrentUser(request, env);

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: new Headers(cors.origin ? {
      "Access-Control-Allow-Origin": cors.origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Vary": "Origin",
    } : {}) });
  }

  if (path === "/health" && method === "GET") {
    return jsonResponse({ status: "ok", service: "TraceWise API" }, {}, cors);
  }

  if (path === "/" && method === "GET") {
    return jsonResponse({ service: "TraceWise API", status: "ok" }, {}, cors);
  }

  if (path === "/auth/me" && method === "GET") {
    return jsonResponse(authContext(env, currentUser), {}, cors);
  }

  if (path === "/auth/login" && method === "GET") {
    return handleAuthLogin(request, env, cors);
  }

  if (path === "/auth/callback" && method === "GET") {
    return handleAuthCallback(request, env, cors);
  }

  if (path === "/auth/demo-login" && method === "POST") {
    return handleDemoLogin(request, env, cors);
  }

  if (path === "/auth/logout" && method === "POST") {
    return handleLogout(request, env, cors);
  }

  if (path === "/api/requirements/intake" && method === "POST") {
    if (!canWrite(currentUser, env)) return jsonResponse({ detail: "Authentication required" }, { status: 401 }, cors);
    const body = await request.json();
    const created = await createRequirement(env, currentUser, body);
    return jsonResponse(created, { status: 201 }, cors);
  }

  if (path === "/api/requirements" && method === "GET") {
    return jsonResponse(await listRequirements(env), {}, cors);
  }

  const requirementMatch = path.match(/^\/api\/requirements\/(\d+)$/);
  if (requirementMatch && method === "GET") {
    const req = await getRequirementById(env, Number(requirementMatch[1]));
    if (!req) return jsonResponse({ detail: "Requirement not found" }, { status: 404 }, cors);
    return jsonResponse(rowToRequirement(req), {}, cors);
  }

  if (requirementMatch && method === "PUT") {
    if (!canWrite(currentUser, env)) return jsonResponse({ detail: "Authentication required" }, { status: 401 }, cors);
    const body = await request.json();
    const updated = await updateRequirement(env, currentUser, Number(requirementMatch[1]), body);
    if (!updated) return jsonResponse({ detail: "Requirement not found" }, { status: 404 }, cors);
    return jsonResponse(rowToRequirement(updated), {}, cors);
  }

  const versionsMatch = path.match(/^\/api\/requirements\/(\d+)\/versions$/);
  if (versionsMatch && method === "GET") {
    const result = await env.DB.prepare("SELECT * FROM requirement_versions WHERE requirement_id = ? ORDER BY version DESC").bind(Number(versionsMatch[1])).all();
    return jsonResponse(result.results.map(rowToVersion), {}, cors);
  }

  const clarifyMatch = path.match(/^\/api\/requirements\/(\d+)\/clarify$/);
  if (clarifyMatch && method === "POST") {
    if (!canWrite(currentUser, env)) return jsonResponse({ detail: "Authentication required" }, { status: 401 }, cors);
    const req = await getRequirementById(env, Number(clarifyMatch[1]));
    if (!req) return jsonResponse({ detail: "Requirement not found" }, { status: 404 }, cors);
    const result = await clarifyRequirement(env, req.raw_input);
    await logAuditEvent(env, { questions: result.clarification_questions.length }, {
      user: currentUser || {},
      action: "requirement.clarified",
      targetType: "requirement",
      targetId: String(req.id),
    });
    return jsonResponse(result, {}, cors);
  }

  const traceLinkMatch = path.match(/^\/api\/requirements\/(\d+)\/trace-links$/);
  if (traceLinkMatch && method === "POST") {
    if (!canWrite(currentUser, env)) return jsonResponse({ detail: "Authentication required" }, { status: 401 }, cors);
    const body = await request.json();
    const link = await addTraceLink(env, currentUser, Number(traceLinkMatch[1]), body);
    if (!link) return jsonResponse({ detail: "Requirement not found" }, { status: 404 }, cors);
    return jsonResponse(rowToTraceLink(link), { status: 201 }, cors);
  }

  const traceabilityMatch = path.match(/^\/api\/requirements\/(\d+)\/traceability$/);
  if (traceabilityMatch && method === "GET") {
    const result = await env.DB.prepare("SELECT * FROM trace_links WHERE requirement_id = ? ORDER BY created_at DESC").bind(Number(traceabilityMatch[1])).all();
    return jsonResponse(result.results.map(rowToTraceLink), {}, cors);
  }

  if (path === "/api/traceability/matrix" && method === "GET") {
    const result = await env.DB.prepare(
      "SELECT r.id AS requirement_id, r.title AS requirement_title, t.user_story, t.task, t.test_case FROM requirements r JOIN trace_links t ON t.requirement_id = r.id ORDER BY r.updated_at DESC, t.created_at DESC"
    ).all();
    return jsonResponse(result.results, {}, cors);
  }

  const duplicateMatch = path.match(/^\/api\/requirements\/(\d+)\/duplicates$/);
  if (duplicateMatch && method === "GET") {
    const req = await getRequirementById(env, Number(duplicateMatch[1]));
    if (!req) return jsonResponse({ detail: "Requirement not found" }, { status: 404 }, cors);
    const prefix = req.title.slice(0, 20).toLowerCase();
    const result = await env.DB.prepare(
      "SELECT id FROM requirements WHERE id != ? AND (LOWER(title) = ? OR LOWER(raw_input) LIKE ?)"
    ).bind(Number(duplicateMatch[1]), req.title.toLowerCase(), `%${prefix}%`).all();
    return jsonResponse({ possible_duplicates: result.results.map((row) => row.id) }, {}, cors);
  }

  if (path === "/api/export/brd" && method === "GET") {
    const rows = await listRequirements(env);
    return textResponse(brdExport(rows), {
      headers: { "content-disposition": "attachment; filename=tracewise_brd.txt", "content-type": "text/plain; charset=utf-8" },
    }, cors);
  }

  if (path === "/api/export/frd" && method === "GET") {
    const rows = await listRequirements(env);
    return textResponse(frdExport(rows), {
      headers: { "content-disposition": "attachment; filename=tracewise_frd.txt", "content-type": "text/plain; charset=utf-8" },
    }, cors);
  }

  if (path === "/api/dashboard/summary" && method === "GET") {
    return jsonResponse(await dashboardSummary(env), {}, cors);
  }

  if (path === "/api/audit/events" && method === "GET") {
    const events = await listAudit(env, Object.fromEntries(url.searchParams.entries()), url.searchParams.get("limit") || 30);
    return jsonResponse(events, {}, cors);
  }

  const activityMatch = path.match(/^\/api\/requirements\/(\d+)\/activity$/);
  if (activityMatch && method === "GET") {
    const limit = Number(url.searchParams.get("limit") || 30);
    const result = await env.DB.prepare(
      "SELECT * FROM audit_events WHERE target_type = 'requirement' AND target_id = ? ORDER BY created_at DESC LIMIT ?"
    ).bind(String(activityMatch[1]), Math.max(1, Math.min(limit || 30, 200))).all();
    return jsonResponse(result.results.map(rowToAudit), {}, cors);
  }

  if (path === "/api/audit/events/export.csv" && method === "GET") {
    if (!canExportAudit(currentUser)) return jsonResponse({ detail: "Admin role required" }, { status: 403 }, cors);
    const events = await listAudit(env, Object.fromEntries(url.searchParams.entries()), url.searchParams.get("limit") || 500);
    const lines = ["id,created_at,user_email,user_name,user_role,action,target_type,target_id,details_json"];
    for (const event of events) {
      lines.push([
        event.id,
        event.created_at,
        csvEscape(event.user_email),
        csvEscape(event.user_name),
        csvEscape(event.user_role),
        csvEscape(event.action),
        csvEscape(event.target_type),
        csvEscape(event.target_id),
        csvEscape(event.details_json),
      ].join(","));
    }
    return textResponse(lines.join("\n"), {
      headers: { "content-disposition": "attachment; filename=tracewise_audit_events.csv", "content-type": "text/csv; charset=utf-8" },
    }, cors);
  }

  return notFound(cors);
}

export default {
  async fetch(request, env, ctx) {
    const cors = corsFromRequest(request, env);
    try {
      return await handleRequest(request, env, cors);
    } catch (error) {
      console.error(error);
      return jsonResponse({ detail: error?.message || "Internal Server Error" }, { status: 500 }, cors);
    }
  },
};
