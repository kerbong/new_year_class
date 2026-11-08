// 1. 자동배분
// 이미 나뉜 반(Z/ㄹ 방식 분반 결과)을 기준으로, 학생을 교환·이동해서 균형을 맞춘다.
//
// 교환 규칙: 옮겨야 하는 학생은 "비고(특수/그룹/생활지도 등)가 없는 학생"과 맞바꾼다.
//   맞바꿀 학생은 옮기는 학생과 같은 현재반(exClass) + 같은 성별 + 점수가 가장 비슷한 학생을 먼저 찾는다.
//   (없으면 같은 성별 중 점수가 가장 비슷한 학생)
//
// 우선순위 (점수가 클수록 먼저 맞춘다)
//   1) 같은 반이면 안 되는 학생(그룹N), 쌍둥이 같은 반/다른 반
//   2) 특수(특수반) 학생 고르게
//   3) 굿 / 배드 고르게
//   4) 생활지도·학부모(상3 중2 하1), 학습부진·다문화·전출 고르게
// 그 다음 인원수(전출 제외, 특수 학생이 있는 반은 1명 적게) → 성비 → 반별 평균 점수 순서로 맞춘다.

const noteOf = (s) => String(s?.note || "");
const has = (s, w) => noteOf(s).includes(w);

export const isSpecial = (s) => has(s, "특수");
export const isTransfer = (s) => has(s, "전출");
export const isTwin = (s) => has(s, "쌍둥이") || has(s, "쌍생아");
const isGood = (s) => String(s?.teamWork || "").includes("굿");
const isBad = (s) => String(s?.teamWork || "").includes("배드");
// "그룹1"과 "그룹10"을 구분하기 위해 정확히 잘라서 비교 (자주 불리므로 비고 문자열별로 기억)
const groupCache = new Map();
const groupsOf = (s) => {
  const n = noteOf(s);
  if (!groupCache.has(n)) {
    groupCache.set(n, [...new Set(n.match(/그룹\d+/g) || [])]);
  }
  return groupCache.get(n);
};

const levelWeight = (s, label) => {
  const n = noteOf(s);
  if (!n.includes(label)) return 0;
  if (n.includes(`${label}-상`)) return 3;
  if (n.includes(`${label}-하`)) return 1;
  return 2; // 중 또는 단계 표시 없음
};

const CATEGORIES = [
  { name: "특수", weight: 1000, value: (s) => (isSpecial(s) ? 1 : 0) },
  { name: "굿", weight: 100, value: (s) => (isGood(s) ? 1 : 0) },
  { name: "배드", weight: 100, value: (s) => (isBad(s) ? 1 : 0) },
  { name: "생활지도", weight: 50, value: (s) => levelWeight(s, "생활지도") },
  { name: "학부모", weight: 50, value: (s) => levelWeight(s, "학부모") },
  { name: "학습부진", weight: 30, value: (s) => (has(s, "학습부진") ? 1 : 0) },
  { name: "다문화", weight: 30, value: (s) => (has(s, "다문화") ? 1 : 0) },
  { name: "전출", weight: 30, value: (s) => (isTransfer(s) ? 1 : 0) },
];
const CONFLICT_COST = 100000;
const MAX_LOOPS = 5000;

export const studentKey = (s) => `${s.exClass}-${s.num}-${s.name}`;

/** 교환 상대가 될 수 있는 학생: 배치에 영향을 주는 표시가 하나도 없는 학생 */
const isFree = (s) =>
  !isTwin(s) &&
  groupsOf(s).length === 0 &&
  CATEGORIES.every((c) => c.value(s) === 0);

const scoreOf = (s) => Number(s?.score) || 0;

/**
 * 비고에 '쌍둥이'가 있는 학생들을 짝지어 묶는다.
 * - 비고에 '쌍둥이1'처럼 번호가 있으면 같은 번호끼리
 * - 아니면 성(이름 첫 글자) + 생년월일이 같은 학생끼리
 * - 생년월일이 없으면 성이 같은 학생끼리 (같은 성이 4명 이상이면 짝을 알 수 없음)
 * @returns {{groups: Array<Array<object>>, unmatched: Array<object>}}
 */
export function findTwinGroups(classes) {
  const twins = classes.flat().filter((s) => s && isTwin(s));
  const buckets = new Map();
  const put = (key, s) => {
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(s);
  };

  twins.forEach((s) => {
    const id = noteOf(s).match(/(?:쌍둥이|쌍생아)\s*(\d+)/);
    const bday = s.birthday && s.birthday !== "-" ? s.birthday : "";
    const surname = String(s.name || "").charAt(0);
    put(id ? `id:${id[1]}` : `nb:${surname}|${bday}`, s);
  });

  const groups = [];
  const leftovers = [];
  const unmatched = [];
  buckets.forEach((list, key) => {
    if (list.length >= 2) groups.push(list);
    // 번호를 적었는데 짝이 없으면 다른 학생과 함부로 묶지 않는다
    else if (key.startsWith("id:")) unmatched.push(...list);
    else leftovers.push(...list);
  });

  // 한쪽만 생년월일이 있는 경우 등: 남은 학생끼리 성만으로 다시 묶기
  const bySurname = new Map();
  leftovers.forEach((s) => {
    const key = String(s.name || "").charAt(0);
    if (!bySurname.has(key)) bySurname.set(key, []);
    bySurname.get(key).push(s);
  });
  bySurname.forEach((list) => {
    if (list.length >= 2 && list.length <= 3) groups.push(list);
    else unmatched.push(...list);
  });

  return { groups, unmatched };
}

/**
 * @param {Array<Array<object>>} input 반별 학생 배열 (학생 객체는 그대로 재사용하므로 미리 깊은 복사해서 넘길 것)
 * @param {{twinRules?: Array<{members: string[], mode: "same"|"apart"|"none"}>}} options
 *   members는 studentKey() 값
 */
export function autoDistribute(input, { twinRules = [], classNames = [] } = {}) {
  const classes = input.map((cl) => (cl || []).filter(Boolean));
  const K = classes.length;
  const nameOf = (i) => (classNames[i] ? `${classNames[i]}반` : `${i + 1}번째 반`);
  const report = { swaps: 0, moves: 0, genderSwaps: 0, warnings: [] };
  if (K < 2) return { classes, report };

  // 학생 → 반 번호
  const where = new Map();
  classes.forEach((cl, i) => cl.forEach((s) => where.set(s, i)));

  // 쌍둥이 규칙: 학생 → { mode, studs }
  const byKey = new Map();
  classes.flat().forEach((s) => byKey.set(studentKey(s), s));
  const ruleOf = new Map();
  twinRules.forEach((rule) => {
    if (rule.mode !== "same" && rule.mode !== "apart") return;
    const studs = rule.members.map((k) => byKey.get(k)).filter(Boolean);
    if (studs.length < 2) return;
    const r = { mode: rule.mode, studs };
    studs.forEach((s) => ruleOf.set(s, r));
  });

  // 학생 s가 반 i에 있을 때 생기는 충돌 수 (그룹 겹침 + 쌍둥이 규칙 위반)
  const conflictAt = (s, i) => {
    let c = 0;
    const gs = groupsOf(s);
    if (gs.length) {
      classes[i].forEach((o) => {
        if (o === s) return;
        const og = groupsOf(o);
        gs.forEach((g) => {
          if (og.includes(g)) c++;
        });
      });
    }
    const rule = ruleOf.get(s);
    if (rule) {
      rule.studs.forEach((o) => {
        if (o === s) return;
        const oi = where.get(o);
        if (rule.mode === "apart" && oi === i) c++;
        if (rule.mode === "same" && oi !== i) c++;
      });
    }
    return c;
  };

  // 교환 상대 찾기: 같은 현재반 + 같은 성별 → 같은 성별 → (허용 시) 아무나, 점수 가까운 순
  const findPartner = (s, toIdx, allowCrossGender) => {
    let best = null;
    let bestRank = Infinity;
    classes[toIdx].forEach((p, idx) => {
      if (!isFree(p)) return;
      const sameGender = p.gender === s.gender;
      if (!sameGender && !allowCrossGender) return;
      const tier = sameGender ? (p.exClass === s.exClass ? 0 : 1) : 2;
      const rank = tier * 1e6 + Math.abs(scoreOf(p) - scoreOf(s));
      if (rank < bestRank) {
        bestRank = rank;
        best = idx;
      }
    });
    return best;
  };

  // 학생 s(a반)와 비고 있는 학생 p(b반)를 맞바꿀 때 가장 좋은 상대 (나빠지면 null)
  const bestTaggedPartner = (s, a, sIdx, b, counts, allowCrossGender) => {
    const ts = CATEGORIES.map((c) => c.value(s));
    let best = null;
    classes[b].forEach((p, pIdx) => {
      if (isFree(p)) return;
      const sameGender = p.gender === s.gender;
      if (!sameGender && !allowCrossGender) return;
      const tp = CATEGORIES.map((c) => c.value(p));
      let delta = 0;
      CATEGORIES.forEach((c, k) => {
        const cA = counts[k][a];
        const cB = counts[k][b];
        const nA = cA - ts[k] + tp[k];
        const nB = cB + ts[k] - tp[k];
        delta += c.weight * (nA * nA + nB * nB - cA * cA - cB * cB);
      });
      // 충돌은 실제로 바꿔본 뒤 세고 되돌린다
      const before = conflictAt(s, a) + conflictAt(p, b);
      classes[a][sIdx] = p;
      classes[b][pIdx] = s;
      where.set(s, b);
      where.set(p, a);
      const after = conflictAt(s, b) + conflictAt(p, a);
      classes[a][sIdx] = s;
      classes[b][pIdx] = p;
      where.set(s, a);
      where.set(p, b);
      delta += CONFLICT_COST * (after - before);
      // 같은 성별·같은 현재반·점수 비슷한 상대를 아주 조금 더 선호
      const tie =
        (sameGender ? 0 : 1e-3) +
        (p.exClass === s.exClass ? 0 : 1e-4) +
        Math.abs(scoreOf(p) - scoreOf(s)) * 1e-7;
      if (delta < -1e-9 && (!best || delta + tie < best.rank)) {
        best = { delta, rank: delta + tie, pIdx };
      }
    });
    return best;
  };

  // ===== 1단계: 그룹·쌍둥이·특수·굿/배드·생활지도 등 (교환만 하므로 반별 인원·성비는 그대로) =====
  for (let loop = 0; loop < MAX_LOOPS; loop++) {
    const counts = CATEGORIES.map((c) =>
      classes.map((cl) => cl.reduce((sum, s) => sum + c.value(s), 0))
    );

    let best = null;
    classes.forEach((cl, a) => {
      cl.forEach((s, sIdx) => {
        if (isFree(s)) return;
        const values = CATEGORIES.map((c) => c.value(s));
        const conflictHere = conflictAt(s, a);
        for (let b = 0; b < K; b++) {
          if (b === a) continue;
          // 제곱합 기준 변화량: w * 2t(t + cB - cA)
          let delta = 0;
          let specialGain = 0;
          values.forEach((t, k) => {
            if (!t) return;
            const d = CATEGORIES[k].weight * 2 * t * (t + counts[k][b] - counts[k][a]);
            delta += d;
            if (k === 0) specialGain = d;
          });
          const conflictDelta = conflictAt(s, b) - conflictHere;
          delta += CONFLICT_COST * conflictDelta;
          if (delta >= -1e-9 || (best && delta >= best.delta)) continue;

          const mustFix = conflictDelta < 0 || specialGain < 0;
          let pIdx = findPartner(s, b, false);
          // 같은 성별 상대가 없어도 그룹/쌍둥이/특수는 꼭 맞춘다 (성비는 3단계에서 다시 맞춤)
          if (pIdx === null && mustFix) pIdx = findPartner(s, b, true);
          if (pIdx !== null) {
            best = { delta, a, b, sIdx, pIdx };
            continue;
          }

          // 비고 없는 학생이 없으면: 비고 있는 학생과 맞바꿨을 때의 효과를 직접 계산
          const alt = bestTaggedPartner(s, a, sIdx, b, counts, mustFix);
          if (alt && (!best || alt.delta < best.delta)) {
            best = { delta: alt.delta, a, b, sIdx, pIdx: alt.pIdx };
          }
        }
      });
    });

    if (!best) break;
    const s = classes[best.a][best.sIdx];
    const p = classes[best.b][best.pIdx];
    classes[best.a][best.sIdx] = p;
    classes[best.b][best.pIdx] = s;
    where.set(s, best.b);
    where.set(p, best.a);
    report.swaps++;
  }

  // ===== 2단계: 인원수 (전출 제외, 특수 학생 수만큼 그 반 정원을 줄임) =====
  const active = (s) => !isTransfer(s);
  const activeAll = classes.flat().filter(active);
  const meanScore =
    activeAll.reduce((sum, s) => sum + scoreOf(s), 0) / (activeAll.length || 1);

  const sizeOf = (i) => classes[i].filter(active).length;
  const specialCount = classes.map(
    (cl) => cl.filter((s) => active(s) && isSpecial(s)).length
  );
  const effTotal =
    activeAll.length + specialCount.reduce((a, b) => a + b, 0);
  const base = Math.floor(effTotal / K);
  const rem = effTotal % K;
  // 남는 인원은 특수 학생이 없는 반부터, 지금 인원이 많은 반부터 받는다 (이동 최소화)
  const order = [...Array(K).keys()].sort((x, y) => {
    if ((specialCount[x] > 0) !== (specialCount[y] > 0))
      return specialCount[x] > 0 ? 1 : -1;
    return sizeOf(y) + specialCount[y] - (sizeOf(x) + specialCount[x]);
  });
  const target = Array(K).fill(0);
  order.forEach((i, rank) => {
    target[i] = base + (rank < rem ? 1 : 0) - specialCount[i];
  });

  const stuck = new Set(); // 옮길 학생이 없는 반
  for (let loop = 0; loop < MAX_LOOPS; loop++) {
    let a = -1;
    let b = -1;
    for (let i = 0; i < K; i++) {
      const diff = sizeOf(i) - target[i];
      if (diff > 0 && !stuck.has(i) && (a === -1 || diff > sizeOf(a) - target[a])) a = i;
      if (diff < 0 && (b === -1 || diff < sizeOf(b) - target[b])) b = i;
    }
    if (a === -1 || b === -1) break;

    const maleRatio = (i) => {
      const act = classes[i].filter(active);
      return act.filter((s) => s.gender === "남").length / (act.length || 1);
    };
    const preferGender = maleRatio(a) >= maleRatio(b) ? "남" : "여";
    const candidates = classes[a]
      .map((s, idx) => ({ s, idx }))
      .filter(({ s }) => isFree(s) && active(s));
    if (!candidates.length) {
      stuck.add(a);
      report.warnings.push(
        `${nameOf(a)}에 옮길 수 있는 학생(비고 없는 학생)이 없어 인원수를 다 맞추지 못했습니다.`
      );
      continue;
    }
    // 이 반에 더 많이 와 있는 현재반 출신을 옮겨서, 현재반 섞임이 덜 흐트러지게
    const exCount = (i, ex) => classes[i].filter((o) => o.exClass === ex).length;
    const surplus = (st) => exCount(a, st.exClass) - exCount(b, st.exClass);
    candidates.sort((x, y) => {
      const gx = x.s.gender === preferGender ? 0 : 1;
      const gy = y.s.gender === preferGender ? 0 : 1;
      if (gx !== gy) return gx - gy;
      const sx = surplus(x.s);
      const sy = surplus(y.s);
      if (sx !== sy) return sy - sx;
      return Math.abs(scoreOf(x.s) - meanScore) - Math.abs(scoreOf(y.s) - meanScore);
    });
    const { s, idx } = candidates[0];
    classes[a].splice(idx, 1);
    classes[b].push(s);
    where.set(s, b);
    report.moves++;
  }

  // ===== 3단계: 성비 (비고 없는 학생끼리, 같은 현재반·점수 비슷한 남↔여 교환) =====
  const totalMale = activeAll.filter((s) => s.gender === "남").length;
  const maleDiff = (i) => {
    const act = classes[i].filter(active);
    const male = act.filter((s) => s.gender === "남").length;
    return male - (act.length * totalMale) / (activeAll.length || 1);
  };

  for (let loop = 0; loop < MAX_LOOPS; loop++) {
    const diffs = classes.map((_, i) => maleDiff(i));
    // 남학생이 많은 반(a) ↔ 적은 반(b) 쌍을 차이가 큰 순서대로 시도
    const pairs = [];
    for (let a = 0; a < K; a++)
      for (let b = 0; b < K; b++)
        if (diffs[a] - diffs[b] > 1) pairs.push([a, b, diffs[a] - diffs[b]]);
    pairs.sort((x, y) => y[2] - x[2]);

    let done = false;
    for (const [a, b] of pairs) {
      let best = null;
      classes[a].forEach((m, mi) => {
        if (m.gender !== "남" || !isFree(m) || !active(m)) return;
        classes[b].forEach((f, fi) => {
          if (f.gender !== "여" || !isFree(f) || !active(f)) return;
          const rank =
            (m.exClass === f.exClass ? 0 : 1e6) + Math.abs(scoreOf(m) - scoreOf(f));
          if (!best || rank < best.rank) best = { rank, mi, fi };
        });
      });
      if (!best) continue;
      const m = classes[a][best.mi];
      const f = classes[b][best.fi];
      classes[a][best.mi] = f;
      classes[b][best.fi] = m;
      where.set(m, b);
      where.set(f, a);
      report.genderSwaps++;
      done = true;
      break;
    }
    if (!done) break;
  }

  // ===== 4단계: 반별 평균 점수 (비고 없는 같은 성별끼리 교환, 같은 현재반 우선) =====
  const sumOf = (i) =>
    classes[i].filter(active).reduce((sum, s) => sum + scoreOf(s), 0);
  for (let loop = 0; loop < 500; loop++) {
    // 목표 대비 점수 합 차이 (양수: 점수가 높은 반)
    const dev = classes.map((_, i) => sumOf(i) - sizeOf(i) * meanScore);
    let best = null;
    for (let a = 0; a < K; a++) {
      for (let b = 0; b < K; b++) {
        if (dev[a] <= dev[b]) continue;
        for (let xi = 0; xi < classes[a].length; xi++) {
          const x = classes[a][xi];
          if (!isFree(x) || !active(x)) continue;
          for (let yi = 0; yi < classes[b].length; yi++) {
            const y = classes[b][yi];
            // 같은 현재반·같은 성별끼리만 바꿔서 현재반 섞임과 성비를 그대로 둔다
            if (y.gender !== x.gender || y.exClass !== x.exClass) continue;
            if (!isFree(y) || !active(y)) continue;
            const d = scoreOf(x) - scoreOf(y);
            if (d <= 0) continue;
            // 교환 후 제곱합 변화량
            const delta =
              (dev[a] - d) ** 2 + (dev[b] + d) ** 2 - dev[a] ** 2 - dev[b] ** 2;
            if (delta < -1e-9 && (!best || delta < best.delta))
              best = { delta, a, b, xi, yi };
          }
        }
      }
    }
    // 반 평균 차이가 0.5점 이하로 줄면 충분
    const avgs = classes.map((_, i) => sumOf(i) / (sizeOf(i) || 1));
    if (!best || Math.max(...avgs) - Math.min(...avgs) <= 0.5) break;
    const x = classes[best.a][best.xi];
    const y = classes[best.b][best.yi];
    classes[best.a][best.xi] = y;
    classes[best.b][best.yi] = x;
    where.set(x, best.b);
    where.set(y, best.a);
    report.scoreSwaps = (report.scoreSwaps || 0) + 1;
  }

  // ===== 남은 문제 정리 =====
  const seen = new Set();
  classes.forEach((cl, i) => {
    cl.forEach((s) => {
      groupsOf(s).forEach((g) => {
        const key = `${i}-${g}`;
        if (seen.has(key)) return;
        const same = cl.filter((o) => groupsOf(o).includes(g));
        if (same.length > 1) {
          seen.add(key);
          report.warnings.push(
            `${g} 학생이 같은 반에 있습니다: ${same.map((o) => o.name).join(", ")}`
          );
        }
      });
    });
  });
  new Set(ruleOf.values()).forEach((rule) => {
    const idxs = rule.studs.map((s) => where.get(s));
    const names = rule.studs.map((s) => s.name).join(", ");
    if (rule.mode === "same" && new Set(idxs).size > 1)
      report.warnings.push(`쌍둥이(${names})를 같은 반에 넣지 못했습니다.`);
    if (rule.mode === "apart" && new Set(idxs).size < idxs.length)
      report.warnings.push(`쌍둥이(${names})를 다른 반으로 떼어놓지 못했습니다.`);
  });

  const specials = classes.map((cl) => cl.filter(isSpecial).length);
  if (Math.max(...specials) - Math.min(...specials) > 1)
    report.warnings.push(
      "특수 학생을 고르게 나누지 못했습니다. (맞바꿀 수 있는 비고 없는 학생이 부족해요)"
    );

  report.stats = classes.map((cl) => {
    const act = cl.filter(active);
    return {
      size: act.length,
      male: act.filter((s) => s.gender === "남").length,
      female: act.filter((s) => s.gender === "여").length,
      special: cl.filter(isSpecial).length,
      transfer: cl.filter(isTransfer).length,
    };
  });

  return { classes, report };
}
