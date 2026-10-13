import { read, utils } from "xlsx";

// 학생 자료가 아닌 시트(설명서, 작성예시 등)는 이름으로 건너뛰기
const SKIP_SHEET_PATTERN = /설명|예시|안내|사용법|목록/;

// 머리글 별칭 (공백, 괄호 안 내용은 무시하고 비교)
const COMMON_ALIASES = {
  name: ["이름", "성명", "학생명", "학생이름"],
  gender: ["성별", "성"],
  birthday: ["생년월일", "생일"],
  score: ["총점", "점수", "성적", "합계"],
  note: ["비고", "특이사항"],
  teamWork: ["협동", "협동성"],
  guidance: ["생활지도"],
  parent: ["학부모"],
  slow: ["학습부진"],
  special: ["특수반", "특수"],
  multi: ["다문화"],
  twin: ["쌍둥이", "쌍생아"],
  transfer: ["전출", "전출예정"],
  group: ["그룹", "분리그룹"],
};

const NEW_ALIASES = {
  ...COMMON_ALIASES,
  exClass: ["반", "학급", "현재반"],
  num: ["번호", "현재번호"],
};

// 이어하기(명렬표)는 반/번호가 내년 기준이라 이전반/이전번호를 사용
const SAVED_ALIASES = {
  ...COMMON_ALIASES,
  exClass: ["이전반"],
  num: ["이전번호"],
  grade: ["학년"],
};

const GENDER_MAP = {
  남: "남",
  남자: "남",
  남성: "남",
  남학생: "남",
  m: "남",
  male: "남",
  boy: "남",
  man: "남",
  여: "여",
  여자: "여",
  여성: "여",
  여학생: "여",
  f: "여",
  female: "여",
  girl: "여",
  w: "여",
  woman: "여",
};

const TEAMWORK_MAP = {
  굿: "굿",
  good: "굿",
  에이스: "굿",
  배드: "배드",
  bad: "배드",
};

// 체크 열(학습부진 등)에서 "해당 없음"으로 보는 값
const FALSY_MARKS = ["x", "n", "no", "false", "0", "-", "아니오", "아니요", "해당없음", "없음"];

// 보이지 않는 문자, 양쪽 공백 제거
export function cleanString(v) {
  if (v === undefined || v === null) return "";
  return String(v)
    .replace(/[​-‍﻿]/g, "") // 제로폭 문자 제거
    .replace(/ /g, " ") // 줄바꿈 없는 공백
    .replace(/\s+/g, " ") // 중복 공백 정리
    .trim();
}

function normalizeHeader(v) {
  return cleanString(v)
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/[\s*※]/g, "");
}

function toInt(v) {
  const m = cleanString(v).match(/\d+/);
  return m ? Number(m[0]) : null;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatYmd(y, m, d) {
  y = Number(y);
  m = Number(m);
  d = Number(d);
  // 두 자리 연도: 올해보다 크면 1900년대
  if (y < 100) y += y <= new Date().getFullYear() % 100 ? 2000 : 1900;
  const date = new Date(Date.UTC(y, m - 1, d));
  // 2월 30일처럼 없는 날짜 걸러내기
  if (
    y < 1900 ||
    y > 2100 ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return `${y}.${pad2(m)}.${pad2(d)}`;
}

// 엑셀 날짜 일련번호 (2000년 ~ 2050년)
function fromSerial(n) {
  if (n < 36526 || n > 55000) return null;
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);
  return formatYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function fromDigits(digits) {
  if (digits.length === 8) {
    return formatYmd(digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8));
  }
  if (digits.length === 6) {
    return formatYmd(digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6));
  }
  return null;
}

// 생년월일을 나이스 형식 "YYYY.MM.DD"로 통일. 알아볼 수 없으면 null
// (2015.03.07. / 15.3.7 / 2015-03-07 / 2015년 3월 7일 / 20150307 / 150307 / 3/7/2015 / 엑셀 날짜 서식 등)
export function parseBirthday(v) {
  if (v instanceof Date) {
    return isNaN(v) ? null : formatYmd(v.getFullYear(), v.getMonth() + 1, v.getDate());
  }

  let s = cleanString(v)
    // 전각 숫자 → 반각
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  // 숫자만 있는 경우 (숫자 서식 셀 포함)
  if (/^\d+(\.0+)?$/.test(s)) {
    s = s.split(".")[0];
    return (
      fromDigits(s) ||
      (s.length <= 5 && (fromSerial(Number(s)) || fromDigits(s.padStart(6, "0")))) ||
      null
    );
  }
  // 시간이 붙은 일련번호 (42070.5)
  if (/^\d{5}\.\d+$/.test(s)) return fromSerial(Number(s));

  // "2015-03-07 00:00:00", "2015-03-07T00:00" 처럼 뒤에 붙은 시간 제거
  s = s.replace(/[T\s]+\d{1,2}:\d{2}.*$/, "");
  const groups = s.match(/\d+/g) || [];

  // 150307-3****** 처럼 붙여 쓴 숫자가 맨 앞에 있는 경우
  if (groups.length > 0 && groups.length !== 3 && fromDigits(groups[0])) {
    return fromDigits(groups[0]);
  }
  if (groups.length !== 3) return null;

  const [a, b, c] = groups;
  if (a.length === 4) return formatYmd(a, b, c);
  // 3/7/2015 (월/일/연도)
  if (c.length === 4) return formatYmd(c, a, b);
  if (a.length <= 2) return formatYmd(a, b, c);
  return null;
}

export function normalizeBirthday(v) {
  const s = cleanString(v);
  if (!(v instanceof Date) && s === "") return "";
  return parseBirthday(v) || s;
}

function isMarked(v) {
  const s = cleanString(v).toLowerCase();
  return s !== "" && !FALSY_MARKS.includes(s);
}

// 생활지도/학부모/학습부진... 열과 비고(자유 입력)를 하나의 비고 문자열로 합치기
function buildNote(get) {
  const freeNote = cleanString(get("note"));
  const tokens = [];

  [
    ["guidance", "생활지도"],
    ["parent", "학부모"],
  ].forEach(([field, label]) => {
    const v = cleanString(get(field));
    if (!isMarked(v)) return;
    const level = v.match(/[상중하]/);
    tokens.push(level ? `${label}-${level[0]}` : label);
  });

  [
    ["slow", "학습부진"],
    ["special", "특수반"],
    ["multi", "다문화"],
    ["twin", "쌍둥이"],
    ["transfer", "전출"],
  ].forEach(([field, label]) => {
    if (isMarked(get(field))) tokens.push(label);
  });

  const group = cleanString(get("group"));
  if (isMarked(group)) {
    (group.match(/\d+/g) || []).forEach((n) => tokens.push(`그룹${+n}`));
  }

  // 비고에 이미 같은 항목이 적혀 있으면 중복 제거
  const freeParts = freeNote.split(",").map((part) => part.trim());
  return [...tokens.filter((t) => !freeParts.includes(t)), freeNote]
    .filter(Boolean)
    .join(", ");
}

function findHeader(rows, aliases) {
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const headers = (rows[r] || []).map(normalizeHeader);
    if (!headers.some((h) => aliases.name.includes(h))) continue;

    const colMap = {};
    Object.keys(aliases).forEach((field) => {
      // 별칭 우선순위대로 찾기
      for (const alias of aliases[field]) {
        const idx = headers.indexOf(alias);
        if (idx !== -1) {
          colMap[field] = idx;
          break;
        }
      }
    });
    return { headerIndex: r, colMap };
  }
  return null;
}

/**
 * 엑셀 워크북에서 학급별 학생 배열 만들기
 * @returns {{classes: Array, loaded: Array, skipped: Array, errors: Array, warnings: Array, grade: number|null}}
 */
export function parseWorkbook(workBook, isNew) {
  const aliases = isNew ? NEW_ALIASES : SAVED_ALIASES;
  const result = {
    classes: [],
    loaded: [],
    skipped: [],
    errors: [],
    warnings: [],
    grade: null,
  };
  const seenIds = {};
  let noScoreCount = 0;
  const badBirthdays = [];

  workBook.SheetNames.forEach((sheetName) => {
    const sheet = workBook.Sheets[sheetName];
    if (SKIP_SHEET_PATTERN.test(sheetName)) {
      result.skipped.push(sheetName);
      return;
    }
    if (!sheet || !sheet["!ref"]) return;

    const rowOffset = utils.decode_range(sheet["!ref"]).s.r + 1;
    const rows = utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: true,
    });
    const hasContent = rows.some((row) =>
      row.some((v) => cleanString(v) !== "")
    );
    if (!hasContent) return;

    const header = findHeader(rows, aliases);
    if (!header) {
      result.skipped.push(sheetName);
      result.warnings.push(
        `'${sheetName}' 시트는 '이름' 머리글을 찾지 못해 건너뛰었습니다.`
      );
      return;
    }
    const { headerIndex, colMap } = header;

    const required = isNew
      ? [["gender", "성별"]]
      : [
          ["gender", "성별"],
          ["exClass", "이전반"],
          ["num", "이전번호"],
        ];
    const missing = required
      .filter(([field]) => colMap[field] === undefined)
      .map(([, label]) => label);

    const sheetClassNum = /^\s*\d+\s*반?\s*$/.test(sheetName)
      ? toInt(sheetName)
      : null;
    const students = [];
    let classMismatch = false;
    const dupErrors = [];

    for (let r = headerIndex + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const get = (field) =>
        colMap[field] === undefined ? "" : row[colMap[field]];
      const where = `'${sheetName}' 시트 ${r + rowOffset}행`;

      const name = cleanString(get("name"));
      if (!name) {
        // 반/번호만 미리 채워진 줄은 빈 줄로 취급
        const hasOtherData = Object.keys(colMap).some(
          (field) =>
            !["exClass", "num", "grade", "name"].includes(field) &&
            cleanString(get(field)) !== ""
        );
        if (hasOtherData) {
          result.errors.push(`${where}: 이름이 비어 있습니다.`);
        }
        continue;
      }
      if (missing.length > 0) {
        students.push(null);
        continue;
      }

      const genderRaw = cleanString(get("gender"));
      const gender = GENDER_MAP[genderRaw.toLowerCase()];
      if (!gender) {
        result.errors.push(
          genderRaw
            ? `${where} (${name}): 성별 '${genderRaw}'을(를) 알 수 없습니다. '남' 또는 '여'로 입력해주세요.`
            : `${where} (${name}): 성별이 비어 있습니다.`
        );
      }

      let exClass = toInt(get("exClass"));
      let num = toInt(get("num"));
      if (isNew) {
        if (exClass === null) exClass = toInt(sheetName);
        if (exClass === null) {
          result.errors.push(
            `${where} (${name}): 반이 비어 있습니다. '반' 열에 숫자를 입력해주세요.`
          );
        } else if (sheetClassNum !== null && sheetClassNum !== exClass) {
          classMismatch = true;
        }
        if (num === null) {
          result.errors.push(`${where} (${name}): 번호가 비어 있습니다.`);
        }
        if (exClass !== null && num !== null) {
          const id = `${exClass}-${num}`;
          if (seenIds[id]) {
            dupErrors.push(
              `${where} (${name}): ${exClass}반 ${num}번이 ${seenIds[id]}와(과) 겹칩니다.`
            );
          } else {
            seenIds[id] = `${where} (${name})`;
          }
        }
      }

      const scoreRaw = cleanString(get("score"));
      const scoreNum = Number(scoreRaw);
      if (scoreRaw === "" || isNaN(scoreNum)) noScoreCount++;

      const teamRaw = cleanString(get("teamWork"));
      const teamWork = TEAMWORK_MAP[teamRaw.toLowerCase()] || teamRaw;

      if (result.grade === null) result.grade = toInt(get("grade"));

      const birthdayRaw = cleanString(get("birthday"));
      if (birthdayRaw && birthdayRaw !== "-" && !parseBirthday(get("birthday"))) {
        badBirthdays.push(`${name}(${birthdayRaw})`);
      }

      students.push({
        exClass: exClass || 0,
        birthday: normalizeBirthday(get("birthday")) || (isNew ? "" : "-"),
        num: num || 0,
        gender: gender || "",
        name,
        score: isNaN(scoreNum) ? 0 : scoreNum,
        note: buildNote(get),
        teamWork,
      });
    }

    // 시트를 통째로 복사한 경우 등은 한 줄로 요약
    if (dupErrors.length > 3) {
      result.errors.push(
        `'${sheetName}' 시트: 학생 ${dupErrors.length}명의 반/번호가 다른 학생과 겹칩니다. 같은 자료가 두 번 들어갔거나, 시트를 복사한 뒤 '반' 열의 숫자를 바꾸지 않았는지 확인해주세요.`
      );
    } else {
      result.errors.push(...dupErrors);
    }

    if (students.length === 0) {
      // 이어하기에서는 빈 학급도 자리 유지
      if (!isNew) {
        result.classes.push([]);
        result.loaded.push({ sheet: sheetName, count: 0 });
      }
      return;
    }
    if (missing.length > 0) {
      result.errors.push(
        `'${sheetName}' 시트: '${missing.join(
          "', '"
        )}' 열(머리글)을 찾지 못했습니다. 머리글을 바꾸거나 지우지 않았는지 확인해주세요.`
      );
      return;
    }
    if (classMismatch) {
      result.warnings.push(
        `'${sheetName}' 시트에 '반' 열의 값이 시트 이름과 다른 학생이 있습니다. (시트를 복사한 뒤 '반' 열을 고치지 않았는지 확인)`
      );
    }

    // 점수 내림차순 (새 작업만)
    if (isNew) students.sort((a, b) => b.score - a.score);

    result.classes.push(students);
    result.loaded.push({ sheet: sheetName, count: students.length });
  });

  if (noScoreCount > 0 && isNew) {
    result.warnings.push(
      `총점이 비어 있거나 숫자가 아닌 학생이 ${noScoreCount}명 있습니다. (0점으로 처리됩니다)`
    );
  }
  if (badBirthdays.length > 0) {
    result.warnings.push(
      `생년월일을 알아볼 수 없는 학생이 ${badBirthdays.length}명 있습니다: ${badBirthdays
        .slice(0, 5)
        .join(", ")}${badBirthdays.length > 5 ? " ..." : ""} (입력된 그대로 사용됩니다)`
    );
  }
  const total = result.loaded.reduce((sum, s) => sum + s.count, 0);
  if (total === 0 && result.errors.length === 0) {
    result.errors.push(
      "학생 자료를 찾지 못했습니다. 머리글(반, 번호, 이름, 성별...)이 있는 양식 파일인지 확인해주세요."
    );
  }

  return result;
}

export function parseExcelFile(arrayBuffer, isNew) {
  return parseWorkbook(read(arrayBuffer, { type: "array" }), isNew);
}

// "2027학년도 5학년 학급편성자료(명렬표).xlsx" → "2027학년도 5학년"
export function getYearGrade(fileName, grade) {
  const match = String(fileName).match(/(\d{4})\s*학년도\s*(\d)\s*학년/);
  if (match) return { yearGrade: `${match[1]}학년도 ${match[2]}학년`, guessed: false };

  const now = new Date();
  const year = now.getMonth() > 6 ? now.getFullYear() + 1 : now.getFullYear();
  return { yearGrade: `${year}학년도 ${grade || 1}학년`, guessed: true };
}
