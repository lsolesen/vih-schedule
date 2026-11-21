// js/solver.js
// Beregning af ugetimer pr. delfase (inkl. gennemgående DGL & Fællessang),
// periode-diagnostik, lås på lærertildelinger samt smart auto-fordeling.

export function normalizeCompetencyEntry(entry) {
  if (!entry) return { leads: [], primary: [], canTeach: [] };
  const leads = Array.isArray(entry.leads)
    ? [...entry.leads]
    : entry.lead
      ? [entry.lead]
      : [];
  const primary = (entry.primary || []).filter(t => !leads.includes(t));
  const canTeach = (entry.canTeach || []).filter(t => !leads.includes(t) && !primary.includes(t));
  return { leads, primary, canTeach };
}

export function getCompetencyLevel(competencies, courseName, teacherId) {
  const { leads, primary, canTeach } = normalizeCompetencyEntry(competencies[courseName]);
  if (leads.includes(teacherId)) return 3; // 👑 Hovedlærer
  if (primary.includes(teacherId)) return 2; // ★ Mest oplagt
  if (canTeach.includes(teacherId)) return 1; // ✓ Kan dække
  return 0;
}

export function getAllSemesterBlocks(sem) {
  if (sem.timelineBlocks) return sem.timelineBlocks;
  const list = [];
  (sem.periods || []).forEach(p => {
    p.blocks.forEach(b => list.push({ ...b, activePhases: p.activePhases }));
  });
  return list;
}

export function getCourseSharing(course) {
  let teacherCount = Number(course.teacherCount || 0);
  let splitType = course.splitType || "";

  if (!teacherCount) {
    if (course.mode === "three" || (course.assignments || []).length >= 3) teacherCount = 3;
    else if (course.requiresTwo || ["split", "double", "partial"].includes(course.mode) || (course.assignments || []).length === 2) teacherCount = 2;
    else teacherCount = 1;
  }

  if (!splitType) {
    if (course.mode === "double") splitType = "double";
    else if (course.mode === "partial") splitType = "partial";
    else if (course.mode === "split") splitType = "split";
    else if (course.requiresTwo) splitType = "double";
    else splitType = "split";
  }

  return { teacherCount, splitType };
}

export function getSlotDefaultHours(baseHours, teacherCount, splitType, slotIndex) {
  const h = Number(baseHours || 0);
  if (teacherCount <= 1) return h;
  if (splitType === "double") return h;
  if (splitType === "partial") {
    return slotIndex === 0 ? h : Math.round((h / 2) * 100) / 100;
  }
  return Math.round((h / teacherCount) * 100) / 100;
}

export function getTeacherBounds(teacher) {
  const ideal = Number(teacher.targetWeekly ?? 10.5);
  if (ideal === 0) {
    return { minAcceptable: 0, ideal: 0, maxAcceptable: 12 };
  }
  const ratio = ideal / 10.5;
  return {
    minAcceptable: Math.round(9.0 * ratio * 100) / 100,
    ideal,
    maxAcceptable: Math.round(12.0 * ratio * 100) / 100
  };
}

export function computeTeacherMetrics(state, semKey) {
  const sem = state.semesters[semKey];
  const phases = sem.phases;
  const metrics = {};

  state.teachers.forEach(t => {
    const specialUv = state.specialTasks
      .filter(st => st.sem === semKey && st.teachers.includes(t.id))
      .reduce((acc, st) => acc + st.uv, 0);

    const phaseHours = {};
    phases.forEach(ph => { phaseHours[ph.id] = 0; });

    metrics[t.id] = {
      teacher: t,
      bounds: getTeacherBounds(t),
      specialUv,
      continuousHours: 0,
      phaseHours,
      phaseStatus: {},
      avgWeekly: 0,
      conflicts: [],
      spikes: [],
      deficits: [],
      assignedCourses: []
    };
  });

  // 1. Gennemgående bånd: DGL (gælder hele semesteret)
  const dgl = sem.dglConfig || { hoursPerTeam: 3, teachers: [] };
  const dglHours = Number(dgl.hoursPerTeam ?? 3);
  (dgl.teachers || []).forEach(rawTid => {
    const tid = (rawTid || "").trim();
    if (!tid || !metrics[tid]) return;
    metrics[tid].continuousHours += dglHours;
    metrics[tid].assignedCourses.push({
      blockId: "CONT_DGL",
      name: "DGL (Det Gælder Livet)",
      blockName: "Gennemgående",
      phases: phases.map(p => p.label).join(", "),
      hours: dglHours
    });
  });

  // 2. Gennemgående bånd: Fællessang (gælder hele semesteret)
  const sang = sem.sangConfig || { weeklyHours: 1.5, splitHours: true, teachers: [] };
  const sangTotalHours = Number(sang.weeklyHours ?? 1.5);
  const activeSangTeachers = (sang.teachers || [])
    .map(t => (t || "").trim())
    .filter(tid => tid && metrics[tid]);

  if (activeSangTeachers.length > 0) {
    const perTeacher = sang.splitHours
      ? Math.round((sangTotalHours / activeSangTeachers.length) * 100) / 100
      : sangTotalHours;

    activeSangTeachers.forEach(tid => {
      metrics[tid].continuousHours += perTeacher;
      metrics[tid].assignedCourses.push({
        blockId: "CONT_SANG",
        name: "Fællessang",
        blockName: "Gennemgående",
        phases: phases.map(p => p.label).join(", "),
        hours: perTeacher
      });
    });
  }

  // Læg gennemgående timer (DGL + Fællessang) på ALLE delfaser i semesteret
  state.teachers.forEach(t => {
    const cont = metrics[t.id].continuousHours;
    if (cont > 0) {
      phases.forEach(ph => {
        metrics[t.id].phaseHours[ph.id] = (metrics[t.id].phaseHours[ph.id] || 0) + cont;
      });
    }
  });

  // 3. Blokfag i de enkelte delfaser
  const blocks = getAllSemesterBlocks(sem);
  blocks.forEach(block => {
    const seenInBlock = {};
    block.courses.forEach(course => {
      if (course.isCanceled) return;

      course.assignments.forEach(a => {
        const m = metrics[a.teacher];
        if (!m) return;

        (block.activePhases || []).forEach(phId => {
          m.phaseHours[phId] = (m.phaseHours[phId] || 0) + Number(a.hours || 0);
          if ((m.teacher.leavePhases?.[semKey] || []).includes(phId)) {
            m.conflicts.push(`${block.name}: ${a.teacher} har orlov i ${phId}`);
          }
        });

        if (seenInBlock[a.teacher]) {
          m.conflicts.push(`${block.name}: Dobbeltbooket i samme blok`);
        }
        seenInBlock[a.teacher] = true;

        const phaseLabels = phases
          .filter(p => (block.activePhases || []).includes(p.id))
          .map(p => p.label)
          .join(" + ");

        m.assignedCourses.push({
          blockId: block.id,
          name: course.name,
          blockName: block.name,
          phases: phaseLabels,
          hours: Number(a.hours || 0)
        });
      });
    });
  });

  // 4. Vægtet gennemsnit & periode-status ud fra 9–12t spændet
  const totalWeight = phases.reduce((acc, p) => acc + p.weight, 0);
  state.teachers.forEach(t => {
    const m = metrics[t.id];
    const weightedSum = phases.reduce((acc, p) => acc + (m.phaseHours[p.id] || 0) * p.weight, 0);
    m.avgWeekly = weightedSum / totalWeight;

    const leaveList = t.leavePhases?.[semKey] || [];
    phases.forEach(ph => {
      const hrs = m.phaseHours[ph.id] || 0;
      if (leaveList.includes(ph.id)) {
        m.phaseStatus[ph.id] = "leave";
      } else if (hrs > m.bounds.maxAcceptable + 0.05) {
        m.phaseStatus[ph.id] = "over";
        m.spikes.push({ phase: ph.label, hours: hrs, max: m.bounds.maxAcceptable });
      } else if (hrs < m.bounds.minAcceptable - 0.05) {
        m.phaseStatus[ph.id] = "under";
        m.deficits.push({ phase: ph.label, hours: hrs, min: m.bounds.minAcceptable });
      } else {
        m.phaseStatus[ph.id] = "ok";
      }
    });
  });

  return metrics;
}

export function clearUnlockedAssignments(state, semKey) {
  const sem = state.semesters[semKey];
  const blocks = getAllSemesterBlocks(sem);

  blocks.forEach(b => {
    const isInspiration = (b.id || "").endsWith("_IN") || (b.name || "").toLowerCase().includes("inspiration");
    b.courses.forEach(c => {
      if (c.locked || c.isCanceled) return;
      c.assignments = (c.assignments || []).filter(a => !!a.locked);
      if (c.assignments.length === 0 && (c.autoSplit || isInspiration)) {
        c.teacherCount = 1;
        c.splitType = "split";
        c.mode = "single";
        delete c.autoSplit;
      }
    });
  });

  const dgl = sem.dglConfig;
  dgl.lockedSlots = dgl.lockedSlots || [];
  dgl.teachers = (dgl.teachers || []).map((tid, idx) => (dgl.lockedSlots[idx] ? tid : ""));

  const sang = sem.sangConfig;
  sang.lockedSlots = sang.lockedSlots || [];
  sang.teachers = (sang.teachers || []).map((tid, idx) => (sang.lockedSlots[idx] ? tid : ""));
}

export function runAutoAssign(state, semKey) {
  const sem = state.semesters[semKey];
  const blocks = getAllSemesterBlocks(sem);

  clearUnlockedAssignments(state, semKey);

  // Registrér lærere der allerede er låst fast på fag i de enkelte blokke
  const busyByBlock = {};
  blocks.forEach(b => {
    busyByBlock[b.id] = new Set();
    b.courses.forEach(c => {
      (c.assignments || []).forEach(a => {
        if (a.locked) busyByBlock[b.id].add(a.teacher);
      });
    });
  });

  // 1. DGL
  const dgl = sem.dglConfig;
  const usedInDgl = new Set((dgl.teachers || []).filter(Boolean));
  const dglCandidates = state.teachers
    .filter(t => !usedInDgl.has(t.id) && !t.locked && (t.leavePhases?.[semKey] || []).length === 0)
    .map(t => {
      const compLvl = getCompetencyLevel(state.competencies, "DGL", t.id);
      const hasWish = (dgl.wishes || []).includes(t.id) ? 1 : 0;
      if (compLvl === 0 && hasWish === 0) return { id: t.id, score: -999 };
      const synergy = (compLvl >= 2 && hasWish === 1) ? 12 : 0;
      return { id: t.id, score: (compLvl * 11) + (hasWish * 13) + synergy + t.targetWeekly };
    })
    .filter(x => x.score > -999)
    .sort((a, b) => b.score - a.score);

  let dglPtr = 0;
  for (let i = 0; i < dgl.teamCount; i++) {
    if (!dgl.teachers[i]) {
      const nextId = dglCandidates[dglPtr++]?.id || "";
      dgl.teachers[i] = nextId;
      if (nextId) usedInDgl.add(nextId);
    }
  }

  // 2. Fællessang
  const sang = sem.sangConfig;
  const usedInSang = new Set((sang.teachers || []).filter(Boolean));
  const sangCandidates = state.teachers
    .filter(t => !usedInSang.has(t.id) && !t.locked && (t.leavePhases?.[semKey] || []).length === 0)
    .map(t => {
      const compLvl = getCompetencyLevel(state.competencies, "Fællessang", t.id);
      const hasWish = (sang.wishes || []).includes(t.id) ? 1 : 0;
      if (compLvl === 0 && hasWish === 0) return { id: t.id, score: -999 };
      const synergy = (compLvl >= 2 && hasWish === 1) ? 12 : 0;
      return { id: t.id, score: (compLvl * 11) + (hasWish * 13) + synergy + t.targetWeekly };
    })
    .filter(x => x.score > -999)
    .sort((a, b) => b.score - a.score);

  let sangPtr = 0;
  for (let i = 0; i < sang.teacherCount; i++) {
    if (!sang.teachers[i]) {
      const nextId = sangCandidates[sangPtr++]?.id || "";
      sang.teachers[i] = nextId;
      if (nextId) usedInSang.add(nextId);
    }
  }

  // 3. Blokfag
  const openSlots = [];
  blocks.forEach(b => {
    b.courses.forEach(c => {
      if (c.isCanceled || c.locked) return;
      const { teacherCount, splitType } = getCourseSharing(c);
      if ((c.assignments || []).length < teacherCount) {
        openSlots.push({ block: b, course: c, needed: teacherCount, splitType });
      }
    });
  });

  openSlots.sort((a, b) => {
    const compA = normalizeCompetencyEntry(state.competencies[a.course.name]);
    const compB = normalizeCompetencyEntry(state.competencies[b.course.name]);
    const topA = compA.leads.some(tid => (a.course.wishes1 || []).includes(tid)) ? 1 : 0;
    const topB = compB.leads.some(tid => (b.course.wishes1 || []).includes(tid)) ? 1 : 0;
    if (topA !== topB) return topB - topA;
    return (a.course.wishes1 || []).length - (b.course.wishes1 || []).length;
  });

  function scoreCandidateForHours(teacher, block, course, addedHours, metrics) {
    if (teacher.locked) return -999;
    const leave = teacher.leavePhases?.[semKey] || [];
    if ((block.activePhases || []).some(ph => leave.includes(ph))) return -999;
    if (busyByBlock[block.id].has(teacher.id)) return -999;

    const compLvl = getCompetencyLevel(state.competencies, course.name, teacher.id);
    if (compLvl === 0) return -999; // Kræver mindst ✓ (niveau 1) i kompetencematrixen

    const w1 = (course.wishes1 || []).includes(teacher.id) ? 1 : 0;
    const w2 = (course.wishes2 || []).includes(teacher.id) ? 1 : 0;
    if (compLvl === 0 && w1 === 0 && w2 === 0) return -999;

    const m = metrics[teacher.id];
    let phaseScore = 0;
    for (const phId of (block.activePhases || [])) {
      const projected = (m.phaseHours[phId] || 0) + addedHours;
      if (projected > m.bounds.maxAcceptable + 0.05) return -999;
      const dist = Math.abs(projected - m.bounds.ideal);
      if (projected >= m.bounds.minAcceptable - 0.05 && projected <= m.bounds.maxAcceptable + 0.05) {
        phaseScore += 16 - (dist * 4);
      } else {
        phaseScore += 6 - (dist * 3);
      }
    }
    phaseScore /= Math.max(1, (block.activePhases || []).length);
    const synergy = (compLvl >= 2 && w1 === 1) ? 14 : (compLvl >= 1 && w1 === 1) ? 6 : 0;
    return (compLvl * 11) + (w1 * 13) + (w2 * 5) + synergy + phaseScore;
  }

  const deferredForSplit = [];

  openSlots.forEach(({ block, course, needed, splitType }) => {
    const metrics = computeTeacherMetrics(state, semKey);

    if (needed >= 2) {
      while (course.assignments.length < needed) {
        const slotIdx = course.assignments.length;
        const slotHours = getSlotDefaultHours(course.hours, needed, splitType, slotIdx);
        let bestId = null, bestScore = -999;
        state.teachers.forEach(t => {
          const sc = scoreCandidateForHours(t, block, course, slotHours, metrics);
          if (sc > bestScore) { bestScore = sc; bestId = t.id; }
        });
        if (!bestId) break;
        course.assignments.push({ teacher: bestId, hours: slotHours, locked: false });
        busyByBlock[block.id].add(bestId);
      }
      return;
    }

    let bestId = null, bestScore = -999;
    state.teachers.forEach(t => {
      const sc = scoreCandidateForHours(t, block, course, course.hours, metrics);
      if (sc > bestScore) { bestScore = sc; bestId = t.id; }
    });

    if (bestId) {
      course.assignments.push({ teacher: bestId, hours: course.hours, locked: false });
      busyByBlock[block.id].add(bestId);
    } else {
      const isInspiration = (block.id || "").endsWith("_IN") || (block.name || "").toLowerCase().includes("inspiration");
      if (!isInspiration) {
        deferredForSplit.push({ block, course });
      }
    }
  });

  deferredForSplit.forEach(({ block, course }) => {
    if (course.assignments.length > 0) return;
    const metrics = computeTeacherMetrics(state, semKey);
    const halfHours = Math.round((course.hours / 2) * 100) / 100;
    const picked = [];

    for (let i = 0; i < 2; i++) {
      let bestId = null, bestScore = -999;
      state.teachers.forEach(t => {
        if (picked.includes(t.id)) return;
        const sc = scoreCandidateForHours(t, block, course, halfHours, metrics);
        if (sc > bestScore) { bestScore = sc; bestId = t.id; }
      });
      if (bestId) picked.push(bestId);
    }

    if (picked.length > 0) {
      course.teacherCount = 2;
      course.splitType = "split";
      course.mode = "split";
      course.autoSplit = true;
      course.assignments = picked.map(tid => ({ teacher: tid, hours: halfHours, locked: false }));
      picked.forEach(tid => busyByBlock[block.id].add(tid));
    }
  });
}