/* ═══════════════════════════════════════════════════════
   Release Guardian v3.1 — 量子发布治理前端
   ═══════════════════════════════════════════════════════ */

const API = window.location.origin;

/* ── 状态管理 ── */
let currentView = "dashboard";
let pagination = { offset: 0, limit: 20 };
let ws = null;
let wsReconnectTimer = null;
let wsReconnectAttempts = 0;
const WS_MAX_RECONNECT = 5;

/* ── 初始化 ── */
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
    shell.classList.add("visible");
    
    // 数据加载
    checkHealth();
    loadDashboard();
    
    // 初始化 WebSocket 实时推送
    initWebSocket();
  }, 2500);
}

/* ── 导航系统 ── */
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

/* ── 搜索功能 ── */
function initSearch() {
  const input = document.getElementById("search-input");
  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const q = input.value.trim();
      if (q.length > 0) {
        switchView("releases");
        loadReleases(q);
      }
    }, 400);
  });
}

/* ── 模态框 ── */
function initModal() {
  const backdrop = document.getElementById("modal-backdrop");
  const modal = document.getElementById("detail-modal");
  
  document.getElementById("modal-close").addEventListener("click", () => {
    backdrop.classList.remove("active");
    modal.classList.remove("active");
  });
  
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) {
      backdrop.classList.remove("active");
      modal.classList.remove("active");
    }
  });
}

function showModal(title, bodyHtml) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-body").innerHTML = bodyHtml;
  document.getElementById("modal-backdrop").classList.add("active");
  document.getElementById("detail-modal").classList.add("active");
}

function closeModal() {
  document.getElementById("modal-backdrop").classList.remove("active");
  document.getElementById("detail-modal").classList.remove("active");
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
      badge.style.display = "flex";
      badge.textContent = escalations;
    } else {
      badge.style.display = "none";
    }

    // 风险分布图表
    renderRiskChart(data.byRiskBand || {});
  } catch (e) {
    console.error("仪表板加载失败:", e);
  }
}

function renderRiskChart(bands) {
  const chart = document.getElementById("risk-chart");
  if (!chart) return;
  
  const max = Math.max(...Object.values(bands), 1);
  const colors = {
    low: "var(--status-ok)",
    medium: "var(--status-warn)",
    high: "var(--status-error)",
    critical: "var(--status-error)"
  };
  
  chart.innerHTML = Object.entries(bands).map(([band, count]) => `
    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;">
      <div style="width: 100%; height: ${(count / max) * 150}px; background: ${colors[band] || "var(--quantum-primary)"}; border-radius: 4px 4px 0 0; transition: height 0.5s var(--ease-out);"></div>
      <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">${band}</div>
      <div style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary);">${count}</div>
    </div>
  `).join("");
}

function animateValue(elementId, end) {
  const el = document.getElementById(elementId);
  if (!el) return;
  
  const duration = 1000;
  const start = parseInt(el.textContent) || 0;
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    const current = Math.round(start + (end - start) * eased);
    el.textContent = current.toLocaleString();
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  
  requestAnimationFrame(update);
}

/* ═══════════ 发布列表 ═══════════ */
async function loadReleases(searchQuery = "") {
  try {
    const params = new URLSearchParams({
      limit: pagination.limit,
      offset: pagination.offset
    });
    if (searchQuery) params.set("application", searchQuery);

    const { data, pagination: p } = await apiFetch(`/api/releases?${params}`);
    
    const tbody = document.getElementById("releases-tbody");
    if (!data || data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <div class="empty-state-title">暂无发布记录</div>
            <div class="empty-state-description">点击上方按钮创建第一个发布</div>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = data.map(r => `
      <tr onclick="showReleaseDetail('${r.id}')" style="cursor: pointer;">
        <td><strong>${escapeHtml(r.application)}</strong></td>
        <td><code>${escapeHtml(r.version)}</code></td>
        <td>${r.environment}</td>
        <td><span class="risk-${r.risk?.band || 'low'}">${r.risk?.score || 0}</span></td>
        <td><span class="status-badge status-${r.status}">${r.status}</span></td>
        <td>${formatDate(r.createdAt)}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); showReleaseDetail('${r.id}')">
            详情
          </button>
        </td>
      </tr>
    `).join("");

    // 分页
    renderPagination(p);
  } catch (e) {
    console.error("发布列表加载失败:", e);
  }
}

function renderPagination(p) {
  const container = document.getElementById("releases-pagination");
  if (!container || !p) return;
  
  const totalPages = Math.ceil(p.total / p.limit);
  const currentPage = Math.floor(p.offset / p.limit) + 1;
  
  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }
  
  let html = '<button class="pagination-btn" onclick="goToPage(' + (currentPage - 1) + ')" ' + (currentPage <= 1 ? 'disabled' : '') + '>上一页</button>';
  
  for (let i = 1; i <= totalPages; i++) {
    if (i === currentPage) {
      html += `<button class="pagination-btn active">${i}</button>`;
    } else if (i <= 3 || i >= totalPages - 2 || Math.abs(i - currentPage) <= 1) {
      html += `<button class="pagination-btn" onclick="goToPage(${i})">${i}</button>`;
    } else if (i === 4 || i === totalPages - 3) {
      html += '<span class="pagination-info">...</span>';
    }
  }
  
  html += '<button class="pagination-btn" onclick="goToPage(' + (currentPage + 1) + ')" ' + (currentPage >= totalPages ? 'disabled' : '') + '>下一页</button>';
  
  container.innerHTML = html;
}

function goToPage(page) {
  pagination.offset = (page - 1) * pagination.limit;
  loadReleases();
}

async function showReleaseDetail(id) {
  try {
    const { data: release } = await apiFetch(`/api/releases/${id}`);
    
    const body = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div>
          <div class="form-label">应用</div>
          <div>${escapeHtml(release.application)}</div>
        </div>
        <div>
          <div class="form-label">版本</div>
          <div><code>${escapeHtml(release.version)}</code></div>
        </div>
        <div>
          <div class="form-label">环境</div>
          <div>${release.environment}</div>
        </div>
        <div>
          <div class="form-label">状态</div>
          <div><span class="status-badge status-${release.status}">${release.status}</span></div>
        </div>
        <div>
          <div class="form-label">风险评分</div>
          <div class="risk-${release.risk?.band}">${release.risk?.score} (${release.risk?.band})</div>
        </div>
        <div>
          <div class="form-label">负责人</div>
          <div>${escapeHtml(release.owner)}</div>
        </div>
      </div>
      <div style="margin-top: 20px;">
        <div class="form-label">发布摘要</div>
        <div>${escapeHtml(release.summary)}</div>
      </div>
      <div style="margin-top: 20px;">
        <div class="form-label">审批状态</div>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
          ${(release.approvals || []).map(a => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--bg-raised); border-radius: 8px;">
              <div>
                <div style="font-weight: 600;">${a.displayName}</div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">${a.team}</div>
              </div>
              <span class="status-badge status-${a.status}">${a.status}</span>
            </div>
          `).join("")}
        </div>
      </div>
      ${release.status === "pending_approval" ? `
        <div style="margin-top: 24px; display: flex; gap: 12px;">
          <button class="btn btn-primary" onclick="approveRelease('${release.id}', 'release_management', 'approved')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            批准
          </button>
          <button class="btn btn-ghost" style="color: var(--status-error);" onclick="approveRelease('${release.id}', 'release_management', 'rejected')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            拒绝
          </button>
        </div>
      ` : ""}
    `;
    
    showModal(`发布详情: ${release.application} v${release.version}`, body);
  } catch (e) {
    console.error("获取发布详情失败:", e);
  }
}

async function approveRelease(id, team, decision) {
  try {
    await apiFetch(`/api/releases/${id}/approvals`, {
      method: "POST",
      body: JSON.stringify({
        team,
        status: decision,
        actor: "admin",
        decision
      })
    });
    showToast(`发布已${decision === "approved" ? "批准" : "拒绝"}`, decision === "approved" ? "success" : "warning");
    closeModal();
    refreshCurrentView();
  } catch (e) {
    console.error("审批操作失败:", e);
  }
}

/* ═══════════ 创建发布 ═══════════ */
async function handleCreateRelease(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  
  const payload = {
    application: formData.get("application"),
    version: formData.get("version"),
    environment: formData.get("environment"),
    serviceTier: formData.get("serviceTier"),
    changeCategory: formData.get("changeCategory"),
    owner: formData.get("owner"),
    plannedStartAt: new Date(formData.get("plannedStartAt")).toISOString(),
    plannedEndAt: new Date(formData.get("plannedEndAt")).toISOString(),
    summary: formData.get("summary"),
    components: formData.get("components").split(",").map(s => s.trim()).filter(Boolean),
    controls: {
      automatedTestsPassed: formData.has("automatedTestsPassed"),
      rollbackReady: formData.has("rollbackReady"),
      monitoringReady: formData.has("monitoringReady"),
      securityReviewed: true,
      customerImpactScore: parseInt(formData.get("customerImpactScore") || "0"),
      dataSensitivityScore: parseInt(formData.get("dataSensitivityScore") || "0")
    }
  };
  
  try {
    await apiFetch("/api/releases", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    showToast("发布请求创建成功", "success");
    form.reset();
    switchView("releases");
  } catch (e) {
    console.error("创建发布失败:", e);
  }
}

/* ═══════════ 升级告警 ═══════════ */
async function loadEscalations() {
  try {
    const { data } = await apiFetch("/api/escalations");
    
    const container = document.getElementById("escalations-list");
    if (!data || data.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">暂无告警</div>
          <div class="empty-state-description">所有发布审批都在 SLA 范围内</div>
        </div>`;
      return;
    }

    container.innerHTML = data.map(e => `
      <div style="padding: 16px; background: var(--bg-raised); border-radius: 12px; margin-bottom: 12px; border-left: 3px solid var(--status-error);">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 600;">${escapeHtml(e.application)} v${escapeHtml(e.version)}</div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">${e.environment} • ${e.team}</div>
          </div>
          <span class="status-badge status-pending">待处理</span>
        </div>
      </div>
    `).join("");
  } catch (e) {
    console.error("升级告警加载失败:", e);
  }
}

/* ═══════════ Webhook 管理 ═══════════ */
async function loadWebhooks() {
  try {
    const { data } = await apiFetch("/api/webhooks");
    
    const tbody = document.getElementById("webhooks-tbody");
    if (!data || data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="empty-state">
            <div class="empty-state-title">暂无 Webhook 订阅</div>
            <div class="empty-state-description">点击上方按钮添加第一个订阅</div>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = data.map(w => `
      <tr>
        <td><code>${escapeHtml(w.url)}</code></td>
        <td>${(w.events || ["*"]).join(", ")}</td>
        <td><span class="status-badge status-approved">活跃</span></td>
        <td>
          <button class="btn btn-ghost btn-sm" style="color: var(--status-error);" onclick="deleteWebhook('${w.id}')">
            删除
          </button>
        </td>
      </tr>
    `).join("");
  } catch (e) {
    console.error("Webhook 加载失败:", e);
  }
}

function showCreateWebhook() {
  const body = `
    <form id="webhook-form" onsubmit="handleCreateWebhook(event)">
      <div class="form-group">
        <label class="form-label">Webhook URL *</label>
        <input type="url" class="form-input" name="url" placeholder="https://example.com/webhook" required>
      </div>
      <div class="form-group">
        <label class="form-label">订阅事件</label>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
          <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
            <input type="checkbox" name="events" value="release.created" checked> 创建
          </label>
          <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
            <input type="checkbox" name="events" value="release.approved" checked> 审批
          </label>
          <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
            <input type="checkbox" name="events" value="release.deployed" checked> 部署
          </label>
          <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
            <input type="checkbox" name="events" value="release.rejected"> 拒绝
          </label>
        </div>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px;">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">取消</button>
        <button type="submit" class="btn btn-primary">创建订阅</button>
      </div>
    </form>
  `;
  showModal("新增 Webhook 订阅", body);
}

async function handleCreateWebhook(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  
  const events = formData.getAll("events");
  
  try {
    await apiFetch("/api/webhooks", {
      method: "POST",
      body: JSON.stringify({
        url: formData.get("url"),
        events: events.length > 0 ? events : ["*"]
      })
    });
    showToast("Webhook 订阅创建成功", "success");
    closeModal();
    loadWebhooks();
  } catch (e) {
    console.error("创建 Webhook 失败:", e);
  }
}

async function deleteWebhook(id) {
  if (!confirm("确定删除此 Webhook 订阅？")) return;
  
  try {
    await apiFetch(`/api/webhooks/${id}`, { method: "DELETE" });
    showToast("Webhook 已删除", "success");
    loadWebhooks();
  } catch (e) {
    console.error("删除 Webhook 失败:", e);
  }
}

/* ═══════════ 治理策略 ═══════════ */
async function loadPolicy() {
  try {
    const { data } = await apiFetch("/api/policy");
    
    const container = document.getElementById("policy-content");
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
        <div style="padding: 20px; background: var(--bg-raised); border-radius: 12px;">
          <h3 style="font-size: 1rem; margin-bottom: 12px;">风险等级</h3>
          ${(data.riskBands || []).map(b => `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-subtle);">
              <span class="risk-${b.code}">${b.code.toUpperCase()}</span>
              <span>${b.minScore}-${b.maxScore}</span>
            </div>
          `).join("")}
        </div>
        <div style="padding: 20px; background: var(--bg-raised); border-radius: 12px;">
          <h3 style="font-size: 1rem; margin-bottom: 12px;">服务层级</h3>
          ${(data.serviceTiers || []).map(t => `
            <div style="padding: 8px 0; border-bottom: 1px solid var(--border-subtle);">
              <div style="font-weight: 600;">${t.code}</div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">${t.description}</div>
            </div>
          `).join("")}
        </div>
        <div style="padding: 20px; background: var(--bg-raised); border-radius: 12px;">
          <h3 style="font-size: 1rem; margin-bottom: 12px;">审批路由</h3>
          ${(data.approvalRouting || []).map(r => `
            <div style="padding: 8px 0; border-bottom: 1px solid var(--border-subtle);">
              <div style="font-weight: 600;">${r.team}</div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">${r.appliesWhen}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  } catch (e) {
    console.error("治理策略加载失败:", e);
  }
}

/* ═══════════ WebSocket 实时推送 ═══════════ */
function initWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  try {
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log("[WS] 已连接");
      wsReconnectAttempts = 0;
      updateWSStatus("connected");
      
      ws.send(JSON.stringify({
        type: "subscribe",
        events: ["release.created", "release.approved", "release.rejected", "release.deployed"]
      }));
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWSMessage(data);
      } catch (e) {
        console.warn("[WS] 消息解析失败:", e);
      }
    };
    
    ws.onclose = () => {
      console.log("[WS] 连接断开");
      updateWSStatus("disconnected");
      scheduleReconnect();
    };
    
    ws.onerror = (err) => {
      console.warn("[WS] 错误:", err);
    };
  } catch (e) {
    console.warn("[WS] 初始化失败:", e);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (wsReconnectAttempts >= WS_MAX_RECONNECT) {
    console.log("[WS] 达到最大重连次数");
    return;
  }
  
  const delay = Math.min(1000 * Math.pow(2, wsReconnectAttempts), 30000);
  wsReconnectAttempts++;
  
  clearTimeout(wsReconnectTimer);
  wsReconnectTimer = setTimeout(() => {
    console.log(`[WS] 尝试重连 (${wsReconnectAttempts}/${WS_MAX_RECONNECT})`);
    initWebSocket();
  }, delay);
}

function handleWSMessage(data) {
  if (data.type === "connected") {
    console.log("[WS] 客户端 ID:", data.clientId);
    return;
  }
  
  if (data.type === "event") {
    const { event, data: payload } = data;
    
    const messages = {
      "release.created": `新发布创建: ${payload.application} v${payload.version}`,
      "release.approved": `发布审批通过: ${payload.application}`,
      "release.rejected": `发布审批拒绝: ${payload.application}`,
      "release.deployed": `发布部署完成: ${payload.application} → ${payload.environment}`
    };
    
    const message = messages[event] || `事件: ${event}`;
    showToast(message, event.includes("rejected") ? "warning" : "success");
    
    refreshCurrentView();
  }
}

function updateWSStatus(status) {
  const indicator = document.getElementById("ws-status");
  if (indicator) {
    indicator.className = `ws-status ${status}`;
    indicator.title = status === "connected" ? "WebSocket 已连接" : "WebSocket 未连接";
  }
}

/* ═══════════ Toast 通知 ═══════════ */
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  const icons = {
    success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="var(--status-ok)" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    warning: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="var(--status-warn)" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    error: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="var(--status-error)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="var(--status-info)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
  };
  
  toast.innerHTML = `
    ${icons[type] || icons.info}
    <div class="toast-content">
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add("toast-out");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* ═══════════ 键盘快捷键 ═══════════ */
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    document.getElementById("search-input")?.focus();
  }
  
  if (e.key === "Escape") {
    closeModal();
  }
});

/* ═══════════ 工具函数 ═══════════ */
function escapeHtml(str) {
  if (typeof str !== "string") return str;
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("zh-CN", { 
    month: "2-digit", 
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
