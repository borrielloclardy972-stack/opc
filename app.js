// OPC超级个体训练营 · 旗舰版 v3.1
// 整合：UI旗舰版多页面架构 + v2 云端协作（审核/状态轮询/管理面板）+ UI全面优化
// 素材格式统一为对象，新增 status 字段："pending" | "published" | "rejected"

const CODES = { user: "OPC-VIEW-2026", admin: "OPC-EDIT-2026" };
const STORAGE_KEYS = { materials: "opc_redesign_materials", requests: "opc_redesign_requests" };

// ── 云端配置 ─────────────────────────────────────────────────
const cloudApiBase = (window.OPC_CLOUD?.apiBase || "").replace(/\/$/, "");
const hasCloudApi = Boolean(cloudApiBase);
let cloudToken = "";
let cloudMode = ""; // "view" | "edit" | ""
let statusPollTimer = null;
let adminPanelOpen = false;

// ── Toast 通知系统 ──────────────────────────────────────────
function showToast(message, type) {
  type = type || "info";
  var container = document.getElementById("toastContainer");
  if (!container) return;
  var toast = document.createElement("div");
  toast.className = "toast " + type;
  var icons = { success: "✓", error: "✕", info: "ℹ", warning: "⚠" };
  toast.innerHTML =
    '<span class="toast-icon">' + (icons[type] || "ℹ") + '</span>' +
    '<span>' + esc(message) + '</span>';
  container.appendChild(toast);
  setTimeout(function() {
    toast.classList.add("out");
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 300);
  }, 3200);
}

// ── 平台图标映射 ─────────────────────────────────────────────
const platformMeta = {
  "抖音":     { label: "抖音",     icon: "assets/icons/douyin.svg",      key: "dy" },
  "小红书":    { label: "小红书",   icon: "assets/icons/xiaohongshu.svg",  key: "xhs" },
  "视频号":    { label: "视频号",   icon: "assets/icons/shipinhao.svg",    key: "wx" },
  "boss":     { label: "BOSS直聘", icon: "assets/icons/boss.svg",         key: "boss" },
  "闲鱼":     { label: "闲鱼",     icon: "assets/icons/xianyu.svg",       key: "xy" },
  "抖音投流":  { label: "抖音投流", icon: "assets/icons/douyin-ad.svg",    key: "dyad" },
  "腾讯广告":  { label: "腾讯广告", icon: "assets/icons/tencent-ad.svg",   key: "tx" },
  "OPC":      { label: "OPC",      icon: "assets/icons/opc-app.svg",      key: "opc" },
  "销售":     { label: "销售端",   icon: "assets/icons/opc-app.svg",      key: "sale" },
  "交付":     { label: "交付端",   icon: "assets/icons/opc-app.svg",      key: "sale" },
  "案例":     { label: "案例库",   icon: "assets/icons/opc-app.svg",      key: "case" },
  "工具":     { label: "工具",     icon: "assets/icons/opc-app.svg",      key: "tool" },
  "BOSS":     { label: "BOSS直聘", icon: "assets/icons/boss.svg",         key: "boss" }
};

function displayPlatform(platform) {
  return platformMeta[platform]?.label || platform;
}

function platformBadge(platform, size) {
  size = size || "sm";
  const meta = platformMeta[platform];
  if (!meta) return '<span class="platform-icon-fallback ' + size + '">' + ((platform||"?")[0]) + '</span>';
  return '<img class="platform-icon-img ' + size + '" src="' + meta.icon + '" alt="' + meta.label + '" />';
}

function platformFullBadge(platform) {
  const meta = platformMeta[platform];
  if (!meta) return '<span class="platform-icon-fallback">' + ((platform||"?")[0]) + '</span>';
  return '<div class="platform-badge-wrap"><img class="platform-icon-img" src="' + meta.icon + '" alt="' + meta.label + '" /><span class="platform-label">' + meta.label + '</span></div>';
}

// ── 分组元数据 ───────────────────────────────────────────────
const GROUP_META = {
  camp: {
    title: "培训营 / 训练营",
    small: "TRAINING CAMP",
    desc: "按培训营结构查看引流端、销售端与交付端对应的学习视频资料。",
    label: "培训营",
    summaries: [
      ["一级分类", "培训营 / 训练营"],
      ["二级结构", "引流端 / 销售交付"],
      ["三级结构", "各平台引流教程"],
      ["资料类型", "视频 / 图文 / SOP"]
    ]
  },
  product: {
    title: "产品物料资料",
    small: "PRODUCT MATERIALS",
    desc: "查看产品核心物料、基础文档和SOP，便于统一理解产品与交付标准。",
    label: "产品物料",
    summaries: [
      ["核心内容", "产品卖点 / 价格 / 说明"],
      ["基础资料", "文档 / SOP / 手册"],
      ["适用场景", "销售 / 交付 / 培训"],
      ["资料类型", "文档 / 资料包"]
    ]
  },
  cases: {
    title: "素材案例",
    small: "CASE LIBRARY",
    desc: "查看高转化素材案例与成交交付案例，学习内容结构与转化链路。",
    label: "素材案例",
    summaries: [
      ["案例类型", "高转化 / 成交交付"],
      ["学习目标", "结构拆解 / 转化路径"],
      ["适用场景", "内容创作 / 实战复盘"],
      ["资料类型", "案例 / 视频 / 图文"]
    ]
  },
  other: {
    title: "其他资料",
    small: "TOOLS & FAQ",
    desc: "查看工具清单、FAQ和补充说明，用于补足学习资料之外的通用内容。",
    label: "其他资料",
    summaries: [
      ["资料类型", "工具清单 / FAQ"],
      ["作用", "补充说明 / 公告"],
      ["使用场景", "日常查询 / 问题排查"],
      ["资料形式", "文档 / 清单"]
    ]
  }
};

// ── 初始素材 ─────────────────────────────────────────────────
const SEED_MATERIALS = [
  { id:"m1",  group:"camp", category:"引流端培训营",  subcategory:"抖音引流教程",    platform:"抖音",     platformKey:"dy",   type:"视频",   duration:"18s",  badge:"自然流",   label:"AI创业粉", title:"抖音创业开场三秒钩子",         desc:"引流端培训营 · 抖音获客口播开场，适合短视频起号与私域承接。",             mentor:"学习：创业者开场三秒钩子", gradient:"linear-gradient(135deg, rgba(21,18,22,.95), rgba(255,45,85,.28))", status:"published" },
  { id:"m2",  group:"camp", category:"引流端培训营",  subcategory:"小红书引流教程",   platform:"小红书",    platformKey:"xhs",  type:"图文",   duration:"7页",   badge:"爆款图文", label:"AI创业粉", title:"小红书图文种草七页结构",         desc:"引流端培训营 · 收藏型图文模板，适合转化成交前的种草承接。",               mentor:"学习：封面与结构转化",         gradient:"linear-gradient(135deg, rgba(91,16,32,.95), rgba(255,36,66,.28))", status:"published" },
  { id:"m3",  group:"camp", category:"引流端培训营",  subcategory:"视频号引流教程",   platform:"视频号",    platformKey:"wx",   type:"视频",   duration:"3m",    badge:"私域承接", label:"AI创业粉", title:"视频号教程内容承接SOP",          desc:"引流端培训营 · 适合教程型内容引流与社群承接。",                           mentor:"学习：视频号内容承接",         gradient:"linear-gradient(135deg, rgba(16,50,35,.95), rgba(35,194,107,.28))", status:"published" },
  { id:"m4",  group:"camp", category:"引流端培训营",  subcategory:"闲鱼引流教程",    platform:"闲鱼",     platformKey:"xy",   type:"SOP",    duration:"12m",   badge:"交易型",   label:"AI创业粉", title:"闲鱼商品发布与私信成交",         desc:"引流端培训营 · 商品标题、发布、沟通到私信成交全链路。",                 mentor:"学习：闲鱼线索承接",           gradient:"linear-gradient(135deg, rgba(58,50,20,.95), rgba(255,209,61,.28))", status:"published" },
  { id:"m5",  group:"camp", category:"引流端培训营",  subcategory:"BOSS引流教程",    platform:"BOSS",      platformKey:"boss", type:"文档",   duration:"9页",   badge:"线索筛选", label:"AI创业粉", title:"BOSS直聘线索筛选话术",           desc:"引流端培训营 · 招聘场景线索识别与高意向用户筛选方法。",                 mentor:"学习：BOSS获客话术",           gradient:"linear-gradient(135deg, rgba(18,40,77,.95), rgba(25,118,255,.28))", status:"published" },
  { id:"m6",  group:"camp", category:"交付销售培训营", subcategory:"销售端培训营",    platform:"销售",     platformKey:"sale", type:"视频",   duration:"11m",   badge:"成交课",   label:"销售端",   title:"销售端成交四步话术",             desc:"交付 / 销售端培训营 · 从需求确认到报价成交的标准流程。",               mentor:"学习：成交四步模型",           gradient:"linear-gradient(135deg, rgba(20,17,29,.95), rgba(122,92,255,.30))", status:"published" },
  { id:"m7",  group:"camp", category:"交付销售培训营", subcategory:"交付端培训营",    platform:"交付",     platformKey:"opc",  type:"文档",   duration:"SOP",   badge:"交付课",   label:"交付端",   title:"交付端客户管理SOP",              desc:"交付 / 销售端培训营 · 交付节奏、节点复盘和客户管理标准化。",           mentor:"学习：交付流程闭环",           gradient:"linear-gradient(135deg, rgba(16,42,68,.95), rgba(22,133,255,.28))", status:"published" },
  { id:"m8",  group:"product", category:"产品核心物料",  subcategory:"产品核心物料",  platform:"OPC",     platformKey:"opc",  type:"资料包", duration:"8份",   badge:"核心物料", label:"产品资料", title:"产品核心物料包",                  desc:"产品介绍、卖点、价格、交付说明与常见问题整理。",                       mentor:"学习：产品标准介绍",           gradient:"linear-gradient(135deg, rgba(30,36,61,.95), rgba(122,92,255,.30))", status:"published" },
  { id:"m9",  group:"product", category:"基础文档SOP",   subcategory:"基础文档SOP",   platform:"OPC",     platformKey:"opc",  type:"文档",   duration:"合集",  badge:"基础文档", label:"SOP",      title:"基础文档与SOP合集",              desc:"学员手册、执行流程、交付标准、复盘模板等基础资料。",                   mentor:"学习：执行SOP",                gradient:"linear-gradient(135deg, rgba(23,51,64,.95), rgba(47,215,255,.26))", status:"published" },
  { id:"m10", group:"cases",  category:"高转化素材案例", subcategory:"高转化素材案例", platform:"案例",     platformKey:"case", type:"案例",   duration:"6例",   badge:"高转化",   label:"案例库",   title:"高转化素材案例拆解",             desc:"拆解标题、封面、钩子和转化动作，适合对照复用。",                       mentor:"学习：案例结构拆解",           gradient:"linear-gradient(135deg, rgba(53,31,27,.95), rgba(255,91,132,.26))", status:"published" },
  { id:"m11", group:"cases",  category:"成交交付案例",   subcategory:"成交交付案例",  platform:"案例",     platformKey:"case", type:"案例",   duration:"4例",   badge:"完整链路", label:"成交案例", title:"成交与交付完整案例",              desc:"从线索进入、沟通成交到交付履约的全链路案例演示。",                     mentor:"学习：成交与交付案例",         gradient:"linear-gradient(135deg, rgba(47,34,56,.95), rgba(255,79,139,.26))", status:"published" },
  { id:"m12", group:"other",  category:"工具清单FAQ",    subcategory:"工具清单FAQ",   platform:"工具",     platformKey:"tool", type:"工具",   duration:"清单",  badge:"FAQ",     label:"辅助资料", title:"工具清单与FAQ",                   desc:"常用工具、账号使用、常见问题、补充公告与说明合集。",                   mentor:"学习：常用工具与FAQ",          gradient:"linear-gradient(135deg, rgba(27,55,50,.95), rgba(54,211,153,.24))", status:"published" }
];

const TITLES = {
  home: "首页",
  agent: "代理认证卡密",
  library: "培训营 / 训练营",
  learning: "学习进度",
  assessment: "考核学习进度"
};

const state = {
  role: "user",
  authMode: "user",
  screen: "home",
  group: "camp",
  filter: "all"
};

// ── 工具函数 ─────────────────────────────────────────────────
function $(s){ return document.querySelector(s); }
function $$(s){ return document.querySelectorAll(s); }
function a$(s){ return Array.from(document.querySelectorAll(s)); }
function esc(v){ return String(v ?? "").replace(/[&<>"']/g, function(m){ return ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"})[m]; }); }

function readMaterials(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.materials)) || SEED_MATERIALS.slice(); }
  catch { return SEED_MATERIALS.slice(); }
}
function saveMaterials(list){ localStorage.setItem(STORAGE_KEYS.materials, JSON.stringify(list)); }
function readRequests(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.requests)) || []; }
  catch { return []; }
}
function saveRequests(list){ localStorage.setItem(STORAGE_KEYS.requests, JSON.stringify(list)); }

// ── 云端 API ─────────────────────────────────────────────────
async function verifyCloudCode(code) {
  const res = await fetch(cloudApiBase + "/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: code })
  });
  if (!res.ok) throw new Error("卡密不正确，请重新输入。");
  return res.json();
}

async function fetchCloudMaterials() {
  if (!hasCloudApi || !cloudToken) return;
  try {
    const res = await fetch(cloudApiBase + "/api/materials", {
      headers: { Authorization: "Bearer " + cloudToken }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data.materials)) return;
    // 云端素材合并：本地种子素材 + 云端素材（去重）
    const all = readMaterials();
    const cloudIds = new Set(data.materials.map(function(m){ return m.id; }));
    const merged = data.materials.concat(all.filter(function(m){ return !cloudIds.has(m.id); }));
    saveMaterials(merged);
    if (state.screen === "library") renderLibrary();
  } catch (e) { /* 静默失败 */ }
}

async function saveCloudTemplate(payload, file) {
  if (!hasCloudApi || !cloudToken) throw new Error("云端未连接");
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  if (file) form.append("file", file);
  const res = await fetch(cloudApiBase + "/api/materials", {
    method: "POST",
    headers: { Authorization: "Bearer " + cloudToken },
    body: form
  });
  if (!res.ok) {
    const d = await res.json().catch(function(){ return {}; });
    throw new Error(d.error || "云端保存失败");
  }
  return res.json();
}

async function reviewCloudMaterial(id, action) {
  const res = await fetch(cloudApiBase + "/api/materials/" + id, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + cloudToken
    },
    body: JSON.stringify({ action: action })
  });
  if (!res.ok) {
    const d = await res.json().catch(function(){ return {}; });
    throw new Error(d.error || "操作失败");
  }
  return res.json();
}

async function deleteCloudMaterial(id) {
  const res = await fetch(cloudApiBase + "/api/materials/" + id, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + cloudToken }
  });
  if (!res.ok) {
    const d = await res.json().catch(function(){ return {}; });
    throw new Error(d.error || "删除失败");
  }
  return res.json();
}

// ── 实时状态轮询 ──────────────────────────────────────────────
async function fetchStatus() {
  if (!hasCloudApi || !cloudToken) return null;
  try {
    const res = await fetch(cloudApiBase + "/api/status", {
      headers: { Authorization: "Bearer " + cloudToken }
    });
    if (!res.ok) return null;
    return res.json();
  } catch (e) { return null; }
}

function updateStatusBar(data) {
  if (!data) return;
  var bar = $("#statusBar");
  if (!bar) return;

  var stats = data.stats;
  var mode = data.mode;

  if (mode === "edit") {
    bar.innerHTML =
      '<div class="status-bar-inner admin-status">' +
        '<div class="status-stats">' +
          '<span class="stat-item pending"><span class="stat-num">' + stats.pending + '</span> 待审核</span>' +
          '<span class="stat-item published"><span class="stat-num">' + stats.published + '</span> 已发布</span>' +
          '<span class="stat-item rejected"><span class="stat-num">' + stats.rejected + '</span> 已拒绝</span>' +
          '<span class="stat-item total"><span class="stat-num">' + stats.total + '</span> 总计</span>' +
        '</div>' +
        '<div class="status-actions">' +
          (stats.pending > 0 ? '<button class="status-review-btn" type="button" id="openAdminPanel">审核待处理素材 (' + stats.pending + ')</button>' : '<span class="status-clean">✓ 无待审核</span>') +
          '<span class="status-time">更新于 ' + new Date(data.timestamp).toLocaleTimeString("zh-CN") + '</span>' +
        '</div>' +
      '</div>';
    var btn = $("#openAdminPanel");
    if (btn) btn.addEventListener("click", openAdminPanel);
  } else {
    if (stats.pending > 0) {
      bar.innerHTML =
        '<div class="status-bar-inner user-status">' +
          '<span class="pulse-dot"></span>' +
          '<span>素材库更新中，<strong>' + stats.pending + '</strong> 个素材正在审核，通过后将自动出现在列表中</span>' +
          '<span class="status-time">' + new Date(data.timestamp).toLocaleTimeString("zh-CN") + '</span>' +
        '</div>';
      bar.classList.add("has-pending");
    } else {
      bar.innerHTML = "";
      bar.classList.remove("has-pending");
    }
  }
}

function startStatusPoll() {
  stopStatusPoll();
  fetchStatus().then(updateStatusBar);
  statusPollTimer = setInterval(function(){
    fetchStatus().then(function(data){
      updateStatusBar(data);
      if (data && cloudMode === "edit") fetchCloudMaterials();
    });
  }, 15000);
}

function stopStatusPoll() {
  if (statusPollTimer) { clearInterval(statusPollTimer); statusPollTimer = null; }
}

// ── 管理端审核面板 ────────────────────────────────────────────
function openAdminPanel() {
  if (adminPanelOpen) return;
  adminPanelOpen = true;

  fetchStatus().then(function(data){
    if (!data) { adminPanelOpen = false; return; }
    var pending = data.pending || [];

    var panel = document.createElement("dialog");
    panel.className = "admin-panel-dialog";
    panel.id = "adminPanel";

    panel.innerHTML =
      '<div class="admin-panel-head">' +
        '<div><p class="eyebrow">管理端</p><h2>待审核素材 <span class="badge-count">' + pending.length + '</span></h2></div>' +
        '<button class="icon-button" id="closeAdminPanel" type="button" aria-label="关闭">×</button>' +
      '</div>' +
      '<div class="admin-panel-body">' +
        (pending.length === 0
          ? '<div class="empty-state" style="padding:40px 0">暂无待审核素材</div>'
          : '<div class="admin-material-list" id="adminMaterialList">' +
              pending.map(function(m){
                return '<div class="admin-material-row" data-id="' + m.id + '">' +
                  '<div class="admin-thumb" style="background: ' + (m.colors ? 'linear-gradient(135deg, ' + m.colors + ')' : '#1b2635') + ';">' +
                    (m.cover ? '<img src="' + m.cover + '" alt="" />' : '<span>' + ((m.platform || "?").slice(0,1)) + '</span>') +
                  '</div>' +
                  '<div class="admin-info">' +
                    '<strong>' + esc(m.name) + '</strong>' +
                    '<span>' + displayPlatform(m.platform) + ' · ' + esc(m.category) + ' · ' + esc(m.type) + '</span>' +
                    '<span class="admin-meta">' + esc(m.audience) + ' · 上传于 ' + (m.createdAt ? new Date(m.createdAt).toLocaleString("zh-CN") : "未知") + '</span>' +
                  '</div>' +
                  '<div class="admin-ops">' +
                    '<button class="btn-approve" data-action="publish" data-id="' + m.id + '" type="button">✓ 通过</button>' +
                    '<button class="btn-reject" data-action="reject" data-id="' + m.id + '" type="button">✕ 拒绝</button>' +
                    '<button class="btn-delete" data-action="delete" data-id="' + m.id + '" type="button">🗑 删除</button>' +
                  '</div>' +
                '</div>';
              }).join("") +
            '</div>') +
      '</div>';

    document.body.appendChild(panel);
    panel.showModal();

    panel.querySelector("#closeAdminPanel").addEventListener("click", function(){
      panel.close(); panel.remove(); adminPanelOpen = false;
    });

    panel.addEventListener("click", function(e){
      var btn = e.target.closest("[data-action][data-id]");
      if (!btn) return;
      var action = btn.dataset.action;
      var id = btn.dataset.id;
      btn.disabled = true;
      var row = btn.closest(".admin-material-row");

      (action === "delete" ? deleteCloudMaterial(id) : reviewCloudMaterial(id, action))
        .then(function(){
          if (action === "delete") {
            if (row) row.remove();
          } else if (row) {
            row.querySelector(".admin-ops").innerHTML =
              action === "publish"
                ? '<span class="status-badge status-published">已发布</span>'
                : '<span class="status-badge status-rejected">已拒绝</span>';
          }
          // 更新本地素材状态
          var materials = readMaterials();
          var found = false;
          for (var i = 0; i < materials.length; i++) {
            if (materials[i].id === id) {
              if (action === "delete") { materials.splice(i, 1); }
              else { materials[i].status = action === "publish" ? "published" : "rejected"; }
              found = true;
              break;
            }
          }
          if (found) { saveMaterials(materials); if (state.screen === "library") renderLibrary(); }
          fetchStatus().then(updateStatusBar);
        })
        .catch(function(err){
          alert(err.message || "操作失败");
          btn.disabled = false;
        });
    });
  });
}

// ── 状态徽章 ─────────────────────────────────────────────────
function statusBadge(status) {
  var map = {
    pending:   { text: "审核中", cls: "status-pending" },
    published: { text: "已发布", cls: "status-published" },
    rejected:  { text: "已拒绝", cls: "status-rejected" }
  };
  var s = map[status] || map.published;
  return '<span class="status-badge ' + s.cls + '">' + s.text + '</span>';
}

// ── 平台渐变色映射 ────────────────────────────────────────────
function guessGradient(platformKey) {
  var map = {
    dy:   "linear-gradient(135deg, rgba(21,18,22,.95), rgba(255,45,85,.28))",
    dyad: "linear-gradient(135deg, rgba(20,17,29,.95), rgba(122,92,255,.28))",
    xhs:  "linear-gradient(135deg, rgba(91,16,32,.95), rgba(255,36,66,.28))",
    wx:   "linear-gradient(135deg, rgba(16,50,35,.95), rgba(35,194,107,.28))",
    xy:   "linear-gradient(135deg, rgba(58,50,20,.95), rgba(255,209,61,.28))",
    boss: "linear-gradient(135deg, rgba(18,40,77,.95), rgba(25,118,255,.28))",
    tx:   "linear-gradient(135deg, rgba(16,42,68,.95), rgba(22,133,255,.28))",
    sale: "linear-gradient(135deg, rgba(20,17,29,.95), rgba(122,92,255,.30))",
    case: "linear-gradient(135deg, rgba(53,31,27,.95), rgba(255,91,132,.26))",
    tool: "linear-gradient(135deg, rgba(27,55,50,.95), rgba(54,211,153,.24))",
    opc:  "linear-gradient(135deg, rgba(30,36,61,.95), rgba(122,92,255,.30))"
  };
  return map[platformKey] || map.opc;
}

function guessPlatformKey(platform) {
  var name = (platform || "").toLowerCase();
  if (name.indexOf("抖音投流") !== -1 || name.indexOf("douyinad") !== -1) return "dyad";
  if (name.indexOf("抖音") !== -1) return "dy";
  if (name.indexOf("小红书") !== -1) return "xhs";
  if (name.indexOf("视频号") !== -1 || name.indexOf("微信") !== -1) return "wx";
  if (name.indexOf("闲鱼") !== -1) return "xy";
  if (name.indexOf("boss") !== -1) return "boss";
  if (name.indexOf("腾讯广告") !== -1) return "tx";
  if (name.indexOf("销售") !== -1) return "sale";
  if (name.indexOf("交付") !== -1) return "sale";
  if (name.indexOf("案例") !== -1) return "case";
  if (name.indexOf("工具") !== -1) return "tool";
  return "opc";
}

// ── 权限与登录 ────────────────────────────────────────────────
function setAuthTab(mode){
  state.authMode = mode;
  a$("[data-auth]").forEach(function(btn){ btn.classList.toggle("active", btn.dataset.auth === mode); });
  var isRegister = mode === "register";
  $("#passwordPanel").hidden = isRegister;
  $("#registerPanel").hidden = !isRegister;
  $("#formMessage").textContent = "";
  $("#formMessage").style.color = "";
  if(!isRegister){
    var isAdmin = mode === "admin";
    $("#roleNote").innerHTML = isAdmin
      ? "<b>管理员登录</b><span>管理权限：上传、删除素材、审核云端素材和查看注册申请。</span>"
      : "<b>用户登录</b><span>只读权限：查看素材、课程进度和资料内容。</span>";
    $("#codeLabel").textContent = isAdmin ? "管理员卡密" : "用户查看卡密";
    $("#accessCode").placeholder = isAdmin ? "请输入管理员卡密" : "请输入用户卡密";
    $("#loginSubmit").textContent = isAdmin ? "管理员登录管理系统" : "用户登录查看素材";
  }
}

function applyAccessMode(mode) {
  state.role = mode;
  document.body.classList.remove("locked");
  document.body.classList.toggle("admin", mode === "admin");
  $("#authShell").hidden = true;
  $("#appShell").hidden = false;
  $("#roleChip").textContent = mode === "admin" ? "管理员" : "用户";
  cloudMode = mode;
  if (hasCloudApi) {
    fetchCloudMaterials();
    startStatusPoll();
  }
  goTo("home");
}

function enterApp(role){
  state.role = role;
  document.body.classList.remove("locked");
  document.body.classList.toggle("admin", role === "admin");
  $("#authShell").hidden = true;
  $("#appShell").hidden = false;
  $("#roleChip").textContent = role === "admin" ? "管理员" : "用户";
  cloudMode = role;
  sessionStorage.setItem("opc_cloud_mode", role);
  if (hasCloudApi) {
    fetchCloudMaterials();
    startStatusPoll();
  }
  goTo("home");
}

function lockAccess() {
  document.body.classList.add("locked");
  document.body.classList.remove("admin");
  $("#authShell").hidden = false;
  $("#appShell").hidden = true;
  cloudMode = "";
  cloudToken = "";
  sessionStorage.removeItem("opc_cloud_mode");
  sessionStorage.removeItem("opc_cloud_token");
  stopStatusPoll();
  var bar = $("#statusBar");
  if (bar) bar.innerHTML = "";
  setAuthTab("user");
  $("#accessCode").value = "";
  $("#formMessage").textContent = "";
}

// ── 导航 ──────────────────────────────────────────────────────
function goTo(screen, group, filter){
  if (!group) group = state.group;
  if (!filter) filter = state.filter;
  state.screen = screen;
  if(screen === "library"){ state.group = group; state.filter = filter; }
  a$(".view").forEach(function(v){ v.classList.remove("active"); });
  $("#view-" + screen).classList.add("active");
  a$(".nav-link").forEach(function(btn){
    var active = screen === "library"
      ? btn.dataset.screen === "library" && btn.dataset.group === state.group
      : btn.dataset.screen === screen;
    btn.classList.toggle("active", active);
  });
  $("#screenTitle").textContent = screen === "library" ? GROUP_META[state.group].title : TITLES[screen];
  $("#crumb").textContent = screen === "library" ? GROUP_META[state.group].title : TITLES[screen];
  $("#catalogGroupLabel").textContent = GROUP_META[state.group] ? GROUP_META[state.group].label : "培训营";
  highlightCatalog();
  if(screen === "library") renderLibrary();
}

function highlightCatalog(){
  a$(".catalog-item, .catalog-leaf").forEach(function(btn){
    btn.classList.toggle("active", btn.dataset.group === state.group && btn.dataset.filter === state.filter);
  });
  a$(".catalog-group").forEach(function(group){
    group.classList.toggle("open", group.dataset.accordion === state.group);
  });
}

function defaultFilter(group){
  switch(group){
    case "product": return "产品核心物料";
    case "cases": return "高转化素材案例";
    case "other": return "工具清单FAQ";
    default: return "all";
  }
}

// ── 素材库渲染 ────────────────────────────────────────────────
function filterMaterials(list){
  var group = state.group;
  var filter = state.filter;
  return list.filter(function(item){
    if(item.group !== group) return false;
    // 用户端隐藏非 published 素材
    var itemStatus = item.status || "published";
    if (cloudMode !== "edit" && itemStatus !== "published") return false;
    if(filter === "all") return true;
    if(filter === "引流端培训营") return item.category === "引流端培训营";
    if(filter === "交付销售培训营") return item.category === "交付销售培训营";
    return item.subcategory === filter || item.category === filter;
  });
}

function renderSummary(){
  var meta = GROUP_META[state.group];
  $("#summaryStrip").innerHTML = meta.summaries.map(function(pair){
    return '<article class="summary-card"><span>' + esc(pair[0]) + '</span><strong>' + esc(pair[1]) + '</strong></article>';
  }).join("");
}

function renderLibrary(){
  var meta = GROUP_META[state.group];
  var list = filterMaterials(readMaterials());
  $("#librarySmallTitle").textContent = meta.small;
  $("#libraryTitle").textContent = meta.title;
  $("#libraryDesc").textContent = state.filter === "all" ? meta.desc : "当前分类：" + state.filter + "，以下展示该分类对应的学习资料。";
  $("#libraryCount").textContent = list.length + " 项资料";
  renderSummary();
  $("#materialGrid").innerHTML = list.length ? list.map(renderMaterialCard).join("") : '<div class="empty-state">当前分类暂无资料。</div>';
}

function renderMaterialCard(item){
  var pLabel = displayPlatform(item.platform || "");
  var itemStatus = item.status || "published";

  return '<article class="material-card">' +
    '<div class="material-cover" style="background:' + esc(item.gradient) + '">' +
      '<div class="cover-chip-row">' +
        '<span class="cover-chip">' + esc(item.badge) + '</span>' +
        '<span class="cover-tag">' + esc(item.label) + '</span>' +
        (itemStatus === "pending" ? '<span class="cover-status-chip pending">审核中</span>' : '') +
        (itemStatus === "rejected" ? '<span class="cover-status-chip rejected">已拒绝</span>' : '') +
      '</div>' +
      '<div class="platform-panel">' +
        '<div class="platform-icon-block">' + platformBadge(item.platform, "lg") + '</div>' +
        '<div class="platform-meta">' +
          '<strong>' + esc(item.title) + '</strong>' +
          '<span class="platform-meta-sub">' +
            '<span class="platform-meta-label">' + esc(pLabel) + '</span>' +
            '<span class="platform-meta-sep">·</span>' +
            '<span>' + esc(item.subcategory) + ' · ' + esc(item.duration) + '</span>' +
          '</span>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="material-body">' +
      '<h3>' + esc(item.type) + '</h3>' +
      '<p>' + esc(item.desc) + '</p>' +
      '<div class="material-foot">' +
        '<div class="info-stack">' +
          '<small>' + esc(item.category) + '</small>' +
          '<strong>' + esc(item.mentor) + '</strong>' +
        '</div>' +
        (cloudMode === "edit"
          ? '<div class="admin-card-actions">' +
              statusBadge(itemStatus) +
              (itemStatus === "pending"
                ? '<button class="btn-approve" data-review="publish" data-id="' + esc(item.id) + '" type="button">✓ 通过</button>' +
                  '<button class="btn-reject" data-review="reject" data-id="' + esc(item.id) + '" type="button">✕ 拒绝</button>'
                : '') +
              '<button class="btn-delete-card" data-delete="' + esc(item.id) + '" type="button">🗑 删除</button>' +
            '</div>'
          : (itemStatus === "pending"
            ? '<div class="user-status-pending">⏳ 素材审核中，通过后即可查看</div>'
            : '')) +
      '</div>' +
    '</div>' +
  '</article>';
}

// ── 注册申请 ─────────────────────────────────────────────────
function renderRequests(){
  var list = readRequests();
  $("#requestsList").innerHTML = list.length ? list.map(function(req){
    return '<article class="request-item">' +
      '<div class="request-head"><strong>' + esc(req.name) + '</strong><span class="request-role">' + (req.role === "admin" ? "管理员申请" : "用户申请") + '</span></div>' +
      '<p>联系方式：' + esc(req.contact) + '</p>' +
      '<p>申请说明：' + esc(req.note || "未填写") + '</p>' +
      '<p>提交时间：' + esc(req.createdAt) + '</p>' +
    '</article>';
  }).join("") : '<div class="empty-state">暂无注册申请。</div>';
}

// ── 移动端侧边栏控制 ─────────────────────────────────────────
function openSidebar() {
  var sidebar = $("#sidebar");
  var overlay = $("#sidebarOverlay");
  if (sidebar) sidebar.classList.add("open");
  if (overlay) overlay.classList.add("show");
}
function closeSidebar() {
  var sidebar = $("#sidebar");
  var overlay = $("#sidebarOverlay");
  if (sidebar) sidebar.classList.remove("open");
  if (overlay) overlay.classList.remove("show");
}

// ── 事件绑定 ─────────────────────────────────────────────────
function bindEvents(){
  a$("[data-auth]").forEach(function(btn){
    btn.addEventListener("click", function(){ setAuthTab(btn.dataset.auth); });
  });

  $("#authCard").addEventListener("submit", function(e){
    e.preventDefault();
    if(state.authMode === "register") return;
    var code = $("#accessCode").value.trim();

    if (hasCloudApi) {
      verifyCloudCode(code).then(function(data){
        cloudToken = code;
        sessionStorage.setItem("opc_cloud_token", code);
        applyAccessMode(data.mode);
        showToast(data.mode === "edit" ? "管理员登录成功" : "登录成功", "success");
      }).catch(function(err){
        $("#formMessage").textContent = err.message || "卡密不正确，请重新输入。";
        showToast("登录失败：" + (err.message || "卡密不正确"), "error");
      });
    } else {
      if(code === CODES[state.authMode]){
        cloudToken = code;
        enterApp(state.authMode === "admin" ? "admin" : "user");
        showToast(state.authMode === "admin" ? "管理员登录成功" : "登录成功", "success");
      } else {
        $("#formMessage").textContent = state.authMode === "admin" ? "管理员卡密不正确。" : "用户卡密不正确。";
        showToast("卡密不正确", "error");
      }
    }
  });

  $("#registerSubmit").addEventListener("click", function(){
    var req = {
      id: Date.now(),
      name: $("#regName").value.trim(),
      contact: $("#regContact").value.trim(),
      role: $("#regRole").value,
      note: $("#regNote").value.trim(),
      createdAt: new Date().toLocaleString("zh-CN")
    };
    if(!req.name || !req.contact){
      $("#formMessage").textContent = "请填写姓名和联系方式。";
      return;
    }
    var list = readRequests();
    list.unshift(req);
    saveRequests(list);
    $("#formMessage").style.color = "#168f65";
    $("#formMessage").textContent = "注册申请已提交，等待管理员审核。";
    showToast("注册申请已提交，等待审核", "success");
    $("#regName").value = "";
    $("#regContact").value = "";
    $("#regNote").value = "";
  });

  a$(".nav-link").forEach(function(btn){
    btn.addEventListener("click", function(){
      var screen = btn.dataset.screen;
      if(screen === "library") goTo("library", btn.dataset.group, btn.dataset.group === "camp" ? "all" : defaultFilter(btn.dataset.group));
      else goTo(screen);
      closeSidebar();
    });
  });

  $("#catalogCard").addEventListener("click", function(e){
    var head = e.target.closest(".catalog-head");
    if(head){ head.closest(".catalog-group").classList.toggle("open"); return; }
    var item = e.target.closest(".catalog-item, .catalog-leaf");
    if(!item) return;
    goTo("library", item.dataset.group, item.dataset.filter);
    closeSidebar();
  });

  // ── 移动端汉堡菜单 ────────────────────────────────────────
  $("#mobileMenuToggle").addEventListener("click", openSidebar);
  $("#sidebarClose").addEventListener("click", closeSidebar);
  $("#sidebarOverlay").addEventListener("click", closeSidebar);

  $("#switchAccess").addEventListener("click", function(){ lockAccess(); showToast("已退出登录", "info"); });
  $("#verifyBtn").addEventListener("click", function(){ $("#verifyText").textContent = "已完成认证 · OPC超级个体"; showToast("身份认证完成", "success"); });
  $("#assessmentBtn").addEventListener("click", function(){ showToast("考核模块正在规划中，敬请期待", "warning"); });

  $("#openUpload").addEventListener("click", function(){ $("#uploadModal").showModal(); });
  $("#openRequests").addEventListener("click", function(){ renderRequests(); $("#requestsModal").showModal(); });

  a$("[data-close]").forEach(function(btn){
    btn.addEventListener("click", function(){ $("#" + btn.dataset.close).close(); });
  });

  // ── 上传素材（含云端）─────────────────────────────────────
  $("#saveMaterial").addEventListener("click", function(){
    var title = $("#upTitle").value.trim();
    var group = $("#upGroup").value;
    var category = $("#upCategory").value.trim();
    var subcategory = $("#upSubcategory").value.trim() || category;
    var platform = $("#upPlatform").value.trim() || "OPC";
    var type = $("#upType").value.trim() || "资料";
    var desc = $("#upDesc").value.trim() || "管理员上传的学习资料";
    if(!title || !category){ showToast("请至少填写素材标题和分类名", "warning"); return; }

    var platformKey = guessPlatformKey(platform);
    var payload = {
      id: "up" + Date.now(),
      group: group,
      category: category,
      subcategory: subcategory,
      platform: platform,
      platformKey: platformKey,
      type: type,
      duration: "新上传",
      badge: "管理员上传",
      label: GROUP_META[group].label,
      title: title,
      desc: desc,
      mentor: "学习：管理员上传资料",
      gradient: guessGradient(platformKey),
      status: "pending"
    };

    var btn = $("#saveMaterial");
    btn.disabled = true;
    btn.textContent = "上传中…";

    (hasCloudApi && cloudMode === "edit"
      ? saveCloudTemplate(payload).then(function(data){
          var materials = readMaterials();
          materials.unshift(data.material || payload);
          saveMaterials(materials);
          setTimeout(function(){ fetchStatus().then(updateStatusBar); }, 500);
        })
      : Promise.resolve().then(function(){
          var materials = readMaterials();
          materials.unshift(payload);
          saveMaterials(materials);
        })
    ).then(function(){
      ["#upTitle","#upCategory","#upSubcategory","#upPlatform","#upType","#upDesc"].forEach(function(id){ $(id).value = ""; });
      $("#uploadModal").close();
      goTo("library", group, group === "camp" ? "all" : category);
      showToast("素材上传成功" + (hasCloudApi && cloudMode === "edit" ? "，等待审核" : ""), "success");
    }).catch(function(err){
      showToast(err.message || "保存失败，请重试", "error");
    }).then(function(){
      btn.disabled = false;
      btn.textContent = "保存素材";
    });
  });

  // ── 素材卡片操作委托 ──────────────────────────────────────
  $("#materialGrid").addEventListener("click", function(e){
    // 管理端审核按钮
    var reviewBtn = e.target.closest("[data-review]");
    if (reviewBtn && cloudMode === "edit") {
      var id = reviewBtn.dataset.id;
      var action = reviewBtn.dataset.action;
      reviewBtn.disabled = true;

      reviewCloudMaterial(id, action).then(function(){
        var materials = readMaterials();
        for (var i = 0; i < materials.length; i++) {
          if (materials[i].id === id) {
            materials[i].status = action === "publish" ? "published" : "rejected";
            break;
          }
        }
        saveMaterials(materials);
        renderLibrary();
        fetchStatus().then(updateStatusBar);
        showToast(action === "publish" ? "素材已通过审核" : "素材已拒绝", action === "publish" ? "success" : "info");
      }).catch(function(err){
        showToast(err.message || "操作失败", "error");
        reviewBtn.disabled = false;
      });
      return;
    }

    // 删除按钮
    var delBtn = e.target.closest("[data-delete]");
    if (!delBtn) return;
    // 用户模式且素材是 locked 则不操作
    if (state.role !== "admin" && hasCloudApi) return;
    if (state.role !== "admin" && !hasCloudApi) {
      // 纯本地模式只有 admin 可删除
      if (state.role !== "admin") return;
    }

    var id = delBtn.dataset.delete;
    if (!confirm("确认删除素材 " + id + "？")) return;

    if (hasCloudApi && cloudMode === "edit") {
      deleteCloudMaterial(id).then(function(){
        var materials = readMaterials();
        for (var i = 0; i < materials.length; i++) {
          if (materials[i].id === id) { materials.splice(i, 1); break; }
        }
        saveMaterials(materials);
        renderLibrary();
        fetchStatus().then(updateStatusBar);
        showToast("素材已删除", "info");
      }).catch(function(err){ showToast(err.message || "删除失败", "error"); });
    } else {
      var materials = readMaterials();
      for (var i = 0; i < materials.length; i++) {
        if (materials[i].id === id) { materials.splice(i, 1); break; }
      }
      saveMaterials(materials);
      renderLibrary();
      showToast("素材已删除", "info");
    }
  });
}

// ── 初始化 ────────────────────────────────────────────────────
bindEvents();
setAuthTab("user");
highlightCatalog();

// 恢复会话
var savedMode = sessionStorage.getItem("opc_cloud_mode");
var savedToken = sessionStorage.getItem("opc_cloud_token") || "";
if (savedMode === "user" || savedMode === "admin") {
  state.role = savedMode;
  cloudMode = savedMode;
  cloudToken = savedToken;
  document.body.classList.remove("locked");
  document.body.classList.toggle("admin", savedMode === "admin");
  $("#authShell").hidden = true;
  $("#appShell").hidden = false;
  $("#roleChip").textContent = savedMode === "admin" ? "管理员" : "用户";
  if (hasCloudApi) {
    fetchCloudMaterials();
    startStatusPoll();
  }
  goTo("home");
}

// ── PWA Service Worker ───────────────────────────────────────
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./sw.js").catch(function(){});
}
