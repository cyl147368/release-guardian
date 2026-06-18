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
    policy: ["治理策略", "审批路由与规则配置"],
    audit: ["审计日志", "操作记录和状态变更历史"],
    metrics: ["性能监控", "系统性能指标和健康状态"],
    settings: ["设置", "用户偏好和系统配置"]
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
    case "audit": loadAuditLog(); break;
    case "metrics": loadMetrics(); break;
    case "settings": loadSettings(); break;
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
    
    // 发布流程可视化
    renderReleaseFlow(data.byStatus || {});
    
    // 最近活动
    loadRecentActivity();
  } catch (e) {
    console.error("仪表板加载失败:", e);
  }
}

function renderReleaseFlow(byStatus) {
  const flow = document.getElementById("release-flow");
  if (!flow) return;
  
  const statusConfig = {
    draft: { label: "草稿", color: "var(--text-muted)", icon: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" },
    pending_approval: { label: "待审批", color: "var(--status-warn)", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
    approved: { label: "已批准", color: "var(--status-ok)", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
    rejected: { label: "已拒绝", color: "var(--status-error)", icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" },
    scheduled: { label: "已排期", color: "var(--status-info)", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
    deployed: { label: "已部署", color: "var(--status-sync)", icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" },
    rolled_back: { label: "已回滚", color: "var(--status-error)", icon: "M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" }
  };
  
  const allStatuses = ["draft", "pending_approval", "approved", "scheduled", "deployed", "rolled_back"];
  
  flow.innerHTML = allStatuses.map(status => {
    const count = byStatus[status] || 0;
    const config = statusConfig[status] || { label: status, color: "var(--text-muted)", icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" };
    
    return `
      <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px; background: var(--bg-raised); border-radius: 12px; border: 1px solid var(--border-subtle); transition: all 0.2s var(--ease-out); cursor: pointer;" 
           onclick="loadReleases('${status}')"
           onmouseover="this.style.borderColor='${config.color}'; this.style.transform='translateY(-2px)'"
           onmouseout="this.style.borderColor='var(--border-subtle)'; this.style.transform='translateY(0)'">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${config.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="${config.icon}"/>
        </svg>
        <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">${count}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">${config.label}</div>
      </div>
    `;
  }).join("");
}

async function loadRecentActivity() {
  try {
    const { data } = await apiFetch("/api/releases?limit=5&sort=updatedAt&order=desc");
    
    const container = document.getElementById("recent-activity");
    if (!data || data.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-muted);">
          暂无最近活动
        </div>`;
      return;
    }
    
    container.innerHTML = data.map(r => `
      <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-raised); border-radius: 8px; cursor: pointer; transition: all 0.2s var(--ease-out);"
           onclick="showReleaseDetail('${r.id}')"
           onmouseover="this.style.background='var(--quantum-subtle)'"
           onmouseout="this.style.background='var(--bg-raised)'">
        <div style="width: 8px; height: 8px; border-radius: 50; background: var(--quantum-primary); flex-shrink: 0;"></div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHtml(r.application)} v${escapeHtml(r.version)}
          </div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">
            ${r.environment} • ${formatDate(r.updatedAt)}
          </div>
        </div>
        <span class="status-badge status-${r.status}">${r.status}</span>
      </div>
    `).join("");
  } catch (e) {
    console.warn("最近活动加载失败:", e);
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

/* ═══════════ 审计日志 ═══════════ */
async function loadAuditLog() {
  try {
    const { data, pagination: p } = await apiFetch("/api/audit?limit=50");
    
    const tbody = document.getElementById("audit-tbody");
    if (!data || data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">
            <div class="empty-state-title">暂无审计记录</div>
            <div class="empty-state-description">系统操作将自动记录</div>
          </td>
        </tr>`;
      return;
    }
    
    const eventLabels = {
      "release.created": { label: "创建发布", color: "var(--status-info)" },
      "release.approved": { label: "审批通过", color: "var(--status-ok)" },
      "release.rejected": { label: "审批拒绝", color: "var(--status-error)" },
      "release.deployed": { label: "部署完成", color: "var(--status-sync)" },
      "release.scheduled": { label: "已排期", color: "var(--status-warn)" },
      "release.rolled_back": { label: "已回滚", color: "var(--status-error)" },
      "webhook.subscribed": { label: "订阅 Webhook", color: "var(--status-info)" },
      "webhook.removed": { label: "移除 Webhook", color: "var(--status-error)" },
      "releases.bulk_created": { label: "批量创建", color: "var(--status-info)" }
    };
    
    tbody.innerHTML = data.map(entry => {
      const eventConfig = eventLabels[entry.event] || { label: entry.event, color: "var(--text-muted)" };
      
      return `
        <tr>
          <td style="white-space: nowrap;">${formatDate(entry.timestamp)}</td>
          <td>
            <span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: ${eventConfig.color}15; border-radius: 16px; font-size: 0.85rem; color: ${eventConfig.color};">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: ${eventConfig.color};"></span>
              ${eventConfig.label}
            </span>
          </td>
          <td>${escapeHtml(entry.actor)}</td>
          <td>${entry.resourceType || "—"}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="showAuditDetail(${JSON.stringify(entry).replace(/"/g, '&quot;')})">
              查看
            </button>
          </td>
        </tr>
      `;
    }).join("");
    
    // 渲染分页
    if (p) {
      renderAuditPagination(p);
    }
  } catch (e) {
    console.error("审计日志加载失败:", e);
  }
}

function renderAuditPagination(p) {
  const container = document.getElementById("audit-pagination");
  if (!container || !p) return;
  
  const totalPages = Math.ceil(p.total / p.limit);
  const currentPage = Math.floor(p.offset / p.limit) + 1;
  
  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }
  
  let html = '<button class="pagination-btn" onclick="goToAuditPage(' + (currentPage - 1) + ')" ' + (currentPage <= 1 ? 'disabled' : '') + '>上一页</button>';
  
  for (let i = 1; i <= Math.min(totalPages, 5); i++) {
    html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToAuditPage(${i})">${i}</button>`;
  }
  
  html += '<button class="pagination-btn" onclick="goToAuditPage(' + (currentPage + 1) + ')" ' + (currentPage >= totalPages ? 'disabled' : '') + '>下一页</button>';
  
  container.innerHTML = html;
}

let auditPagination = { offset: 0, limit: 50 };

function goToAuditPage(page) {
  auditPagination.offset = (page - 1) * auditPagination.limit;
  loadAuditLog();
}

function showAuditDetail(entry) {
  const body = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      <div>
        <div class="form-label">事件 ID</div>
        <div style="font-family: var(--font-mono); font-size: 0.85rem; word-break: break-all;">${entry.id}</div>
      </div>
      <div>
        <div class="form-label">时间</div>
        <div>${new Date(entry.timestamp).toLocaleString("zh-CN")}</div>
      </div>
      <div>
        <div class="form-label">事件类型</div>
        <div>${entry.event}</div>
      </div>
      <div>
        <div class="form-label">操作者</div>
        <div>${escapeHtml(entry.actor)}</div>
      </div>
      <div>
        <div class="form-label">资源类型</div>
        <div>${entry.resourceType || "—"}</div>
      </div>
      <div>
        <div class="form-label">资源 ID</div>
        <div style="font-family: var(--font-mono); font-size: 0.85rem; word-break: break-all;">${entry.resourceId || "—"}</div>
      </div>
    </div>
    ${entry.details && Object.keys(entry.details).length > 0 ? `
      <div style="margin-top: 20px;">
        <div class="form-label">详细信息</div>
        <pre style="padding: 12px; background: var(--bg-raised); border-radius: 8px; font-family: var(--font-mono); font-size: 0.85rem; overflow-x: auto; margin-top: 8px;">${JSON.stringify(entry.details, null, 2)}</pre>
      </div>
    ` : ""}
  `;
  
  showModal(`审计详情: ${entry.event}`, body);
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

/* ═══════════ 数据导出 ═══════════ */
function exportToCSV(data, filename) {
  if (!data || data.length === 0) {
    showToast("没有数据可导出", "warning");
    return;
  }
  
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(","),
    ...data.map(row => headers.map(h => {
      const val = row[h];
      if (typeof val === "object") return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      if (typeof val === "string" && (val.includes(",") || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(","))
  ].join("\n");
  
  downloadFile(csv, filename, "text/csv;charset=utf-8;");
}

function exportToJSON(data, filename) {
  if (!data) {
    showToast("没有数据可导出", "warning");
    return;
  }
  
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, filename, "application/json");
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast(`已导出 ${filename}`, "success");
}

async function exportReleases(format = "csv") {
  try {
    const { data } = await apiFetch("/api/releases?limit=1000");
    if (!data || data.length === 0) {
      showToast("没有发布记录可导出", "warning");
      return;
    }
    
    const exportData = data.map(r => ({
      应用: r.application,
      版本: r.version,
      环境: r.environment,
      状态: r.status,
      风险评分: r.risk?.score || 0,
      风险等级: r.risk?.band || "low",
      负责人: r.owner,
      服务层级: r.serviceTier,
      变更类型: r.changeCategory,
      创建时间: r.createdAt,
      更新时间: r.updatedAt
    }));
    
    const timestamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      exportToCSV(exportData, `releases-${timestamp}.csv`);
    } else {
      exportToJSON(exportData, `releases-${timestamp}.json`);
    }
  } catch (e) {
    console.error("导出失败:", e);
    showToast("导出失败", "error");
  }
}

async function exportAuditLog(format = "csv") {
  try {
    const { data } = await apiFetch("/api/audit?limit=1000");
    if (!data || data.length === 0) {
      showToast("没有审计日志可导出", "warning");
      return;
    }
    
    const exportData = data.map(e => ({
      ID: e.id,
      时间: e.timestamp,
      事件: e.event,
      操作者: e.actor,
      资源类型: e.resourceType,
      资源ID: e.resourceId || "",
      详情: JSON.stringify(e.details)
    }));
    
    const timestamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      exportToCSV(exportData, `audit-log-${timestamp}.csv`);
    } else {
      exportToJSON(exportData, `audit-log-${timestamp}.json`);
    }
  } catch (e) {
    console.error("导出失败:", e);
    showToast("导出失败", "error");
  }
}

/* ═══════════ 实时统计面板 ═══════════ */
let statsUpdateInterval = null;

function startStatsUpdate() {
  stopStatsUpdate();
  statsUpdateInterval = setInterval(async () => {
    if (currentView === "dashboard") {
      await updateRealtimeStats();
    }
  }, 10000);
}

function stopStatsUpdate() {
  if (statsUpdateInterval) {
    clearInterval(statsUpdateInterval);
    statsUpdateInterval = null;
  }
}

async function updateRealtimeStats() {
  try {
    const [dashboardRes, metricsRes] = await Promise.all([
      apiFetch("/api/dashboard"),
      apiFetch("/api/metrics")
    ]);
    
    // 更新实时指标
    const metrics = metricsRes?.data;
    if (metrics) {
      const uptimeEl = document.getElementById("stat-uptime");
      if (uptimeEl && metrics.uptime) {
        uptimeEl.textContent = formatUptime(metrics.uptime);
      }
      
      const requestsEl = document.getElementById("stat-requests");
      if (requestsEl && metrics.totalRequests) {
        requestsEl.textContent = formatNumber(metrics.totalRequests);
      }
    }
  } catch (e) {
    console.warn("实时统计更新失败:", e);
  }
}

function formatUptime(seconds) {
  if (!seconds) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}天 ${hours}时`;
  if (hours > 0) return `${hours}时 ${minutes}分`;
  return `${minutes}分`;
}

function formatNumber(num) {
  if (!num) return "0";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

/* ═══════════ 主题切换 ═══════════ */
function toggleTheme() {
  const body = document.body;
  const isDark = body.classList.contains("light-theme");
  
  if (isDark) {
    body.classList.remove("light-theme");
    localStorage.setItem("theme", "dark");
  } else {
    body.classList.add("light-theme");
    localStorage.setItem("theme", "light");
  }
}

// 初始化主题
function initTheme() {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") {
    document.body.classList.add("light-theme");
  }
}

// 在 DOMContentLoaded 时初始化主题
document.addEventListener("DOMContentLoaded", initTheme);

// 页面可见性变化时暂停/恢复统计更新
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopStatsUpdate();
  } else {
    startStatsUpdate();
  }
});

// 在初始化时启动统计更新
const originalInitBootSequence = initBootSequence;
initBootSequence = function() {
  originalInitBootSequence();
  startStatsUpdate();
};

/* ═══════════ 性能监控 ═══════════ */
async function loadMetrics() {
  try {
    const [metricsRes, healthRes] = await Promise.all([
      apiFetch("/api/metrics"),
      apiFetch("/ready")
    ]);
    
    const metrics = metricsRes?.data || {};
    const health = healthRes?.data || {};
    
    // 更新 KPI 卡片
    animateValue("metric-requests", metrics.totalRequests || 0);
    
    const uptimeEl = document.getElementById("metric-uptime");
    if (uptimeEl && metrics.uptime) {
      uptimeEl.textContent = formatUptime(metrics.uptime);
    }
    
    const latencyEl = document.getElementById("metric-latency");
    if (latencyEl && metrics.avgResponseTime) {
      latencyEl.textContent = `${Math.round(metrics.avgResponseTime)}ms`;
    }
    
    const errorsEl = document.getElementById("metric-errors");
    if (errorsEl) {
      const errorRate = metrics.totalRequests > 0 
        ? ((metrics.errors || 0) / metrics.totalRequests * 100).toFixed(2)
        : "0";
      errorsEl.textContent = `${errorRate}%`;
    }
    
    // 渲染请求分布
    renderRequestDistribution(metrics.byMethod || {});
    
    // 渲染系统状态
    renderSystemStatus(health);
  } catch (e) {
    console.error("性能监控加载失败:", e);
  }
}

function renderRequestDistribution(byMethod) {
  const container = document.getElementById("request-distribution");
  if (!container) return;
  
  const methods = Object.entries(byMethod);
  if (methods.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">暂无请求数据</div>';
    return;
  }
  
  const max = Math.max(...methods.map(([, v]) => v), 1);
  const colors = {
    GET: "var(--status-ok)",
    POST: "var(--status-info)",
    PUT: "var(--status-warn)",
    DELETE: "var(--status-error)",
    PATCH: "var(--status-sync)"
  };
  
  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 12px; padding: 16px 0;">
      ${methods.map(([method, count]) => `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 60px; font-family: var(--font-mono); font-size: 0.85rem; color: ${colors[method] || "var(--text-muted)"};">${method}</div>
          <div style="flex: 1; height: 24px; background: var(--bg-raised); border-radius: 4px; overflow: hidden;">
            <div style="width: ${(count / max) * 100}%; height: 100%; background: ${colors[method] || "var(--quantum-primary)"}; border-radius: 4px; transition: width 0.5s var(--ease-out);"></div>
          </div>
          <div style="width: 60px; text-align: right; font-family: var(--font-mono); font-size: 0.85rem;">${count}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderSystemStatus(health) {
  const container = document.getElementById("system-status");
  if (!container) return;
  
  const checks = health.checks || {};
  const isReady = health.status === "ready";
  
  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 16px; padding: 16px 0;">
      <div style="display: flex; align-items: center; gap: 12px; padding: 16px; background: var(--bg-raised); border-radius: 8px;">
        <div style="width: 12px; height: 12px; border-radius: 50%; background: ${isReady ? "var(--status-ok)" : "var(--status-error)"}; box-shadow: 0 0 8px ${isReady ? "var(--status-ok)" : "var(--status-error)"};"></div>
        <div>
          <div style="font-weight: 600;">服务状态</div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">${isReady ? "正常运行" : "异常"}</div>
        </div>
      </div>
      
      ${Object.entries(checks).map(([name, check]) => `
        <div style="display: flex; align-items: center; gap: 12px; padding: 16px; background: var(--bg-raised); border-radius: 8px;">
          <div style="width: 12px; height: 12px; border-radius: 50%; background: ${check.status === "ok" ? "var(--status-ok)" : "var(--status-error)"}; box-shadow: 0 0 8px ${check.status === "ok" ? "var(--status-ok)" : "var(--status-error)"};"></div>
          <div>
            <div style="font-weight: 600;">${name}</div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">${check.status === "ok" ? "正常" : check.message || "异常"}</div>
          </div>
        </div>
      `).join("")}
      
      <div style="padding: 16px; background: var(--bg-raised); border-radius: 8px;">
        <div style="font-weight: 600; margin-bottom: 8px;">版本信息</div>
        <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text-muted);">
          Release Guardian v${health.version || "3.1.0"}
        </div>
      </div>
    </div>
  `;
}

/* ═══════════ 用户设置 ═══════════ */
const DEFAULT_SETTINGS = {
  theme: "dark",
  language: "zh-CN",
  pageSize: 20,
  refreshInterval: 30,
  notifications: true,
  soundEffects: false
};

function loadSettings() {
  const settings = getSettings();
  const form = document.getElementById("settings-form");
  if (!form) return;
  
  // 填充表单
  form.theme.value = settings.theme;
  form.language.value = settings.language;
  form.pageSize.value = settings.pageSize;
  form.refreshInterval.value = settings.refreshInterval;
  form.notifications.checked = settings.notifications;
  form.soundEffects.checked = settings.soundEffects;
}

function getSettings() {
  try {
    const saved = localStorage.getItem("rg-settings");
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  
  const settings = {
    theme: formData.get("theme"),
    language: formData.get("language"),
    pageSize: parseInt(formData.get("pageSize")),
    refreshInterval: parseInt(formData.get("refreshInterval")),
    notifications: formData.has("notifications"),
    soundEffects: formData.has("soundEffects")
  };
  
  localStorage.setItem("rg-settings", JSON.stringify(settings));
  
  // 应用主题
  if (settings.theme === "light") {
    document.body.classList.add("light-theme");
  } else {
    document.body.classList.remove("light-theme");
  }
  
  // 更新分页大小
  pagination.limit = settings.pageSize;
  
  showToast("设置已保存", "success");
}

function resetSettings() {
  localStorage.removeItem("rg-settings");
  loadSettings();
  showToast("设置已恢复默认", "info");
}

// 初始化设置
function applySettings() {
  const settings = getSettings();
  
  // 应用主题
  if (settings.theme === "light") {
    document.body.classList.add("light-theme");
  }
  
  // 应用分页大小
  pagination.limit = settings.pageSize;
}

// 在 DOMContentLoaded 时应用设置
document.addEventListener("DOMContentLoaded", applySettings);
