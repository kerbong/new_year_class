import React, { useState, useRef } from "react";
import { utils, writeFile } from "xlsx";
import Swal from "sweetalert2";
import classes from "./App.module.css";
import ExcelUploader from "./component/ExcelUploader";
import { makeClassFormHwpx } from "./component/makeHwpx";
import {
  autoDistribute,
  findTwinGroups,
  studentKey,
} from "./component/autoDistribute";

// 총 14반까지만 가능..
const CLASS_NAME = [
  [
    "가",
    "나",
    "다",
    "라",
    "마",
    "바",
    "사",
    "아",
    "자",
    "차",
    "카",
    "타",
    "파",
    "하",
  ],
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"],
];

// 첫 화면 맨 아래 업데이트 기록 (최신이 위로)
const UPDATE_LOG = [
  {
    date: "2026.11.08",
    text: "자동배분 개선(특수·전출·그룹·쌍둥이 고르게, 같은 현재반·같은 성별·비슷한 점수 학생과 교환), AI편성 기능 삭제",
  },
  { date: "2026.11.08", text: "골고루 분반하는 이유 안내 페이지 추가" },
  { date: "2026.11.05", text: "학급편성 계획 서식1~3 한글(.hwpx) 파일 저장" },
  { date: "2026.10.13", text: "엑셀 입력양식 새로 제작, 업로드 오류 안내 강화" },
];

// 설명보기에 나오는 색 안내
const EXPLAIN_LEGEND = [
  { label: "협동 굿", className: "goodStudent" },
  { label: "협동 배드", className: "badStudent" },
  { label: "특수반", className: "specialStudent" },
  { label: "선택한 현재학급 (남)", className: "highlightedExClassMale" },
  { label: "선택한 현재학급 (여)", className: "highlightedExClassFemale" },
  { label: "중복이름 (성까지 같음)", className: "dupli-stu-bg" },
  { label: "중복이름 (이름만 같음)", className: "dupli-given-bg" },
];

const EXPLAINS = [
  {
    title: "👀 화면 보는 법",
    items: [
      "학생 한 줄은 이름 / 현재반 / 성별 / 점수 / 비고 순서입니다.",
      "브라우저 확대/축소(Ctrl + 마우스휠)로 한눈에 보이게 맞춰두세요.",
      "비고가 길면 🚩로 줄여서 보여줍니다. '비고 펼치기 / 줄이기' 버튼으로 바꿀 수 있어요.",
      "'현재학급 표시'에서 반을 누르면 그 반 학생들이 노란색으로 표시됩니다.",
    ],
  },
  {
    title: "🚀 추천 순서 (버튼 1 → 4)",
    items: [
      "처음 분반: 현재 반마다 점수 순으로 줄을 세워 1등부터 Z(또는 ㄹ) 방식으로 내년 반에 차례로 넣습니다. 현재 반마다 시작하는 내년 반을 하나씩 밀어서, 각 반 1등이 한 반에 몰리지 않아요. '성비 고려'를 고르면 남학생·여학생을 따로 돌려 넣습니다.",
      "1. 자동배분: ① 같은 그룹(그룹1, 그룹2…) 학생 떼어놓기·쌍둥이(같은 반/다른 반을 물어봐요) ② 특수(특수반) 학생 고르게 ③ 굿/배드 고르게 ④ 생활지도·학부모(상/중/하)·학습부진·다문화·전출 고르게 (어려운 학생이 한 반에 겹치지 않게 반별 합계도 맞춤) ⑤ 인원수(전출 제외, 반마다 최대 1명 차이 · 특수 학생이 있는 반이 적은 쪽. 두 가지가 부딪치면 어느 쪽으로 할지 물어봐요) ⑥ 성비 ⑦ 반별 평균 점수 순서로 맞춥니다.",
      "자동배분에서 학생을 옮길 때는 비고가 없는 학생과 맞바꾸는데, 같은 현재반·같은 성별·점수가 가장 비슷한 학생을 먼저 고릅니다.",
      "쌍둥이는 성과 생년월일로 짝을 찾습니다. 못 찾으면 비고에 '쌍둥이1', '쌍둥이2'처럼 짝끼리 같은 번호를 적어주세요.",
      "2. 중복이름확인: 한 반에 성까지 이름이 똑같은 학생은 진한 빨강, 성만 다르고 이름이 같은 학생은 연한 빨강으로 표시합니다. 다시 누르면 해제돼요.",
      "3. 엑셀파일 저장: 나이스용 / 명렬표 / 기존학급기준 3개 파일이 저장됩니다.",
      "4. 한글 양식 저장: 학급편성 계획의 서식1(진급 반 편성 통계표)·서식2(이전반 기준)·서식3(진급반 기준)이 한글(.hwpx) 파일 하나로 저장됩니다. 학년도·학년은 자동으로 들어갑니다.",
    ],
  },
  {
    title: "✋ 직접 옮기고 고치기",
    items: [
      "두 학생을 차례로 클릭하고 이유를 입력하면 서로 반이 바뀝니다.",
      "학생을 클릭한 뒤 다른 반의 '빈자리에 넣기'를 누르면 그 반으로 옮겨집니다.",
      "학생을 마우스 오른쪽 버튼으로 클릭하면 비고 / 협동을 수정할 수 있습니다.",
      "'초기화'를 누르면 처음 반배정된 상태로 돌아갑니다. (바꾼 내용은 사라져요)",
    ],
  },
  {
    title: "🔀 정렬과 보기",
    items: [
      "'현재학급 기준 / 내년학급 기준'으로 올해 반별, 내년 반별 명단을 바꿔 볼 수 있습니다.",
      "'남자 앞번호 / 여자 앞번호 / 혼성번호'를 누르면 그 기준의 이름순으로 번호가 정해집니다.",
      "이때 비고에 '전출'이 있는 학생은 항상 맨 뒤로 갑니다.",
      "'이름순 / 학급순'은 반 안에서 보이는 순서만 바꿉니다.",
    ],
  },
  {
    title: "💾 저장과 주의사항",
    items: [
      "사이트를 새로고침(F5)하면 작업 중이던 자료가 사라집니다. 중간중간 엑셀파일로 저장해두세요.",
      "다음에 이어서 하려면 저장된 파일 중 '명렬표' 파일을 첫 화면의 '분반 이어하기'에 올리세요. (파일 이름은 바꾸지 마세요)",
      "다른 자료로 새로 시작하려면 사이트를 새로고침하세요.",
      "학생 정보와 관련된 책임은 사용자에게 있습니다.",
    ],
  },
];

function App() {
  const [classStudents, setClassStudents] = useState([]);
  const [nextOriginClass, setNextOriginClass] = useState([]);
  const [nextAdaptClass, setNextAdaptClass] = useState([]);
  const [divideType, setDivideType] = useState("way2");
  const [firstMale, setFirstMale] = useState("female");
  // 남자 앞번호 / 여자 앞번호 / 혼성번호 중 마지막으로 고른 번호 순서 (자동배분 후에도 유지)
  const [numberOrder, setNumberOrder] = useState(null);
  // 쌍둥이 같은 반/다른 반 선택 기억 (다시 자동배분할 때 또 묻지 않도록)
  const twinChoices = useRef({});
  const [tempStudent, setTempStudent] = useState({});
  const [yearGrade, setYearGrade] = useState(null);
  const [divided, setDivided] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const [hanglOrNum, setHanglOrNum] = useState(0);
  const [conGenderRate, setConGenderRate] = useState(false);
  const [reason, setReason] = useState([]);
  const [noteSummary, setNoteSummary] = useState(false);
  const [exClassData, setExClassData] = useState([]);
  const [exClassNames, setExClassNames] = useState([]);
  const [checkDupliName, setCheckDupliName] = useState(false);
  const [orderOriginClass, setOrderOriginClass] = useState(false);
  const [selectedExClasses, setSelectedExClasses] = useState([]); // 현재학급 필터

  const classInput = useRef();
  const gradeInput = useRef();
  const yearInput = useRef();

  //분반방식 버튼 누르면 id를 state에 저장하고 이를 바탕으로 btn css속성 다르게 설정함.
  const divideTypeHandler = (e) => {
    setDivideType(e.target.id);
  };

  /** 현재학급 기준으로 학생들을 정렬하는 함수 */
  const orderByClassHandler = () => {
    //현재학급 기준 정렬상태였으면... 이름기준 정렬로 다시 원상복귀
    //새로운 학급 기준으로 보려면
    if (orderOriginClass) {
      // nextClass 기준으로 데이터를 그룹화
      const groupedByNextClass = nextAdaptClass
        .flat() // 모든 학급 데이터를 하나의 배열로 합침
        .reduce((acc, student) => {
          // nextClass 기준으로 그룹화
          const key = student.nextClass;
          if (!acc[key]) {
            acc[key] = [];
          }
          acc[key].push(student);
          return acc;
        }, {});

      // 객체를 배열로 변환하며 기준에 따라 정렬
      // CLASS_NAME 기준으로 정렬 및 배열 변환
      const groupedArray = Object.entries(groupedByNextClass)
        .sort(([keyA], [keyB]) => {
          // CLASS_NAME에서 keyA와 keyB의 순서 비교
          const findIndex = (key) =>
            CLASS_NAME.findIndex((list) => list.includes(key)) * 100 +
            CLASS_NAME.flat().indexOf(key); // 대분류와 소분류 인덱스 조합
          return findIndex(keyA) - findIndex(keyB);
        })
        .map(([_, students]) => students); // 학생 배열만 추출

      setNextAdaptClass(groupedArray);

      //현재 학급으로 보려면..
    } else {
      const [exClData, exClNames] = orderByExClass(true);

      setNextAdaptClass(exClData);
      console.table(exClData);
    }

    setOrderOriginClass((prev) => !prev);
  };

  // 이름순 정렬
  const orderByName = () => {
    let new_wholeClass = [];
    nextAdaptClass.forEach((cl) => {
      let sortedClass = [...cl].sort((a, b) => {
        return a.name?.localeCompare(b.name);
      });
      new_wholeClass.push(sortedClass);
    });
    setNextAdaptClass(new_wholeClass);
  };

  // 학급순 정렬
  const orderByExClassNum = () => {
    let new_wholeClass = [];
    nextAdaptClass.forEach((cl) => {
      let sortedClass = [...cl].sort((a, b) => {
        const numA = parseInt(a.exClass);
        const numB = parseInt(b.exClass);
        if (numA !== numB) {
          return numA - numB;
        }
        // 같은 학급이면 번호순
        return (a.num || 0) - (b.num || 0);
      });
      new_wholeClass.push(sortedClass);
    });
    setNextAdaptClass(new_wholeClass);
  };

  // 남, 여학생 모아서 내림차순 정렬하기
  const orderByGenderName = (nextWholeClass, how) => {
    let new_wholeClass = [];
    nextWholeClass.forEach((cl) => {
      let maleFilter = cl.filter((stu) => stu.gender === "남");
      let femaleFilter = cl.filter((stu) => stu.gender === "여");

      let wholeFilter = cl.filter((stu) => stu);

      maleFilter.sort((a, b) => {
        return a.name?.localeCompare(b.name);
      });
      femaleFilter.sort((a, b) => {
        return a.name?.localeCompare(b.name);
      });
      wholeFilter.sort((a, b) => {
        return a.name?.localeCompare(b.name);
      });

      let new_cl;
      if (how === "male") {
        new_cl = [...maleFilter, ...femaleFilter];
      } else if (how === "female") {
        new_cl = [...femaleFilter, ...maleFilter];
      } else if (how === "whole") {
        new_cl = [...wholeFilter];
      }

      //전출학생 제외하고 배열만들기
      let new_cl_transfer = new_cl.filter((stu) => !stu.note.includes("전출"));
      //전출인 학생 제일 뒤에 붙이기
      new_cl.forEach((stu) => {
        if (stu["note"].includes("전출")) {
          new_cl_transfer.push(stu);
        }
      });

      new_wholeClass.push(new_cl_transfer);
    });

    return new_wholeClass;
  };

  //내년 학급 초기자료 만들기!
  const divideClassHandler = (nextYearClass) => {
    console.log("=== divideClassHandler 시작 ===");
    console.log("nextYearClass:", nextYearClass);
    console.log("classStudents:", classStudents);
    console.log("classStudents 길이:", classStudents?.length);

    let nextWholeClass = [];
    //내년도 학급 만들어서 nextWholeClass에 넣어두기
    for (let i = 0; i < nextYearClass; i++) {
      nextWholeClass.push([]);
    }
    // console.log(nextWholeClass);
    // console.log(classStudents);

    //현재 학급 자료로 배정 시작하기
    classStudents?.forEach((cl, cl_index) => {
      // console.log(cl);
      let go_forward = true;

      //남여성비고려가 아니라 총점순으로만 배정하면
      if (!conGenderRate) {
        cl.forEach((student, stu_index) => {
          //학생인덱스+ 학급인덱스 / 학급수의 나머지 (1반은 내년 1반 1등부터, 2반은 내년 2반 1등부터...)
          let clNum = +((stu_index + cl_index) % nextYearClass);
          if (go_forward) {
            nextWholeClass[clNum].push(student);
          } else {
            nextWholeClass[nextYearClass - 1 - clNum].push(student);
          }
          //만약 ㄹ자 방식인 경우 방향 바꾸기
          if (divideType === "way1") {
            //만약 방향이 바뀌는 학생(인덱스 나머지가 학급수-1과 같아지지면) 차례가 되면 방향 바꾸기
            if (
              //전체 학생수 - 학생인덱스가 내년 학급수보다 크면
              // cl.length - +stu_index > nextYearClass &&
              nextYearClass - 1 ===
              +clNum
            ) {
              // console.log(cl.length);
              // console.log(+stu_index);
              // console.log(go_forward);
              go_forward = !go_forward;
              // console.log(go_forward);
            }
          }
        });
        //성비고려 옵션인 경우
      } else {
        let male = cl.filter((stu) => stu.gender === "남");
        // console.log(male);
        let female = cl.filter((stu) => stu.gender === "여");
        // console.log(female);
        male.forEach((student, index) => {
          //학생인덱스+ 학급인덱스 / 학급수의 나머지 (1반은 내년 1반 1등부터, 2반은 내년 2반 1등부터...)
          let clNum = +((index + cl_index) % nextYearClass);
          if (go_forward) {
            nextWholeClass[clNum].push(student);
          } else {
            nextWholeClass[nextYearClass - 1 - clNum].push(student);
          }
          //만약 ㄹ자 방식인 경우 방향 바꾸기
          if (divideType === "way1") {
            //만약 방향이 바뀌는 학생(인덱스 나머지가 학급수-1과 같아지지면) 차례가 되면 방향 바꾸기
            if (
              // cl.length - +index > nextYearClass &&
              nextYearClass - 1 ===
              +clNum
            ) {
              go_forward = !go_forward;
            }
          }
        });
        female.forEach((student, index) => {
          //학생인덱스+ 학급인덱스 / 학급수의 나머지 (1반은 내년 나반에 1등부터, 2반은 내년 다반 1등부터...)
          let clNum = +((index + cl_index + 1) % nextYearClass);

          if (go_forward) {
            nextWholeClass[clNum].push(student);
          } else {
            nextWholeClass[nextYearClass - 1 - clNum].push(student);
          }
          //만약 ㄹ자 방식인 경우 방향 바꾸기
          if (divideType === "way1") {
            //만약 방향이 바뀌는 학생(인덱스 나머지가 학급수-1과 같아지지면) 차례가 되면 방향 바꾸기
            if (
              cl.length - +index > nextYearClass &&
              nextYearClass - 1 === +clNum
            ) {
              go_forward = !go_forward;
            }
          }
        });
      }
    });

    const new_wholeClass = orderByGenderName(nextWholeClass, firstMale);

    setNextOriginClass(JSON.parse(JSON.stringify(new_wholeClass)));
    setNextAdaptClass([...new_wholeClass]);
    console.log(new_wholeClass);
    setDivided(true);
  };

  const editYearAndGrade = (inputStr) => {
    const yearPattern = inputStr?.slice(0, 4);
    const gradePattern = inputStr?.slice(8, 9);

    const adjustedYear = String(Number(yearPattern) - 1); // 학년도 숫자 -1
    const adjustedGrade = String(Number(gradePattern) - 1); // 학년 숫자 -1

    return adjustedYear + "학년도 " + adjustedGrade + "학년";
  };

  //분반시작 버튼누르면 실행
  const submitHandler = (e) => {
    e.preventDefault();
    setYearGrade(
      yearInput.current.value + "학년도 " + gradeInput.current.value + "학년"
    );
    const nextClass = +classInput.current.value;
    let divideWay = "";
    if (divideType === "way1") {
      divideWay = "ㄹ 방식";
    } else if (divideType === "way2") {
      divideWay = "Z 방식";
    }

    Swal.fire({
      icon: "question",
      title: `${divideWay} / ${
        firstMale === "male" ? "남자 앞번호" : "여자 앞번호"
      } / ${classInput.current.value}반 `,
      text: `분반 설정과 내년 학급수를 확인해주세요. 분반 초기 작업을 시작할까요?`,
      denyButtonText: "취소",
      confirmButtonText: "확인",
      confirmButtonColor: "#85bd82",
      showDenyButton: true,
    }).then((result) => {
      /* 분반시작 누르면 */
      if (result.isConfirmed) {
        divideClassHandler(nextClass);
      }
    });
  };

  //초기화 버튼
  const originReset = () => {
    const resetOriginState = () => {
      setNextAdaptClass([...JSON.parse(JSON.stringify(nextOriginClass))]);
      // 이유들도 초기화...
      setReason([]);
    };

    Swal.fire({
      icon: "question",
      title: "초기화할까요?",
      text: `처음 배정했던 상태로 되돌릴까요? 수정했던 정보는 저장되지 않습니다!`,
      denyButtonText: "취소",
      confirmButtonText: "확인",
      confirmButtonColor: "#85bd82",
      showDenyButton: true,
    }).then((result) => {
      /* 분반시작 누르면 */
      if (result.isConfirmed) {
        resetOriginState();
      }
    });
  };

  const escapeHtml = (str) =>
    String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));

  // 쌍둥이마다 같은 반 / 다른 반 / 상관없음 물어보기
  const askTwinRules = async (classData) => {
    const { groups, unmatched } = findTwinGroups(classData);
    const MODE_LABEL = { same: "같은 반", apart: "다른 반", none: "상관없음" };
    const pairKey = (group) => group.map(studentKey).sort().join("|");

    // 전에 답한 쌍둥이가 모두 그대로면 한 번만 확인
    const saved = groups.map((g) => twinChoices.current[pairKey(g)]);
    if (groups.length > 0 && saved.every(Boolean)) {
      const list = groups
        .map((g, i) => `${escapeHtml(g.map((s) => s.name).join(", "))} → <b>${MODE_LABEL[saved[i]]}</b>`)
        .join("<br/>");
      const reuse = await Swal.fire({
        icon: "question",
        title: "쌍둥이 배정",
        html: `지난번 선택을 그대로 쓸까요?<br/><br/>${list}`,
        showDenyButton: true,
        confirmButtonText: "그대로",
        denyButtonText: "다시 고르기",
        confirmButtonColor: "#85bd82",
        allowOutsideClick: false,
        allowEscapeKey: false,
      });
      if (reuse.isConfirmed) {
        return groups.map((g, i) => ({ members: g.map(studentKey), mode: saved[i] }));
      }
    }

    const rules = [];
    for (let i = 0; i < groups.length; i++) {
      const names = escapeHtml(
        groups[i].map((s) => `${s.exClass}반 ${s.name}`).join(", ")
      );
      const result = await Swal.fire({
        icon: "question",
        title: `쌍둥이 배정 (${i + 1}/${groups.length})`,
        html: `<b>${names}</b><br/><br/>내년에 어떻게 배정할까요?`,
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: "같은 반",
        denyButtonText: "다른 반",
        cancelButtonText: "상관없음",
        confirmButtonColor: "#85bd82",
        denyButtonColor: "#5c8fd6",
        allowOutsideClick: false,
        allowEscapeKey: false,
      });
      const mode = result.isConfirmed
        ? "same"
        : result.isDenied
        ? "apart"
        : "none";
      twinChoices.current[pairKey(groups[i])] = mode;
      rules.push({ members: groups[i].map(studentKey), mode });
    }
    if (unmatched.length > 0) {
      await Swal.fire({
        icon: "info",
        title: "짝을 찾지 못한 쌍둥이",
        html: `${escapeHtml(
          unmatched.map((s) => `${s.exClass}반 ${s.name}`).join(", ")
        )}<br/><br/>성과 생년월일로 짝을 찾지 못했어요. 비고에 '쌍둥이1', '쌍둥이2'처럼 짝끼리 같은 번호를 적으면 묶어서 물어봅니다.`,
        confirmButtonColor: "#85bd82",
      });
    }
    return rules;
  };

  // 자동배분 버튼
  const autoDistributeHandler = async () => {
    try {
      if (!nextAdaptClass || nextAdaptClass.length === 0) {
        Swal.fire({
          icon: "warning",
          title: "자동배분 불가",
          text: "먼저 반편성을 진행해주세요!",
          confirmButtonColor: "#85bd82",
        });
        return;
      }

      const copied = JSON.parse(JSON.stringify(nextAdaptClass)).map((cl) =>
        (cl || []).filter(Boolean).map((stu) => ({
          ...stu,
          note: stu.note || "",
          teamWork: stu.teamWork || "",
        }))
      );
      const twinRules = await askTwinRules(copied);
      const classNames = CLASS_NAME[hanglOrNum];
      const original = JSON.stringify(copied);
      let { classes: result, report } = autoDistribute(copied, {
        twinRules,
        classNames,
      });

      // '반 인원 차이 최대 1명'과 '특수반은 적게'가 부딪치면 선생님께 물어보기
      const choice = report.sizeChoice;
      if (choice?.conflict) {
        const sizesHtml = (sizes) =>
          sizes
            .map(
              (n, i) =>
                `${classNames[i]}반 ${n}명${
                  choice.specialCount[i] > 0 ? "<sup>특수</sup>" : ""
                }`
            )
            .join(" · ");
        const answer = await Swal.fire({
          icon: "question",
          title: "반 인원을 어떻게 맞출까요?",
          html: `
            <p style="font-size:14px;">이번 명단은 <b>반 인원을 고르게</b> 하면 특수 학생이 있는 반이 다른 반보다 적어지지 않아요. (전출 제외 인원)</p>
            <div style="text-align:left;font-size:14px;line-height:1.7;margin-top:12px;">
              <b>① 인원 고르게</b> (반 사이 최대 1명 차이)<br/>${sizesHtml(choice.even)}<br/><br/>
              <b>② 특수반은 적게</b> (특수 학생 1명당 1명 적게)<br/>${sizesHtml(choice.specialSmaller)}
            </div>`,
          showDenyButton: true,
          confirmButtonText: "① 인원 고르게",
          denyButtonText: "② 특수반은 적게",
          confirmButtonColor: "#85bd82",
          denyButtonColor: "#b886b8",
          allowOutsideClick: false,
          allowEscapeKey: false,
          width: 600,
        });
        if (answer.isDenied) {
          ({ classes: result, report } = autoDistribute(JSON.parse(original), {
            twinRules,
            classNames,
            sizeRule: "specialSmaller",
          }));
        }
      }

      setNextAdaptClass(orderByGenderName(result, numberOrder || firstMale));

      const rows = report.stats
        .map(
          (st, i) =>
            `<tr><td>${classNames[i]}반</td><td>${st.size}명</td><td>${st.male} / ${st.female}</td><td>${st.special}</td><td>${st.transfer}</td></tr>`
        )
        .join("");
      const warnings = report.warnings.length
        ? `<p style="color:#d32f2f;margin-top:12px;text-align:left;font-size:13px;">⚠️ 직접 확인이 필요해요<br/>${report.warnings.map(escapeHtml).join("<br/>")}</p>`
        : "";

      Swal.fire({
        icon: report.warnings.length ? "warning" : "success",
        title: "자동배분 완료",
        html: `
          <table style="margin:0 auto;font-size:13px;border-collapse:collapse;" cellpadding="4">
            <tr><th>반</th><th>인원(전출제외)</th><th>남 / 여</th><th>특수</th><th>전출</th></tr>
            ${rows}
          </table>
          <p style="color:#666;font-size:12px;margin-top:10px;">
            교환 ${report.swaps + report.genderSwaps + (report.scoreSwaps || 0)}회 · 이동 ${report.moves}회<br/>
            (교환 상대는 같은 현재반·같은 성별·점수가 비슷한 학생)
          </p>
          ${warnings}`,
        confirmButtonColor: "#85bd82",
      });
    } catch (error) {
      console.error("자동배분 에러:", error);
      Swal.fire({
        icon: "error",
        title: "자동배분 실패",
        text: "자동배분 중 오류가 발생했습니다. 다시 시도해주세요.",
      });
    }
  };

  // 상태에 따라 duplicateCheck 실행 함수
  const handleDuplicateCheck = () => {
    setCheckDupliName((prevState) => {
      const newState = !prevState; // 상태를 반전
      duplicateCheck(!prevState); // 상태 반영 후 실행
      return newState;
    });
  };

  //각반의 중복이름 체크함수
  // 성까지 같은 이름 → 진한 빨강, 성만 다르고 이름이 같으면 → 연한 빨강
  const duplicateCheck = (nowState) => {
    const FULL = classes["dupli-stu-bg"];
    const GIVEN = classes["dupli-given-bg"];
    const elOf = (stu) => document.getElementById(`${stu.exClass}-${stu.num}`);

    nextAdaptClass.forEach((cl) => {
      cl.forEach((stu) => elOf(stu)?.classList.remove(FULL, GIVEN));
    });
    if (!nowState) return;

    nextAdaptClass.forEach((cl) => {
      const fullCount = {};
      const givenCount = {};
      cl.forEach((stu) => {
        const full = String(stu.name || "").trim();
        if (!full) return;
        fullCount[full] = (fullCount[full] || 0) + 1;
        givenCount[full.slice(1)] = (givenCount[full.slice(1)] || 0) + 1;
      });
      cl.forEach((stu) => {
        const full = String(stu.name || "").trim();
        if (!full) return;
        if (fullCount[full] > 1) elOf(stu)?.classList.add(FULL);
        else if (givenCount[full.slice(1)] > 1) elOf(stu)?.classList.add(GIVEN);
      });
    });
  };

  //빈자리 클릭했을 때 학생 넣어주기
  const emptyLiClickHandler = (class_index) => {
    //temp에 학생이 저장되어 있는 경우에만 temp에 있는 학생을 현재 학급으로 옮기고 temp 비우기
    if (Object.keys(tempStudent).length !== 0) {
      let new_AdaptClass = [...nextAdaptClass];

      //만약 같은 반에서 빈자리에 넣기를 누른경우 작동하지 않도록
      if (class_index === tempStudent.next_cl_index) {
        return;
      }

      //바꾸는 이유 등록하기
      Swal.fire({
        title: "학생을 바꾸는 이유를 작성해주세요.",
        input: "textarea",
        inputAttributes: {
          autocapitalize: "off",
          maxlength: 100,
        },
        background: "#ffffffe0",
        showCancelButton: true,
        cancelButtonText: "취소",
        confirmButtonText: "저장",
      }).then((result) => {
        if (result.isConfirmed) {
          //빈칸은 저장불가
          if (result.value.trim() === "") {
            Swal.fire({
              icon: "error",
              title: "저장불가",
              text: "빈 내용을 저장할 수 없어요. 내용을 확인해주세요!",
            });

            return;
          }

          const stu_data = {
            change_or_put: "put",
            student1_name: tempStudent.name,
            student1_exClass: tempStudent.exClass,
            student1_classFromIndex: tempStudent.next_cl_index,
            student1_classToIndex: class_index,
            student2_name: "",
            student2_exClass: "",
            student2_classFromIndex: "",
            student2_classToIndex: "",
            change_reason: result.value,
          };
          console.log(stu_data);
          setReason((prev) => [...prev, { ...stu_data }]);

          // console.log(reason);
          //임시학생의 자리를 비우고
          new_AdaptClass[tempStudent.next_cl_index].splice(
            tempStudent.next_stu_index,
            1
          );

          //임시학생을 현재 반으로 넣어주기
          const student_data = { ...tempStudent };
          delete student_data.next_cl_index;
          delete student_data.next_stu_index;

          new_AdaptClass[class_index].push(student_data);

          setNextAdaptClass([...new_AdaptClass]);
          setTempStudent("");
        }
      });
    }
  };

  //내년반기준 데이터를, 기존반 기준 데이터로 변경하기...
  const orderByExClass = (returnArray) => {
    let new_AdaptClass = [...nextAdaptClass];
    let new_exClassData = [];
    let new_exClassNames = [];
    new_AdaptClass.forEach((next_cl) => {
      next_cl.forEach((stu) => {
        new_exClassNames.push(stu.exClass);
      });
    });
    new_exClassNames = [...new Set(new_exClassNames)];
    new_exClassNames.sort((a, b) => a - b);

    new_exClassNames.forEach((name) => {
      new_exClassData.push([]);
    });

    new_exClassNames.forEach((exCl, index) => {
      new_AdaptClass.forEach((next_cl, cl_index) => {
        next_cl.forEach((stu, stu_index) => {
          if (stu.exClass === exCl) {
            new_exClassData?.[index].push({
              ...stu,
              nextClass: CLASS_NAME[hanglOrNum][cl_index],
              nextNum: stu_index + 1,
            });
          }
        });
      });
    });
    new_exClassData?.map((exClData, index) => {
      exClData?.sort((a, b) => {
        if (a?.num !== "-" && b?.num !== "-") {
          return a.num - b.num;
        } else {
          return a.name?.localeCompare(b.name);
        }
      });
      return exClData;
    });

    setExClassData(new_exClassData);
    setExClassNames(new_exClassNames);

    if (returnArray) return [new_exClassData, new_exClassNames];
  };

  //엑셀파일 만들어서 저장
  const makeExcelFile = () => {
    const [exClData, exClNames] = orderByExClass(true);
    // console.log(exClData);
    // console.log(exClNames);
    // 나이스 업로드 용
    const book = utils.book_new();
    // 명렬표 용
    const book2 = utils.book_new();
    // 기존학급 용
    const book3 = utils.book_new();

    let new_AdaptClass = [...nextAdaptClass];

    new_AdaptClass.forEach((cl, cl_index) => {
      //나이스 업로드용
      let new_cl = [];

      new_cl.push([
        "성명",
        "이전학년명",
        "이전반명",
        "이전번호",
        "진급학년명",
        "진급반번호 ",
        "성별",
        "생년월일",
      ]);
      cl.forEach((stu, stu_index) => {
        new_cl.push([
          stu.name,
          +yearGrade.slice(8, 9) - 1,
          stu.exClass,
          stu.num,
          +yearGrade.slice(8, 9),
          stu_index + 1,
          stu.gender,
          stu.birthday.length === 8 ? "20" + stu.birthday : stu.birthday,
        ]);
      });
      const sheetData = utils.aoa_to_sheet(new_cl);
      sheetData["!cols"] = [
        { wpx: 40 }, // 성명
        { wpx: 60 }, // 이전학년
        { wpx: 60 }, // 이전반명
        { wpx: 60 }, // 이전번호
        { wpx: 60 }, // 진급학년명
        { wpx: 60 }, // 진급반번호
        { wpx: 40 }, // 성별
        { wpx: 70 }, // 생년월일
      ];

      //시트에 작성한 데이터 넣기 파일명, 데이터, 시트명
      utils.book_append_sheet(
        book,
        sheetData,
        `${CLASS_NAME[hanglOrNum][cl_index]}반`
      );

      //교사용 명렬표
      let new_cl_2 = [];
      new_cl_2.push([
        "학년",
        "반",
        "번호 ",
        "이름",
        "성별",
        "생년월일",
        "이전반",
        "이전번호",
        "총점",
        "비고",
        "협동",
      ]);
      cl.forEach((stu, stu_index) => {
        new_cl_2.push([
          +yearGrade.slice(8, 9),
          CLASS_NAME[hanglOrNum][cl_index],
          stu_index + 1,
          stu.name,
          stu.gender,
          stu.birthday,
          stu.exClass,
          stu.num,
          stu.score,
          stu.note || "",
          stu.teamWork || "",
        ]);
      });
      const sheetData2 = utils.aoa_to_sheet(new_cl_2);
      sheetData2["!cols"] = [
        { wpx: 40 }, // 진급학년
        { wpx: 40 }, // 진급반
        { wpx: 30 }, // 진급번호
        { wpx: 60 }, // 이름
        { wpx: 40 }, // 성별
        { wpx: 70 }, // 생년월일
        { wpx: 50 }, // 이전반
        { wpx: 60 }, // 이전반 번호
        { wpx: 50 }, // 총점
        { wpx: 60 }, // 비고
        { wpx: 40 }, // 협동
      ];

      //시트에 작성한 데이터 넣기 파일명, 데이터, 시트명
      utils.book_append_sheet(
        book2,
        sheetData2,
        `${CLASS_NAME[hanglOrNum][cl_index]}반`
      );
    });

    exClData.forEach((cl, cl_index) => {
      //기존학급용 명렬표
      let new_cl_3 = [];
      new_cl_3.push([
        "학년",
        "반",
        "번호 ",
        "이름",
        "성별",
        "생년월일",
        "내년반",
        "내년번호",
        "총점",
        "비고",
        "협동",
      ]);
      cl.forEach((stu, stu_index) => {
        new_cl_3.push([
          +yearGrade.slice(8, 9) - 1,
          stu.exClass,
          stu.num,
          stu.name,
          stu.gender,
          stu.birthday,
          stu.nextClass,
          stu.nextNum,
          stu.score,
          stu.note || "",
          stu.teamWork || "",
        ]);
      });
      const sheetData3 = utils.aoa_to_sheet(new_cl_3);
      sheetData3["!cols"] = [
        { wpx: 40 }, // 기존학년
        { wpx: 40 }, // 기존반
        { wpx: 30 }, // 기존번호
        { wpx: 60 }, // 이름
        { wpx: 40 }, // 성별
        { wpx: 70 }, // 생년월일
        { wpx: 50 }, // 내년반
        { wpx: 60 }, // 내년반 번호
        { wpx: 50 }, // 총점
        { wpx: 60 }, // 비고
        { wpx: 40 }, // 협동
      ];

      //시트에 작성한 데이터 넣기 파일명, 데이터, 시트명

      utils.book_append_sheet(book3, sheetData3, `${exClNames[cl_index]}반`);
    });

    writeFile(book, `${yearGrade} 학급편성자료(나이스용).xlsx`);

    writeFile(book2, `${yearGrade} 학급편성자료(명렬표).xlsx`);

    writeFile(book3, `내년도 학급편성자료(기존학급기준).xlsx`);
  };

  //한글(HWPX) 양식 파일 만들어서 저장 (서식1 통계표 / 서식2 이전반 기준 / 서식3 진급반 기준)
  const makeHwpxFile = async () => {
    try {
      const res = await fetch(`${process.env.PUBLIC_URL}/hwpx/header.xml`);
      if (!res.ok) throw new Error("양식 스타일 파일을 불러오지 못했습니다.");
      const headerXml = await res.text();
      const { file, fileName } = await makeClassFormHwpx({
        yearGrade,
        nextClasses: nextAdaptClass,
        classNames: CLASS_NAME[hanglOrNum],
        headerXml,
      });
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "한글 파일 저장 실패",
        text: err.message || "한글 파일을 만드는 중 문제가 생겼습니다.",
      });
    }
  };

  // ============================================================
  // 비고 편집 관련 상수 및 함수들
  // ============================================================

  // 11개 카테고리 버튼 (레벨 포함)
  const NOTE_CATEGORIES = [
    "생활지도-상", "생활지도-중", "생활지도-하",
    "학부모-상", "학부모-중", "학부모-하",
    "학습부진", "특수반", "다문화", "쌍둥이", "전출"
  ];

  // 기존 비고 파싱 함수
  function parseExistingNote(noteString) {
    if (!noteString || noteString.trim() === "") {
      return { categories: [], freeText: "" };
    }

    const parts = noteString.split(",").map(p => p.trim());
    const categories = [];
    let freeText = "";

    parts.forEach(part => {
      if (NOTE_CATEGORIES.includes(part)) {
        categories.push(part);
      } else {
        // 카테고리가 아닌 경우 자유 입력으로 간주
        freeText += (freeText ? ", " : "") + part;
      }
    });

    return { categories, freeText };
  }

  // 비고 문자열 조합 함수
  function buildNoteString() {
    if (!window.noteEditorState) return "";

    const { selectedCategories, freeText } = window.noteEditorState;
    const parts = [...selectedCategories];

    if (freeText && freeText.trim()) {
      parts.push(freeText.trim());
    }

    return parts.join(", ");
  }

  // 카테고리 토글 함수 (Window 객체에 노출)
  window.toggleCategory = (category) => {
    if (!window.noteEditorState) return;

    const { selectedCategories } = window.noteEditorState;
    const index = selectedCategories.indexOf(category);

    if (index > -1) {
      selectedCategories.splice(index, 1);
    } else {
      selectedCategories.push(category);
    }

    // 버튼 UI 업데이트
    const btn = document.querySelector(`[data-category="${category}"]`);
    if (btn) {
      if (index > -1) {
        btn.classList.remove("category-btn-selected");
      } else {
        btn.classList.add("category-btn-selected");
      }
    }

    updatePreview();
  };

  // 모두 삭제 함수 (Window 객체에 노출)
  window.clearAllCategories = () => {
    if (!window.noteEditorState) return;

    // 모든 카테고리 선택 해제
    window.noteEditorState.selectedCategories = [];

    // 모든 버튼 선택 해제
    document.querySelectorAll('.category-btn-selected').forEach(btn => {
      btn.classList.remove('category-btn-selected');
    });

    // 자유 입력 필드 비우기
    const freeTextInput = document.getElementById("free-note");
    if (freeTextInput) {
      freeTextInput.value = "";
      window.noteEditorState.freeText = "";
    }

    updatePreview();
  };

  // 에이스/마이너스 토글 함수 (Window 객체에 노출)
  window.toggleTeamWork = (type) => {
    if (!window.noteEditorState) return;

    // 현재 선택된 타입과 같으면 해제, 다르면 변경
    if (window.noteEditorState.teamWork === type) {
      window.noteEditorState.teamWork = "";
    } else {
      window.noteEditorState.teamWork = type;
    }

    // UI 업데이트
    const aceBtn = document.getElementById("ace-btn");
    const minusBtn = document.getElementById("minus-btn");

    if (aceBtn && minusBtn) {
      aceBtn.style.opacity = window.noteEditorState.teamWork === "굿" ? "1" : "0.5";
      aceBtn.style.fontWeight = window.noteEditorState.teamWork === "굿" ? "bold" : "normal";

      minusBtn.style.opacity = window.noteEditorState.teamWork === "배드" ? "1" : "0.5";
      minusBtn.style.fontWeight = window.noteEditorState.teamWork === "배드" ? "bold" : "normal";
    }

    updatePreview();
  };

  // 협동 삭제 함수 (Window 객체에 노출)
  window.clearTeamWork = () => {
    if (!window.noteEditorState) return;

    window.noteEditorState.teamWork = "";

    // UI 업데이트
    const aceBtn = document.getElementById("ace-btn");
    const minusBtn = document.getElementById("minus-btn");

    if (aceBtn && minusBtn) {
      aceBtn.style.opacity = "0.5";
      aceBtn.style.fontWeight = "normal";
      minusBtn.style.opacity = "0.5";
      minusBtn.style.fontWeight = "normal";
    }

    updatePreview();
  };

  // 미리보기 업데이트 함수
  function updatePreview() {
    if (!window.noteEditorState) return;

    const freeTextInput = document.getElementById("free-note");
    if (freeTextInput) {
      window.noteEditorState.freeText = freeTextInput.value;
    }

    const notePreviewEl = document.getElementById("note-preview");
    if (notePreviewEl) {
      const previewText = buildNoteString();
      notePreviewEl.textContent = previewText || "(없음)";
    }

    const teamWorkPreviewEl = document.getElementById("teamwork-preview");
    if (teamWorkPreviewEl) {
      teamWorkPreviewEl.textContent = window.noteEditorState.teamWork || "(없음)";
    }
  }

  // 노트 에디터 초기화 함수
  function initializeNoteEditor(existingNote, existingTeamWork) {
    const { categories, freeText } = parseExistingNote(existingNote);

    window.noteEditorState = {
      selectedCategories: [...categories],
      freeText: freeText,
      teamWork: existingTeamWork || ""
    };

    // 자유 입력 필드 이벤트 리스너
    setTimeout(() => {
      const freeTextInput = document.getElementById("free-note");
      if (freeTextInput) {
        freeTextInput.value = freeText;
        freeTextInput.addEventListener("input", updatePreview);
      }

      // 선택된 카테고리 버튼 활성화
      categories.forEach(cat => {
        const btn = document.querySelector(`[data-category="${cat}"]`);
        if (btn) {
          btn.classList.add("category-btn-selected");
        }
      });

      // 에이스/마이너스 버튼 초기 상태 설정
      const aceBtn = document.getElementById("ace-btn");
      const minusBtn = document.getElementById("minus-btn");
      if (aceBtn && minusBtn) {
        aceBtn.style.opacity = existingTeamWork === "굿" ? "1" : "0.5";
        aceBtn.style.fontWeight = existingTeamWork === "굿" ? "bold" : "normal";
        minusBtn.style.opacity = existingTeamWork === "배드" ? "1" : "0.5";
        minusBtn.style.fontWeight = existingTeamWork === "배드" ? "bold" : "normal";
      }

      updatePreview();
    }, 100);
  }

  // 비고 편집 메인 핸들러
  const handleNoteEdit = async (stu, classIndex, studentIndex) => {
    const hasNote = stu.note && stu.note.trim() !== "";
    const hasTeamWork = stu.teamWork && stu.teamWork.trim() !== "";

    const result = await Swal.fire({
      title: `${stu.exClass}반 ${stu.name} - 비고 / 협동 수정`,
      html: `
        <div style="margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong>비고 선택:</strong>
            ${hasNote ? `
              <button
                onclick="clearAllCategories()"
                type="button"
                style="padding: 6px 12px; border: 2px solid #d32f2f; border-radius: 6px; background: #f44336; color: white; cursor: pointer; font-size: 12px; font-weight: bold;"
              >
                🗑️ 비고 삭제
              </button>
            ` : ''}
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px;">
            ${NOTE_CATEGORIES.map(cat => `
              <button
                class="category-btn"
                data-category="${cat}"
                onclick="toggleCategory('${cat}')"
                type="button"
                style="padding: 8px 12px; border: 2px solid #ddd; border-radius: 8px; background: white; cursor: pointer; font-size: 13px;"
              >
                ${cat}
              </button>
            `).join('')}
          </div>
        </div>

        <div style="margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong>협동:</strong>
            ${hasTeamWork ? `
              <button
                onclick="clearTeamWork()"
                type="button"
                style="padding: 6px 12px; border: 2px solid #d32f2f; border-radius: 6px; background: #f44336; color: white; cursor: pointer; font-size: 12px; font-weight: bold;"
              >
                🗑️ 협동 삭제
              </button>
            ` : ''}
          </div>
          <div style="display: flex; gap: 8px; margin-top: 10px; justify-content: center;">
            <button
              id="ace-btn"
              onclick="toggleTeamWork('굿')"
              type="button"
              style="padding: 10px 30px; border: 2px solid #5a9e0d; border-radius: 8px; background: #70be0d69; cursor: pointer; font-size: 14px; font-weight: bold; opacity: 0.5;"
            >
              ⭐ 에이스
            </button>
            <button
              id="minus-btn"
              onclick="toggleTeamWork('배드')"
              type="button"
              style="padding: 10px 30px; border: 2px solid #8b0000; border-radius: 8px; background: #8b000080; color: white; cursor: pointer; font-size: 14px; font-weight: bold; opacity: 0.5;"
            >
              ⚠️ 마이너스
            </button>
          </div>
        </div>

        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">추가 내용:</label>
          <textarea
            id="free-note"
            placeholder="자유롭게 입력하세요"
            style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; min-height: 60px; box-sizing: border-box;"
          ></textarea>
        </div>

        <div style="padding: 10px; background-color: #e7f3ff; border-radius: 5px;">
          <div style="margin-bottom: 5px;"><strong>비고 -</strong> <span id="note-preview">${stu.note || "(없음)"}</span></div>
          <div><strong>협동 -</strong> <span id="teamwork-preview">${stu.teamWork || "(없음)"}</span></div>
        </div>
      `,
      width: "600px",
      showCancelButton: true,
      confirmButtonText: "저장",
      cancelButtonText: "취소",
      didOpen: () => {
        initializeNoteEditor(stu.note || "", stu.teamWork || "");
      },
      preConfirm: () => {
        return {
          note: buildNoteString(),
          teamWork: window.noteEditorState?.teamWork || ""
        };
      }
    });

    if (result.isConfirmed) {
      // State 업데이트
      const updatedClass = [...nextAdaptClass];
      updatedClass[classIndex][studentIndex] = {
        ...updatedClass[classIndex][studentIndex],
        note: result.value.note,
        teamWork: result.value.teamWork
      };
      setNextAdaptClass(updatedClass);

      Swal.fire({
        icon: "success",
        title: "비고가 수정되었습니다",
        html: `
          <div>비고: ${result.value.note || "(삭제됨)"}</div>
          <div>협동: ${result.value.teamWork || "(없음)"}</div>
        `,
        timer: 2000,
        showConfirmButton: false
      });
    }

    // 정리
    delete window.noteEditorState;
  };

  function truncateString(str, maxLength) {
    if (!noteSummary && str.length > maxLength) {
      return "🚩" + str.substring(0, maxLength) + "...";
    }
    return str;
  }

  return (
    <div className={classes["App"]}>
      {/* localStorage에 학생정보가 없으면...엑셀업로드화면 보여주기 */}

      {classStudents?.length === 0 && (
        <>
          <ExcelUploader
            setStudents={(students, isNew, yearGr) => {
              setClassStudents([...students]);
              if (!isNew) {
                setNextOriginClass([...students]);
                setNextAdaptClass([...students]);
                setDivided(true);
                setYearGrade(yearGr);
              }
            }}
          />
        </>
      )}
      {/* 아직 분반 전에 보일 화면들 */}
      {!divided &&
        // {/* 학생명부가 있으면 반배정 규칙 선택하기 1.ㄹ 2.z  +  내년 학급수 입력 후 반배정!버튼 누르기*/}
        classStudents?.length > 0 && (
          <>
            <div className={classes["newClassOption"]}>
              {/* 분반할 때 방법 ㄹ / z 선택 */}
              <div className={classes["btnGroup-div"]}>
                <button
                  id="way2"
                  className={
                    divideType === "way2"
                      ? classes["clickedBtn"]
                      : classes["nonClickedBtn"]
                  }
                  onClick={(e) => divideTypeHandler(e)}
                >
                  Z 방식 분반
                </button>
                <button
                  id="way1"
                  className={
                    divideType === "way1"
                      ? classes["clickedBtn"]
                      : classes["nonClickedBtn"]
                  }
                  onClick={(e) => divideTypeHandler(e)}
                >
                  ㄹ 방식 분반
                </button>
              </div>
              {/* 분반 남/여 앞번호 설정 */}
              <div className={classes["btnGroup-div"]}>
                <button
                  id="female"
                  className={
                    firstMale === "female"
                      ? classes["clickedBtn"]
                      : classes["nonClickedBtn"]
                  }
                  onClick={() => setFirstMale("female")}
                >
                  여자 앞번호
                </button>
                <button
                  id="male"
                  className={
                    firstMale === "male"
                      ? classes["clickedBtn"]
                      : classes["nonClickedBtn"]
                  }
                  onClick={() => setFirstMale("male")}
                >
                  남자 앞번호
                </button>
              </div>

              {/* 학급명 가나다 or 123 */}
              <div className={classes["btnGroup-div"]}>
                <button
                  id="hangle"
                  className={
                    hanglOrNum === 0
                      ? classes["clickedBtn"]
                      : classes["nonClickedBtn"]
                  }
                  onClick={() => setHanglOrNum(0)}
                >
                  한글반명(가나다..)
                </button>
                <button
                  id="hangle"
                  className={
                    hanglOrNum === 1
                      ? classes["clickedBtn"]
                      : classes["nonClickedBtn"]
                  }
                  onClick={() => setHanglOrNum(1)}
                >
                  숫자반명(123..)
                </button>
              </div>

              {/* 남여비율 고려 */}
              <div className={classes["btnGroup-div"]}>
                <button
                  className={
                    !conGenderRate
                      ? classes["clickedBtn"]
                      : classes["nonClickedBtn"]
                  }
                  onClick={() => setConGenderRate(false)}
                >
                  성적 우선
                </button>
                <button
                  className={
                    conGenderRate
                      ? classes["clickedBtn"]
                      : classes["nonClickedBtn"]
                  }
                  onClick={() => setConGenderRate(true)}
                >
                  성비 고려
                </button>
              </div>
            </div>
            <form onSubmit={submitHandler} className={classes["form"]}>
              <div className={classes["formLabelInput"]}>
                <label className={classes["yearLabel"]}>
                  <input
                    type="number"
                    defaultValue={
                      new Date().getMonth() > 6
                        ? new Date().getFullYear() + 1
                        : new Date().getFullYear()
                    }
                    min={new Date().getFullYear()}
                    ref={yearInput}
                    className={classes["yearInput"]}
                    required
                  />
                  학년도
                </label>
                <label className={classes["gradeClassLabel"]}>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    ref={gradeInput}
                    className={classes["classInput"]}
                    required
                  />
                  학년
                  <input
                    type="number"
                    min="1"
                    max="14"
                    ref={classInput}
                    className={classes["classInput"]}
                    required
                  />
                  학급
                </label>
              </div>
              <button
                className={`${classes["nonClickedBtn"]} ${classes["divide"]}`}
              >
                분반 시작
              </button>
            </form>
          </>
        )}
      {/* 초기화버튼, 중복이름확인버튼, 이름순재정렬, 엑셀저장버튼,  */}
      {divided && (
        <>
          <span className={classes["gradeClassSpan"]}>
            {orderOriginClass ? editYearAndGrade(yearGrade) : yearGrade}
          </span>

          <div>
            <button
              className={`${classes["settingBtn"]} ${classes["explainBg"]}`}
              onClick={() => setShowExplain((prev) => !prev)}
            >
              {showExplain ? "설명숨기기" : "설명보기"}
            </button>
            <button
              className={classes["settingBtn"]}
              onClick={() => setNoteSummary((prev) => !prev)}
              title={"비고의 내용이 긴 경우 줄이거나, 모두 보이도록 펼쳐주기"}
            >
              {noteSummary ? "비고 줄이기" : "비고 펼치기"}
            </button>
            <button className={classes["settingBtn"]} onClick={originReset}>
              초기화
            </button>
            <button className={classes["settingBtn"]} onClick={autoDistributeHandler}>
              1. 자동배분
            </button>
            <button
              className={classes["settingBtn"]}
              onClick={handleDuplicateCheck}
            >
              {!checkDupliName ? "2. 중복이름확인" : "중복해제"}
            </button>
            <button
              className={classes["settingBtn"]}
              onClick={orderByClassHandler}
            >
              {!orderOriginClass ? "현재학급 기준" : "내년학급 기준"}
            </button>
            <button
              className={`${classes["settingBtn"]} ${classes["male"]}`}
              onClick={() => {
                setNumberOrder("male");
                let new_AdaptClass = orderByGenderName(nextAdaptClass, "male");
                setNextAdaptClass([...new_AdaptClass]);
              }}
            >
              남자 앞번호
            </button>
            <button
              className={`${classes["settingBtn"]} ${classes["male"]}`}
              onClick={() => {
                setNumberOrder("female");
                let new_AdaptClass = orderByGenderName(
                  nextAdaptClass,
                  "female"
                );
                setNextAdaptClass([...new_AdaptClass]);
              }}
            >
              여자 앞번호
            </button>
            <button
              className={`${classes["settingBtn"]} ${classes["male"]}`}
              onClick={() => {
                setNumberOrder("whole");
                let new_AdaptClass = orderByGenderName(nextAdaptClass, "whole");
                setNextAdaptClass([...new_AdaptClass]);
              }}
            >
              혼성번호
            </button>

            <button className={classes["settingBtn"]} onClick={makeExcelFile}>
              3. 엑셀파일 저장
            </button>
            <button
              className={classes["settingBtn"]}
              onClick={makeHwpxFile}
              title="학급편성 계획 서식1(통계표)·서식2(이전반 기준)·서식3(진급반 기준)을 한글 파일로 저장"
            >
              4. 한글 양식 저장
            </button>

            <button
              className={classes["settingBtn"]}
              onClick={() => window.print()}
              style={{ marginLeft: "10px" }}
            >
              🖨️ 인쇄
            </button>
          </div>

          {/* 현재학급 필터 버튼들 */}
          <div style={{ marginTop: "15px", padding: "10px", backgroundColor: "#f9f9f9", borderRadius: "8px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "5px" }}>
            <strong style={{ marginRight: "10px", fontSize: "14px" }}>정렬:</strong>
            <button
              className={classes["settingBtn"]}
              onClick={orderByName}
              style={{
                padding: "8px 16px",
                fontSize: "12px",
                backgroundColor: "#e3f2fd"
              }}
            >
              이름순 ↓
            </button>
            <button
              className={classes["settingBtn"]}
              onClick={orderByExClassNum}
              style={{
                padding: "8px 16px",
                fontSize: "12px",
                backgroundColor: "#e3f2fd",
                marginRight: "10px"
              }}
            >
              학급순 ↓
            </button>
            <strong style={{ marginRight: "10px", fontSize: "14px" }}>현재학급 표시:</strong>
            {(() => {
              // nextAdaptClass에서 현재 학급 목록 추출
              const allExClasses = nextAdaptClass.flat().map(stu => stu.exClass).filter(Boolean);
              const uniqueExClasses = [...new Set(allExClasses)].sort((a, b) => {
                // 숫자로 정렬
                const numA = parseInt(a);
                const numB = parseInt(b);
                return numA - numB;
              });

              return uniqueExClasses.map((className) => (
                <button
                  key={className}
                  className={classes["settingBtn"]}
                  style={{
                    padding: "10px",
                    fontSize: "12px",
                    backgroundColor: selectedExClasses.includes(className) ? "#ffd700" : "#fff",
                    fontWeight: selectedExClasses.includes(className) ? "bold" : "normal"
                  }}
                  onClick={() => {
                    setSelectedExClasses(prev => {
                      if (prev.includes(className)) {
                        // 이미 선택된 경우 해제
                        return prev.filter(c => c !== className);
                      } else {
                        // 새로 선택
                        return [...prev, className];
                      }
                    });
                  }}
                >
                  {className}반
                </button>
              ));
            })()}
            <button
              className={classes["settingBtn"]}
              style={{
                padding: "10px",
                fontSize: "12px",
                backgroundColor: selectedExClasses.length > 0 ? "#f44336" : "#999",
                color: "white"
              }}
              onClick={() => setSelectedExClasses([])}
            >
              전체 해제
            </button>
          </div>

          {/* 설명보여주기 부분의 설명*/}
          {showExplain && (
            <div className={classes["helpPanel"]}>
              <div className={classes["helpLegend"]}>
                <strong>색 안내</strong>
                {EXPLAIN_LEGEND.map((legend) => (
                  <span key={legend.label} className={classes["helpLegendItem"]}>
                    <i
                      className={`${classes["helpSwatch"]} ${
                        classes[legend.className]
                      }`}
                    />
                    {legend.label}
                  </span>
                ))}
              </div>
              {EXPLAINS.map((section) => (
                <div key={section.title} className={classes["helpCard"]}>
                  <h3>{section.title}</h3>
                  <ul>
                    {section.items.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {/* 가배정이 끝나면...가배정 화면 보여주기 학생이름 작년반 작년번호*/}
      {divided && (
        <>
          <div className={classes["newClass-div"]}>
            {nextAdaptClass.map((cl, index) => (
              <div
                className={classes["newClass-ul"]}
                key={cl + index + "반div"}
                style={{ padding: "0 5px" }}
              >
                <span className={classes["gradeClassSpan"]}>
                  {!orderOriginClass
                    ? CLASS_NAME[hanglOrNum][index]
                    : cl[0]?.exClass}
                  반
                </span>

                <div
                  className={classes["newClass-li"]}
                  style={{
                    border: "none",
                    padding: "5px 0",
                    marginBottom: "-20px",
                  }}
                >
                  <span className={classes["newClassSpan-name"]}>
                    <b>이름</b>
                  </span>
                  <span
                    className={classes["newClassSpan-exClass"]}
                    onClick={orderByClassHandler}
                  >
                    <b style={{ fontSize: "10px" }}>
                      {!orderOriginClass ? "현재" : "내년"}
                    </b>
                  </span>
                  <span className={classes["newClassSpan-gender"]}>
                    <b style={{ fontSize: "10px" }}>성별</b>
                  </span>
                  <span className={classes["newClassSpan-score"]}>
                    <b style={{ fontSize: "10px" }}>점수</b>
                  </span>
                  <span className={classes["newClassSpan-note"]}>
                    <b>비고</b>
                  </span>
                </div>

                <ul
                  className={classes["newClass-ul"]}
                  //  key={`newclass${index}`}
                >
                  {cl.map((stu, stu_index) => (
                    <li
                      id={stu.exClass + "-" + stu.num}
                      className={`${classes["newClass-li"]} ${
                        stu.teamWork === "굿" ? classes["goodStudent"] : ""
                      } ${
                        stu.teamWork === "배드" ? classes["badStudent"] : ""
                      } ${
                        stu.note?.includes("특수") ? classes["specialStudent"] : ""
                      } ${
                        selectedExClasses.includes(stu.exClass)
                          ? (stu.gender === "남" ? classes["highlightedExClassMale"] : classes["highlightedExClassFemale"])
                          : ""
                      }`}
                      // className={`${classes["newClass-li"]} ${
                      //   stu.teamWork === 1 ? classes["cl1"] : ""
                      // } ${stu.teamWork === 2 ? classes["cl2"] : ""} ${
                      //   stu.teamWork === 3 ? classes["cl3"] : ""
                      // } ${stu.teamWork === 4 ? classes["cl4"] : ""} ${
                      //   stu.teamWork === 5 ? classes["cl5"] : ""
                      // } ${stu.teamWork === 6 ? classes["cl6"] : ""}`}
                      key={stu.exClass + stu_index + stu.name}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        handleNoteEdit(stu, index, stu_index);
                      }}
                      onClick={(e) => {
                        const currentT = e.currentTarget;
                        // 클릭된 학생이 없었으면 템프에 추가해두고 테두리 진하게!

                        if (Object.keys(tempStudent).length === 0) {
                          setTempStudent({
                            ...stu,
                            next_cl_index: index,
                            next_stu_index: stu_index,
                          });

                          // 테두리 점선으로 파랗게
                          currentT.style.border = "dashed #2771df";

                          //같은 학생을 클릭하면 초기화
                        } else if (
                          tempStudent.exClass === stu.exClass &&
                          tempStudent.num === stu.num
                        ) {
                          setTempStudent("");
                          currentT.style.border = "";
                          //다른 학생을 클릭하면 두 학생 바꾸기
                        } else {
                          // 테두리 점선으로 파랗게
                          currentT.style.border = "dashed #2771df";

                          //바꾸는 이유 등록하기
                          Swal.fire({
                            title: "학생을 바꾸는 이유를 작성해주세요.",
                            text: "(선택사항 - 빈칸 가능)",
                            input: "textarea",
                            inputAttributes: {
                              autocapitalize: "off",
                              maxlength: 100,
                            },
                            background: "#ffffffe0",
                            showCancelButton: true,
                            cancelButtonText: "취소",
                            confirmButtonText: "저장",
                          }).then((result) => {
                            if (result.isConfirmed) {
                              const stu_data = {
                                change_or_put: "change",
                                student1_name: tempStudent.name,
                                student1_exClass: tempStudent.exClass,
                                student1_classFromIndex:
                                  tempStudent.next_cl_index,
                                student1_classToIndex: index,
                                student2_name: stu.name,
                                student2_exClass: stu.exClass,
                                student2_classFromIndex: index,
                                student2_classToIndex:
                                  tempStudent.next_cl_index,
                                change_reason: result.value || "",
                              };
                              // console.log(stu_data);
                              setReason((prev) => [...prev, { ...stu_data }]);

                              // console.log(reason);

                              //클릭된 학생이 있었으면 전체 학생 목록에서 현재 학생 자료를 찾아서 temp 자료와 바꾸기
                              let new_AdaptClass = [...nextAdaptClass];

                              //임시학생의 자리에 현재 학생의 정보를 넣고
                              new_AdaptClass[tempStudent.next_cl_index][
                                tempStudent.next_stu_index
                              ] = { ...stu };

                              //현재학생의 자리에 임시학생의 정보를 넣기
                              new_AdaptClass[index][stu_index] = {
                                ...tempStudent,
                              };

                              // setTimeout(() => {
                              setNextAdaptClass([...new_AdaptClass]);
                              setTempStudent("");
                              // }, 2000);
                            } else {
                              // 테두리 점선으로 파랗게
                              currentT.style.border = "";
                              return;
                            }
                          });
                        }
                      }}
                    >
                      <span
                        className={classes["newClassSpan-name"]}
                        title="좌클릭: 학급변경 / 우클릭: 비고수정"
                      >
                        {stu.name}
                      </span>
                      <span
                        className={classes["newClassSpan-exClass"]}
                        title="좌클릭: 학급변경 / 우클릭: 비고수정"
                      >
                        {orderOriginClass ? stu?.nextClass : stu.exClass}
                      </span>
                      <span
                        className={classes["newClassSpan-gender"]}
                        title="좌클릭: 학급변경 / 우클릭: 비고수정"
                      >
                        {stu.gender}
                      </span>
                      <span
                        className={classes["newClassSpan-score"]}
                        title="좌클릭: 학급변경 / 우클릭: 비고수정"
                      >
                        {stu.score}
                      </span>
                      <span
                        className={classes["newClassSpan-note"]}
                        title={
                          stu.note?.length > 4 ? stu.name + ") " + stu.note : ""
                        }
                      >
                        {truncateString(stu.note, 4)}
                      </span>
                    </li>
                  ))}
                  <button
                    className={classes["emptyBtn"]}
                    // 학급 인덱스 보내기
                    onClick={() => emptyLiClickHandler(index)}
                  >
                    빈자리에 넣기
                  </button>
                </ul>
              </div>
            ))}
          </div>

          <div className={classes["newClass-div"]}>
            {nextAdaptClass.map((cl, index) => (
              <div key={index} className={classes["newClass-ul"]}>
                <span className={classes["gradeClassSpan"]}>
                  {CLASS_NAME[hanglOrNum][index]} 반
                </span>

                <div
                  className={classes["goodStudent"]}
                  title="협동에 '굿' 기록 학생 수"
                >
                  에이스 -{" "}
                  {cl.filter((stu) => stu.teamWork.includes("굿")).length} 명
                </div>
                <div
                  className={classes["badStudent"]}
                  title="협동에 '배드' 기록 학생 수"
                >
                  마이너스 -{" "}
                  {cl.filter((stu) => stu.teamWork.includes("배드")).length} 명
                </div>

                <div
                  className={classes["grayBack"]}
                  title="비고에 '쌍둥이' 혹은 '쌍생아' 기록 학생 수"
                >
                  쌍둥이 -{" "}
                  {
                    cl.filter(
                      (stu) =>
                        stu.note.includes("쌍둥이") ||
                        stu.note.includes("쌍생아")
                    ).length
                  }{" "}
                  명
                </div>
                <div title="비고에 '생활지도' 기록 학생 수">
                  생활지도 -{" "}
                  {cl.filter((stu) => stu.note.includes("생활지도")).length} 명
                </div>
                <div
                  className={classes["grayBack"]}
                  title="비고에 '학습부진' 기록 학생 수"
                >
                  학습부진 -{" "}
                  {cl.filter((stu) => stu.note.includes("학습부진")).length} 명
                </div>
                <div title="비고에 '다문화' 기록 학생 수">
                  다문화 -{" "}
                  {cl.filter((stu) => stu.note.includes("다문화")).length} 명
                </div>
                <div
                  className={classes["grayBack"]}
                  title="비고에 '학부모' 기록 학생 수"
                >
                  학부모 -{" "}
                  {cl.filter((stu) => stu.note.includes("학부모")).length} 명
                </div>

                <div title="전출학생 제외한 비고 존재 학생 수">
                  비고 -{" "}
                  {
                    cl.filter(
                      (stu) =>
                        stu.note?.trim() !== "" && !stu.note.includes("전출")
                    ).length
                  }
                </div>
                <div title="비고에 '전출' 기록 학생 수">
                  전출예정 -{" "}
                  {cl.filter((stu) => stu.note.includes("전출")).length} 명
                </div>
                <div
                  className={classes["grayBack"]}
                  style={{ fontSize: "20px" }}
                >
                  남 {cl.filter((stu) => stu.gender === "남").length} / 여{" "}
                  {cl.filter((stu) => stu.gender === "여").length} <br />
                  총 {cl.length}명 <br />
                  <hr />
                  <div style={{ fontSize: "14px", marginTop: "5px" }}>
                    <div style={{ fontSize: "10px", color: "#666" }}>전출제외</div>
                    남 {cl.filter((stu) => stu.gender === "남" && !stu.note.includes("전출")).length} / 여{" "}
                    {cl.filter((stu) => stu.gender === "여" && !stu.note.includes("전출")).length}<br />
                    총 {cl.length - cl.filter((stu) => stu.note.includes("전출")).length}명
                  </div>
                </div>
                <div
                  className={classes["specialStudent"]}
                  title="비고에 '특수' 혹은 '특수반' 기록 학생 수"
                >
                  특수반 -{" "}
                  {cl.filter((stu) => stu.note.includes("특수")).length} 명
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {reason?.length > 0 && (
        <div className={classes["reason-div"]}>
          {" "}
          {reason?.map((data, index) => (
            <li key={"reason" + index} className={classes["reason-li"]}>
              {/* 바꾼 1번 학생 보여주기 */}
              <span className={classes["cl2"]}>
                {data.student1_name}(현재 {data.student1_exClass}반)
              </span>
              {CLASS_NAME[hanglOrNum][data.student1_classFromIndex]}반 👉
              {CLASS_NAME[hanglOrNum][data.student1_classToIndex]}반{" "}
              {/* 교환인 학생만 2번 학생도 보여줌 */}
              {data.change_or_put === "change" && (
                <>
                  <span className={classes["cl1"]}>
                    {data.student2_name}(현재 {data.student2_exClass}반)
                  </span>{" "}
                  {CLASS_NAME[hanglOrNum][data.student2_classFromIndex]}반 👉{" "}
                  {CLASS_NAME[hanglOrNum][data.student2_classToIndex]}반
                </>
              )}
              {/* 바꾼 이유 보여주기 */}
              <span className={classes["cl5"]}>이유: {data.change_reason}</span>
            </li>
          ))}{" "}
        </div>
      )}

      {!divided && (
        <div className={classes["updateLog"]}>
          <b>업데이트 기록</b>
          <ul>
            {UPDATE_LOG.map(({ date, text }) => (
              <li key={date + text}>
                <span>{date}</span> {text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer className={classes["footer"]}>
        by 말랑한거봉🍇 kerbong@gmail.com
      </footer>
    </div>
  );
}

export default App;
