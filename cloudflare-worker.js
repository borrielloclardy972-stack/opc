// OPC超级个体训练营 - Cloudflare Worker v2
// 新增接口：PUT /api/materials/:id (审核), DELETE /api/materials/:id (删除), GET /api/status (实时状态)
// 素材状态字段：index 14 = "pending" | "published" | "rejected"

const MATERIALS_KEY = "materials";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Max-Age": "86400"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function getBearer(request) {
  const header = request.headers.get("Authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function accessMode(request, env) {
  const token = getBearer(request);
  if (token && token === env.EDIT_CODE) return "edit";
  if (token && token === env.VIEW_CODE) return "view";
  return "";
}

function requireAccess(request, env) {
  const mode = accessMode(request, env);
  if (!mode) return { error: json({ error: "未授权" }, 401) };
  return { mode };
}

function requireEdit(request, env) {
  const mode = accessMode(request, env);
  if (mode !== "edit") return { error: json({ error: "需要编辑卡密" }, 403) };
  return { mode };
}

async function readMaterials(env) {
  const value = await env.MATERIALS_KV.get(MATERIALS_KEY);
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

async function writeMaterials(env, materials) {
  await env.MATERIALS_KV.put(MATERIALS_KEY, JSON.stringify(materials.slice(0, 1000)));
}

function safeFileName(name) {
  return String(name || "material")
    .replace(/[^\w.\-\u4e00-\u9fa5]+/g, "-")
    .slice(0, 120);
}

// 获取素材状态（兼容老格式数组和新对象格式）
function getStatus(m) {
  return Array.isArray(m) ? (m[14] || "published") : (m.status || "published");
}

function getId(m) {
  return Array.isArray(m) ? m[0] : m.id;
}

// 将数组格式素材转为普通对象（用于 status 接口返回）
function toPlainObj(m) {
  if (!Array.isArray(m)) return m;
  return {
    id: m[0], name: m[1], platform: m[2], category: m[3],
    audience: m[4], type: m[5], source: m[6], duration: m[7],
    title: m[8], colors: m[9], cover: m[10], fileUrl: m[11],
    fileName: m[12], createdAt: m[13], status: m[14] || "published"
  };
}

async function uploadFileIfPossible(request, env, form, payload) {
  const file = form.get("file");
  if (!file || typeof file === "string" || !env.MATERIALS_BUCKET) return payload;

  const key = "materials/" + Date.now() + "-" + safeFileName(file.name);
  await env.MATERIALS_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" }
  });

  const url = new URL(request.url);
  payload.fileName = file.name || "";
  payload.fileType = file.type || "";
  payload.fileUrl = url.origin + "/api/files/" + encodeURIComponent(key);
  if ((file.type || "").startsWith("image/")) {
    payload.cover = payload.fileUrl;
  }
  return payload;
}

// ── 路由处理器 ────────────────────────────────────────────────

async function handleSession(request, env) {
  const body = await request.json().catch(() => ({}));
  const code = String(body.code || "").trim();
  if (code && code === env.EDIT_CODE) return json({ mode: "edit" });
  if (code && code === env.VIEW_CODE) return json({ mode: "view" });
  return json({ error: "卡密不正确" }, 401);
}

// GET /api/materials
// 用户端（view）：只返回 status=published 的素材
// 管理端（edit）：返回全部，附带 status 字段
async function handleGetMaterials(request, env) {
  const access = requireAccess(request, env);
  if (access.error) return access.error;

  const mode = access.mode;
  const materials = await readMaterials(env);

  const filtered = mode === "edit"
    ? materials
    : materials.filter(m => getStatus(m) === "published");

  return json({ materials: filtered, mode });
}

// POST /api/materials — 上传新素材，状态默认 pending（待审核）
async function handleCreateMaterial(request, env) {
  const access = requireEdit(request, env);
  if (access.error) return access.error;

  const contentType = request.headers.get("Content-Type") || "";
  let payload;
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    payload = JSON.parse(String(form.get("payload") || "{}"));
    payload = await uploadFileIfPossible(request, env, form, payload);
  } else {
    payload = await request.json();
  }

  if (!payload || !payload.name || !payload.platform) {
    return json({ error: "素材信息不完整" }, 400);
  }

  const item = [
    payload.id || ("UP-" + String(Date.now()).slice(-6)),
    payload.name,
    payload.platform,
    payload.category || "未分类",
    payload.audience || "AI创业粉",
    payload.type || "图文",
    payload.source || "上传",
    payload.duration || "File",
    payload.title || payload.note || payload.fileName || "新上传素材",
    payload.colors || "#1b2635, #7a5cff",
    payload.cover || "",
    payload.fileUrl || "",
    payload.fileName || "",
    new Date().toISOString(),  // index 13: createdAt
    "pending"                  // index 14: status
  ];

  const materials = await readMaterials(env);
  materials.unshift(item);
  await writeMaterials(env, materials);
  return json({ material: item });
}

// PUT /api/materials/:id — 审核素材
// body: { action: "publish" | "reject" }
async function handleReviewMaterial(request, env, id) {
  const access = requireEdit(request, env);
  if (access.error) return access.error;

  const body = await request.json().catch(() => ({}));
  const action = body.action;
  if (!action) return json({ error: "缺少 action 字段（publish 或 reject）" }, 400);

  const materials = await readMaterials(env);
  const idx = materials.findIndex(m => getId(m) === id);
  if (idx === -1) return json({ error: "素材不存在" }, 404);

  const newStatus = action === "publish" ? "published" : "rejected";
  if (Array.isArray(materials[idx])) {
    materials[idx][14] = newStatus;
  } else {
    materials[idx].status = newStatus;
  }

  await writeMaterials(env, materials);
  return json({ ok: true, id, status: newStatus });
}

// DELETE /api/materials/:id — 删除素材
async function handleDeleteMaterial(request, env, id) {
  const access = requireEdit(request, env);
  if (access.error) return access.error;

  const materials = await readMaterials(env);
  const before = materials.length;
  const filtered = materials.filter(m => getId(m) !== id);

  if (filtered.length === before) return json({ error: "素材不存在" }, 404);

  await writeMaterials(env, filtered);
  return json({ ok: true, deleted: id });
}

// GET /api/status — 实时状态轮询
// 用户端：返回统计数据（pending/published/rejected 数量）+ 最近上传记录概要
// 管理端：另外返回待审核素材明细列表
async function handleStatus(request, env) {
  const access = requireAccess(request, env);
  if (access.error) return access.error;

  const mode = access.mode;
  const materials = await readMaterials(env);

  const stats = { pending: 0, published: 0, rejected: 0, total: materials.length };
  const pendingList = [];
  const recentUploads = [];

  for (const m of materials) {
    const status = getStatus(m);
    if (status === "pending") {
      stats.pending++;
      if (pendingList.length < 30) pendingList.push(toPlainObj(m));
    } else if (status === "published") {
      stats.published++;
    } else {
      stats.rejected++;
    }
    // 最近上传（管理端可见，用于用户端展示"正在审核中"）
    if (recentUploads.length < 5) {
      const plain = toPlainObj(m);
      recentUploads.push({ id: plain.id, name: plain.name, platform: plain.platform, status, createdAt: plain.createdAt });
    }
  }

  return json({
    stats,
    timestamp: new Date().toISOString(),
    // 管理端可看待审核明细，用户端只看统计和近期摘要
    pending: mode === "edit" ? pendingList : [],
    recentUploads,
    mode
  });
}

async function handleFile(request, env, path) {
  if (!env.MATERIALS_BUCKET) return json({ error: "未配置文件存储" }, 404);
  const key = decodeURIComponent(path.replace("/api/files/", ""));
  const object = await env.MATERIALS_BUCKET.get(key);
  if (!object) return json({ error: "文件不存在" }, 404);
  return new Response(object.body, {
    headers: {
      ...corsHeaders,
      "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000"
    }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/health")                                        return json({ ok: true });
      if (path === "/api/session"   && request.method === "POST")        return handleSession(request, env);
      if (path === "/api/status"    && request.method === "GET")         return handleStatus(request, env);
      if (path === "/api/materials" && request.method === "GET")         return handleGetMaterials(request, env);
      if (path === "/api/materials" && request.method === "POST")        return handleCreateMaterial(request, env);
      if (path.startsWith("/api/files/") && request.method === "GET")   return handleFile(request, env, path);

      // /api/materials/:id
      const itemMatch = path.match(/^\/api\/materials\/([^/]+)$/);
      if (itemMatch) {
        if (request.method === "PUT")    return handleReviewMaterial(request, env, itemMatch[1]);
        if (request.method === "DELETE") return handleDeleteMaterial(request, env, itemMatch[1]);
      }

      return json({ error: "Not found" }, 404);
    } catch (error) {
      return json({ error: error.message || "Server error" }, 500);
    }
  }
};
