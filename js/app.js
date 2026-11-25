// js/app.js
import { COURSE_STRUCTURE } from "./courses.js";
import {
  normalizeCompetencyEntry,
  computeTeacherMetrics,
  getCompetencyLevel,
  getAllSemesterBlocks,
  getCourseSharing,
  getSlotDefaultHours,
  clearUnlockedAssignments,
  runAutoAssign
} from "./solver.js";

const STORAGE_KEY = "vih_fagfordeling_modular_v8";
let state = buildDefaultState();
let currentSem = "F2026";
let selectedProfileTeacher = "AB";
let activeCourseRef = null;
let highlightUnassigned = false;
let diagnosticsCollapsed = true;
let modalTeacherCount = 1;
let modalSplitType = "split";
let lastCsvWishCounts = {};

function normalizeAllCompetencies(compObj) {
  const out = {};
  Object.entries(compObj || {}).forEach(([cName, info]) => {
    out[cName] = normalizeCompetencyEntry(info);
  });
  return out;
}

function buildDefaultState() {
  return {
    wishesUrls: { E2026: "", F2026: "" },
    teachers: [],
    specialTasks: [],
    competencies: {},
    semesters: structuredClone(COURSE_STRUCTURE),
    diagnosticsCollapsed: true
  };
}

function setDataSourceStatus(mode) {
  const badge = document.getElementById("data-source-badge");
  if (!badge) return;

  badge.classList.remove("is-repo", "is-local", "is-default", "is-plan");
  if (mode === "plan") {
    badge.classList.add("is-repo");
    badge.innerHTML = `<span class="source-dot"></span><span>plan.json + settings.json</span>`;
    badge.title = "Arbejdsplan indlæst fra plan.json og stamdata fra settings.json";
  } else if (mode === "settings") {
    badge.classList.add("is-repo");
    badge.innerHTML = `<span class="source-dot"></span><span>settings.json</span>`;
    badge.title = "Indlæst stamdata fra settings.json";
  } else if (mode === "local") {
    badge.classList.add("is-local");
    badge.innerHTML = `<span class="source-dot"></span><span>Lokal kladde</span>`;
    badge.title = "Dine ændringer gemmes automatisk i browseren. Klik 'Hent fra filer' for at indlæse filerne igen.";
  } else {
    badge.classList.add("is-default");
    badge.innerHTML = `<span class="source-dot"></span><span>Standarddata</span>`;
    badge.title = "Hverken plan.json eller settings.json blev fundet — bruger tomt grundskelet";
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  setDataSourceStatus("local");
}

async function fetchFiles() {
  const base = buildDefaultState();
  let foundAny = false;

  try {
    const setRes = await fetch("./settings.json?t=" + Date.now(), { cache: "no-store" });
    if (setRes.ok) {
      const setJson = await setRes.json();
      if (setJson.teachers) base.teachers = setJson.teachers;
      if (setJson.specialTasks) base.specialTasks = setJson.specialTasks;
      if (setJson.competencies) base.competencies = normalizeAllCompetencies(setJson.competencies);
      if (setJson.wishesUrls) base.wishesUrls = { ...base.wishesUrls, ...setJson.wishesUrls };
      foundAny = true;
    }
  } catch {
    // Ingen settings.json fundet
  }

  try {
    const planRes = await fetch("./plan.json?t=" + Date.now(), { cache: "no-store" });
    if (planRes.ok) {
      const planJson = await planRes.json();
      if (planJson.semesters) {
        base.semesters = planJson.semesters;
        foundAny = true;
      }
      if (typeof planJson.diagnosticsCollapsed === "boolean") {
        base.diagnosticsCollapsed = planJson.diagnosticsCollapsed;
      }
      if (!base.teachers.length && planJson.teachers) base.teachers = planJson.teachers;
      if (!base.specialTasks.length && planJson.specialTasks) base.specialTasks = planJson.specialTasks;
      if (!Object.keys(base.competencies).length && planJson.competencies) {
        base.competencies = normalizeAllCompetencies(planJson.competencies);
      }
    }
  } catch {
    // Ingen plan.json fundet
  }

  setDataSourceStatus(foundAny ? "plan" : "default");
  return base;
}

async function initApp() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.semesters && parsed.teachers) {
        parsed.competencies = normalizeAllCompetencies(parsed.competencies);
        state = parsed;
        setDataSourceStatus("local");
      } else {
        state = await fetchFiles();
      }
    } catch {
      state = await fetchFiles();
    }
  } else {
    state = await fetchFiles();
  }

  selectedProfileTeacher = state.teachers[0]?.id || "AB";
  diagnosticsCollapsed = state.diagnosticsCollapsed !== false;
  renderAll();
}

function formatNum(n) {
  return Number(n).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1").replace(".", ",");
}

// ==========================================
// 1. FAGOVERSIGT, BAROMETER & DIAGNOSTIK
// ==========================================
function renderBoard() {
  const sem = state.semesters[currentSem];
  document.getElementById("current-sem-label").textContent = sem.label;
  const metrics = computeTeacherMetrics(state, currentSem);

  const baroEl = document.getElementById("teacher-barometer");
  baroEl.innerHTML = "";

  state.teachers.forEach(t => {
    const m = metrics[t.id];
    const leaveList = t.leavePhases?.[currentSem] || [];
    const isLeaveAll = leaveList.length >= sem.phases.length && sem.phases.length > 0;
    const hasPartialLeave = leaveList.length > 0 && !isLeaveAll;

    const leaveBadge = leaveList.length
      ? `<span class="pill pill-locked" style="font-size:10px;padding:1px 5px;white-space:nowrap;" title="Orlov i faser: ${leaveList.join(", ")}">🏖️${hasPartialLeave ? ` ${leaveList.length}/${sem.phases.length}` : ""}</span>`
      : "";

    let textColor = "var(--text-main)";
    let barColor = "#4b6584";
    if (!isLeaveAll && Number(t.targetWeekly || 0) > 0) {
      if (m.avgWeekly < m.bounds.minAcceptable - 0.05) {
        textColor = "var(--warn)";
        barColor = "var(--warn)";
      } else if (m.avgWeekly > m.bounds.maxAcceptable + 0.05) {
        textColor = "#ff7675";
        barColor = "var(--danger)";
      }
    }

    const maxRef = Math.max(1, m.bounds.maxAcceptable || t.targetWeekly || 10.5);
    const fillPct = Math.min(100, Math.round((m.avgWeekly / maxRef) * 100));
    const phaseMiniHtml = sem.phases.map(ph => {
      const st = m.phaseStatus[ph.id] || "ok";
      const cls = st === "over" ? "ph-over" : st === "under" ? "ph-under" : st === "leave" ? "ph-leave" : "ph-ok";
      return `<span class="ph-pill ${cls}">${ph.label.split("–")[0]}:${formatNum(m.phaseHours[ph.id])}</span>`;
    }).join("");

    const card = document.createElement("div");
    card.className = [
      "t-meter",
      m.conflicts.length ? "has-conflict" : "",
      m.spikes.length ? "has-spike" : "",
      isLeaveAll ? "on-leave" : ""
    ].filter(Boolean).join(" ");

    card.innerHTML = `
      <div class="t-meter-top" style="gap:6px;">
        <span style="display:inline-flex;align-items:center;gap:4px;min-width:0;">${t.id}${leaveBadge}${m.conflicts.length ? " ⚠️" : m.spikes.length ? " 🔥" : ""}</span>
        <span style="color:${textColor};white-space:nowrap;flex-shrink:0;">${formatNum(m.avgWeekly)} / ${formatNum(t.targetWeekly)}t</span>
      </div>
      <div class="t-bar-bg">
        <div class="t-bar-fill" style="width:${fillPct}%; background:${barColor};"></div>
      </div>
      <div class="t-phase-mini ${sem.phases.length === 2 ? "two-phases" : ""}">${phaseMiniHtml}</div>
    `;

    card.onclick = () => {
      selectedProfileTeacher = t.id;
      switchTab("profile");
      renderTeacherProfile();
    };
    baroEl.appendChild(card);
  });

  renderDiagnosticsPanel(sem, metrics);

  const periodsEl = document.getElementById("periods-container");
  periodsEl.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "timeline-wrapper";

  const bannerText = currentSem === "E2026"
    ? "🍂 EFTERÅRSSEMESTER • SAMLET FAGOVERSIGT"
    : "🌱 FORÅRSSEMESTER • PROPORTIONAL TIDSLINJE";
  const subText = currentSem === "F2026"
    ? "Idræt skifter 3 gange (2+2+2) • Kompetence & Inspiration skifter midtvejs (3+3)"
    : "2 perioder (Aug–Okt & Okt–Dec) • 4 fagblokke pr. periode";

  const bannerEl = document.createElement("div");
  bannerEl.className = `timeline-banner ${currentSem === "E2026" ? "autumn" : ""}`;
  bannerEl.innerHTML = `
    <span>${bannerText}</span>
    <span style="font-size:11.5px;font-weight:600;opacity:0.9;">${subText}</span>
  `;
  wrap.appendChild(bannerEl);

  const contBandsEl = document.createElement("div");
  contBandsEl.className = "continuous-bands";
  renderContinuousBandsInto(contBandsEl, sem);
  wrap.appendChild(contBandsEl);

  const grid = document.createElement("div");
  grid.className = `timeline-grid ${currentSem === "E2026" ? "cols-4" : "cols-6"}`;

  if (currentSem === "F2026") {
    grid.innerHTML = `
      <div class="col-header span-2">Forår 1 (Jan–Feb)</div>
      <div class="col-header span-2">Forår 2 (Mar–Apr)</div>
      <div class="col-header span-2">Forår 3 (Maj–Jun)</div>
    `;
  } else {
    const h1 = document.createElement("div");
    h1.className = "col-header";
    h1.style.gridColumn = "1 / -1";
    h1.textContent = "1. PERIODE (AUG – OKT)";
    grid.appendChild(h1);
  }

  const blocks = getAllSemesterBlocks(sem);
  blocks.forEach((block, idx) => {
    if (currentSem === "E2026" && idx === 4) {
      const h2 = document.createElement("div");
      h2.className = "col-header";
      h2.style.gridColumn = "1 / -1";
      h2.style.marginTop = "8px";
      h2.textContent = "2. PERIODE (OKT – DEC)";
      grid.appendChild(h2);
    }

    const col = createCompactBlock(block, metrics);
    if (currentSem === "F2026" && block.span) {
      col.classList.add(`block-span-${block.span}`);
    }
    grid.appendChild(col);
  });

  wrap.appendChild(grid);
  periodsEl.appendChild(wrap);
}

function renderDiagnosticsPanel(sem, metrics) {
  const panel = document.getElementById("diagnostics-panel");
  const blocks = getAllSemesterBlocks(sem);

  const conflicts = [];
  const spikes = [];
  const deficits = [];
  let unassignedCourses = 0;
  let missingTeacherSlots = 0;
  const sparseCourses = [];

  blocks.forEach(b => {
    b.courses.forEach(c => {
      if (c.isCanceled) return;
      const { teacherCount } = getCourseSharing(c);
      const assignedCount = (c.assignments || []).length;

      if (assignedCount === 0) {
        unassignedCourses++;
        const qualifiedCount = state.teachers.filter(t => getCompetencyLevel(state.competencies, c.name, t.id) > 0).length;
        if (qualifiedCount <= 2) {
          sparseCourses.push({ name: c.name, blockName: b.name, qualifiedCount });
        }
      }

      if (assignedCount < teacherCount) {
        missingTeacherSlots += (teacherCount - assignedCount);
      }
    });
  });

  const phases = sem.phases || [];
  const totalWeight = Math.max(1, phases.reduce((acc, p) => acc + Number(p.weight || 1), 0));

  let totalCapacityWeekly = 0;
  let totalMinWeekly = 0;
  let totalMaxWeekly = 0;
  let totalAssignedWeekly = 0;
  let leaveReducedWeekly = 0;
  const zeroNormAssigned = [];

  state.teachers.forEach(t => {
    const m = metrics[t.id];
    const leaveSet = new Set(t.leavePhases?.[currentSem] || []);
    const baseTarget = Number(t.targetWeekly || 0);

    const activeWeight = phases.reduce((sum, p) => {
      const w = Number(p.weight || 1);
      return leaveSet.has(p.id) ? sum : sum + w;
    }, 0);

    const effectiveTarget = (baseTarget * activeWeight) / totalWeight;
    leaveReducedWeekly += Math.max(0, baseTarget - effectiveTarget);

    totalCapacityWeekly += effectiveTarget;
    totalMinWeekly += Number(m.bounds.minAcceptable || 0);
    totalMaxWeekly += Number(m.bounds.maxAcceptable || 0);
    totalAssignedWeekly += Number(m.avgWeekly || 0);

    if (baseTarget <= 0 && Number(m.avgWeekly || 0) > 0) {
      zeroNormAssigned.push({ id: t.id, avg: m.avgWeekly });
    }

    m.conflicts.forEach(msg => conflicts.push({ tid: t.id, label: `${t.id}: ${msg}` }));
    m.spikes.forEach(sp => spikes.push({ tid: t.id, label: `${t.id} (${sp.phase}: ${formatNum(sp.hours)}t / maks ${formatNum(sp.max)}t)` }));
    m.deficits.forEach(df => deficits.push({ tid: t.id, label: `${t.id} (${df.phase}: ${formatNum(df.hours)}t / min ${formatNum(df.min)}t)` }));
  });

  let weightedMissingWeekly = 0;
  blocks.forEach(b => {
    b.courses.forEach(c => {
      if (c.isCanceled) return;
      const { teacherCount, splitType } = getCourseSharing(c);
      const assignedCount = (c.assignments || []).length;
      if (assignedCount < teacherCount) {
        let missingHrsThisCourse = 0;
        for (let idx = assignedCount; idx < teacherCount; idx++) {
          missingHrsThisCourse += getSlotDefaultHours(c.hours, teacherCount, splitType, idx);
        }
        const blockPhaseWeight = (b.activePhases || []).reduce((sum, phId) => {
          const ph = phases.find(p => p.id === phId);
          return sum + Number(ph?.weight || 1);
        }, 0);
        weightedMissingWeekly += (missingHrsThisCourse * blockPhaseWeight) / totalWeight;
      }
    });
  });

  const plannedTotalWeekly = totalAssignedWeekly + weightedMissingWeekly;
  const balanceWeekly = totalCapacityWeekly - plannedTotalWeekly;
  const currentSurplusWeekly = totalCapacityWeekly - totalAssignedWeekly;
  const zeroNormTotalWeekly = zeroNormAssigned.reduce((sum, x) => sum + x.avg, 0);

  const suggestions = [];
  const dgl = sem.dglConfig || {};
  const dglTeachers = (dgl.teachers || []).filter(Boolean);
  const openDglSlots = Math.max(0, Number(dgl.teamCount || 0) - dglTeachers.length);
  const dglHours = Number(dgl.hoursPerTeam ?? 3);

  const sang = sem.sangConfig || {};
  const sangTeachers = (sang.teachers || []).filter(Boolean);
  const openSangSlots = Math.max(0, Number(sang.teacherCount || 0) - sangTeachers.length);
  const sangHoursEach = sang.splitHours
    ? Number(sang.weeklyHours ?? 1.5) / Math.max(1, Number(sang.teacherCount || 1))
    : Number(sang.weeklyHours ?? 1.5);

  const deficitTeachers = state.teachers
    .map(t => {
      const m = metrics[t.id];
      const gap = m.bounds.minAcceptable - m.avgWeekly;
      return { id: t.id, avg: m.avgWeekly, min: m.bounds.minAcceptable, gap };
    })
    .filter(x => x.gap > 0.05 && x.min > 0)
    .sort((a, b) => b.gap - a.gap);

  if (zeroNormAssigned.length > 0) {
    const zList = zeroNormAssigned.map(x => `${x.id} (${formatNum(x.avg)} t/uge)`).join(", ");
    suggestions.push({
      tid: zeroNormAssigned[0].id,
      action: "teachers",
      text: `<strong>Timer på 0t-lærere (${formatNum(zeroNormTotalWeekly)} t/uge):</strong> ${zList} har tildelte timer uden en norm i <code>targetWeekly</code>. Tjek om timerne skal dækkes af lærere med norm eller om normen skal opdateres.`
    });
  }

  if (balanceWeekly < -0.5) {
    suggestions.push({
      tid: deficitTeachers[0]?.id || "",
      text: `<strong>Samlet timepres (${formatNum(Math.abs(balanceWeekly))} t/uge over norm):</strong> Planlagte fag + manglende pladser overstiger den aktive lærernorm (efter orlov). Overvej at aflyse enkelte fag, nedjustere fagtimetal eller dublere/dele færre hold.`
    });
  } else if (balanceWeekly > 1.5) {
    suggestions.push({
      tid: deficitTeachers[0]?.id || "",
      text: `<strong>Ledig kapacitet (${formatNum(balanceWeekly)} t/uge i overskud):</strong> Lærerstaben har samlet set ekstra timer til rådighed ud over de planlagte hold og åbne pladser.`
    });
  }

  if (openDglSlots > 0 && deficitTeachers.length > 0) {
    const dglCompIds = deficitTeachers
      .filter(x => getCompetencyLevel(state.competencies, "DGL", x.id) > 0)
      .slice(0, Math.min(4, openDglSlots))
      .map(x => x.id);
    const hintIds = dglCompIds.length ? dglCompIds.join(", ") : deficitTeachers.slice(0, 3).map(x => x.id).join(", ");
    suggestions.push({
      tid: dglCompIds[0] || deficitTeachers[0].id,
      text: `<strong>DGL (${formatNum(dglHours)} t/uge hele semesteret):</strong> Der er ${openDglSlots} ledig(e) holdplads(er). Sættes f.eks. ${hintIds} på, løfter det hele ugenormen markant.`
    });
  }

  if (openSangSlots > 0 && deficitTeachers.length > 0) {
    const sangCompIds = deficitTeachers
      .filter(x => getCompetencyLevel(state.competencies, "Fællessang", x.id) > 0)
      .slice(0, Math.min(3, openSangSlots))
      .map(x => x.id);
    if (sangCompIds.length) {
      suggestions.push({
        tid: sangCompIds[0],
        text: `<strong>Fællessang (${formatNum(sangHoursEach)} t/uge):</strong> ${openSangSlots} ledig(e) plads(er) — relevant for ${sangCompIds.join(", ")}.`
      });
    }
  }

  if (spikes.length > 0 && deficitTeachers.length > 0) {
    const spikeTid = spikes[0].tid;
    const defTid = deficitTeachers[0].id;
    suggestions.push({
      tid: spikeTid,
      text: `<strong>Udlign spidsbelastning:</strong> Overvej at dele et fag for <strong>${spikeTid}</strong> med f.eks. <strong>${defTid}</strong> eller flytte et fag til en roligere periode.`
    });
  }

  if (sparseCourses.length > 0) {
    const sample = sparseCourses.slice(0, 3).map(sc => `${sc.name} (${sc.qualifiedCount} lærer${sc.qualifiedCount === 1 ? "" : "e"})`).join(", ");
    suggestions.push({
      tid: deficitTeachers[0]?.id || "",
      action: "matrix",
      text: `<strong>Få kompetencer på ubesatte fag:</strong> Bl.a. ${sample}. Tilføj ✓/★ i Kompetencematrixen eller tildel manuelt.`
    });
  }

  if (!suggestions.length && deficitTeachers.length > 0) {
    const topDef = deficitTeachers.slice(0, 3).map(x => `${x.id} (${formatNum(x.avg)}/${formatNum(x.min)}t)`).join(", ");
    suggestions.push({
      tid: deficitTeachers[0].id,
      text: `<strong>Lærere under min.-spænd:</strong> Klik på en lærer for at se ledige blokke og fylde op med passende kompetencer (${topDef}).`
    });
  }

  panel.innerHTML = `
    <div class="diag-header" id="diag-toggle-header">
      <div class="diag-header-left">
        <span>${diagnosticsCollapsed ? "▶" : "▼"}</span>
        <h3>📊 Periode-overblik & Fordelingsudfordringer (${sem.label})</h3>
      </div>
      <div class="diag-summary-badges">
        ${conflicts.length ? `<span class="pill pill-high">⚠️ ${conflicts.length} konflikter</span>` : ""}
        ${spikes.length ? `<span class="pill pill-high">🔥 ${spikes.length} over spænd</span>` : ""}
        ${deficits.length ? `<span class="pill pill-low">📉 ${deficits.length} under spænd</span>` : ""}
        ${zeroNormAssigned.length ? `<span class="pill pill-low">0️⃣ ${zeroNormAssigned.length} på 0t-norm</span>` : ""}
        ${missingTeacherSlots ? `
          <button type="button" id="btn-toggle-unassigned" class="pill pill-locked" style="cursor:pointer;font-family:inherit;">
            📌 ${missingTeacherSlots} manglende pladser (${unassignedCourses} helt ubesatte) ${highlightUnassigned ? "(markeret)" : "(markér)"}
          </button>
        ` : `<span class="pill pill-locked">✓ Alle pladser besat</span>`}
      </div>
    </div>
    <div class="diag-body ${diagnosticsCollapsed ? "collapsed" : ""}">
      <div class="diag-stats-bar" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px;">
        <div class="phase-box" style="text-align:left;padding:8px 10px;">
          <span class="hint">Tilgængelig lærernorm</span>
          <strong style="font-size:14px;">${formatNum(totalCapacityWeekly)} t/uge</strong>
          <span class="hint" style="font-size:11px;">
            ${leaveReducedWeekly > 0.01 ? `-${formatNum(leaveReducedWeekly)}t pga. orlov • ` : ""}Spænd: ${formatNum(totalMinWeekly)}–${formatNum(totalMaxWeekly)}t
          </span>
        </div>
        <div class="phase-box" style="text-align:left;padding:8px 10px;">
          <span class="hint">Tildelt nu i skemaet</span>
          <strong style="font-size:14px;">${formatNum(totalAssignedWeekly)} t/uge</strong>
          <span class="hint" style="font-size:11px;">
            Ledig norm nu: ${formatNum(currentSurplusWeekly)}t${zeroNormAssigned.length ? ` • 0t-lærere: ${formatNum(zeroNormTotalWeekly)}t` : ""}
          </span>
        </div>
        <div class="phase-box" style="text-align:left;padding:8px 10px;">
          <span class="hint">Åbne pladser (inkl. delte/dubl.)</span>
          <strong style="font-size:14px;">${missingTeacherSlots} pladser</strong>
          <span class="hint" style="font-size:11px;">~${formatNum(weightedMissingWeekly)} t/uge vægtet</span>
        </div>
        <div class="phase-box" style="text-align:left;padding:8px 10px;">
          <span class="hint">Balance efter åbne pladser</span>
          <strong style="font-size:14px;color:${balanceWeekly < -0.5 ? "#ff7675" : balanceWeekly > 0 ? "#6ee7b7" : "var(--text-main)"}">
            ${balanceWeekly >= 0 ? "+" : ""}${formatNum(balanceWeekly)} t/uge
          </strong>
          <span class="hint" style="font-size:11px;">${balanceWeekly >= 0 ? "Overskud i stabens norm" : "Underskud i stabens norm"}</span>
        </div>
      </div>

      <div class="diag-grid" style="grid-template-columns: repeat(3, minmax(0, 1fr));">
        <div class="diag-box ${conflicts.length ? "diag-danger" : "diag-ok"}">
          <div class="diag-title"><span>⚠️ Blok- & Orlovskonflikter</span><span>${conflicts.length}</span></div>
          <div class="diag-chips">
            ${conflicts.length
              ? conflicts.map(c => `<span class="diag-chip" data-tid="${c.tid}">${c.label}</span>`).join("")
              : `<span class="hint">Ingen blok- eller orlovskonflikter</span>`}
          </div>
        </div>

        <div class="diag-box ${spikes.length ? "diag-danger" : "diag-ok"}">
          <div class="diag-title"><span>🔥 Over acceptabelt spænd</span><span>${spikes.length}</span></div>
          <div class="diag-chips">
            ${spikes.length
              ? spikes.map(s => `<span class="diag-chip" data-tid="${s.tid}">${s.label}</span>`).join("")
              : `<span class="hint">Ingen lærere over maks-loftet</span>`}
          </div>
        </div>

        <div class="diag-box ${deficits.length ? "diag-warn" : "diag-ok"}">
          <div class="diag-title"><span>📉 Under acceptabelt spænd</span><span>${deficits.length}</span></div>
          <div class="diag-chips">
            ${deficits.length
              ? deficits.map(d => `<span class="diag-chip" data-tid="${d.tid}">${d.label}</span>`).join("")
              : `<span class="hint">Alle aktive lærere er inden for spændet</span>`}
          </div>
        </div>
      </div>

      ${suggestions.length ? `
        <div class="diag-suggestions" style="margin-top:10px;padding:9px 11px;border-radius:8px;background:rgba(15,23,42,0.55);border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:6px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#93c5fd;">💡 Forslag til at løse udfordringerne</div>
          ${suggestions.map(sg => `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;color:var(--text-main);">
              <span>${sg.text}</span>
              ${sg.action === "matrix"
                ? `<button type="button" class="diag-chip diag-sug-action" data-action="matrix" style="flex-shrink:0;cursor:pointer;">Åbn matrix ↗</button>`
                : sg.action === "teachers"
                  ? `<button type="button" class="diag-chip diag-sug-action" data-action="teachers" style="flex-shrink:0;cursor:pointer;">Se normer ↗</button>`
                  : sg.tid
                    ? `<button type="button" class="diag-chip diag-sug-action" data-tid="${sg.tid}" style="flex-shrink:0;cursor:pointer;">Se ${sg.tid} ↗</button>`
                    : ""}
            </div>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;

  panel.querySelector("#diag-toggle-header").onclick = () => {
    diagnosticsCollapsed = !diagnosticsCollapsed;
    state.diagnosticsCollapsed = diagnosticsCollapsed;
    saveState();
    panel.querySelector(".diag-body").classList.toggle("collapsed", diagnosticsCollapsed);
    panel.querySelector(".diag-header-left span").textContent = diagnosticsCollapsed ? "▶" : "▼";
  };

  const toggleBtn = panel.querySelector("#btn-toggle-unassigned");
  if (toggleBtn) {
    toggleBtn.onclick = (e) => {
      e.stopPropagation();
      highlightUnassigned = !highlightUnassigned;
      renderBoard();
    };
  }

  panel.querySelectorAll(".diag-chip[data-tid]").forEach(chip => {
    chip.onclick = (e) => {
      e.stopPropagation();
      selectedProfileTeacher = chip.dataset.tid;
      switchTab("profile");
      renderTeacherProfile();
    };
  });

  panel.querySelectorAll(".diag-sug-action").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      if (btn.dataset.action === "matrix") {
        switchTab("competencies");
        renderCompetencyMatrix();
      } else if (btn.dataset.action === "teachers") {
        switchTab("teachers");
        renderTeachersTab();
      } else if (btn.dataset.tid) {
        selectedProfileTeacher = btn.dataset.tid;
        switchTab("profile");
        renderTeacherProfile();
      }
    };
  });
}

function renderContinuousBandsInto(container, sem) {
  const dgl = sem.dglConfig;
  dgl.lockedSlots = dgl.lockedSlots || [];
  const dglLine = document.createElement("div");
  dglLine.className = "band-line";
  dglLine.innerHTML = `
    <div class="band-line-left">
      <h3>🧭 DGL • HELE SEMESTERET</h3>
      <span class="block-hours-tag">${formatNum(dgl.hoursPerTeam)} t/uge</span>
    </div>
    <div class="band-line-slots" id="dgl-slots"></div>
    <div class="band-line-controls">
      <label>Hold:
        <input type="number" id="dgl-team-count" min="1" max="12" value="${dgl.teamCount}" class="input-field tiny-input" style="padding:3px 6px;" />
      </label>
    </div>
  `;
  container.appendChild(dglLine);

  const dglSlotsEl = dglLine.querySelector("#dgl-slots");
  for (let i = 0; i < dgl.teamCount; i++) {
    const isLocked = !!dgl.lockedSlots[i];
    const pill = document.createElement("div");
    pill.className = `band-slot-pill ${isLocked ? "locked" : ""}`;

    const sel = buildTeacherSelect(dgl.teachers[i] || "", "DGL", dgl.wishes);
    sel.onchange = () => {
      dgl.teachers[i] = sel.value;
      saveState();
      renderAll();
    };

    const lockBtn = document.createElement("button");
    lockBtn.type = "button";
    lockBtn.className = `badge-lock-btn ${isLocked ? "locked" : ""}`;
    lockBtn.textContent = isLocked ? "🔒" : "🔓";
    lockBtn.title = isLocked ? "Lås op" : "Lås denne DGL-lærer fast";
    lockBtn.onclick = () => {
      dgl.lockedSlots[i] = !dgl.lockedSlots[i];
      saveState();
      renderAll();
    };

    pill.appendChild(sel);
    pill.appendChild(lockBtn);
    dglSlotsEl.appendChild(pill);
  }

  dglLine.querySelector("#dgl-team-count").onchange = (e) => {
    const count = Math.max(1, Math.min(12, Number(e.target.value || 1)));
    dgl.teamCount = count;
    while (dgl.teachers.length < count) dgl.teachers.push("");
    while (dgl.lockedSlots.length < count) dgl.lockedSlots.push(false);
    dgl.teachers = dgl.teachers.slice(0, count);
    dgl.lockedSlots = dgl.lockedSlots.slice(0, count);
    saveState();
    renderAll();
  };

  const sang = sem.sangConfig;
  sang.lockedSlots = sang.lockedSlots || [];
  const hoursEach = sang.splitHours ? sang.weeklyHours / Math.max(1, sang.teacherCount) : sang.weeklyHours;

  const sangLine = document.createElement("div");
  sangLine.className = "band-line";
  sangLine.innerHTML = `
    <div class="band-line-left">
      <h3>🎤 FÆLLESSANG • HELE SEMESTERET</h3>
      <span class="block-hours-tag">${formatNum(hoursEach)} t/uge</span>
    </div>
    <div class="band-line-slots" id="sang-slots"></div>
    <div class="band-line-controls">
      <label>Lærere:
        <input type="number" id="sang-teacher-count" min="1" max="6" value="${sang.teacherCount}" class="input-field tiny-input" style="padding:3px 6px;" />
      </label>
      <select id="sang-split-mode" class="input-field" style="padding:3px 7px;font-size:11.5px;">
        <option value="split" ${sang.splitHours ? "selected" : ""}>Deler 1,5t</option>
        <option value="double" ${!sang.splitHours ? "selected" : ""}>Alle på (1,5t hver)</option>
      </select>
    </div>
  `;
  container.appendChild(sangLine);

  const sangSlotsEl = sangLine.querySelector("#sang-slots");
  for (let i = 0; i < sang.teacherCount; i++) {
    const isLocked = !!sang.lockedSlots[i];
    const pill = document.createElement("div");
    pill.className = `band-slot-pill ${isLocked ? "locked" : ""}`;

    const sel = buildTeacherSelect(sang.teachers[i] || "", "Fællessang", sang.wishes);
    sel.onchange = () => {
      sang.teachers[i] = sel.value;
      saveState();
      renderAll();
    };

    const lockBtn = document.createElement("button");
    lockBtn.type = "button";
    lockBtn.className = `badge-lock-btn ${isLocked ? "locked" : ""}`;
    lockBtn.textContent = isLocked ? "🔒" : "🔓";
    lockBtn.title = isLocked ? "Lås op" : "Lås denne lærer fast";
    lockBtn.onclick = () => {
      sang.lockedSlots[i] = !sang.lockedSlots[i];
      saveState();
      renderAll();
    };

    pill.appendChild(sel);
    pill.appendChild(lockBtn);
    sangSlotsEl.appendChild(pill);
  }

  sangLine.querySelector("#sang-teacher-count").onchange = (e) => {
    const count = Math.max(1, Math.min(6, Number(e.target.value || 1)));
    sang.teacherCount = count;
    while (sang.teachers.length < count) sang.teachers.push("");
    while (sang.lockedSlots.length < count) sang.lockedSlots.push(false);
    sang.teachers = sang.teachers.slice(0, count);
    sang.lockedSlots = sang.lockedSlots.slice(0, count);
    saveState();
    renderAll();
  };

  sangLine.querySelector("#sang-split-mode").onchange = (e) => {
    sang.splitHours = e.target.value === "split";
    saveState();
    renderAll();
  };
}

function buildTeacherSelect(selectedId, courseName, wishes1 = []) {
  const sel = document.createElement("select");
  sel.className = "input-field";
  sel.style.padding = "3px 6px";
  sel.style.fontSize = "11.5px";

  let html = `<option value="">-- Vælg --</option>`;
  state.teachers.forEach(t => {
    const lvl = getCompetencyLevel(state.competencies, courseName, t.id);
    const tags = [];
    if (lvl === 3) tags.push("👑");
    else if (lvl === 2) tags.push("★");
    else if (lvl === 1) tags.push("✓");
    if ((wishes1 || []).includes(t.id)) tags.push("Ønske");
    html += `<option value="${t.id}" ${t.id === selectedId ? "selected" : ""}>${t.id}${tags.length ? " (" + tags.join(" ") + ")" : ""}</option>`;
  });
  sel.innerHTML = html;
  return sel;
}

function createCompactBlock(block, metrics) {
  const col = document.createElement("div");
  col.className = "block-col";

  const teacherCounts = {};
  const conflictTeachers = new Set();
  let activeCourseCount = 0;

  block.courses.forEach(course => {
    if (course.isCanceled) return;
    activeCourseCount++;

    course.assignments.forEach(a => {
      teacherCounts[a.teacher] = (teacherCounts[a.teacher] || 0) + 1;
      if (teacherCounts[a.teacher] > 1) {
        conflictTeachers.add(a.teacher);
      }
    });
  });

  const conflictBanner = conflictTeachers.size > 0
    ? `<div class="block-conflict-banner">⚠️ Dobbeltbooking: ${Array.from(conflictTeachers).join(", ")}</div>`
    : "";

  col.innerHTML = `
    <div class="block-col-header">
      <h3>${block.name} <span class="block-active-count">(${activeCourseCount} aktive)</span></h3>
      <span class="block-hours-tag">${formatNum(block.defaultHours)} t/uge</span>
    </div>
    ${conflictBanner}
  `;

  const list = document.createElement("div");
  list.className = "course-list";

  block.courses.forEach(course => {
    const item = document.createElement("div");
    const { teacherCount, splitType } = getCourseSharing(course);
    const isCourseInConflict = !course.isCanceled && course.assignments.some(a => conflictTeachers.has(a.teacher));
    const hasLeaveConflict = !course.isCanceled && course.assignments.some(a => {
      const m = metrics[a.teacher];
      return m && m.conflicts.some(msg => msg.includes("orlov"));
    });
    const hasLockedTeacher = !course.isCanceled && course.assignments.some(a => !!a.locked);
    const isMissingSlots = !course.isCanceled && course.assignments.length < teacherCount;

    item.className = [
      "course-item",
      course.isCanceled ? "is-canceled" : "",
      (isCourseInConflict || hasLeaveConflict) ? "has-conflict" : "",
      hasLockedTeacher ? "has-locked-teacher" : "",
      highlightUnassigned && isMissingSlots ? "highlight-unassigned" : ""
    ].filter(Boolean).join(" ");

    let modeText = "";
    if (!course.isCanceled && teacherCount > 1) {
      if (splitType === "double") modeText = `${teacherCount} HOLD`;
      else if (splitType === "partial") modeText = "DELVIST DUBL.";
      else modeText = `DELT (${teacherCount})`;
    }
    const modeBadge = modeText ? `<span class="c-mode">${modeText}</span>` : "";

    const noteHtml = course.note
      ? `<span class="hint" style="margin-left:6px;font-style:italic;opacity:0.88;">— ${course.note}</span>`
      : "";

    item.innerHTML = `
      <div class="c-left">
        <span class="c-name" title="${course.name}${course.note ? " — " + course.note : ""}">${course.name}${noteHtml}</span>
      </div>
      <div class="c-teachers">
        ${modeBadge}
      </div>
    `;

    const teachersWrap = item.querySelector(".c-teachers");

    if (course.isCanceled) {
      teachersWrap.innerHTML = `<span class="c-canceled-badge">🚫 Aflyst</span>`;
    } else {
      course.assignments.forEach((a, aIdx) => {
        const lvl = getCompetencyLevel(state.competencies, course.name, a.teacher);
        const isThisTeacherConflicted = conflictTeachers.has(a.teacher);

        const cls = [
          "t-badge",
          isThisTeacherConflicted ? "conflict-badge" : (lvl === 3 ? "lead" : lvl === 2 ? "prim" : ""),
          a.locked ? "is-locked" : ""
        ].filter(Boolean).join(" ");

        const icon = isThisTeacherConflicted ? "⚠️ " : (lvl === 3 ? "👑 " : lvl === 2 ? "★ " : "");
        const isCustomHours = Number(a.hours) !== Number(block.defaultHours) || Number(a.hours) !== Number(course.hours);
        const hoursText = isCustomHours ? ` (${formatNum(a.hours)}t)` : "";

        const badge = document.createElement("span");
        badge.className = cls;
        badge.innerHTML = `<span>${icon}${a.teacher}${hoursText}</span>`;

        const lockBtn = document.createElement("button");
        lockBtn.type = "button";
        lockBtn.className = `badge-lock-btn ${a.locked ? "locked" : ""}`;
        lockBtn.textContent = a.locked ? "🔒" : "🔓";
        lockBtn.title = a.locked
          ? `Lås ${a.teacher} op fra ${course.name}`
          : `Lås ${a.teacher} fast på ${course.name}`;
        lockBtn.onclick = (e) => {
          e.stopPropagation();
          course.assignments[aIdx].locked = !course.assignments[aIdx].locked;
          saveState();
          renderAll();
        };

        badge.appendChild(lockBtn);
        teachersWrap.appendChild(badge);
      });

      const missingSlots = Math.max(0, teacherCount - course.assignments.length);
      for (let s = 0; s < missingSlots; s++) {
        const slotNumber = course.assignments.length + s + 1;
        const emptySpan = document.createElement("span");
        emptySpan.className = "c-empty";
        emptySpan.textContent = teacherCount > 1 ? `+ Lærer ${slotNumber}` : "+ Tildel";
        teachersWrap.appendChild(emptySpan);
      }
    }

    item.onclick = () => openCourseModal(course, block.name, block);
    list.appendChild(item);
  });

  col.appendChild(list);
  return col;
}

// ==========================================
// 2. LÆRERPROFIL & PERIODE-SKEMA
// ==========================================
function renderTeacherProfile() {
  const select = document.getElementById("profile-teacher-select");
  if (!select) return;

  select.innerHTML = state.teachers
    .map(t => `<option value="${t.id}" ${t.id === selectedProfileTeacher ? "selected" : ""}>${t.id} (${t.pct}% • Norm ${formatNum(t.targetWeekly)} t/uge)</option>`)
    .join("");

  select.onchange = () => {
    selectedProfileTeacher = select.value;
    renderTeacherProfile();
  };

  const tid = selectedProfileTeacher;
  const teacher = state.teachers.find(t => t.id === tid);
  const contentEl = document.getElementById("teacher-profile-content");
  if (!teacher || !contentEl) {
    if (contentEl) contentEl.innerHTML = `<p class="hint">Ingen lærere indlæst endnu.</p>`;
    return;
  }

  const sem = state.semesters[currentSem];
  const metrics = computeTeacherMetrics(state, currentSem);
  const m = metrics[tid];

  const leadCourses = [];
  const primCourses = [];
  const canCourses = [];
  Object.entries(state.competencies).forEach(([cName, rawInfo]) => {
    const info = normalizeCompetencyEntry(rawInfo);
    if (info.leads.includes(tid)) leadCourses.push(cName);
    else if (info.primary.includes(tid)) primCourses.push(cName);
    else if (info.canTeach.includes(tid)) canCourses.push(cName);
  });

  const blocks = getAllSemesterBlocks(sem);

  const getWishesGroupedByBlock = (blockIds) => {
    const groups = [];
    blocks
      .filter(b => blockIds.includes(b.id))
      .forEach(b => {
        const items = [];
        b.courses.forEach((c, cIdx) => {
          const isP1 = (c.wishes1 || []).includes(tid);
          const isP2 = (c.wishes2 || []).includes(tid);
          if (!isP1 && !isP2) return;
          const isAssigned = (c.assignments || []).some(a => a.teacher === tid);
          items.push({
            name: c.name,
            note: c.note || "",
            prio: isP1 ? 1 : 2,
            isAssigned,
            blockId: b.id,
            courseIdx: cIdx
          });
        });
        items.sort((a, b) => a.prio - b.prio);
        groups.push({
          blockId: b.id,
          blockTitle: b.name.split("•")[0].trim(),
          items
        });
      });
    return groups;
  };

  const contWishes = [];
  if ((sem.dglConfig?.wishes || []).includes(tid)) {
    const isAssigned = (sem.dglConfig?.teachers || []).includes(tid);
    contWishes.push({ name: "DGL", eyebrow: "Hele semesteret", prio: 1, isAssigned, blockId: "CONT_DGL", courseIdx: -1 });
  }
  if ((sem.sangConfig?.wishes || []).includes(tid)) {
    const isAssigned = (sem.sangConfig?.teachers || []).includes(tid);
    contWishes.push({ name: "Fællessang", eyebrow: "Hele semesteret", prio: 1, isAssigned, blockId: "CONT_SANG", courseIdx: -1 });
  }

  const renderWishRow = (w, eyebrowOverride = "") => {
    const wNote = w.note ? `<span class="hint" style="margin-left:5px;font-style:italic;opacity:0.88;">— ${w.note}</span>` : "";
    return `
      <button type="button"
        class="wish-period-item profile-course-trigger ${w.prio === 2 ? "is-prio-2" : "is-prio-1"} ${w.isAssigned ? "is-assigned" : ""}"
        data-block-id="${w.blockId}" data-course-idx="${w.courseIdx}"
        title="Klik for at åbne ${w.name}${w.note ? " — " + w.note : ""} (${w.prio}. prioritet)${w.isAssigned ? " • Allerede tildelt" : ""}">
        <div class="wish-item-left">
          ${eyebrowOverride ? `<span class="wish-item-eyebrow">${eyebrowOverride}</span>` : ""}
          <span class="wish-item-name">${w.isAssigned ? "✓ " : ""}${w.name}${wNote}</span>
        </div>
        <span class="prio-pill ${w.prio === 1 ? "prio-1" : "prio-2"}">${w.prio}. prio</span>
      </button>
    `;
  };

  const renderWishColumn = (title, blockIds) => {
    const groups = getWishesGroupedByBlock(blockIds);
    const hasAny = groups.some(g => g.items.length > 0);

    return `
      <div class="wish-period-col">
        <div class="wish-period-title">${title}</div>
        ${hasAny
          ? groups.map(g => `
              <div class="wish-subblock" style="margin-top:4px;">
                <div class="wish-item-eyebrow" style="padding:2px 2px 3px;">${g.blockTitle}</div>
                ${g.items.length
                  ? g.items.map(w => renderWishRow(w)).join("")
                  : `<div class="c-empty" style="font-size:11px;padding:2px 4px;">Ingen ønsker</div>`}
              </div>
            `).join("")
          : `<div class="c-empty" style="font-size:11.5px;padding:4px 2px;">Ingen ønsker</div>`}
      </div>
    `;
  };

  let wishesPeriodHtml = "";
  if (contWishes.length) {
    wishesPeriodHtml += `
      <div class="wish-cont-row">
        ${contWishes.map(w => renderWishRow(w, "HELE SEMESTERET")).join("")}
      </div>
    `;
  }

  if (currentSem === "F2026") {
    wishesPeriodHtml += `
      <div class="wish-period-grid cols-3">
        ${renderWishColumn("Forår 1 (Jan–Feb)", ["F1_I1", "F1_I2"])}
        ${renderWishColumn("Forår 2 (Mar–Apr)", ["F2_I1", "F2_I2"])}
        ${renderWishColumn("Forår 3 (Maj–Jun)", ["F3_I1", "F3_I2"])}
      </div>
      <div class="wish-period-grid cols-2" style="margin-top:8px;">
        ${renderWishColumn("Kompetence & Inspiration • Del 1", ["F1_K", "F1_IN"])}
        ${renderWishColumn("Kompetence & Inspiration • Del 2", ["F2_K", "F2_IN"])}
      </div>
    `;
  } else {
    wishesPeriodHtml += `
      <div class="wish-period-grid cols-2">
        ${renderWishColumn("1. Periode (Aug–Okt)", ["E1_I1", "E1_I2", "E1_K", "E1_IN"])}
        ${renderWishColumn("2. Periode (Okt–Dec)", ["E2_I1", "E2_I2", "E2_K", "E2_IN"])}
      </div>
    `;
  }

  const phaseBoxesHtml = sem.phases.map(ph => {
    const hrs = m.phaseHours[ph.id] || 0;
    const st = m.phaseStatus[ph.id] || "ok";
    const col = st === "over" ? "#ff7675" : st === "under" ? "var(--warn)" : st === "leave" ? "var(--text-muted)" : "var(--text-main)";
    return `
      <div class="phase-box">
        <span class="hint">${ph.label}</span>
        <strong style="color:${col}">${formatNum(hrs)} t/uge</strong>
      </div>
    `;
  }).join("");

  const contCourses = m.assignedCourses.filter(ac => ac.blockId.startsWith("CONT_"));
  const contLinesHtml = contCourses.length
    ? contCourses.map(ac => {
        const isDgl = ac.blockId === "CONT_DGL";
        const wished = isDgl
          ? (sem.dglConfig?.wishes || []).includes(tid)
          : (sem.sangConfig?.wishes || []).includes(tid);

        const prioBadge = wished
          ? `<span class="prio-pill prio-1" title="Ønsket af ${tid}">1. prio</span>`
          : `<span class="prio-pill prio-none" title="Ikke ønsket af ${tid}">Ej prio</span>`;

        const sangCo = !isDgl
          ? (sem.sangConfig?.teachers || []).filter(t => t && t !== tid)
          : [];
        const coBadge = sangCo.length
          ? `<span class="co-teacher-pill" title="Fællessang sammen med ${sangCo.join(", ")}">🤝 ${sangCo.join(", ")}</span>`
          : "";

        return `
          <div class="course-item profile-course-trigger profile-mini-card ${wished ? "has-prio-1" : "has-prio-none"}"
            data-block-id="${ac.blockId}" data-course-idx="-1"
            title="Klik for at gå til DGL/Fællessang i oversigten" style="cursor:pointer;margin-top:6px;">
            <div class="profile-mini-left">
              <span class="profile-mini-eyebrow">HELE SEMESTERET</span>
              <span class="c-name">${ac.name}</span>
            </div>
            <div class="profile-mini-right">
              ${prioBadge}
              ${coBadge}
              <span class="t-badge prim">${formatNum(ac.hours)} t/uge ↗</span>
            </div>
          </div>
        `;
      }).join("")
    : `<div class="course-item" style="cursor:default;margin-top:6px;"><span class="c-empty">Ingen gennemgående fag tildelt</span></div>`;

  const renderBlockSlotGroup = (blockId, fallbackLabel) => {
    const blk = blocks.find(b => b.id === blockId);
    const blkTitle = blk ? blk.name : fallbackLabel;
    const assignedInBlock = m.assignedCourses.filter(ac => ac.blockId === blockId);

    if (!assignedInBlock.length) {
      return `
        <div class="course-item profile-block-picker profile-mini-card"
          data-block-id="${blockId}"
          title="Klik for at vælge et fag i ${blkTitle} og tildele ${tid}"
          style="cursor:pointer;margin-top:6px;border-style:dashed;opacity:0.9;">
          <div class="profile-mini-left">
            <span class="profile-mini-eyebrow">${blkTitle}</span>
            <span class="c-empty" style="padding:0;">+ Tilføj fag i ${blkTitle.split("•")[0].trim()}</span>
          </div>
          <div class="profile-mini-right">
            <span class="c-empty" style="padding:0;">Vælg fag ↗</span>
          </div>
        </div>
      `;
    }

    return assignedInBlock.map(ac => {
      const cIdx = blk ? blk.courses.findIndex(c => c.name === ac.name) : -1;
      const courseObj = (blk && cIdx >= 0) ? blk.courses[cIdx] : null;
      const isLocked = courseObj ? (courseObj.assignments || []).some(a => a.teacher === tid && a.locked) : false;

      const isPrio1 = courseObj ? (courseObj.wishes1 || []).includes(tid) : false;
      const isPrio2 = courseObj ? (courseObj.wishes2 || []).includes(tid) : false;

      const prioClass = isPrio1 ? "has-prio-1" : isPrio2 ? "has-prio-2" : "has-prio-none";
      const prioBadge = isPrio1
        ? `<span class="prio-pill prio-1" title="1. prioritet i ønskearket">1. prio</span>`
        : isPrio2
          ? `<span class="prio-pill prio-2" title="2. prioritet i ønskearket">2. prio</span>`
          : `<span class="prio-pill prio-none" title="Ikke blandt lærerens ønsker">Ej prio</span>`;

      const coTeachers = courseObj
        ? (courseObj.assignments || []).filter(a => a.teacher !== tid).map(a => a.teacher)
        : [];
      const sharing = courseObj ? getCourseSharing(courseObj) : { splitType: "split" };
      const isDouble = sharing.splitType === "double";

      const coTeacherHtml = coTeachers.length
        ? `<span class="co-teacher-pill ${isDouble ? "is-double" : ""}"
             title="${isDouble ? "Parallelhold sammen med" : "Delt fag med"} ${coTeachers.join(", ")}">
             ${isDouble ? "👥" : "🤝"} ${coTeachers.join(", ")}
           </span>`
        : "";

      const miniNoteHtml = courseObj?.note
        ? `<span class="hint" style="margin-left:5px;font-style:italic;opacity:0.88;">— ${courseObj.note}</span>`
        : "";

      return `
        <div class="course-item profile-course-trigger profile-mini-card ${prioClass}"
          data-block-id="${ac.blockId}" data-course-idx="${cIdx}"
          title="Klik for at redigere timetal, deling/dublering eller lås på ${ac.name}${courseObj?.note ? " — " + courseObj.note : ""}"
          style="cursor:pointer;margin-top:6px;">
          <div class="profile-mini-left">
            <span class="profile-mini-eyebrow">${ac.blockName}</span>
            <span class="c-name">${ac.name}${miniNoteHtml}</span>
          </div>
          <div class="profile-mini-right">
            ${prioBadge}
            ${coTeacherHtml}
            <span class="t-badge ${isLocked ? "is-locked" : ""}">${isLocked ? "🔒 " : ""}${formatNum(ac.hours)}t ✏️</span>
          </div>
        </div>
      `;
    }).join("");
  };

  let periodGridHtml = "";
  if (currentSem === "F2026") {
    periodGridHtml = `
      <div class="timeline-grid cols-6" style="margin-top:12px;">
        <div class="col-header span-2">Forår 1 (Jan–Feb)</div>
        <div class="col-header span-2">Forår 2 (Mar–Apr)</div>
        <div class="col-header span-2">Forår 3 (Maj–Jun)</div>
        <div class="block-col block-span-2">
          ${renderBlockSlotGroup("F1_I1", "IDRÆT 1 • Forår 1")}
          ${renderBlockSlotGroup("F1_I2", "IDRÆT 2 • Forår 1")}
        </div>
        <div class="block-col block-span-2">
          ${renderBlockSlotGroup("F2_I1", "IDRÆT 1 • Forår 2")}
          ${renderBlockSlotGroup("F2_I2", "IDRÆT 2 • Forår 2")}
        </div>
        <div class="block-col block-span-2">
          ${renderBlockSlotGroup("F3_I1", "IDRÆT 1 • Forår 3")}
          ${renderBlockSlotGroup("F3_I2", "IDRÆT 2 • Forår 3")}
        </div>

        <div class="col-header span-3">Kompetence & Inspiration • Del 1 (Jan–Mar)</div>
        <div class="col-header span-3">Kompetence & Inspiration • Del 2 (Apr–Jun)</div>
        <div class="block-col block-span-3">
          ${renderBlockSlotGroup("F1_K", "KOMPETENCEFAG • Del 1")}
          ${renderBlockSlotGroup("F1_IN", "INSPIRATIONSFAG • Del 1")}
        </div>
        <div class="block-col block-span-3">
          ${renderBlockSlotGroup("F2_K", "KOMPETENCEFAG • Del 2")}
          ${renderBlockSlotGroup("F2_IN", "INSPIRATIONSFAG • Del 2")}
        </div>
      </div>
    `;
  } else {
    periodGridHtml = `
      <div class="timeline-grid cols-4" style="margin-top:12px;">
        <div class="col-header span-2">1. Periode (Aug–Okt)</div>
        <div class="col-header span-2">2. Periode (Okt–Dec)</div>
        <div class="block-col block-span-2">
          ${renderBlockSlotGroup("E1_I1", "IDRÆT 1 • 1. Periode")}
          ${renderBlockSlotGroup("E1_I2", "IDRÆT 2 • 1. Periode")}
          ${renderBlockSlotGroup("E1_K", "KOMPETENCEFAG • 1. Periode")}
          ${renderBlockSlotGroup("E1_IN", "INSPIRATIONSFAG • 1. Periode")}
        </div>
        <div class="block-col block-span-2">
          ${renderBlockSlotGroup("E2_I1", "IDRÆT 1 • 2. Periode")}
          ${renderBlockSlotGroup("E2_I2", "IDRÆT 2 • 2. Periode")}
          ${renderBlockSlotGroup("E2_K", "KOMPETENCEFAG • 2. Periode")}
          ${renderBlockSlotGroup("E2_IN", "INSPIRATIONSFAG • 2. Periode")}
        </div>
      </div>
    `;
  }

  const semCsvCounts = lastCsvWishCounts[currentSem];
  const csvStatusNote = semCsvCounts
    ? `<div class="hint" style="margin-bottom:8px;">Seneste CSV-import (${sem.label}): <strong>${semCsvCounts[tid] || 0}</strong> matchede ønsker for ${tid}.</div>`
    : "";

  contentEl.innerHTML = `
    <div class="profile-grid">
      <div class="profile-card">
        <h3>🎯 Dine kompetencevurderinger for ${tid}</h3>
        <p class="hint" style="margin-bottom:6px;">👑 Hovedlærer:</p>
        <div class="tag-cloud">${leadCourses.length ? leadCourses.map(c => `<span class="tag-item tag-lead">👑 ${c}</span>`).join("") : "<span class='hint'>Ingen sat</span>"}</div>
        <p class="hint" style="margin-bottom:6px;">★ Mest oplagt:</p>
        <div class="tag-cloud">${primCourses.length ? primCourses.map(c => `<span class="tag-item tag-prim">★ ${c}</span>`).join("") : "<span class='hint'>Ingen sat</span>"}</div>
        <p class="hint" style="margin-bottom:6px;">✓ Kan dække:</p>
        <div class="tag-cloud">${canCourses.length ? canCourses.map(c => `<span class="tag-item tag-can">✓ ${c}</span>`).join("") : "<span class='hint'>Ingen sat</span>"}</div>
      </div>

      <div class="profile-card">
        <h3>💬 ${tid}'s egne fagønsker (${sem.label}) <span class="hint" style="font-weight:400;">(klik for at åbne fag)</span></h3>
        ${csvStatusNote}
        ${wishesPeriodHtml}
        ${teacher.wishNotes ? `<p style="margin-top:10px;font-size:12.5px;color:#fde68a;">📝 Bemærkning fra ønskeark: "${teacher.wishNotes}"</p>` : ""}
      </div>
    </div>

    <div class="profile-card" style="margin-top:16px;">
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;">
        <h3 style="margin:0;">📅 ${tid}'s skema & timer pr. periode (${sem.label}) <span class="hint" style="font-weight:400;">(klik på et fag for at redigere eller på en tom blok for at tilføje)</span></h3>
        <span class="hint">Spænd: <strong>${formatNum(m.bounds.minAcceptable)}–${formatNum(m.bounds.maxAcceptable)} t/uge</strong> (Mål: ${formatNum(teacher.targetWeekly)}t) • Gns. nu: <strong>${formatNum(m.avgWeekly)} t/uge</strong></span>
      </div>
      <div class="phase-bars">${phaseBoxesHtml}</div>
      <div style="margin-top:12px;">
        <div class="col-header" style="margin-bottom:4px;">Gennemgående fag (Hele semesteret)</div>
        ${contLinesHtml}
      </div>
      ${periodGridHtml}
    </div>
  `;

  contentEl.querySelectorAll(".profile-course-trigger").forEach(el => {
    el.onclick = () => {
      const blockId = el.dataset.blockId;
      const cIdx = Number(el.dataset.courseIdx);

      if (blockId.startsWith("CONT_")) {
        switchTab("board");
        document.querySelector(".continuous-bands")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      const block = blocks.find(b => b.id === blockId);
      const course = block && cIdx >= 0 ? block.courses[cIdx] : null;
      if (block && course) {
        openCourseModal(course, block.name, block);
      }
    };
  });

  contentEl.querySelectorAll(".profile-block-picker").forEach(el => {
    el.onclick = () => {
      const blockId = el.dataset.blockId;
      const block = blocks.find(b => b.id === blockId);
      if (!block) return;
      const firstActive = block.courses.find(c => !c.isCanceled) || block.courses[0];
      if (firstActive) {
        openCourseModal(firstActive, block.name, block, { preselectTeacherId: tid, showBlockRoster: true });
      }
    };
  });
}

// ==========================================
// 3. FAGKOMPETENCER & HOVEDLÆRERE MATRIX
// ==========================================
function renderCompetencyMatrix() {
  const table = document.getElementById("competency-matrix");
  if (!table) return;
  const filter = (document.getElementById("comp-search")?.value || "").toLowerCase();
  const courseCategories = new Map();

  ["E2026", "F2026"].forEach(sk => {
    const sem = state.semesters[sk];
    courseCategories.set("DGL", "GENNEMGÅENDE FAG");
    courseCategories.set("Fællessang", "GENNEMGÅENDE FAG");

    getAllSemesterBlocks(sem).forEach(b => {
      const bName = b.name.toLowerCase();
      let category = "ANDRE FAG";
      if (bName.includes("idræt")) category = "IDRÆTSFAG";
      else if (bName.includes("kompetence")) category = "KOMPETENCEFAG";
      else if (bName.includes("inspiration")) category = "INSPIRATIONSFAG";

      b.courses.forEach(c => {
        if (!courseCategories.has(c.name)) {
          courseCategories.set(c.name, category);
        }
      });
    });
  });

  const courseSet = new Set([...Object.keys(state.competencies), ...courseCategories.keys()]);
  const filteredCourses = Array.from(courseSet).filter(c => c.toLowerCase().includes(filter));

  const grouped = {
    "GENNEMGÅENDE FAG": [],
    "IDRÆTSFAG": [],
    "KOMPETENCEFAG": [],
    "INSPIRATIONSFAG": [],
    "ANDRE FAG": []
  };
  filteredCourses.forEach(c => {
    const cat = courseCategories.get(c) || "ANDRE FAG";
    if (grouped[cat]) grouped[cat].push(c);
  });
  Object.keys(grouped).forEach(key => {
    grouped[key].sort((a, b) => a.localeCompare(b, "da"));
  });

  let thead = `<thead><tr><th>Fag</th><th>Hovedlærer(e) & Dækning</th>`;
  state.teachers.forEach(t => { thead += `<th style="text-align:center;">${t.id}</th>`; });
  thead += `</tr></thead>`;

  let tbody = `<tbody>`;
  const groupOrder = ["GENNEMGÅENDE FAG", "IDRÆTSFAG", "KOMPETENCEFAG", "INSPIRATIONSFAG", "ANDRE FAG"];

  groupOrder.forEach(groupName => {
    if (grouped[groupName].length === 0) return;
    const colSpan = state.teachers.length + 2;
    tbody += `<tr class="matrix-group-header"><td colspan="${colSpan}">${groupName}</td></tr>`;

    grouped[groupName].forEach(cName => {
      const info = normalizeCompetencyEntry(state.competencies[cName]);
      const leadsHtml = info.leads.length
        ? `<span class="badge-lead">👑 ${info.leads.join(", ")}</span>`
        : `<span class="hint">—</span>`;
      const primCount = info.primary.length;
      const canCount = info.canTeach.length;
      const totalQualified = info.leads.length + primCount + canCount;

      const countsHtml = totalQualified === 0
        ? `<span class="comp-counts" title="Ingen lærere sat på faget"><span class="cnt-pill cnt-zero">⚠️ 0</span></span>`
        : `<span class="comp-counts" title="${info.leads.length} hovedlærer(e), ${primCount} mest oplagte (★), ${canCount} kan dække (✓)">
            <span class="cnt-pill cnt-prim">★ ${primCount}</span>
            <span class="cnt-pill cnt-can">✓ ${canCount}</span>
          </span>`;

      tbody += `<tr><td><strong>${cName}</strong></td><td><div class="lead-cell-wrap">${leadsHtml}${countsHtml}</div></td>`;
      state.teachers.forEach(t => {
        const lvl = getCompetencyLevel(state.competencies, cName, t.id);
        const cls = lvl === 3 ? "comp-lead" : lvl === 2 ? "comp-prim" : lvl === 1 ? "comp-can" : "";
        const label = lvl === 3 ? "👑" : lvl === 2 ? "★" : lvl === 1 ? "✓" : "—";
        tbody += `<td class="cell-comp ${cls}" data-course="${cName}" data-tid="${t.id}">${label}</td>`;
      });
      tbody += `</tr>`;
    });
  });

  tbody += `</tbody>`;
  table.innerHTML = thead + tbody;

  table.querySelectorAll(".cell-comp").forEach(cell => {
    cell.onclick = () => {
      const cName = cell.dataset.course;
      const tid = cell.dataset.tid;
      const entry = normalizeCompetencyEntry(state.competencies[cName]);
      const cur = getCompetencyLevel(state.competencies, cName, tid);
      const next = (cur + 1) % 4;

      entry.leads = entry.leads.filter(x => x !== tid);
      entry.primary = entry.primary.filter(x => x !== tid);
      entry.canTeach = entry.canTeach.filter(x => x !== tid);

      if (next === 1) entry.canTeach.push(tid);
      if (next === 2) entry.primary.push(tid);
      if (next === 3) entry.leads.push(tid);

      state.competencies[cName] = entry;
      saveState();
      renderAll();
    };
  });
}

const compSearchEl = document.getElementById("comp-search");
if (compSearchEl) compSearchEl.oninput = renderCompetencyMatrix;

// ==========================================
// 4. ARBEJDSTID, REJSER & NORMER
// ==========================================
function renderTeachersTab() {
  const tbody = document.querySelector("#teacher-hours-table tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const sem = state.semesters[currentSem];
  const metrics = computeTeacherMetrics(state, currentSem);

  state.teachers.forEach(t => {
    const m = metrics[t.id];
    const totalSpecialYear = state.specialTasks
      .filter(st => st.teachers.includes(t.id))
      .reduce((acc, st) => acc + st.uv, 0);

    const phaseBreakdown = sem.phases
      .map(ph => `${ph.label}: <strong>${formatNum(m.phaseHours[ph.id])}t</strong>`)
      .join(" • ");

    const leaveSet = new Set(t.leavePhases?.[currentSem] || []);
    const leaveTogglesHtml = sem.phases.map(ph => {
      const active = leaveSet.has(ph.id);
      return `
        <button type="button"
          class="diag-chip leave-phase-btn"
          data-tid="${t.id}"
          data-phase="${ph.id}"
          style="cursor:pointer;font-size:11px;padding:2px 6px;${active ? "border-color:var(--warn);color:#fde68a;background:rgba(245,158,11,0.16);" : "opacity:0.75;"}"
          title="Klik for at slå orlov til/fra i ${ph.label}">
          ${active ? "🏖️ " : ""}${ph.label}
        </button>
      `;
    }).join(" ");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${t.id}</strong></td>
      <td>${t.pct}%</td>
      <td>${formatNum(t.annualUv)} t</td>
      <td>${formatNum(totalSpecialYear)} t (${currentSem}: ${formatNum(m.specialUv)} t)</td>
      <td><input type="number" step="0.1" value="${t.targetWeekly}" data-tid="${t.id}" class="input-field tiny-input norm-input" /></td>
      <td><strong>${formatNum(m.avgWeekly)} t/uge</strong></td>
      <td style="font-size:12px;">
        <div>${phaseBreakdown}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;">${leaveTogglesHtml}</div>
      </td>
      <td><input type="text" value="${t.note || ""}" data-tid="${t.id}" class="input-field note-input" placeholder="Orlov / note..." /></td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".norm-input").forEach(inp => {
    inp.onchange = () => {
      const t = state.teachers.find(x => x.id === inp.dataset.tid);
      if (t) { t.targetWeekly = Number(inp.value || 0); saveState(); renderAll(); }
    };
  });

  document.querySelectorAll(".note-input").forEach(inp => {
    inp.onchange = () => {
      const t = state.teachers.find(x => x.id === inp.dataset.tid);
      if (t) { t.note = inp.value; saveState(); }
    };
  });

  tbody.querySelectorAll(".leave-phase-btn").forEach(btn => {
    btn.onclick = () => {
      const tObj = state.teachers.find(x => x.id === btn.dataset.tid);
      if (!tObj) return;
      tObj.leavePhases = tObj.leavePhases || {};
      const curList = tObj.leavePhases[currentSem] || [];
      const phId = btn.dataset.phase;
      tObj.leavePhases[currentSem] = curList.includes(phId)
        ? curList.filter(id => id !== phId)
        : [...curList, phId];
      saveState();
      renderAll();
    };
  });

  const tasksEl = document.getElementById("special-tasks-list");
  if (tasksEl) {
    tasksEl.innerHTML = state.specialTasks.map(st => `
      <div class="task-card">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <strong>${st.name}</strong>
          <span style="color:var(--accent-orange);font-weight:700;">${st.uv} uv-t (${st.sem})</span>
        </div>
        <div style="color:var(--text-muted);font-size:12px;">Lærere: ${st.teachers.join(", ")}</div>
      </div>
    `).join("");
  }
}

const btnAddSpecial = document.getElementById("btn-add-special");
if (btnAddSpecial) {
  btnAddSpecial.onclick = () => {
    const name = prompt("Navn på rejse / temauge:");
    if (!name) return;
    const uv = Number(prompt("Antal uv-timer pr. lærer:", "15") || 0);
    const raw = prompt("Lærere (komma-separeret, f.eks. AB, JD):", "");
    if (!raw) return;
    const teachers = raw.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
    state.specialTasks.push({ id: "st_" + Date.now(), sem: currentSem, name, uv, teachers });
    saveState();
    renderAll();
  };
}

// ==========================================
// 5. MODAL FOR FAG-TILDELING (1-3 LÆRERE & DELING/DUBLERING)
// ==========================================
function openCourseModal(course, periodTitle, block, opts = {}) {
  activeCourseRef = { course, block };
  document.getElementById("modal-block-tag").textContent = `${periodTitle} • ${formatNum(course.hours)} t/uge`;
  document.getElementById("modal-course-title").textContent = course.name;
  document.getElementById("modal-hours").value = course.hours;

  const cancelEl = document.getElementById("modal-canceled");
  if (cancelEl) cancelEl.checked = !!course.isCanceled;

  const titleEl = document.getElementById("modal-course-title");
  let noteInput = document.getElementById("modal-course-note");
  if (!noteInput && titleEl && titleEl.parentElement) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "margin:6px 0 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;";
    wrap.innerHTML = `
      <label for="modal-course-note" class="hint" style="font-size:11.5px;white-space:nowrap;">Notat efter navn:</label>
      <input type="text" id="modal-course-note" class="input-field" style="flex:1;min-width:180px;padding:5px 8px;font-size:12.5px;" placeholder="F.eks. Keramik eller bålhygge..." />
    `;
    titleEl.insertAdjacentElement("afterend", wrap);
    noteInput = document.getElementById("modal-course-note");
  }
  if (noteInput) noteInput.value = course.note || "";

  const sel1 = document.getElementById("modal-teacher-1");
  const sel2 = document.getElementById("modal-teacher-2");
  const sel3 = document.getElementById("modal-teacher-3");

  const defaultT1 = course.assignments[0]?.teacher || opts.preselectTeacherId || "";

  const makeOpts = (selectedId) => {
    let html = `<option value="">-- Vælg lærer --</option>`;
    state.teachers.forEach(t => {
      const lvl = getCompetencyLevel(state.competencies, course.name, t.id);
      const tags = [];
      if (lvl === 3) tags.push("👑 Hovedlærer");
      else if (lvl === 2) tags.push("★ Oplagt");
      else if (lvl === 1) tags.push("✓ Kan dække");
      if ((course.wishes1 || []).includes(t.id)) tags.push("1. ønske");
      if ((course.wishes2 || []).includes(t.id)) tags.push("2. ønske");
      html += `<option value="${t.id}" ${t.id === selectedId ? "selected" : ""}>${t.id} ${tags.length ? "(" + tags.join(", ") + ")" : ""}</option>`;
    });
    return html;
  };

  if (sel1) sel1.innerHTML = makeOpts(defaultT1);
  if (sel2) sel2.innerHTML = makeOpts(course.assignments[1]?.teacher || "");
  if (sel3) sel3.innerHTML = makeOpts(course.assignments[2]?.teacher || "");

  const lock1El = document.getElementById("modal-lock-1");
  const lock2El = document.getElementById("modal-lock-2");
  const lock3El = document.getElementById("modal-lock-3");
  if (lock1El) lock1El.checked = !!course.assignments[0]?.locked;
  if (lock2El) lock2El.checked = !!course.assignments[1]?.locked;
  if (lock3El) lock3El.checked = !!course.assignments[2]?.locked;

  const { teacherCount, splitType } = getCourseSharing(course);
  updateModalSharingUI(teacherCount, splitType, course);

  const candEl = document.getElementById("modal-candidates-list");
  if (candEl) {
    candEl.innerHTML = "";

    if (block && Array.isArray(block.courses) && block.courses.length > 0) {
      const rosterBox = document.createElement("div");
      rosterBox.style.cssText = "width:100%;margin-bottom:10px;padding:8px 10px;border-radius:8px;background:rgba(15,23,42,0.55);border:1px solid var(--border-subtle);";
      rosterBox.innerHTML = `<div class="hint" style="margin-bottom:6px;font-weight:700;">Fag i ${periodTitle} (klik for at skifte fag):</div>`;

      const listDiv = document.createElement("div");
      listDiv.style.cssText = "display:flex;flex-direction:column;gap:5px;max-height:175px;overflow:auto;";

      block.courses.forEach(bc => {
        const sharingInfo = getCourseSharing(bc);
        const missing = bc.isCanceled ? 0 : Math.max(0, sharingInfo.teacherCount - (bc.assignments || []).length);
        const rowBtn = document.createElement("button");
        rowBtn.type = "button";
        rowBtn.className = "course-item";
        rowBtn.style.cssText = `width:100%;text-align:left;cursor:pointer;${bc === course ? "border-color:var(--accent-orange);background:rgba(249,115,22,0.12);" : ""}`;

        const assignedBadges = bc.isCanceled
          ? `<span class="c-canceled-badge">🚫 Aflyst</span>`
          : [
              ...(bc.assignments || []).map(a => `<span class="t-badge ${a.locked ? "is-locked" : ""}">${a.locked ? "🔒 " : ""}${a.teacher} (${formatNum(a.hours)}t)</span>`),
              ...Array.from({ length: missing }, (_, idx) => `<span class="c-empty">${sharingInfo.teacherCount > 1 ? `+ Lærer ${(bc.assignments || []).length + idx + 1}` : "+ Tildel"}</span>`)
            ].join("");

        const bcNoteHtml = bc.note
          ? `<span class="hint" style="margin-left:5px;font-style:italic;opacity:0.88;">— ${bc.note}</span>`
          : "";

        rowBtn.innerHTML = `
          <span class="c-name">${bc.name}${bcNoteHtml}</span>
          <span class="c-teachers">${assignedBadges}</span>
        `;
        rowBtn.onclick = () => openCourseModal(bc, periodTitle, block, opts);
        listDiv.appendChild(rowBtn);
      });

      rosterBox.appendChild(listDiv);
      candEl.appendChild(rosterBox);
    }

    const compInfo = normalizeCompetencyEntry(state.competencies[course.name]);
    const candIds = new Set([
      ...compInfo.leads,
      ...compInfo.primary,
      ...compInfo.canTeach,
      ...(course.wishes1 || []),
      ...(course.wishes2 || [])
    ]);

    if (candIds.size === 0) {
      const hintSpan = document.createElement("span");
      hintSpan.className = "hint";
      hintSpan.textContent = "Ingen forhåndsregistrerede ønsker eller kompetencer på dette fag.";
      candEl.appendChild(hintSpan);
    } else {
      candIds.forEach(tid => {
        const lvl = getCompetencyLevel(state.competencies, course.name, tid);
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "cand-chip";
        const badges = [];
        if (lvl === 3) badges.push("👑 Hovedlærer");
        else if (lvl === 2) badges.push("★ Oplagt");
        else if (lvl === 1) badges.push("✓ Kan dække");
        if ((course.wishes1 || []).includes(tid)) badges.push("1. prio");
        if ((course.wishes2 || []).includes(tid)) badges.push("2. prio");
        chip.textContent = `${tid} • ${badges.join(" + ")}`;
        chip.onclick = () => {
          if (sel1 && (!sel1.value || sel1.value === tid)) {
            sel1.value = tid;
          } else if (sel2 && (!sel2.value || sel2.value === tid)) {
            sel2.value = tid;
            if (modalTeacherCount < 2) updateModalSharingUI(2, modalSplitType);
          } else if (sel3) {
            sel3.value = tid;
            if (modalTeacherCount < 3) updateModalSharingUI(3, modalSplitType);
          }
        };
        candEl.appendChild(chip);
      });
    }
  }

  document.getElementById("course-modal").classList.remove("hidden");
}

function updateModalSharingUI(count, splitType, existingCourse = null) {
  modalTeacherCount = count;
  modalSplitType = splitType;

  document.querySelectorAll("#modal-teacher-count-group .mode-card").forEach(btn => {
    btn.classList.toggle("active", Number(btn.dataset.count) === count);
  });

  const splitWrap = document.getElementById("modal-split-type-wrap");
  if (splitWrap) splitWrap.style.display = count > 1 ? "block" : "none";

  document.querySelectorAll("#modal-split-type-group .mode-card").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.split === splitType);
  });

  const slot2 = document.getElementById("slot-2-wrap");
  const slot3 = document.getElementById("slot-3-wrap");
  if (slot2) slot2.style.display = count >= 2 ? "grid" : "none";
  if (slot3) slot3.style.display = count >= 3 ? "grid" : "none";

  const baseHours = Number(document.getElementById("modal-hours")?.value || 4);
  const hourInputs = [
    document.getElementById("modal-hours-1"),
    document.getElementById("modal-hours-2"),
    document.getElementById("modal-hours-3")
  ];

  hourInputs.forEach((inp, idx) => {
    if (!inp) return;
    if (existingCourse && existingCourse.assignments[idx] && existingCourse.assignments[idx].hours !== undefined) {
      inp.value = existingCourse.assignments[idx].hours;
    } else {
      inp.value = getSlotDefaultHours(baseHours, count, splitType, idx);
    }
  });
}

document.querySelectorAll("#modal-teacher-count-group .mode-card").forEach(btn => {
  btn.onclick = () => updateModalSharingUI(Number(btn.dataset.count), modalSplitType);
});

document.querySelectorAll("#modal-split-type-group .mode-card").forEach(btn => {
  btn.onclick = () => updateModalSharingUI(modalTeacherCount, btn.dataset.split);
});

const modalHoursEl = document.getElementById("modal-hours");
if (modalHoursEl) {
  modalHoursEl.oninput = () => updateModalSharingUI(modalTeacherCount, modalSplitType);
}

const modalSaveBtn = document.getElementById("modal-save");
if (modalSaveBtn) {
  modalSaveBtn.onclick = () => {
    if (!activeCourseRef) return;
    const { course } = activeCourseRef;

    const t1 = document.getElementById("modal-teacher-1")?.value || "";
    const t2 = document.getElementById("modal-teacher-2")?.value || "";
    const t3 = document.getElementById("modal-teacher-3")?.value || "";
    const h1 = Number(document.getElementById("modal-hours-1")?.value || 0);
    const h2 = Number(document.getElementById("modal-hours-2")?.value || 0);
    const h3 = Number(document.getElementById("modal-hours-3")?.value || 0);
    const lock1 = !!document.getElementById("modal-lock-1")?.checked;
    const lock2 = !!document.getElementById("modal-lock-2")?.checked;
    const lock3 = !!document.getElementById("modal-lock-3")?.checked;

    course.hours = Number(document.getElementById("modal-hours")?.value || course.hours);
    delete course.requiresTwo;
    course.teacherCount = modalTeacherCount;
    course.splitType = modalSplitType;
    course.mode = modalTeacherCount === 1
      ? "single"
      : modalTeacherCount === 3
        ? "three"
        : modalSplitType;

    const cancelEl = document.getElementById("modal-canceled");
    course.isCanceled = cancelEl ? cancelEl.checked : false;

    const noteVal = (document.getElementById("modal-course-note")?.value || "").trim();
    if (noteVal) course.note = noteVal;
    else delete course.note;

    course.assignments = [];
    if (t1) course.assignments.push({ teacher: t1, hours: h1, locked: lock1 });
    if (modalTeacherCount >= 2 && t2) course.assignments.push({ teacher: t2, hours: h2, locked: lock2 });
    if (modalTeacherCount >= 3 && t3) course.assignments.push({ teacher: t3, hours: h3, locked: lock3 });

    saveState();
    closeModal();
    renderAll();
  };
}

const modalClearBtn = document.getElementById("modal-clear");
if (modalClearBtn) {
  modalClearBtn.onclick = () => {
    if (!activeCourseRef) return;
    activeCourseRef.course.assignments = [];
    activeCourseRef.course.teacherCount = 1;
    activeCourseRef.course.splitType = "split";
    activeCourseRef.course.mode = "single";
    delete activeCourseRef.course.requiresTwo;
    saveState();
    closeModal();
    renderAll();
  };
}

function closeModal() {
  document.getElementById("course-modal")?.classList.add("hidden");
  activeCourseRef = null;
}
document.getElementById("modal-close")?.addEventListener("click", closeModal);
document.querySelector(".modal-backdrop")?.addEventListener("click", closeModal);

// ==========================================
// 6. IMPORTÉR LÆRERØNSKER & CSV-LINKS
// ==========================================
function cleanCourseTitle(str) {
  return (str || "").replace(/[^\wæøåÆØÅ0-9 ]/g, "").trim().toLowerCase();
}

function parseDelimitedText(text) {
  const firstLine = text.split(/\r?\n/)[0] || "";
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  const rows = [];
  let row = [], cell = "", inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delimiter) { row.push(cell.trim()); cell = ""; }
      else if (ch === "\r" && next === "\n") { row.push(cell.trim()); rows.push(row); row = []; cell = ""; i++; }
      else if (ch === "\n" || ch === "\r") { row.push(cell.trim()); rows.push(row); row = []; cell = ""; }
      else cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell.trim()); rows.push(row); }
  return rows;
}

function applyWishesFromCsvText(text, targetSem) {
  const rows = parseDelimitedText(text);

  let headerIdx = rows.findIndex(r => r.filter(cell => /^[A-ZÆØÅ]{2,4}\/[\d,.]+$/.test(cell)).length >= 2);
  let splitNormRow = false;

  if (headerIdx === -1) {
    headerIdx = rows.findIndex(r => r.filter(cell => /^[A-ZÆØÅ]{2,4}$/.test(cell)).length >= 3);
    splitNormRow = true;
  }
  if (headerIdx === -1) {
    throw new Error(`Kunne ikke finde header-rækken med lærerinitialer (f.eks. AB, ID, MO) i CSV for ${targetSem}.`);
  }

  const colSections = [];
  let currentSection = 0, seenTeachersInSection = false;
  const colTeacherMap = {};
  const nextRow = rows[headerIdx + 1] || [];
  let hasSeparateNormRow = false;

  rows[headerIdx].forEach((cell, idx) => {
    const combinedMatch = cell.match(/^([A-ZÆØÅ]{2,4})\/([\d,.]+)$/);
    const plainMatch = splitNormRow ? cell.match(/^([A-ZÆØÅ]{2,4})$/) : null;

    if (combinedMatch) {
      const tid = combinedMatch[1];
      const norm = Number(combinedMatch[2].replace(",", "."));
      colTeacherMap[idx] = { tid, section: currentSection };
      seenTeachersInSection = true;
      const tObj = state.teachers.find(t => t.id === tid);
      if (tObj && !isNaN(norm)) tObj.targetWeekly = norm;
    } else if (plainMatch) {
      const tid = plainMatch[1];
      colTeacherMap[idx] = { tid, section: currentSection };
      seenTeachersInSection = true;
      const belowVal = (nextRow[idx] || "").trim();
      if (/^[\d,.]+$/.test(belowVal)) {
        hasSeparateNormRow = true;
        const norm = Number(belowVal.replace(",", "."));
        const tObj = state.teachers.find(t => t.id === tid);
        if (tObj && !isNaN(norm)) tObj.targetWeekly = norm;
      }
    } else if (cell && seenTeachersInSection) {
      currentSection++;
      seenTeachersInSection = false;
    }
    colSections[idx] = currentSection;
  });

  const sem = state.semesters[targetSem];
  const blocks = getAllSemesterBlocks(sem);
  blocks.forEach(b => b.courses.forEach(c => { c.wishes1 = []; c.wishes2 = []; }));
  sem.dglConfig.wishes = [];
  sem.sangConfig.wishes = [];

  const countsBySem = {};
  const sectionPeriod = {}, sectionBlock = {}, sectionPrio = {};
  const startRow = headerIdx + (hasSeparateNormRow ? 2 : 1);

  rows.slice(startRow).forEach(r => {
    r.forEach((cell, colIdx) => {
      if (colTeacherMap[colIdx]) return;
      const sec = colSections[colIdx] || 0;
      const low = cell.toLowerCase();

      if (low.includes("august")) sectionPeriod[sec] = "E1";
      else if (low.includes("oktober")) sectionPeriod[sec] = "E2";
      else if (low.includes("januar")) sectionPeriod[sec] = "F1";
      else if (low.includes("marts")) sectionPeriod[sec] = "F2";
      else if (low.includes("maj")) sectionPeriod[sec] = "F3";

      if (low.includes("idrætsblok 1")) sectionBlock[sec] = "I1";
      else if (low.includes("idrætsblok 2")) sectionBlock[sec] = "I2";
      else if (low.includes("kompetencefag")) sectionBlock[sec] = "K";
      else if (low.includes("inspirationsfag")) sectionBlock[sec] = "IN";
      else if (low === "dgl") { sectionBlock[sec] = "DGL"; sectionPrio[sec] = null; }
      else if (low === "fællessang") { sectionBlock[sec] = "SANG"; sectionPrio[sec] = null; }

      if (low.includes("1. prioritet")) sectionPrio[sec] = 1;
      else if (low.includes("2. prioritet")) sectionPrio[sec] = 2;
    });

    Object.entries(colTeacherMap).forEach(([colIdxStr, info]) => {
      const colIdx = Number(colIdxStr);
      const val = (r[colIdx] || "").trim();
      if (!val) return;
      const sec = info.section, tid = info.tid, blkType = sectionBlock[sec];

      if (blkType === "DGL" && val.toLowerCase().startsWith("ja")) {
        if (!sem.dglConfig.wishes.includes(tid)) {
          sem.dglConfig.wishes.push(tid);
          countsBySem[tid] = (countsBySem[tid] || 0) + 1;
        }
        return;
      }
      if (blkType === "SANG" && val.toLowerCase().startsWith("ja")) {
        if (!sem.sangConfig.wishes.includes(tid)) {
          sem.sangConfig.wishes.push(tid);
          countsBySem[tid] = (countsBySem[tid] || 0) + 1;
        }
        return;
      }

      const prio = sectionPrio[sec];
      if (!prio || !blkType || blkType === "DGL" || blkType === "SANG") return;

      let lookupPeriod = sectionPeriod[sec] || (targetSem === "E2026" ? "E1" : "F1");
      if (targetSem === "F2026" && (blkType === "K" || blkType === "IN") && lookupPeriod === "F3") lookupPeriod = "F2";

      const targetBlock = blocks.find(b => b.id === `${lookupPeriod}_${blkType}`);
      if (!targetBlock) return;

      const cleanVal = cleanCourseTitle(val);
      targetBlock.courses.forEach(c => {
        const cleanC = cleanCourseTitle(c.name);
        if (cleanC && cleanVal && (cleanC.includes(cleanVal) || cleanVal.includes(cleanC))) {
          if (prio === 2) {
            if (!c.wishes2.includes(tid)) {
              c.wishes2.push(tid);
              countsBySem[tid] = (countsBySem[tid] || 0) + 1;
            }
          } else {
            if (!c.wishes1.includes(tid)) {
              c.wishes1.push(tid);
              countsBySem[tid] = (countsBySem[tid] || 0) + 1;
            }
          }
        }
      });
    });
  });

  lastCsvWishCounts[targetSem] = countsBySem;
}

function flashButtonFeedback(btn, label, isError = false) {
  if (!btn) return;
  if (!btn.dataset.origLabel) btn.dataset.origLabel = btn.textContent;
  btn.textContent = label;
  btn.style.borderColor = isError ? "var(--danger)" : "#10b981";
  btn.style.color = isError ? "#ff7675" : "#6ee7b7";
  clearTimeout(btn._flashTimer);
  btn._flashTimer = setTimeout(() => {
    btn.textContent = btn.dataset.origLabel;
    btn.style.borderColor = "";
    btn.style.color = "";
  }, 3000);
}

async function syncWishesFromUrls() {
  const urls = state.wishesUrls || {};
  const entries = Object.entries(urls).filter(([, u]) => u && u.trim() && !u.includes("INDSÆT_DIT"));
  const statusEl = document.getElementById("sync-wishes-status");
  const topBtn = document.getElementById("btn-sync-wishes");
  const tabBtn = document.getElementById("btn-save-and-sync-urls");

  if (entries.length === 0) {
    switchTab("import-wishes");
    if (statusEl) statusEl.textContent = "⚠️ Indsæt dine CSV-links herover først.";
    flashButtonFeedback(topBtn, "⚠️ Mangler links", true);
    return;
  }

  [topBtn, tabBtn].forEach(b => {
    if (!b) return;
    if (!b.dataset.origLabel) b.dataset.origLabel = b.textContent;
    b.disabled = true;
    b.textContent = "⏳ Henter ønsker...";
  });
  if (statusEl) statusEl.textContent = "Henter data fra Google Sheets...";

  try {
    const updated = [];
    for (const [semKey, url] of entries) {
      const sepChar = url.includes("?") ? "&" : "?";
      const res = await fetch(`${url.trim()}${sepChar}t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${semKey}`);
      applyWishesFromCsvText(await res.text(), semKey);
      updated.push(state.semesters[semKey].label);
    }
    saveState();
    renderAll();

    const timeStr = new Date().toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
    if (statusEl) statusEl.textContent = `✅ Ønsker opdateret kl. ${timeStr} (${updated.join(" & ")})`;
    flashButtonFeedback(topBtn, "✅ Ønsker opdateret!");
    flashButtonFeedback(tabBtn, "✅ Ønsker opdateret!");
  } catch (err) {
    if (statusEl) statusEl.textContent = `❌ Fejl: ${err.message}`;
    flashButtonFeedback(topBtn, "❌ Fejl ved hentning", true);
    flashButtonFeedback(tabBtn, "❌ Fejl ved hentning", true);
  } finally {
    [topBtn, tabBtn].forEach(b => { if (b) b.disabled = false; });
  }
}

const btnSyncWishes = document.getElementById("btn-sync-wishes");
if (btnSyncWishes) btnSyncWishes.onclick = syncWishesFromUrls;

const btnSaveAndSync = document.getElementById("btn-save-and-sync-urls");
if (btnSaveAndSync) {
  btnSaveAndSync.onclick = () => {
    state.wishesUrls = {
      E2026: document.getElementById("wishes-url-e2026")?.value.trim() || "",
      F2026: document.getElementById("wishes-url-f2026")?.value.trim() || ""
    };
    saveState();
    syncWishesFromUrls();
  };
}

const btnParseWishes = document.getElementById("btn-parse-wishes");
if (btnParseWishes) {
  btnParseWishes.onclick = () => {
    const text = document.getElementById("paste-wishes-area")?.value.trim() || "";
    const targetSem = document.getElementById("import-target-sem")?.value || "F2026";
    if (!text) return alert("Indsæt først data fra regnearket.");
    try {
      applyWishesFromCsvText(text, targetSem);
      saveState();
      renderAll();
      alert(`Lærerønsker for ${state.semesters[targetSem].label} er opdateret!`);
    } catch (err) {
      alert(err.message);
    }
  };
}

const csvWishesFile = document.getElementById("csv-wishes-file");
if (csvWishesFile) {
  csvWishesFile.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const area = document.getElementById("paste-wishes-area");
      if (area) area.value = reader.result;
    };
    reader.readAsText(file, "UTF-8");
  };
}

// ==========================================
// 7. KNAPPER: FORESLÅ, RYD, LÅS OP, EKSPORT & FIL-INDLÆSNING
// ==========================================
document.getElementById("btn-auto-assign").onclick = () => {
  runAutoAssign(state, currentSem);
  saveState();
  renderAll();
};

document.getElementById("btn-clear-unlocked").onclick = () => {
  clearUnlockedAssignments(state, currentSem);
  saveState();
  renderAll();
};

document.getElementById("btn-unlock-all").onclick = () => {
  if (!confirm("Vil du låse alle tildelinger op i dette semester?")) return;
  const sem = state.semesters[currentSem];
  sem.dglConfig.lockedSlots = [];
  sem.sangConfig.lockedSlots = [];
  getAllSemesterBlocks(sem).forEach(b => {
    b.courses.forEach(c => {
      (c.assignments || []).forEach(a => { a.locked = false; });
    });
  });
  saveState();
  renderAll();
};

document.getElementById("btn-export-plan").onclick = () => {
  const planOnly = {
    semesters: state.semesters,
    diagnosticsCollapsed: state.diagnosticsCollapsed
  };
  downloadJson(planOnly, `plan.json`);
};

const btnExportSettings = document.getElementById("btn-export-settings");
if (btnExportSettings) {
  btnExportSettings.onclick = () => {
    const settingsOnly = {
      wishesUrls: state.wishesUrls || { E2026: "", F2026: "" },
      teachers: state.teachers,
      specialTasks: state.specialTasks,
      competencies: normalizeAllCompetencies(state.competencies)
    };
    downloadJson(settingsOnly, `settings.json`);
  };
}

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

const inputImportJson = document.getElementById("input-import-json");
if (inputImportJson) {
  inputImportJson.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const statusEl = document.getElementById("import-json-status");
    if (statusEl) statusEl.textContent = `Indlæser ${file.name}...`;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed.semesters) {
          state.semesters = parsed.semesters;
          if (typeof parsed.diagnosticsCollapsed === "boolean") {
            state.diagnosticsCollapsed = parsed.diagnosticsCollapsed;
          }
          saveState();
          setDataSourceStatus("plan");
          if (statusEl) statusEl.textContent = `✅ Arbejdsplan indlæst`;
        } else {
          if (parsed.teachers) state.teachers = parsed.teachers;
          if (parsed.specialTasks) state.specialTasks = parsed.specialTasks;
          if (parsed.competencies) state.competencies = normalizeAllCompetencies(parsed.competencies);
          if (parsed.wishesUrls) state.wishesUrls = { ...state.wishesUrls, ...parsed.wishesUrls };
          saveState();
          setDataSourceStatus("settings");
          if (statusEl) statusEl.textContent = `✅ Indstillinger indlæst`;
        }
        renderAll();
        if (statusEl) setTimeout(() => { statusEl.textContent = "Ingen fil valgt"; }, 3000);
      } catch {
        if (statusEl) statusEl.textContent = `❌ Ugyldig JSON-fil`;
      }
    };
    reader.readAsText(file, "UTF-8");
  };
}

document.getElementById("btn-reset").onclick = async () => {
  if (!confirm("Vil du slette din lokale browser-kladde og hente 'plan.json' og 'settings.json' direkte fra mappen igen?")) return;
  const btn = document.getElementById("btn-reset");
  if (!btn.dataset.origLabel) btn.dataset.origLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "⏳ Henter filer...";

  localStorage.removeItem(STORAGE_KEY);
  state = await fetchFiles();
  diagnosticsCollapsed = state.diagnosticsCollapsed !== false;
  renderAll();

  btn.disabled = false;
  flashButtonFeedback(btn, "✅ Filer indlæst!");
};

function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === "tab-" + tabId));
}

document.querySelectorAll(".sem-btn").forEach(btn => {
  btn.onclick = () => {
    currentSem = btn.dataset.semester;
    renderAll();
  };
});

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.onclick = () => switchTab(btn.dataset.tab);
});

function renderAll() {
  document.querySelectorAll(".sem-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.semester === currentSem);
  });
  const uE = document.getElementById("wishes-url-e2026");
  const uF = document.getElementById("wishes-url-f2026");
  if (uE && state.wishesUrls) uE.value = state.wishesUrls.E2026 || "";
  if (uF && state.wishesUrls) uF.value = state.wishesUrls.F2026 || "";

  renderBoard();
  renderTeacherProfile();
  renderCompetencyMatrix();
  renderTeachersTab();
}

initApp();