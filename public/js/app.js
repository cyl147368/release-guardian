/* ═══════════════════════════════════════════════════════
   Release Guardian — 前端控制台逻辑
   ═══════════════════════════════════════════════════════ */

const API = window.location.origin;

/* ── 状态 ── */
let currentView = "dashboard";
let pagination = { offset: 0, limit: 20 };

/* ── 启动序列 ── */
document.addEventListener("DOMContentLoaded", () => {
  initBootSequence();
});

function initBootSequence() {
  const boot = document.getElementById("boot-screen");
  const shell = document.getElementById("app-shell");

  // 初始化各模块
  initNavigation();
  initSearch();
  initModal();

  // 延迟移除开机画面
  setTimeout(() => {
    boot.classList.add("hidden");
    shell.style.opacity = "1";
    // 数据加载
    checkHealth();
    loadDashboard();
  }, 2000);
}

/* ── 导航 ── */
function initNavigation() {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      switchView(item.dataset.view);
    });
  });

  document.getElementById("menu-toggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  document.getElementById("sidebar-close").addEventListener("click", () => {
    document.getElementById("sidebar").classList.remove("open");
  });

  document.getElementById("refresh-btn").addEventListener("click", () => {
    refreshCurrentView();
  });

  document.getElementById("create-form").addEventListener("submit", handleCreateRelease);
}

function switchView(view) {
  currentView = view;
  pagination.offset = 0;

  // 更新导航高亮
  document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
  const activeNav = document.querySelector(`[data-view="${view}"]`);
  if (activeNav) activeNav.classList.add("active");

  // 切换视图
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const viewEl = document.getElementById(`view-${view}`);
  if (viewEl) viewEl.classList.add("active");

  // 更新顶栏
  const titles = {
    dashboard: ["仪表板", "系统总览"],
    releases: ["发布列表", "全部发布记录"],
    create: ["创建发布", "新建发布审批请求"],
    escalations: ["升级告警", "运营风险监控"],
    webhooks: ["Webhook 管理", "事件订阅与日志"],
    policy: ["治理策略", "审批路由与规则配置"]
  };
  const [title, subtitle] = titles[view] || [view, ""];
  document.getElementById("page-title").textContent = title;
  document.getElementById("page-subtitle").textContent = subtitle;

  // 关闭移动端侧边栏
  document.getElementById("sidebar").classList.remove("open");

  // 加载数据
  refreshCurrentView();
}

function refreshCurrentView() {
  switch (currentView) {
    case "dashboard": loadDashboard(); break;
    case "releases": loadReleases(); break;
    case "escalations": loadEscalations(); break;
    case "webhooks": loadWebhooks(); break;
    case "policy": loadPolicy(); break;
  }
}

/* ── 搜索 ── */
function initSearch() {
  const input = document.getElementById("search-input");
  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const q = input.value.trim();
      if (q.length > 0) {
        switchView("releases");
        // 将搜索词传递给发布列表
        loadReleases(q);
      }
    }, 400);
  });
}

/* ── 模态框 ── */
function initModal() {
  const modal = document.getElementById("detail-modal");
  document.getElementById("modal-close").addEventListener("click", () => modal.close());
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.classList.contains("modal-backdrop")) {
      modal.close();
    }
  });
}

function showModal(title, bodyHtml) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-body").innerHTML = bodyHtml;
  document.getElementById("detail-modal").showModal();
}

/* ── API 请求 ── */
async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options
    });

    const reqId = res.headers.get("x-request-id");
    if (reqId) {
      const el = document.getElementById("request-id-display");
      if (el) el.textContent = `RID: ${reqId.slice(0, 8)}`;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }
    return res.status === 204 ? null : await res.json();
  } catch (e) {
    showToast(e.message, "error");
    throw e;
  }
}

/* ── 健康检查 ── */
async function checkHealth() {
  const dot = document.querySelector(".health-dot");
  const text = document.querySelector(".health-text");
  try {
    const res = await fetch(`${API}/ready`);
    const data = await res.json();
    if (data.data?.status === "ready") {
      dot.className = "health-dot ok";
      text.textContent = "服务正常";
      // 获取版本号
      const ver = data.data?.version;
      if (ver) {
        document.getElementById("version-tag").textContent = `v${ver}`;
      }
    } else {
      dot.className = "health-dot error";
      text.textContent = "服务异常";
    }
  } catch {
    dot.className = "health-dot error";
    text.textContent = "连接失败";
  }
}

/* ═══════════ 仪表板 ═══════════ */
async function loadDashboard() {
  try {
    const { data } = await apiFetch("/api/dashboard");

    // KPI 动画计数
    animateValue("stat-total", data.totalReleases ?? 0);
    animateValue("stat-pending", data.byStatus?.pending_approval ?? 0);
    animateValue("stat-deployed", data.byStatus?.deployed ?? 0);
    animateValue("stat-sla-breaches", data.approvalSlaBreaches ?? 0);

    // 更新告警徽章
    const escalations = (data.approvalSlaBreaches ?? 0);
    const badge = document.getElementById("escalation-badge");
    if (escalations > 0) {
      badge.textContent = escalations;
      badge.style.display = "inline";
    } else {
      badge.style.display = "none";
    }

    // 图表
    renderBarChart("risk-chart", data.riskDistribution, {
      low: "#34d399", medium: "#fbbf24", high: "#f87171", critical: "#ef4444"
    });
    renderBarChart("env-chart", data.byEnvironment, {
      development: "#60a5fa", staging: "#fbbf24", production: "#f87171"
    });
    renderBarChart("status-chart", data.byStatus, {
      draft: "#5a6485", pending_approval: "#fbbf24", approved: "#34d399",
      rejected: "#f87171", scheduled: "#60a5fa", deployed: "#10b981", rolled_back: "#f97316"
    });
  } catch {
    // 错误已处理
  }
}

function animateValue(elementId, targetValue) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  const duration = 600;
  const startTime = performance.now();

  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (targetValue - start) * eased);
    el.textContent = current;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function renderBarChart(containerId, data, colors) {
  const container = document.getElementById(containerId);
  if (!data || Object.keys(data).length === 0) {
    container.innerHTML = '<div class="empty-state">暂无数据</div>';
    return;
  }
  const max = Math.max(...Object.values(data), 1);
  container.innerHTML = Object.entries(data).map(([key, val]) => {
    const pct = (val / max) * 100;
    const color = colors[key] || "#7c6cf0";
    return `
      <div class="bar-chart-item">
        <div class="bar-label">${escapeHtml(key)}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <div class="bar-value">${val}</div>
      </div>`;
  }).join("");
}

/* ═══════════ 发布列表 ═══════════ */
async function loadReleases(searchQuery) {
  const env = document.getElementById("filter-env").value;
  const status = document.getElementById("filter-status").value;
  const risk = document.getElementById("filter-risk").value;

  const params = new URLSearchParams();
  if (env) params.set("environment", env);
  if (status) params.set("status", status);
  if (risk) params.set("riskBand", risk);
  if (searchQuery) params.set("application", searchQuery);
  params.set("limit", pagination.limit);
  params.set("offset", pagination.offset);

  try {
    const { data, pagination: pg } = await apiFetch(`/api/releases?${params}`);
    renderReleasesTable(data);
    renderPagination(pg);
  } catch {}
}

function renderReleasesTable(releases) {
  const tbody = document.getElementById("releases-tbody");
  if (!releases.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">暂无发布记录</td></tr>`;
    return;
  }
  tbody.innerHTML = releases.map(r => `
    <tr>
      <td><strong style="color:var(--text-primary)">${escapeHtml(r.application)}</strong></td>
      <td><code style="font-family:var(--font-mono);font-size:0.8rem;color:var(--accent-bright)">${escapeHtml(r.version)}</code></td>
      <td><span class="tag tag-env">${escapeHtml(r.environment)}</span></td>
      <td><span class="tag tag-status">${statusLabel(r.status)}</span></td>
      <td><span class="tag tag-risk-${r.riskBand}">${riskLabel(r.riskBand)}</span></td>
      <td>${escapeHtml(r.owner)}</td>
      <td style="font-family:var(--font-mono);font-size:0.78rem;color:var(--text-muted)">${formatTime(r.createdAt)}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="showReleaseDetail('${r.id}')">详情</button>
      </td>
    </tr>`).join("");
}

async function showReleaseDetail(id) {
  try {
    const { data: r } = await apiFetch(`/api/releases/${id}`);
    const html = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div><strong>应用</strong><br>${escapeHtml(r.application)}</div>
        <div><strong>版本</strong><br><code>${escapeHtml(r.version)}</code></div>
        <div><strong>环境</strong><br><span class="tag tag-env">${escapeHtml(r.environment)}</span></div>
        <div><strong>状态</strong><br><span class="tag tag-status">${statusLabel(r.status)}</span></div>
        <div><strong>风险</strong><br><span class="tag tag-risk-${r.riskBand}">${riskLabel(r.riskBand)} (${r.riskScore})</span></div>
        <div><strong>负责人</strong><br>${escapeHtml(r.owner)}</div>
        <div><strong>服务层级</strong><br>${escapeHtml(r.serviceTier)}</div>
        <div><strong>变更类别</strong><br>${escapeHtml(r.changeCategory)}</div>
        <div style="grid-column:1/-1"><strong>摘要</strong><br>${escapeHtml(r.summary)}</div>
        <div style="grid-column:1/-1"><strong>组件</strong><br>${(r.components||[]).map(c => `<span class="tag tag-env" style="margin-right:4px">${escapeHtml(c)}</span>`).join("")}</div>
      </div>
      ${r.approvals?.length ? `
      <h4 style="margin-top:20px;margin-bottom:8px;font-size:0.85rem">审批记录</h4>
      <table class="policy-table">
        <tr><th>团队</th><th>状态</th><th>SLA(时)</th><th>审批人</th><th>备注</th></tr>
        ${r.approvals.map(a => `<tr>
          <td>${escapeHtml(a.team)}</td>
          <td>${escapeHtml(a.status)}</td>
          <td>${a.slaHours ?? '-'}</td>
          <td>${escapeHtml(a.approver || '-')}</td>
          <td>${escapeHtml(a.comment || '-')}</td>
        </tr>`).join("")}
      </table>` : ""}
    `;
    showModal(`${r.application}@${r.version}`, html);
  } catch {}
}

function renderPagination(pg) {
  const container = document.getElementById("pagination");
  if (!pg) { container.innerHTML = ""; return; }

  const totalPages = Math.ceil(pg.total / pg.limit);
  const currentPage = Math.floor(pg.offset / pg.limit) + 1;

  container.innerHTML = `
    <button ${currentPage <= 1 ? "disabled" : ""} onclick="goToPage(${currentPage - 1})">上一页</button>
    <span class="page-info">${currentPage} / ${totalPages || 1}</span>
    <button ${!pg.hasMore ? "disabled" : ""} onclick="goToPage(${currentPage + 1})">下一页</button>
  `;
}

function goToPage(page) {
  pagination.offset = (page - 1) * pagination.limit;
  loadReleases();
}

/* ═══════════ 创建发布 ═══════════ */
async function handleCreateRelease(e) {
  e.preventDefault();

  const payload = {
    application: document.getElementById("f-application").value.trim(),
    version: document.getElementById("f-version").value.trim(),
    environment: document.getElementById("f-environment").value,
    serviceTier: document.getElementById("f-serviceTier").value,
    changeCategory: document.getElementById("f-changeCategory").value,
    owner: document.getElementById("f-owner").value.trim(),
    plannedStartAt: new Date(document.getElementById("f-plannedStartAt").value).toISOString(),
    plannedEndAt: new Date(document.getElementById("f-plannedEndAt").value).toISOString(),
    summary: document.getElementById("f-summary").value.trim(),
    components: document.getElementById("f-components").value.split(",").map(s => s.trim()).filter(Boolean),
    controls: {
      automatedTestsPassed: document.getElementById("f-automatedTestsPassed").checked,
      rollbackReady: document.getElementById("f-rollbackReady").checked,
      monitoringReady: document.getElementById("f-monitoringReady").checked,
      securityReviewed: document.getElementById("f-securityReviewed").checked
    },
    customerImpactScore: Number(document.getElementById("f-customerImpactScore").value),
    dataSensitivityScore: Number(document.getElementById("f-dataSensitivityScore").value)
  };

  try {
    const result = await apiFetch("/api/releases", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    document.getElementById("create-result").style.display = "block";
    document.getElementById("create-result-content").textContent = JSON.stringify(result, null, 2);
    showToast("发布请求创建成功", "success");
  } catch {
    // 错误已处理
  }
}

/* ═══════════ 升级告警 ═══════════ */
async function loadEscalations() {
  try {
    const { data } = await apiFetch("/api/escalations");
    const container = document.getElementById("escalations-content");

    const items = [
      ...data.overdueApprovals.map(a => ({
        type: "warning",
        title: `审批超时: ${a.application}@${a.version}`,
        detail: `团队 ${a.team} 超过 SLA ${a.hoursOverdue} 小时`
      })),
      ...data.highRiskPending.map(r => ({
        type: "danger",
        title: `高风险待处理: ${r.application}@${r.version}`,
        detail: `风险分 ${r.riskScore}，环境 ${r.environment}`
      })),
      ...data.conflicts.map(c => ({
        type: "info",
        title: `窗口冲突: ${c.application}`,
        detail: `与发布 ${c.conflictingReleaseId} 存在时间冲突`
      }))
    ];

    if (!items.length) {
      container.innerHTML = '<div class="empty-state">暂无升级告警，一切正常</div>';
    } else {
      container.innerHTML = items.map(i => `
        <div class="escalation-item" style="border-left-color:var(--${i.type})">
          <h4>${escapeHtml(i.title)}</h4>
          <p>${escapeHtml(i.detail)}</p>
        </div>`).join("");
    }
  } catch {}
}

/* ═══════════ Webhook ═══════════ */
async function loadWebhooks() {
  try {
    const { data } = await apiFetch("/api/webhooks");
    const container = document.getElementById("webhooks-list");
    if (!data.length) {
      container.innerHTML = '<div class="empty-state">暂无 Webhook 订阅</div>';
    } else {
      container.innerHTML = data.map(w => `
        <div class="webhook-item">
          <div>
            <div class="url">${escapeHtml(w.url)}</div>
            <div class="events">${escapeHtml(w.events.join(", "))}</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="deleteWebhook('${w.id}')">删除</button>
        </div>`).join("");
    }
  } catch {}

  try {
    const { data } = await apiFetch("/api/webhooks/events?limit=20");
    const container = document.getElementById("webhook-events");
    if (!data.length) {
      container.innerHTML = '<div class="empty-state">暂无事件记录</div>';
    } else {
      container.innerHTML = `<pre class="code-block">${JSON.stringify(data, null, 2)}</pre>`;
    }
  } catch {}
}

async function createWebhook() {
  const url = document.getElementById("wh-url").value.trim();
  const events = document.getElementById("wh-events").value.trim().split(",").map(s => s.trim()).filter(Boolean);
  if (!url) { showToast("请输入 Webhook URL", "error"); return; }
  try {
    await apiFetch("/api/webhooks", {
      method: "POST",
      body: JSON.stringify({ url, events: events.length ? events : ["*"] })
    });
    showToast("Webhook 订阅创建成功", "success");
    document.getElementById("wh-url").value = "";
    document.getElementById("wh-events").value = "";
    loadWebhooks();
  } catch {}
}

async function deleteWebhook(id) {
  try {
    await apiFetch(`/api/webhooks/${id}`, { method: "DELETE" });
    showToast("Webhook 订阅已删除", "success");
    loadWebhooks();
  } catch {}
}

/* ═══════════ 治理策略 ═══════════ */
async function loadPolicy() {
  try {
    const { data } = await apiFetch("/api/policy");
    const container = document.getElementById("policy-content");
    container.innerHTML = `
      <table class="policy-table">
        <tr><th>配置项</th><th>值</th></tr>
        <tr><td>支持环境</td><td>${data.environments.join(", ")}</td></tr>
        <tr><td>发布状态</td><td>${data.releaseStatuses.join(", ")}</td></tr>
        <tr><td>审批状态</td><td>${data.approvalStatuses.join(", ")}</td></tr>
        <tr><td>服务层级</td><td>${data.serviceTiers.map(t => `${t.code}: ${t.description}`).join("<br>")}</td></tr>
        <tr><td>风险等级</td><td>${data.riskBands.map(b => `${b.code} (${b.minScore}-${b.maxScore})`).join(", ")}</td></tr>
        <tr><td>客户影响分范围</td><td>${data.controlScoreBounds.customerImpactScore.min} - ${data.controlScoreBounds.customerImpactScore.max}</td></tr>
        <tr><td>数据敏感度分范围</td><td>${data.controlScoreBounds.dataSensitivityScore.min} - ${data.controlScoreBounds.dataSensitivityScore.max}</td></tr>
      </table>
      <h4 style="margin:20px 0 10px;font-size:0.9rem;font-weight:700">审批路由规则</h4>
      <table class="policy-table">
        <tr><th>团队</th><th>适用条件</th><th>SLA（小时）</th></tr>
        ${data.approvalRouting.map(r => `<tr>
          <td><strong>${escapeHtml(r.team)}</strong></td>
          <td>${escapeHtml(r.appliesWhen)}</td>
          <td style="font-family:var(--font-mono)">${JSON.stringify(r.slaHours)}</td>
        </tr>`).join("")}
      </table>`;
  } catch {}
}

/* ═══════════ 工具函数 ═══════════ */
function escapeHtml(str) {
  if (str == null) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function statusLabel(status) {
  const labels = {
    draft: "草稿", pending_approval: "待审批", approved: "已批准",
    rejected: "已拒绝", scheduled: "已排期", deployed: "已部署", rolled_back: "已回滚"
  };
  return labels[status] || status;
}

function riskLabel(band) {
  const labels = { low: "低", medium: "中", high: "高", critical: "严重" };
  return labels[band] || band;
}

function formatTime(isoStr) {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return isoStr;
  }
}

function showToast(message, type = "info") {
  const rack = document.getElementById("toast-rack");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  rack.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("out");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* ═══════════ 实时刷新 ═══════════ */
let refreshInterval = null;
const REFRESH_INTERVAL = 30000; // 30 秒

function startAutoRefresh() {
  stopAutoRefresh();
  refreshInterval = setInterval(() => {
    if (currentView === "dashboard") {
      loadDashboard();
    }
  }, REFRESH_INTERVAL);
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

// 页面可见性变化时暂停/恢复刷新
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopAutoRefresh();
  } else {
    startAutoRefresh();
    refreshCurrentView();
  }
});

/* ═══════════ 主题切换 ═══════════ */
const THEME_KEY = "rg-theme";

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  showToast(`已切换到${next === "dark" ? "深色" : "浅色"}主题`, "info");
}

/* ═══════════ 键盘快捷键 ═══════════ */
document.addEventListener("keydown", (e) => {
  // Ctrl/Cmd + K 打开搜索
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    const searchInput = document.getElementById("search-input");
    if (searchInput) searchInput.focus();
  }
  
  // ESC 关闭模态框
  if (e.key === "Escape") {
    const modal = document.getElementById("detail-modal");
    if (modal && modal.open) modal.close();
  }
  
  // 数字键切换视图
  if (e.altKey && e.key >= "1" && e.key <= "6") {
    e.preventDefault();
    const views = ["dashboard", "releases", "create", "escalations", "webhooks", "policy"];
    const idx = parseInt(e.key) - 1;
    if (views[idx]) switchView(views[idx]);
  }
});

/* ═══════════ 页面加载完成后初始化 ═══════════ */
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  startAutoRefresh();
});
