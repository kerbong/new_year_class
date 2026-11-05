import JSZip from "jszip";

// ============================================================
// 학급 편성 결과 → 한글(HWPX) 양식 파일
//  - <서식 1> 진급 반 편성 통계표(전체)
//  - <서식 2> 기존(이전)반 기준 반 편성표 (이전반마다 한 쪽)
//  - <서식 3> 진급반 기준 반 편성표 (진급반마다 한 쪽)
// 학년도/학년은 화면의 "2026학년도 2학년" 값에서 자동으로 계산한다.
// 글자·문단·테두리 모양은 public/hwpx/header.xml 의 ID를 사용한다.
// ============================================================

// header.xml 스타일 ID
const CHAR = {
  normal: 0, // 10pt
  bold: 9, // 10pt 굵게
  small: 11, // 9pt
  title: 12, // 16pt 굵게
};
// 글자 크기(HWPUNIT, 1pt = 100) - 줄배치 정보 계산용
const CHAR_HEIGHT = { 0: 1000, 9: 1000, 11: 900, 12: 1600 };
const PARA = {
  body: 0, // 양쪽 정렬 160%
  center: 20, // 가운데 160%
  cell: 21, // 가운데 130% (표 셀)
  cellLeft: 22, // 양쪽 130% (표 셀)
};
const BORDER = {
  none: 2, // 테두리 없음
  cell: 3, // 실선 4면
  head: 6, // 실선 4면 + 회색 배경
};

// A4, 좌우 20mm / 위아래 10mm + 머리말·꼬리말 5mm
const PAGE = {
  width: 59528,
  height: 84186,
  left: 5669,
  right: 5669,
  top: 2835,
  bottom: 2835,
  header: 1417,
  footer: 1417,
};
const TEXT_WIDTH = PAGE.width - PAGE.left - PAGE.right; // 48190
const TEXT_HEIGHT =
  PAGE.height - PAGE.top - PAGE.bottom - PAGE.header - PAGE.footer; // 75682
const LABEL_HEIGHT = 1800; // "<서식 N >" 한 줄 + 여유

const NS =
  'xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" ' +
  'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" ' +
  'xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" ' +
  'xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" ' +
  'xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" ' +
  'xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" ' +
  'xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" ' +
  'xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" ' +
  'xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" ' +
  'xmlns:dc="http://purl.org/dc/elements/1.1/" ' +
  'xmlns:opf="http://www.idpf.org/2007/opf/" ' +
  'xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" ' +
  'xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar" ' +
  'xmlns:epub="http://www.idpf.org/2007/ops" ' +
  'xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"';

function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // XML 1.0에서 허용되지 않는 제어문자 제거
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

// 문서 안에서 고유한 id
function idMaker() {
  let n = 1000000000;
  return () => n++;
}

// "2026학년도 2학년" → { year: 2026, grade: 2 }
export function parseYearGrade(yearGrade) {
  const m = String(yearGrade || "").match(/(\d{4})\s*학년도\s*(\d+)\s*학년/);
  if (!m) return null;
  return { year: Number(m[1]), grade: Number(m[2]) };
}

const has = (stu, word) => String(stu?.note || "").includes(word);
const isTransfer = (stu) => has(stu, "전출");
const isTwin = (stu) => has(stu, "쌍둥이") || has(stu, "쌍생아");
const isSpecial = (stu) => has(stu, "특수");

// 비고: 편성 작업용 '그룹N' 표시는 빼고 그대로 적는다
function noteText(stu) {
  return String(stu?.note || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !/^그룹\d+$/.test(s))
    .join(", ");
}

function numText(v) {
  if (v === undefined || v === null || v === "-" || v === 0 || v === "0")
    return "";
  return String(v);
}

function countGender(list) {
  const male = list.filter((s) => s.gender === "남").length;
  const female = list.filter((s) => s.gender === "여").length;
  return { male, female, total: list.length };
}

// ------------------------------------------------------------
// XML 조각
// ------------------------------------------------------------

function secPrXml() {
  return `<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0"><hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/><hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/><hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/><hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/><hp:pagePr landscape="WIDELY" width="${PAGE.width}" height="${PAGE.height}" gutterType="LEFT_ONLY"><hp:margin header="${PAGE.header}" footer="${PAGE.footer}" gutter="0" left="${PAGE.left}" right="${PAGE.right}" top="${PAGE.top}" bottom="${PAGE.bottom}"/></hp:pagePr><hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr><hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr><hp:pageBorderFill type="BOTH" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill><hp:pageBorderFill type="EVEN" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill><hp:pageBorderFill type="ODD" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill></hp:secPr><hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl>`;
}

// 한글이 저장할 때 만드는 줄배치 정보(첫 줄). 한글이 열면서 다시 계산한다.
function lineSeg(height, width, spacingRatio) {
  const h = Math.round(height);
  return `<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="${h}" textheight="${h}" baseline="${Math.round(h * 0.85)}" spacing="${Math.round(h * spacingRatio)}" horzpos="0" horzsize="${Math.round(width)}" flags="393216"/></hp:linesegarray>`;
}

function textPara(nextId, text, { para = PARA.body, char = CHAR.normal, pageBreak = false, first = false } = {}) {
  const sec = first ? `<hp:run charPrIDRef="${CHAR.normal}">${secPrXml()}</hp:run>` : "";
  return `<hp:p id="${nextId()}" paraPrIDRef="${para}" styleIDRef="0" pageBreak="${pageBreak ? 1 : 0}" columnBreak="0" merged="0">${sec}<hp:run charPrIDRef="${char}"><hp:t>${esc(text)}</hp:t></hp:run>${lineSeg(CHAR_HEIGHT[char] || 1000, TEXT_WIDTH, 0.6)}</hp:p>`;
}

/**
 * 표 만들기
 * @param colWidths 열 너비 배열 (합계 = TEXT_WIDTH)
 * @param rows [{ height, cells: [{ text, col, colSpan, rowSpan, char, para, border }] }]
 *             cells의 col은 생략하면 앞 셀 다음 칸
 */
function tableXml(nextId, colWidths, rows) {
  const rowHeights = rows.map((r) => r.height);
  const totalHeight = rowHeights.reduce((a, b) => a + b, 0);
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  const trs = rows
    .map((row, r) => {
      let col = 0;
      const tcs = row.cells
        .map((cell) => {
          if (cell.col !== undefined) col = cell.col;
          const colSpan = cell.colSpan || 1;
          const rowSpan = cell.rowSpan || 1;
          const width = colWidths.slice(col, col + colSpan).reduce((a, b) => a + b, 0);
          const height = rowHeights.slice(r, r + rowSpan).reduce((a, b) => a + b, 0);
          const lines = String(cell.text ?? "").split("\n");
          const paras = lines
            .map(
              (line) =>
                `<hp:p id="${nextId()}" paraPrIDRef="${cell.para ?? PARA.cell}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${cell.char ?? CHAR.normal}"><hp:t>${esc(line)}</hp:t></hp:run>${lineSeg(CHAR_HEIGHT[cell.char ?? CHAR.normal] || 1000, width - 282, 0.3)}</hp:p>`
            )
            .join("");
          const xml = `<hp:tc name="" header="${row.header ? 1 : 0}" hasMargin="0" protect="0" editable="0" dirty="1" borderFillIDRef="${cell.border ?? BORDER.cell}"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${paras}</hp:subList><hp:cellAddr colAddr="${col}" rowAddr="${r}"/><hp:cellSpan colSpan="${colSpan}" rowSpan="${rowSpan}"/><hp:cellSz width="${width}" height="${height}"/><hp:cellMargin left="141" right="141" top="141" bottom="141"/></hp:tc>`;
          col += colSpan;
          return xml;
        })
        .join("");
      return `<hp:tr>${tcs}</hp:tr>`;
    })
    .join("");

  const tbl = `<hp:tbl id="${nextId()}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="${rows.length}" colCnt="${colWidths.length}" cellSpacing="0" borderFillIDRef="${BORDER.cell}" noAdjust="0"><hp:sz width="${totalWidth}" widthRelTo="ABSOLUTE" height="${totalHeight}" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:inMargin left="141" right="141" top="141" bottom="141"/>${trs}</hp:tbl>`;

  return `<hp:p id="${nextId()}" paraPrIDRef="${PARA.center}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${CHAR.normal}">${tbl}<hp:t/></hp:run>${lineSeg(totalHeight + 282, TEXT_WIDTH, 0.6)}</hp:p>`;
}

// 학생 수에 맞춰 한 쪽에 들어가도록 행 높이 조절 (최소 1300 ≈ 4.6mm)
function fitRowHeight(fixedHeight, rowCount, max = 1900) {
  const room = TEXT_HEIGHT - LABEL_HEIGHT - fixedHeight - 600;
  return Math.max(1300, Math.min(max, Math.floor(room / Math.max(rowCount, 1))));
}

// ------------------------------------------------------------
// 데이터 정리
// ------------------------------------------------------------

/**
 * @param nextClasses 진급반 배열 [[학생...], ...] (배열 순서 = 진급 번호 순서)
 * @param classNames  진급반 이름 ["가","나",...]
 */
export function buildFormData({ yearGrade, nextClasses, classNames }) {
  const yg = parseYearGrade(yearGrade);
  if (!yg) throw new Error(`학년도/학년 정보를 알 수 없습니다: ${yearGrade}`);
  const { year, grade } = yg;
  const prevYear = year - 1;
  const prevGrade = grade - 1;

  const next = nextClasses.map((cl, ci) => ({
    name: classNames[ci] ?? String(ci + 1),
    students: cl.map((stu, si) => ({ ...stu, nextClass: classNames[ci] ?? String(ci + 1), nextNum: si + 1 })),
  }));

  // 이전반 기준으로 다시 묶기
  const exMap = new Map();
  next.forEach((cl) =>
    cl.students.forEach((stu) => {
      const key = String(stu.exClass ?? "").trim() || "-";
      if (!exMap.has(key)) exMap.set(key, []);
      exMap.get(key).push(stu);
    })
  );
  const exKeys = [...exMap.keys()].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b, "ko");
  });
  const prev = exKeys.map((key) => ({
    name: key,
    students: exMap.get(key).sort((a, b) => {
      const na = Number(a.num);
      const nb = Number(b.num);
      const okA = !isNaN(na) && na > 0;
      const okB = !isNaN(nb) && nb > 0;
      if (okA && okB) return na - nb;
      if (okA !== okB) return okA ? -1 : 1;
      return String(a.name).localeCompare(String(b.name), "ko");
    }),
  }));

  return {
    year,
    grade,
    prevYear,
    prevGrade,
    prevLabel: prevGrade >= 1 ? `${prevYear}학년도 ${prevGrade}학년` : `${prevYear}학년도 신입생`,
    nextLabel: `${year}학년도 ${grade}학년`,
    next,
    prev,
  };
}

// ------------------------------------------------------------
// 서식
// ------------------------------------------------------------

const H = { title: 2600, sub: 1900, head: 1900, footer: 2200 };

// <서식 1> 진급 반 편성 통계표(전체)
function form1(nextId, d) {
  // 진급반 | 남 | 여 | 계 | 전출예정 | 정원외(2칸) | 개별학습반 | 쌍둥이 | (빈칸) | (빈칸)
  const W = [5000, 5800, 5800, 5800, 4600, 2300, 2300, 4600, 4400, 3900, 3690];
  const rows = [];
  const fixed = H.title + H.sub + H.head * 2 + H.footer;
  const rowH = fitRowHeight(fixed, d.next.length, 2600);
  const head = { char: CHAR.bold, border: BORDER.head };

  rows.push({
    height: H.title,
    cells: [{ text: "진급 반 편성 통계표(전체)", colSpan: 11, char: CHAR.title, border: BORDER.cell }],
  });
  rows.push({
    height: H.sub,
    cells: [
      { text: `현 학년: ${d.prevLabel}`, colSpan: 6, para: PARA.cellLeft },
      { text: `진급 학년: ${d.nextLabel}`, colSpan: 5, para: PARA.cellLeft },
    ],
  });
  rows.push({
    height: H.head,
    header: true,
    cells: [
      { text: "진급반", rowSpan: 2, ...head },
      { text: "남\n(재적/실제)", rowSpan: 2, ...head },
      { text: "여\n(재적/실제)", rowSpan: 2, ...head },
      { text: "계\n(재적/실제)", rowSpan: 2, ...head },
      { text: "비고", colSpan: 7, ...head },
    ],
  });
  rows.push({
    height: H.head,
    header: true,
    cells: [
      { text: "전출예정", col: 4, ...head },
      { text: "정원외", colSpan: 2, ...head },
      { text: "개별\n학습반", ...head },
      { text: "쌍둥이", ...head },
      { text: "", ...head },
      { text: "", ...head },
    ],
  });

  const sum = { male: 0, female: 0, total: 0, rMale: 0, rFemale: 0, rTotal: 0, transfer: 0 };
  d.next.forEach((cl) => {
    const all = countGender(cl.students);
    const real = countGender(cl.students.filter((s) => !isTransfer(s)));
    const transfer = cl.students.filter(isTransfer).length;
    sum.male += all.male;
    sum.female += all.female;
    sum.total += all.total;
    sum.rMale += real.male;
    sum.rFemale += real.female;
    sum.rTotal += real.total;
    sum.transfer += transfer;
    const n = (v) => (v ? String(v) : "");
    rows.push({
      height: rowH,
      cells: [
        { text: cl.name },
        { text: `${all.male}/${real.male}` },
        { text: `${all.female}/${real.female}` },
        { text: `${all.total}/${real.total}` },
        { text: n(transfer) },
        { text: "", colSpan: 2 },
        { text: n(cl.students.filter(isSpecial).length) },
        { text: n(cl.students.filter(isTwin).length) },
        { text: "" },
        { text: "" },
      ],
    });
  });

  let total = `◈ 학년 총계 ◈   남: ${sum.male}명   여: ${sum.female}명   총: ${sum.total}명`;
  if (sum.transfer > 0) {
    total += `   (전출예정 ${sum.transfer}명 제외 시 남 ${sum.rMale}명, 여 ${sum.rFemale}명, 총 ${sum.rTotal}명)`;
  }
  rows.push({ height: H.footer, cells: [{ text: total, colSpan: 11, char: CHAR.bold }] });

  return tableXml(nextId, W, rows);
}

// <서식 2>, <서식 3> 공통: 이전반 | 번호 | 이름 | 성별 | 진급반 | 번호 | 비고
function rosterTable(nextId, title, subtitle, students) {
  const W = [5000, 4500, 9000, 4500, 5500, 4500, 15190];
  const blankRows = 2;
  const fixed = H.title + H.sub + H.head + H.footer;
  const rowH = fitRowHeight(fixed, students.length + blankRows);
  const head = { char: CHAR.bold, border: BORDER.head };
  const rows = [
    { height: H.title, cells: [{ text: title, colSpan: 7, char: CHAR.title }] },
    { height: H.sub, cells: [{ text: subtitle, colSpan: 7, para: PARA.cellLeft }] },
    {
      height: H.head,
      header: true,
      cells: ["이전반", "번호", "이름", "성별", "진급반", "번호", "비고"].map((t) => ({ text: t, ...head })),
    },
  ];
  students.forEach((stu) => {
    const note = noteText(stu);
    rows.push({
      height: rowH,
      cells: [
        { text: stu.exClass ?? "" },
        { text: numText(stu.num) },
        { text: stu.name ?? "" },
        { text: stu.gender ?? "" },
        { text: stu.nextClass ?? "" },
        { text: String(stu.nextNum ?? "") },
        { text: note, char: note.length > 14 ? CHAR.small : CHAR.normal },
      ],
    });
  });
  for (let i = 0; i < blankRows; i++) {
    rows.push({ height: rowH, cells: Array.from({ length: 7 }, () => ({ text: "" })) });
  }
  const g = countGender(students);
  rows.push({
    height: H.footer,
    cells: [
      {
        text: `◈ 남: ( ${g.male} ) 명   ◈ 여: ( ${g.female} ) 명      ◆ 총: ( ${g.total} ) 명`,
        colSpan: 7,
        char: CHAR.bold,
      },
    ],
  });
  return tableXml(nextId, W, rows);
}

export function buildSectionXml(data) {
  const nextId = idMaker();
  const parts = [];
  const d = data;

  parts.push(textPara(nextId, "<서식 1 >", { first: true }));
  parts.push(form1(nextId, d));

  d.prev.forEach((cl) => {
    const where = d.prevGrade >= 1 ? `${d.prevGrade}학년 ${cl.name}반` : `${cl.name}반`;
    parts.push(textPara(nextId, "<서식 2 >", { pageBreak: true }));
    parts.push(
      rosterTable(nextId, `${d.year}학년도 반 편성(${where})`, `진급학년: ${d.nextLabel}`, cl.students)
    );
  });

  d.next.forEach((cl) => {
    parts.push(textPara(nextId, "<서식 3 >", { pageBreak: true }));
    parts.push(
      rosterTable(
        nextId,
        `${d.year}학년도 반편성(${cl.name}반)`,
        `진급 학년: ${d.nextLabel} ${cl.name}반`,
        cl.students
      )
    );
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hs:sec ${NS}>${parts.join("")}</hs:sec>`;
}

// ------------------------------------------------------------
// HWPX 패키지
// ------------------------------------------------------------

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf"><ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/><ocf:rootfile full-path="Preview/PrvText.txt" media-type="text/plain"/><ocf:rootfile full-path="META-INF/container.rdf" media-type="application/rdf+xml"/></ocf:rootfiles></ocf:container>`;

const CONTAINER_RDF = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about=""><ns0:hasPart xmlns:ns0="http://www.hancom.co.kr/hwpml/2016/meta/pkg#" rdf:resource="Contents/header.xml"/></rdf:Description><rdf:Description rdf:about="Contents/header.xml"><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#HeaderFile"/></rdf:Description><rdf:Description rdf:about=""><ns0:hasPart xmlns:ns0="http://www.hancom.co.kr/hwpml/2016/meta/pkg#" rdf:resource="Contents/section0.xml"/></rdf:Description><rdf:Description rdf:about="Contents/section0.xml"><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#SectionFile"/></rdf:Description><rdf:Description rdf:about=""><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#Document"/></rdf:Description></rdf:RDF>`;

const MANIFEST_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>`;

const VERSION_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="WORDPROCESSOR" major="5" minor="1" micro="1" buildNumber="0" os="1" xmlVersion="1.5" application="Hancom Office Hangul" appVersion="13, 0, 0, 1408 WIN32LEWindows_10"/>`;

const SETTINGS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"><ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/></ha:HWPApplicationSetting>`;

function contentHpf(title) {
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><opf:package ${NS} version="" unique-identifier="" id=""><opf:metadata><opf:title>${esc(title)}</opf:title><opf:language>ko</opf:language><opf:meta name="creator" content="text">new_year_class</opf:meta><opf:meta name="CreatedDate" content="text">${now}</opf:meta><opf:meta name="ModifiedDate" content="text">${now}</opf:meta></opf:metadata><opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml"/><opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/><opf:item id="settings" href="settings.xml" media-type="application/xml"/></opf:manifest><opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>`;
}

// 미리보기 텍스트 (한글이 저장할 때처럼 본문 글자를 앞에서부터 담는다)
function previewText(sectionXml) {
  const texts = [];
  const re = /<hp:t>([^<]*)<\/hp:t>/g;
  let m;
  while ((m = re.exec(sectionXml)) && texts.join("").length < 1000) {
    if (m[1]) texts.push(m[1]);
  }
  return texts
    .join(" ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

/**
 * HWPX 파일 만들기
 * @param headerXml public/hwpx/header.xml 내용
 * @param type JSZip 출력 형식 ("blob" | "uint8array" | "nodebuffer")
 */
export async function makeClassFormHwpx({ yearGrade, nextClasses, classNames, headerXml, type = "blob" }) {
  const data = buildFormData({ yearGrade, nextClasses, classNames });
  const title = `${data.nextLabel} 학급편성 양식`;
  const zip = new JSZip();
  // mimetype은 첫 항목, 압축하지 않음
  zip.file("mimetype", "application/hwp+zip", { compression: "STORE" });
  zip.file("version.xml", VERSION_XML);
  zip.file("Contents/header.xml", headerXml);
  const sectionXml = buildSectionXml(data);
  zip.file("Contents/section0.xml", sectionXml);
  zip.file("Contents/content.hpf", contentHpf(title));
  zip.file("settings.xml", SETTINGS_XML);
  zip.file("META-INF/container.xml", CONTAINER_XML);
  zip.file("META-INF/container.rdf", CONTAINER_RDF);
  zip.file("META-INF/manifest.xml", MANIFEST_XML);
  zip.file("Preview/PrvText.txt", previewText(sectionXml));
  const file = await zip.generateAsync({
    type,
    compression: "DEFLATE",
    mimeType: "application/hwp+zip",
  });
  return { file, fileName: `${data.nextLabel} 학급편성(양식).hwpx`, data };
}
