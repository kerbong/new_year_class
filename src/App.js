import React, { useState, useRef, useEffect } from "react";
import { utils, writeFile } from "xlsx";
import Swal from "sweetalert2";
import OpenAI from "openai";
import classes from "./App.module.css";
import ExcelUploader from "./component/ExcelUploader";

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

const EXPLAINS = [
  "* 브라우저 확대/축소 (Ctrl+마우스휠) 로 한 눈에 보이도록 설정한 후 사용하세요.",
  "* 이름 / 이전반 / 성별 / 점수 / 비고 순서로 보여집니다.",
  "* 초기화 버튼을 누르면 처음 반배정되었던 상태로 되돌아갑니다.",
  "* 1. AI편성 버튼: 특정 학생들만 선별하여 재배치합니다 (사용자 입력 학생 + 비고 있는 학생 + 배드 학생 균등 배치). AI 편성 후 '2. 자동배분' 버튼으로 전체 균형을 최적화하세요!",
  "* 2. 자동배분 버튼: 1차-생활지도/학습부진/다문화/학부모, 2차-에이스(굿), 3차-그룹, 4차-배드, 5차-전체 인원수(특수반 +1 가중치) 및 성비 균형을 자동으로 맞춥니다.",
  "* 사이트를 새로고침 하실 경우 작업 중이던 자료가 사라집니다.",
  "* 3. 중복이름확인 버튼을 누르면 현재 상태에서 이름(성 제외)이 같은학생이 있는지 확인해서 빨간색으로 표시/제거합니다.",
  "* 내년학급기준/현재학급기준 버튼을 누르면 해당 기준으로 학생들이 정렬됩니다.",
  "* 남자 앞번호 / 여자 앞번호 / 혼성번호 버튼을 누르면 현재 상태에서 성별을 기준으로 정렬됩니다.",
  "* 두 학생을 차례로 클릭하면 테두리가 표시 되고, 이유를 입력하면 학급이 교체됩니다.",
  "* 학생을 클릭한 후 빈자리에 넣기를 누르면 해당 학급으로 이동됩니다.",
  "* 비고가 '전출'인 학생은 정렬에 상관없이 가장 뒤로 배치됩니다.",
  "* 비고의 내용이 길어서 보기가 불편한 경우(🚩표시), '비고 펼치기 | 줄이기' 버튼을 활용해주세요.",
  "* 엑셀파일로 저장하시면, 나이스 업로드용 / 교사용 명렬표 두 가지 엑셀파일이 저장됩니다.",
  "* 다음에 분반을 이어하실 경우 저장된 엑셀 파일 중 교사용 명렬표 파일을 업로드 해주세요.",
  "* 다른 자료로 배정하시려면 사이트를 새로고침(F5) 해주세요.",
  "* 학생들의 정보와 관련된 책임은 사용자에게 있습니다.",
];

const AI_CLASS_EXAMPLES = [
  "* 💡 1. AI편성은 특정 학생들만 재배치합니다:",
  "  - 사용자가 입력한 학생 (이전반 이름 형식으로 입력)",
  "  - 비고가 있는 학생 (생활지도, 학습부진 등)",
  "  - 협동이 '배드'인 학생 (⚠️ 배드 학생은 각 반에 균등하게 배치됩니다!)",
  "* ⚠️ 나머지 학생들은 현재 반에 그대로 유지됩니다.",
  "* 🔄 AI 편성 후 '2. 자동배분' 버튼을 클릭하면 전체 균형을 최적화할 수 있습니다!",
  "",
  "* 📝 조건 입력 예시:",
  "  예시 1) 1반 김원준, 1반 김태준, 3반 박혜성 한 학급에 두 명 이상 들어가지 않게",
  "  예시 2) 2반 이준우, 4반 최민재 같은 반으로",
  "  예시 3) 1반 송아린, 3반 임수진 다른 반으로",
];

function App() {
  const [classStudents, setClassStudents] = useState([]);
  const [nextOriginClass, setNextOriginClass] = useState([]);
  const [nextAdaptClass, setNextAdaptClass] = useState([]);
  const [divideType, setDivideType] = useState("way2");
  const [firstMale, setFirstMale] = useState("female");
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
  const [openAi, setOpenAi] = useState(null);
  const [aiConditionInput, setAiConditionInput] = useState("");
  const [showAiModal, setShowAiModal] = useState(false);
  const [isAiButtonDisabled, setIsAiButtonDisabled] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");

  const classInput = useRef();
  const gradeInput = useRef();
  const yearInput = useRef();

  // OpenAI API 초기화
  const callOpenAiApi = async () => {
    if (openAi) return openAi;

    // 로컬 스토리지에서 API 키 가져오기 (암호화된 이름으로 저장)
    let API_KEY = localStorage.getItem("app_config_key");

    // 로컬 스토리지에 없으면 환경변수에서 시도
    if (!API_KEY) {
      API_KEY = process.env.REACT_APP_OPEN_API_KEY;
    }

    if (!API_KEY) {
      console.warn("설정 키가 없습니다.");
      return null;
    }

    const openai = new OpenAI({
      apiKey: API_KEY,
      dangerouslyAllowBrowser: true,
    });

    setOpenAi(openai);
    return openai;
  };

  useEffect(() => {
    callOpenAiApi();
  }, []);

  // API 키 저장 함수
  const saveApiKey = () => {
    if (!apiKeyInput || apiKeyInput.trim() === "") {
      Swal.fire({
        icon: "warning",
        title: "입력 필요",
        text: "설정 키를 입력해주세요!",
        confirmButtonColor: "#85bd82",
      });
      return;
    }

    // 로컬 스토리지에 저장 (암호화된 이름으로)
    localStorage.setItem("app_config_key", apiKeyInput.trim());

    // OpenAI 재초기화
    setOpenAi(null);

    Swal.fire({
      icon: "success",
      title: "저장 완료",
      text: "설정 키가 저장되었습니다!",
      confirmButtonColor: "#85bd82",
    });

    setShowApiKeyModal(false);
    setApiKeyInput("");

    // 재초기화
    callOpenAiApi();
  };

  // GPT API 호출 함수
  const gptResult = async (text, openai) => {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that returns ONLY valid JSON arrays without any additional text or explanation.",
        },
        { role: "user", content: text },
      ],
      model: "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
    });
    return completion?.choices[0]?.message?.content;
  };

  // AI 학급 편성 함수
  const aiClassArrange = async () => {
    try {
      if (isAiButtonDisabled) return;

      if (!aiConditionInput || aiConditionInput.trim() === "") {
        Swal.fire({
          icon: "warning",
          title: "조건 입력 필요",
          text: "학급 배치 조건을 입력해주세요!",
          confirmButtonColor: "#85bd82",
        });
        return;
      }

      setIsAiButtonDisabled(true);

      // OpenAI 설정이 완료될 때까지 기다리기
      const openai = await callOpenAiApi();
      if (!openai) {
        Swal.fire({
          icon: "error",
          title: "AI 기능 사용 불가",
          html: `
            <p>현재 AI 기능은 사용할 수 없습니다.</p>
            <p style="color: #666; font-size: 14px;">관리자에게 문의하세요.</p>
          `,
          confirmButtonColor: "#85bd82",
        });

        setIsAiButtonDisabled(false);
        return;
      }

      // ===== 1단계: 굿/배드 학생 균등 배치 =====
      console.log("=== 1단계: 굿/배드 학생 균등 배치 시작 ===");

      let new_AdaptClass = JSON.parse(JSON.stringify(nextAdaptClass));
      const classNames = CLASS_NAME[hanglOrNum].slice(0, nextAdaptClass.length);

      // 굿 학생 균등 배치
      let loopCount = 0;
      const maxLoops = 1000;

      while (loopCount++ < maxLoops) {
        let classGoodCounts = new_AdaptClass.map((cl, idx) => {
          const goodCount = cl.filter(stu => stu && stu.teamWork && stu.teamWork.includes("굿")).length;
          return { classIndex: idx, goodCount };
        });

        classGoodCounts.sort((a, b) => b.goodCount - a.goodCount);
        const maxGoodClass = classGoodCounts[0];
        const minGoodClass = classGoodCounts[classGoodCounts.length - 1];

        if (maxGoodClass.goodCount - minGoodClass.goodCount <= 1) {
          console.log("굿 학생 균등 배치 완료!");
          break;
        }

        // 가장 많은 반에서 굿 학생 찾기
        let goodStudentIndex = new_AdaptClass[maxGoodClass.classIndex].findIndex(
          stu => stu && stu.teamWork && stu.teamWork.includes("굿") && (!stu.note || stu.note.trim() === "")
        );

        if (goodStudentIndex === -1) break;

        // 가장 적은 반에서 비고 없는 일반 학생 찾기
        let normalStudentIndex = new_AdaptClass[minGoodClass.classIndex].findIndex(
          stu => stu && (!stu.note || stu.note.trim() === "") && (!stu.teamWork || !stu.teamWork.includes("굿"))
        );

        if (normalStudentIndex === -1) break;

        // 교환
        let temp = new_AdaptClass[maxGoodClass.classIndex][goodStudentIndex];
        new_AdaptClass[maxGoodClass.classIndex][goodStudentIndex] = new_AdaptClass[minGoodClass.classIndex][normalStudentIndex];
        new_AdaptClass[minGoodClass.classIndex][normalStudentIndex] = temp;

        console.log(`굿 교환: ${classNames[maxGoodClass.classIndex]}반 ↔ ${classNames[minGoodClass.classIndex]}반`);
      }

      // 배드 학생 균등 배치
      loopCount = 0;
      while (loopCount++ < maxLoops) {
        let classBadCounts = new_AdaptClass.map((cl, idx) => {
          const badCount = cl.filter(stu => stu && stu.teamWork && stu.teamWork.includes("배드")).length;
          return { classIndex: idx, badCount };
        });

        classBadCounts.sort((a, b) => b.badCount - a.badCount);
        const maxBadClass = classBadCounts[0];
        const minBadClass = classBadCounts[classBadCounts.length - 1];

        if (maxBadClass.badCount - minBadClass.badCount <= 1) {
          console.log("배드 학생 균등 배치 완료!");
          break;
        }

        // 가장 많은 반에서 배드 학생 찾기
        let badStudentIndex = new_AdaptClass[maxBadClass.classIndex].findIndex(
          stu => stu && stu.teamWork && stu.teamWork.includes("배드") && (!stu.note || stu.note.trim() === "")
        );

        if (badStudentIndex === -1) break;

        // 가장 적은 반에서 비고 없는 일반 학생 찾기
        let normalStudentIndex = new_AdaptClass[minBadClass.classIndex].findIndex(
          stu => stu && (!stu.note || stu.note.trim() === "") && (!stu.teamWork || !stu.teamWork.includes("배드"))
        );

        if (normalStudentIndex === -1) break;

        // 교환
        let temp = new_AdaptClass[maxBadClass.classIndex][badStudentIndex];
        new_AdaptClass[maxBadClass.classIndex][badStudentIndex] = new_AdaptClass[minBadClass.classIndex][normalStudentIndex];
        new_AdaptClass[minBadClass.classIndex][normalStudentIndex] = temp;

        console.log(`배드 교환: ${classNames[maxBadClass.classIndex]}반 ↔ ${classNames[minBadClass.classIndex]}반`);
      }

      // 최종 굿/배드 분포 확인
      const goodDistribution = new_AdaptClass.map((cl, idx) => {
        const goodCount = cl.filter(stu => stu && stu.teamWork && stu.teamWork.includes("굿")).length;
        return `${classNames[idx]}반: ${goodCount}명`;
      });
      const badDistribution = new_AdaptClass.map((cl, idx) => {
        const badCount = cl.filter(stu => stu && stu.teamWork && stu.teamWork.includes("배드")).length;
        return `${classNames[idx]}반: ${badCount}명`;
      });
      console.log("1단계 완료 - 굿 분포:", goodDistribution.join(", "));
      console.log("1단계 완료 - 배드 분포:", badDistribution.join(", "));

      // ===== 2단계: AI를 활용한 비고 학생 + 배드 학생 재배치 =====
      console.log("=== 2단계: AI 활용 재배치 시작 ===");

      // 사용자 입력에서 학생 이름 추출
      const userMentionedStudents = new Set();
      const namePattern = /(\d+)반\s*([가-힣]+)/g;
      let match;
      while ((match = namePattern.exec(aiConditionInput)) !== null) {
        userMentionedStudents.add(match[2]);
      }

      console.log("사용자가 언급한 학생:", Array.from(userMentionedStudents));

      // 재배치 대상 학생 선별: 사용자 언급 + 비고 있음 + 배드
      let targetStudents = [];
      let remainingStudents = [];

      new_AdaptClass.forEach((cl, clIndex) => {
        cl.forEach((stu) => {
          const isUserMentioned = userMentionedStudents.has(stu.name);
          const hasNote = stu.note && stu.note.trim() !== "" && !stu.note.includes("전출");
          const isBad = stu.teamWork && stu.teamWork.includes("배드");

          if (isUserMentioned || hasNote || isBad) {
            targetStudents.push({
              이름: stu.name,
              성별: stu.gender,
              이전반: stu.exClass,
              현재배정반: CLASS_NAME[hanglOrNum][clIndex],
              비고: stu.note || "",
              협동: stu.teamWork || "",
              원본데이터: stu,
            });
          } else {
            remainingStudents.push({
              학생: stu,
              현재반: clIndex,
            });
          }
        });
      });

      console.log(`2단계 재배치 대상 학생: ${targetStudents.length}명`);
      console.log(`2단계 유지 학생: ${remainingStudents.length}명`);

      if (targetStudents.length === 0) {
        Swal.fire({
          icon: "warning",
          title: "재배치 대상 없음",
          text: "재배치할 학생이 없습니다. 조건을 확인해주세요.",
          confirmButtonColor: "#85bd82",
        });
        setIsAiButtonDisabled(false);
        return;
      }

      // 각 반의 현재 배드 학생 수 (1단계에서 이미 균등 배치됨)
      const currentBadPerClass = new_AdaptClass.map((cl, idx) => {
        const badCount = cl.filter(stu => stu && stu.teamWork && stu.teamWork.includes("배드")).length;
        return { className: classNames[idx], badCount };
      });

      // 각 반의 현재 인원수 계산
      const currentClassSizes = new_AdaptClass.map((cl) => cl.length);
      const avgClassSize = Math.round(
        currentClassSizes.reduce((a, b) => a + b, 0) / new_AdaptClass.length
      );

      // GPT 프롬프트 구성
      let text = `아래 학생들을 각 반에 재배치해줘.\n\n`;
      text += `⚠️ 중요: 굿/배드 학생은 이미 1단계에서 균등 배치가 완료되었어!\n`;
      text += `현재 각 반의 배드 학생 수:\n`;
      currentBadPerClass.forEach(info => {
        text += `  - ${info.className}반: 배드 ${info.badCount}명\n`;
      });
      text += `\n`;
      text += `현재 학급 수: ${new_AdaptClass.length}개 (${classNames.join(", ")})\n`;
      text += `각 반의 평균 인원: 약 ${avgClassSize}명\n\n`;
      text += `재배치할 학생 정보 (총 ${targetStudents.length}명):\n`;
      text += `${JSON.stringify(
        targetStudents.map((s) => ({
          이름: s.이름,
          성별: s.성별,
          이전반: s.이전반,
          현재배정반: s.현재배정반,
          비고: s.비고,
          협동: s.협동,
        })),
        null,
        2
      )}\n\n`;

      // 각 반의 현재 굿 학생 수
      const currentGoodPerClass = new_AdaptClass.map((cl, idx) => {
        const goodCount = cl.filter(stu => stu && stu.teamWork && stu.teamWork.includes("굿")).length;
        return { className: classNames[idx], goodCount };
      });

      text += `사용자 조건:\n${aiConditionInput}\n\n`;
      text += `🚨🚨🚨 절대 규칙 (반드시 지켜야 함!) 🚨🚨🚨\n\n`;

      text += `🔴 규칙 1: 굿(에이스) 학생은 절대 이동 금지!\n`;
      text += `   현재 각 반의 굿 학생 수:\n`;
      currentGoodPerClass.forEach(info => {
        text += `   - ${info.className}반: 굿 ${info.goodCount}명\n`;
      });
      text += `   ⚠️ 협동이 "굿"인 학생들은 이미 완벽하게 배치되어 있어.\n`;
      text += `   ❌❌❌ 굿 학생은 절대로 다른 반으로 옮기면 안 돼!\n`;
      text += `   ❌❌❌ 굿 학생의 now와 new는 반드시 같아야 해!\n`;
      text += `\n`;

      text += `🔴 규칙 2: 배드 학생은 배드끼리만 1:1 교환 가능!\n`;
      text += `   현재 각 반의 배드 학생 수:\n`;
      currentBadPerClass.forEach(info => {
        text += `   - ${info.className}반: 배드 ${info.badCount}명\n`;
      });
      text += `   ⚠️ 배드 학생을 재배치할 때는 반드시 배드끼리만 1:1 교환!\n`;
      text += `   - 예) 가반 배드 A ↔ 나반 배드 B (각 반 배드 수 그대로)\n`;
      text += `   ❌ 금지: 배드를 일반 학생과 교환 (배드 수가 변함)\n`;
      text += `   ❌ 금지: 배드 학생을 다른 반으로 옮겨서 배드 수 바꾸기\n`;
      text += `\n`;

      text += `🟡 일반 규칙:\n`;
      text += `1. 사용자 조건을 최대한 만족시켜\n`;
      text += `2. 각 반의 인원수를 최대한 균등하게 유지해 (평균 ${avgClassSize}명 기준)\n`;
      text += `3. 성비도 고려해서 균형있게 배치해\n`;
      text += `4. 비고에 특별한 내용이 있는 학생들도 균등하게 분산해\n`;
      text += `5. 모든 학생(${targetStudents.length}명)이 반드시 포함되어야 해\n`;
      text += `6. 배정반은 반드시 다음 중 하나여야 해: ${classNames.join(", ")}\n\n`;
      text += `IMPORTANT: Return ONLY a JSON object with "students" key containing an array.\n`;
      text += `Format: {"students": [{"이름": "홍길동", "now": "가", "new": "나"}, {"이름": "김철수", "now": "다", "new": "라"}, ...]}\n`;
      text += `Each student object MUST have:\n`;
      text += `- "이름" (name)\n`;
      text += `- "now" (current assigned class from 현재배정반)\n`;
      text += `- "new" (new assigned class - where to move)\n`;
      text += `The "now" value must exactly match the 현재배정반 from input data.\n`;
      text += `Do NOT include any explanation, markdown formatting, or additional text.\n`;

      console.log("GPT 프롬프트:", text);

      // 로딩 메시지
      let totalTime = 120; // 2분으로 변경
      const motivationalMessages = [
        "학급을 재배치하는 중입니다...",
        "조금만 기다려주세요!",
        "AI가 최적의 배치를 찾고 있습니다.",
        "거의 다 됐습니다!",
        "복잡한 조건을 고려하고 있습니다...",
        "학생들을 균등하게 분산하고 있습니다...",
      ];
      let currentMotivation = motivationalMessages[0];

      Swal.fire({
        title: "AI 학급 편성 중...",
        html: `<div id="swal-timer">
               잠시만 기다려 주세요, 남은 시간: 약 <span id="swal-countdown">${totalTime}</span>초<br>
               <span id="swal-motivation">${currentMotivation}</span>
             </div>`,
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          Swal.showLoading();

          const countdownInterval = setInterval(() => {
            totalTime--;
            if (totalTime < 0) totalTime = 0;
            const countdownEl = document.getElementById("swal-countdown");
            if (countdownEl) countdownEl.innerText = totalTime;
          }, 1000);

          let messageIndex = 0;
          const motivationInterval = setInterval(() => {
            messageIndex = (messageIndex + 1) % motivationalMessages.length;
            currentMotivation = motivationalMessages[messageIndex];
            const motivationEl = document.getElementById("swal-motivation");
            if (motivationEl) motivationEl.innerText = currentMotivation;
          }, 15000); // 15초마다 메시지 변경

          Swal.countdownInterval = countdownInterval;
          Swal.motivationInterval = motivationInterval;
        },
      });

      // GPT API 호출
      let resultContent = await gptResult(text, openai);
      console.log("GPT 원본 응답:", resultContent);

      // 인터벌 종료
      if (Swal.countdownInterval) clearInterval(Swal.countdownInterval);
      if (Swal.motivationInterval) clearInterval(Swal.motivationInterval);

      // JSON 파싱 전 처리
      let cleanedContent = resultContent;

      // 마크다운 코드 블록 제거
      cleanedContent = cleanedContent
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "");

      // 줄바꿈 및 공백 정리
      cleanedContent = cleanedContent.trim();

      console.log("정제된 응답:", cleanedContent);

      // JSON 파싱
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(cleanedContent);
      } catch (parseError) {
        console.error("JSON 파싱 실패:", parseError);
        console.error("파싱 시도한 내용:", cleanedContent);
        throw new Error("AI 응답을 해석할 수 없습니다. 다시 시도해주세요.");
      }

      // students 배열 추출
      let resultArray = parsedResponse.students || parsedResponse;

      if (!Array.isArray(resultArray)) {
        console.error("배열이 아닌 응답:", resultArray);
        throw new Error("잘못된 응답 형식입니다.");
      }

      if (resultArray.length === 0) {
        throw new Error("배정된 학생이 없습니다.");
      }

      console.log("파싱된 학생 배열:", resultArray);

      // 재배치 결과 검증
      if (resultArray.length !== targetStudents.length) {
        console.warn(
          `재배치 대상: ${targetStudents.length}명, GPT 응답: ${resultArray.length}명`
        );
      }

      // 새로운 학급 배치 생성 (1단계에서 이미 굿/배드 균등 배치된 상태에서 시작)
      // 2-1단계: 유지될 학생들을 각 반에 배치 (이미 new_AdaptClass에 포함)
      let final_AdaptClass = Array(new_AdaptClass.length)
        .fill(null)
        .map(() => []);

      remainingStudents.forEach((item) => {
        final_AdaptClass[item.현재반].push(item.학생);
      });

      console.log(
        "유지 학생 배치 후 각 반 인원:",
        final_AdaptClass.map((cl) => cl.length)
      );

      // 2-2단계: GPT 응답에 따라 재배치 대상 학생들을 새 반에 배치
      let unassignedStudents = [];
      let successCount = 0;
      let goodViolations = []; // 굿 학생 이동 위반 추적

      resultArray.forEach((assignment) => {
        const studentName = assignment.이름;
        const currentClass = assignment.now;
        const newClass =
          assignment.new || assignment.새배정반 || assignment.배정반;

        if (!studentName) {
          console.warn(`학생 이름이 없음:`, assignment);
          return;
        }

        if (!currentClass || !newClass) {
          console.warn(`배정 정보 부족 (학생: ${studentName}):`, assignment);
          unassignedStudents.push(`${studentName} (${currentClass || "?"}반)`);
          return;
        }

        // 현재반 정보로 정확한 학생 찾기 (이름이 중복될 수 있으므로)
        const foundStudent = targetStudents.find(
          (s) => s.이름 === studentName && s.현재배정반 === currentClass
        );

        if (!foundStudent || !foundStudent.원본데이터) {
          console.warn(
            `재배치 대상에 없는 학생: ${studentName} (현재: ${currentClass}반)`
          );
          unassignedStudents.push(`${studentName} (${currentClass}반)`);
          return;
        }

        // 🚨 굿 학생 이동 검증
        const isGood = foundStudent.협동 && foundStudent.협동.includes("굿");
        if (isGood && currentClass !== newClass) {
          console.error(`🚨 굿 학생 이동 감지! ${studentName}: ${currentClass}반 → ${newClass}반`);
          goodViolations.push(`${studentName} (${currentClass}반 → ${newClass}반)`);
          // 굿 학생은 원래 반에 유지
          const currentClassIndex = classNames.indexOf(currentClass);
          if (currentClassIndex !== -1) {
            final_AdaptClass[currentClassIndex].push({ ...foundStudent.원본데이터 });
            successCount++;
            console.log(`✅ 굿 학생 원위치 유지: ${studentName} (${currentClass}반)`);
          }
          return;
        }

        // 새 배정반 인덱스 찾기
        const newClassIndex = classNames.indexOf(newClass);
        if (newClassIndex === -1) {
          console.warn(
            `잘못된 반 배정: ${newClass} (학생: ${studentName}), 가능한 반: ${classNames.join(
              ", "
            )}`
          );
          unassignedStudents.push(
            `${studentName} (${currentClass}반 → ${newClass}반)`
          );
          return;
        }

        final_AdaptClass[newClassIndex].push({ ...foundStudent.원본데이터 });
        successCount++;
      });

      // 굿 학생 이동 위반 경고
      if (goodViolations.length > 0) {
        console.warn(`⚠️ GPT가 굿 학생을 이동시키려 했으나 원위치로 복구: ${goodViolations.length}명`);
        console.warn("위반 목록:", goodViolations);
      }

      console.log(
        `재배치 성공: ${successCount}명 / ${targetStudents.length}명`
      );
      console.log(
        "재배치 후 각 반 인원:",
        final_AdaptClass.map((cl) => cl.length)
      );

      // 모든 재배치 대상 학생이 배치되었는지 확인
      if (successCount !== targetStudents.length) {
        // GPT가 반환한 학생 목록
        const returnedStudents = new Set();
        resultArray.forEach(a => {
          returnedStudents.add(`${a.이름}_${a.now}`);
        });

        // 누락된 학생 찾기
        const missingStudents = targetStudents.filter(s => {
          const key = `${s.이름}_${s.현재배정반}`;
          return !returnedStudents.has(key);
        });

        console.error("GPT가 반환하지 않은 학생:", missingStudents.map(s => `${s.이름} (${s.현재배정반}반)`));
        console.error("누락된 학생 수:", missingStudents.length);

        // 누락된 학생들을 현재 반에 그대로 유지
        missingStudents.forEach(s => {
          const currentClassIndex = classNames.indexOf(s.현재배정반);
          if (currentClassIndex !== -1 && s.원본데이터) {
            final_AdaptClass[currentClassIndex].push({ ...s.원본데이터 });
            console.log(`⚠️ 누락된 학생을 현재 반에 유지: ${s.이름} (${s.현재배정반}반)`);
          }
        });

        console.warn(`⚠️ GPT가 ${missingStudents.length}명을 반환하지 않아 현재 반에 유지했습니다.`);
      }

      // 전체 학생 수 검증
      let totalBefore = nextAdaptClass.reduce((sum, cl) => sum + cl.length, 0);
      let totalAfter = final_AdaptClass.reduce((sum, cl) => sum + cl.length, 0);

      if (totalBefore !== totalAfter) {
        console.error(`배정 전: ${totalBefore}명, 배정 후: ${totalAfter}명`);
        throw new Error(`전체 학생 수가 일치하지 않습니다.`);
      }

      // 최종 굿/배드 분포 확인
      const finalGoodDistribution = final_AdaptClass.map((cl, idx) => {
        const goodCount = cl.filter(stu => stu && stu.teamWork && stu.teamWork.includes("굿")).length;
        return `${classNames[idx]}반: ${goodCount}명`;
      });
      const finalBadDistribution = final_AdaptClass.map((cl, idx) => {
        const badCount = cl.filter(stu => stu && stu.teamWork && stu.teamWork.includes("배드")).length;
        return `${classNames[idx]}반: ${badCount}명`;
      });
      console.log("=== 최종 완료 ===");
      console.log("최종 굿 분포:", finalGoodDistribution.join(", "));
      console.log("최종 배드 분포:", finalBadDistribution.join(", "));

      setNextAdaptClass([...final_AdaptClass]);
      setShowAiModal(false);
      setIsAiButtonDisabled(false);

      // AI 편성 완료 알림
      Swal.fire({
        icon: "success",
        title: "AI 학급 편성 완료",
        html: `
          <p style="font-weight: bold; color: #28a745;">✅ 1단계: 굿/배드 학생 균등 배치 완료</p>
          <p style="font-weight: bold; color: #28a745;">✅ 2단계: AI 재배치 완료 (${successCount}명)</p>
          <p>유지된 학생: ${remainingStudents.length}명</p>
          <br>
          <p style="color: #666; font-size: 14px;">
            💡 Tip: "2. 자동배분" 버튼을 클릭하면<br>
            전체 균형을 더욱 최적화할 수 있습니다!
          </p>
        `,
        confirmButtonColor: "#85bd82",
      });
    } catch (error) {
      console.error("AI 학급 편성 오류:", error);
      setIsAiButtonDisabled(false);
      Swal.fire({
        icon: "error",
        title: "편성 실패",
        text: "AI 학급 편성 중 오류가 발생했습니다. 다시 시도해주세요.",
      });
    }
  };

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

  // AI를 이용한 성비 균형 맞추기 함수
  const balanceGenderWithAI = async (classArray) => {
    try {
      const openai = await callOpenAiApi();
      if (!openai) {
        console.warn("OpenAI API 사용 불가, 기본 성비 균형 로직으로 진행");
        return;
      }

      const classNames = CLASS_NAME[hanglOrNum].slice(0, classArray.length);

      // 전체 남녀 평균 성비 계산
      let totalMale = 0;
      let totalFemale = 0;
      classArray.forEach((cl) => {
        totalMale += cl.filter((stu) => stu.gender === "남").length;
        totalFemale += cl.filter((stu) => stu.gender === "여").length;
      });
      const avgMalePerClass = Math.round(totalMale / classArray.length);
      const avgFemalePerClass = Math.round(totalFemale / classArray.length);

      // 각 반의 현재 성비 정보
      let classGenderInfo = classArray.map((cl, idx) => {
        const maleCount = cl.filter((stu) => stu.gender === "남").length;
        const femaleCount = cl.filter((stu) => stu.gender === "여").length;
        const noteCount = cl.filter(
          (stu) => stu.note && stu.note.trim() !== ""
        ).length;
        const aceCount = cl.filter((stu) =>
          stu.teamWork?.includes("굿")
        ).length;
        const badCount = cl.filter((stu) =>
          stu.teamWork?.includes("배드")
        ).length;

        return {
          반: classNames[idx],
          남학생수: maleCount,
          여학생수: femaleCount,
          비고있는학생: noteCount,
          에이스: aceCount,
          마이너스: badCount,
        };
      });

      // 비고 없는 학생들만 추출
      let normalStudents = [];
      classArray.forEach((cl, clIdx) => {
        cl.forEach((stu) => {
          const hasNote = stu.note && stu.note.trim() !== "";
          const isAce = stu.teamWork?.includes("굿");
          const isBad = stu.teamWork?.includes("배드");

          if (!hasNote && !isAce && !isBad) {
            normalStudents.push({
              이름: stu.name,
              성별: stu.gender,
              현재반: classNames[clIdx],
              원본데이터: stu,
            });
          }
        });
      });

      console.log(
        `성비 균형 대상: ${normalStudents.length}명 (비고/에이스/마이너스 제외)`
      );

      if (normalStudents.length < 4) {
        console.log("성비 조정 대상 학생이 부족하여 건너뜁니다.");
        return;
      }

      // GPT 프롬프트 구성
      let text = `학급별 성비 균형을 맞추기 위해 학생들을 재배치해줘.\n\n`;
      text += `목표 성비: 각 반당 남학생 약 ${avgMalePerClass}명, 여학생 약 ${avgFemalePerClass}명\n\n`;
      text += `현재 각 반의 상황:\n${JSON.stringify(
        classGenderInfo,
        null,
        2
      )}\n\n`;
      text += `재배치 가능한 학생 (비고/에이스/마이너스 제외, ${normalStudents.length}명):\n`;
      text += `${JSON.stringify(
        normalStudents.map((s) => ({
          이름: s.이름,
          성별: s.성별,
          현재반: s.현재반,
        })),
        null,
        2
      )}\n\n`;
      text += `조건:\n`;
      text += `1. 위 "재배치 가능한 학생" 목록의 학생들만 재배치할 수 있어\n`;
      text += `2. 각 반의 남녀 성비가 목표 성비(남 ${avgMalePerClass}명, 여 ${avgFemalePerClass}명)에 최대한 가깝게\n`;
      text += `3. 모든 반의 성비 차이를 최소화해\n`;
      text += `4. 재배치가 필요 없는 학생은 현재반 그대로 유지\n`;
      text += `5. 재배치할 학생만 응답에 포함 (현재반과 다른 반으로 배정되는 학생만)\n\n`;
      text += `IMPORTANT: Return ONLY a JSON object with "students" key.\n`;
      text += `Format: {"students": [{"이름": "홍길동", "now": "가", "new": "나"}, ...]}\n`;
      text += `Only include students who need to be moved (now ≠ new).\n`;
      text += `If no changes needed, return: {"students": []}\n`;

      console.log("성비 균형 GPT 프롬프트:", text);

      // GPT API 호출
      let resultContent = await gptResult(text, openai);
      console.log("성비 균형 GPT 응답:", resultContent);

      // JSON 파싱
      let cleanedContent = resultContent
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

      let parsedResponse = JSON.parse(cleanedContent);
      let resultArray = parsedResponse.students || parsedResponse;

      if (!Array.isArray(resultArray)) {
        console.warn("성비 균형 응답이 배열이 아닙니다:", resultArray);
        return;
      }

      if (resultArray.length === 0) {
        console.log("성비 균형이 이미 적절하여 재배치가 필요 없습니다.");
        return;
      }

      console.log(`성비 균형 재배치: ${resultArray.length}명`);

      // 재배치 실행
      resultArray.forEach((assignment) => {
        const studentName = assignment.이름;
        const currentClass = assignment.now;
        const newClass = assignment.new;

        if (!studentName || !currentClass || !newClass) return;
        if (currentClass === newClass) return; // 같은 반이면 스킵

        const currentClassIndex = classNames.indexOf(currentClass);
        const newClassIndex = classNames.indexOf(newClass);

        if (currentClassIndex === -1 || newClassIndex === -1) {
          console.warn(`잘못된 반 정보: ${currentClass} → ${newClass}`);
          return;
        }

        // 학생 찾기 및 이동
        const studentIndex = classArray[currentClassIndex].findIndex(
          (stu) => stu.name === studentName
        );

        if (studentIndex !== -1) {
          const student = classArray[currentClassIndex].splice(
            studentIndex,
            1
          )[0];
          classArray[newClassIndex].push(student);
          console.log(
            `성비 조정: ${studentName} (${currentClass}반 → ${newClass}반)`
          );
        }
      });

      console.log("성비 균형 완료");
    } catch (error) {
      console.error("AI 성비 균형 오류:", error);
      console.log("기본 성비 균형 로직으로 진행하지 않고 건너뜁니다.");
    }
  };

  // 자동배분 진행 상황 업데이트 함수
  const updateAutoDistributeProgress = (step, message) => {
    const progressDiv = document.getElementById("auto-distribute-progress");
    if (progressDiv) {
      progressDiv.innerHTML = `
        <p style="color: #1976d2; font-size: 16px; font-weight: bold;">
          ⏳ ${step}차 진행 중...
        </p>
        <p style="color: #666; font-size: 14px; margin-top: 10px;">
          ${message}
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 10px;">
          1차: 생활지도/학습부진/다문화/학부모 분산 ${step >= 1 ? "✅" : ""}<br>
          2차: 그룹 균등 배치 ${step >= 2 ? "✅" : ""}<br>
          3차: 굿/배드 균등 배치 ${step >= 3 ? "✅" : ""}<br>
          4차: AI 성비 균형 조정 ${step >= 4 ? "✅" : ""}
        </p>
      `;
    }
  };

  // 자동배분 버튼
  const autoDistribute = async () => {
    try {
      // nextAdaptClass가 비어있거나 유효하지 않은 경우 체크
      if (!nextAdaptClass || nextAdaptClass.length === 0) {
        Swal.fire({
          icon: "warning",
          title: "자동배분 불가",
          text: "먼저 반편성을 진행해주세요!",
          confirmButtonColor: "#85bd82",
        });
        return;
      }

      let new_AdaptClass = JSON.parse(JSON.stringify(nextAdaptClass));

      // 1차 시작
      updateAutoDistributeProgress(
        1,
        "생활지도, 학습부진, 다문화, 학부모 학생을 균등하게 분산하고 있습니다..."
      );

      // 레벨 가중치 함수 (상:3, 중:2, 하:1, 레벨없음:2)
      const getLevelWeight = (note, caseType) => {
        if (!note || !note.includes(caseType)) return 0;
        if (note.includes(`${caseType}-상`)) return 3;
        if (note.includes(`${caseType}-중`)) return 2;
        if (note.includes(`${caseType}-하`)) return 1;
        // 레벨 표시 없이 해당 케이스만 있으면 중으로 처리
        return 2;
      };

      // 1차: 생활지도/학습부진/다문화/학부모 학생 분산 (레벨 고려)
      const specialCases = ["생활지도", "학습부진", "다문화", "학부모"];
      const leveledCases = ["생활지도", "학부모"]; // 레벨을 고려해야 하는 케이스

      for (let caseType of specialCases) {
        // 해당 케이스가 레벨을 고려해야 하는 경우
        if (leveledCases.includes(caseType)) {
          // 레벨별로 분산 (상 -> 중 -> 하 순서로)
          const levels = ["-상", "-중", "-하", ""]; // 빈 문자열은 레벨 없이 케이스만 있는 경우

          for (let level of levels) {
            const targetPattern =
              level === "" ? caseType : `${caseType}${level}`;

            let loopCount = 0;
            const maxLoops = 1000;

            while (loopCount++ < maxLoops) {
              // 각 반별 가중치 합산 계산
              let classWeights = new_AdaptClass.map((cl) =>
                (cl || []).reduce(
                  (sum, stu) => sum + getLevelWeight(stu.note, caseType),
                  0
                )
              );

              let maxWeight = Math.max(...classWeights);
              let minWeight = Math.min(...classWeights);

              // 가중치 차이가 2 이하면 충분히 균형잡힘
              if (maxWeight - minWeight <= 2) break;

              let maxClassIndex = classWeights.indexOf(maxWeight);
              let minClassIndex = classWeights.indexOf(minWeight);

              if (maxClassIndex === -1 || minClassIndex === -1) break;
              if (
                !new_AdaptClass[maxClassIndex] ||
                !new_AdaptClass[minClassIndex]
              )
                break;

              // 가장 많은 반에서 해당 레벨 학생 찾기
              let specialStudentIndex = new_AdaptClass[maxClassIndex].findIndex(
                (stu) => {
                  if (!stu || !stu.note) return false;
                  if (level === "") {
                    // 레벨 없이 케이스만 있는 경우
                    return (
                      stu.note.includes(caseType) &&
                      !stu.note.includes(`${caseType}-상`) &&
                      !stu.note.includes(`${caseType}-중`) &&
                      !stu.note.includes(`${caseType}-하`)
                    );
                  }
                  return stu.note.includes(targetPattern);
                }
              );

              if (specialStudentIndex === -1) break;

              // 가장 적은 반에서 비고가 없는 학생 찾기
              let normalStudentIndex = new_AdaptClass[minClassIndex].findIndex(
                (stu) => stu && (!stu.note || stu.note.trim() === "")
              );

              if (normalStudentIndex === -1) break;

              // 두 학생 교환
              let temp = new_AdaptClass[maxClassIndex][specialStudentIndex];
              new_AdaptClass[maxClassIndex][specialStudentIndex] =
                new_AdaptClass[minClassIndex][normalStudentIndex];
              new_AdaptClass[minClassIndex][normalStudentIndex] = temp;
            }
          }
        } else {
          // 레벨을 고려하지 않는 케이스 (학습부진, 다문화)
          let classSpecialCount = new_AdaptClass.map(
            (cl) =>
              (cl || []).filter((stu) => stu && stu.note?.includes(caseType))
                .length
          );

          if (classSpecialCount.length === 0) continue;

          let loopCount = 0;
          const maxLoops = 1000;
          while (
            Math.max(...classSpecialCount) - Math.min(...classSpecialCount) >
            1
          ) {
            if (loopCount++ > maxLoops) break;

            let maxClassIndex = classSpecialCount.indexOf(
              Math.max(...classSpecialCount)
            );
            let minClassIndex = classSpecialCount.indexOf(
              Math.min(...classSpecialCount)
            );

            if (maxClassIndex === -1 || minClassIndex === -1) break;
            if (
              !new_AdaptClass[maxClassIndex] ||
              !new_AdaptClass[minClassIndex]
            )
              break;

            let specialStudentIndex = new_AdaptClass[maxClassIndex].findIndex(
              (stu) => stu && stu.note?.includes(caseType)
            );

            if (specialStudentIndex === -1) break;

            let normalStudentIndex = new_AdaptClass[minClassIndex].findIndex(
              (stu) => stu && (!stu.note || stu.note.trim() === "")
            );

            if (normalStudentIndex === -1) break;

            // 두 학생 교환
            let temp = new_AdaptClass[maxClassIndex][specialStudentIndex];
            new_AdaptClass[maxClassIndex][specialStudentIndex] =
              new_AdaptClass[minClassIndex][normalStudentIndex];
            new_AdaptClass[minClassIndex][normalStudentIndex] = temp;

            classSpecialCount = new_AdaptClass.map(
              (cl) =>
                (cl || []).filter((stu) => stu && stu.note?.includes(caseType))
                  .length
            );
          }
        }
      }

      // 2차 시작 - 에이스(굿) 학생 균등 배분
      updateAutoDistributeProgress(
        2,
        "에이스(굿) 학생들을 균등하게 배치하고 있습니다..."
      );
      await new Promise((resolve) => setTimeout(resolve, 300)); // UI 업데이트 대기

      // 2차: 에이스(굿) 학생 균등 배치 (협동에 "굿" 포함된 모든 학생)
      let classAceCount = new_AdaptClass.map(
        (cl) =>
          (cl || []).filter((stu) => stu && stu.teamWork?.includes("굿")).length
      );

      if (classAceCount.length > 0) {
        let loopCount = 0;
        const maxLoops = 1000;
        while (Math.max(...classAceCount) - Math.min(...classAceCount) > 1) {
          if (loopCount++ > maxLoops) break;

          let maxClassIndex = classAceCount.indexOf(Math.max(...classAceCount));
          let minClassIndex = classAceCount.indexOf(Math.min(...classAceCount));

          if (maxClassIndex === -1 || minClassIndex === -1) break;
          if (!new_AdaptClass[maxClassIndex] || !new_AdaptClass[minClassIndex])
            break;

          // 가장 많은 반에서 굿 학생 찾기 (비고 유무 관계없이)
          let aceStudentIndex = new_AdaptClass[maxClassIndex].findIndex(
            (stu) => stu && stu.teamWork?.includes("굿")
          );

          if (aceStudentIndex === -1) break;

          // 가장 적은 반에서 비고가 없고 굿이 아닌 학생 찾기
          let normalStudentIndex = new_AdaptClass[minClassIndex].findIndex(
            (stu) =>
              stu &&
              (!stu.note || stu.note.trim() === "") &&
              (!stu.teamWork || !stu.teamWork.includes("굿"))
          );

          if (normalStudentIndex === -1) break;

          // 두 학생 교환
          let temp = new_AdaptClass[maxClassIndex][aceStudentIndex];
          new_AdaptClass[maxClassIndex][aceStudentIndex] =
            new_AdaptClass[minClassIndex][normalStudentIndex];
          new_AdaptClass[minClassIndex][normalStudentIndex] = temp;

          // 카운트 업데이트
          classAceCount = new_AdaptClass.map(
            (cl) =>
              (cl || []).filter((stu) => stu && stu.teamWork?.includes("굿"))
                .length
          );
        }
      }

      // 3차 시작
      updateAutoDistributeProgress(
        3,
        "그룹별 학생들을 균등하게 배치하고 있습니다..."
      );
      await new Promise((resolve) => setTimeout(resolve, 300)); // UI 업데이트 대기

      // 3차: 비고의 "그룹1", "그룹2" 등 그룹 학생 균등 배치
      // 모든 그룹 패턴 찾기 (그룹1, 그룹2, 그룹3 등)
      let allGroups = new Set();
      new_AdaptClass.forEach((cl) => {
        if (!cl || !Array.isArray(cl)) return;
        cl.forEach((stu) => {
          if (stu && stu.note) {
            let groupMatch = stu.note.match(/그룹\d+/g);
            if (groupMatch) {
              groupMatch.forEach((g) => allGroups.add(g));
            }
          }
        });
      });

      // 각 그룹별로 균등 배치
      for (let groupName of allGroups) {
        let classGroupCount = new_AdaptClass.map(
          (cl) =>
            (cl || []).filter((stu) => stu && stu.note?.includes(groupName))
              .length
        );

        if (classGroupCount.length === 0) continue;

        let loopCount = 0;
        const maxLoops = 1000;
        while (
          Math.max(...classGroupCount) - Math.min(...classGroupCount) >
          1
        ) {
          if (loopCount++ > maxLoops) break;

          let maxClassIndex = classGroupCount.indexOf(
            Math.max(...classGroupCount)
          );
          let minClassIndex = classGroupCount.indexOf(
            Math.min(...classGroupCount)
          );

          if (maxClassIndex === -1 || minClassIndex === -1) break;
          if (!new_AdaptClass[maxClassIndex] || !new_AdaptClass[minClassIndex])
            break;

          // 가장 많은 반에서 해당 그룹 학생 찾기
          let groupStudentIndex = new_AdaptClass[maxClassIndex].findIndex(
            (stu) => stu && stu.note?.includes(groupName)
          );

          if (groupStudentIndex === -1) break;

          // 가장 적은 반에서 그룹이 아닌 비고 없는 학생 찾기
          let normalStudentIndex = new_AdaptClass[minClassIndex].findIndex(
            (stu) => {
              if (!stu) return false;
              if (!stu.note || stu.note.trim() === "") return true;
              // 다른 그룹에 속하지 않는지 확인
              return !/그룹\d+/.test(stu.note);
            }
          );

          if (normalStudentIndex === -1) break;

          // 두 학생 교환
          let temp = new_AdaptClass[maxClassIndex][groupStudentIndex];
          new_AdaptClass[maxClassIndex][groupStudentIndex] =
            new_AdaptClass[minClassIndex][normalStudentIndex];
          new_AdaptClass[minClassIndex][normalStudentIndex] = temp;

          // 카운트 업데이트
          classGroupCount = new_AdaptClass.map(
            (cl) =>
              (cl || []).filter((stu) => stu && stu.note?.includes(groupName))
                .length
          );
        }
      }

      // 4차 시작 - 배드 학생 균등 배분
      updateAutoDistributeProgress(
        4,
        "배드 학생들을 균등하게 배치하고 있습니다..."
      );
      await new Promise((resolve) => setTimeout(resolve, 300)); // UI 업데이트 대기

      // 4차: "배드" 학생 균등 배치 (비고가 없는 학생들 기준으로만)
      // 굿(에이스)은 2차에서 이미 처리했으므로 배드만 처리
      let classBadCount = new_AdaptClass.map(
        (cl) =>
          (cl || []).filter((stu) => stu && stu.teamWork?.includes("배드"))
            .length
      );

      if (classBadCount.length > 0) {
        let loopCount = 0;
        const maxLoops = 1000;
        while (Math.max(...classBadCount) - Math.min(...classBadCount) > 1) {
          if (loopCount++ > maxLoops) break;

          let maxClassIndex = classBadCount.indexOf(Math.max(...classBadCount));
          let minClassIndex = classBadCount.indexOf(Math.min(...classBadCount));

          if (maxClassIndex === -1 || minClassIndex === -1) break;
          if (!new_AdaptClass[maxClassIndex] || !new_AdaptClass[minClassIndex])
            break;

          // 가장 많은 반에서 배드 학생 중 비고가 없는 학생 찾기
          let badStudentIndex = new_AdaptClass[maxClassIndex].findIndex(
            (stu) =>
              stu &&
              stu.teamWork?.includes("배드") &&
              (!stu.note || stu.note.trim() === "")
          );

          if (badStudentIndex === -1) break;

          // 가장 적은 반에서 비고가 없고 배드가 아닌 학생 찾기
          let normalStudentIndex = new_AdaptClass[minClassIndex].findIndex(
            (stu) =>
              stu &&
              (!stu.note || stu.note.trim() === "") &&
              (!stu.teamWork || !stu.teamWork.includes("배드"))
          );

          if (normalStudentIndex === -1) break;

          // 두 학생 교환
          let temp = new_AdaptClass[maxClassIndex][badStudentIndex];
          new_AdaptClass[maxClassIndex][badStudentIndex] =
            new_AdaptClass[minClassIndex][normalStudentIndex];
          new_AdaptClass[minClassIndex][normalStudentIndex] = temp;

          // 카운트 업데이트
          classBadCount = new_AdaptClass.map(
            (cl) =>
              (cl || []).filter((stu) => stu && stu.teamWork?.includes("배드"))
                .length
          );
        }
      }

      // 5차 시작 - 성비 및 인원수 균형
      updateAutoDistributeProgress(
        5,
        "전체 인원수와 성비를 균형있게 조정하고 있습니다..."
      );
      await new Promise((resolve) => setTimeout(resolve, 300)); // UI 업데이트 대기

      // 5차: 성비 균형 맞추기 (비고가 있는 모든 학생 기준으로 목표 설정, 비고가 없는 학생들끼리만 교환)
      // 먼저 전체 인원수를 비슷하게 맞추기
      let loopCount = 0;
      const maxLoops = 1000;

      // 전체 인원수 균형 맞추기 (특수반 학생은 +1명으로 계산)
      while (loopCount++ < maxLoops) {
        // 각 반의 실질적 인원수 계산 (특수반 학생은 +1명으로 계산)
        let classSizes = new_AdaptClass.map((cl) => {
          if (!cl) return 0;
          let size = 0;
          cl.forEach((stu) => {
            if (stu) {
              size += 1;
              // 특수반 학생은 추가로 +1
              if (stu.note && stu.note.includes("특수반")) {
                size += 1;
              }
            }
          });
          return size;
        });

        let maxSize = Math.max(...classSizes);
        let minSize = Math.min(...classSizes);

        // 인원수 차이가 1 이하면 종료
        if (maxSize - minSize <= 1) break;

        let maxClassIndex = classSizes.indexOf(maxSize);
        let minClassIndex = classSizes.indexOf(minSize);

        if (maxClassIndex === -1 || minClassIndex === -1) break;
        if (!new_AdaptClass[maxClassIndex] || !new_AdaptClass[minClassIndex])
          break;

        // 가장 많은 반에서 비고가 없는 학생 찾기 (특수반이 아닌 학생만)
        let studentIndex = new_AdaptClass[maxClassIndex].findIndex(
          (stu) =>
            stu &&
            (!stu.note || stu.note.trim() === "") &&
            !(stu.note && stu.note.includes("특수반"))
        );

        if (studentIndex === -1) break;

        // 학생을 제거하여 적은 반으로 이동
        let student = new_AdaptClass[maxClassIndex].splice(studentIndex, 1)[0];
        new_AdaptClass[minClassIndex].push(student);
      }

      // 성비 균형 맞추기 - 비고가 있는 모든 학생의 성비를 기준으로 목표 설정
      // 전체 학생의 남녀 수 계산
      let totalMale = 0;
      let totalFemale = 0;
      new_AdaptClass.forEach((cl) => {
        (cl || []).forEach((stu) => {
          if (stu) {
            if (stu.gender === "남") totalMale++;
            else if (stu.gender === "여") totalFemale++;
          }
        });
      });

      const numClasses = new_AdaptClass.length;
      const targetMalePerClass = totalMale / numClasses; // 평균 남학생 수
      const targetFemalePerClass = totalFemale / numClasses; // 평균 여학생 수

      console.log(`전체 남학생: ${totalMale}, 여학생: ${totalFemale}`);
      console.log(
        `한 반당 목표 - 남: ${targetMalePerClass.toFixed(
          1
        )}, 여: ${targetFemalePerClass.toFixed(1)}`
      );

      loopCount = 0;
      while (loopCount++ < maxLoops) {
        // 각 반의 남녀 수와 목표 대비 차이 계산
        let classGenderInfo = new_AdaptClass.map((cl, idx) => {
          let maleCount = (cl || []).filter(
            (stu) => stu && stu.gender === "남"
          ).length;
          let femaleCount = (cl || []).filter(
            (stu) => stu && stu.gender === "여"
          ).length;

          // 목표 대비 차이 (양수: 많음, 음수: 부족)
          let maleDiff = maleCount - targetMalePerClass;
          let femaleDiff = femaleCount - targetFemalePerClass;

          return {
            classIndex: idx,
            maleCount,
            femaleCount,
            maleDiff,
            femaleDiff,
            totalDiff: Math.abs(maleDiff) + Math.abs(femaleDiff),
          };
        });

        // 가장 불균형한 반 찾기 (목표 대비 총 차이가 큰 반)
        classGenderInfo.sort((a, b) => b.totalDiff - a.totalDiff);

        // 모든 반이 충분히 균형잡혔는지 확인 (각 성별이 목표 대비 ±0.5 이내)
        const allBalanced = classGenderInfo.every(
          (info) =>
            Math.abs(info.maleDiff) <= 0.5 && Math.abs(info.femaleDiff) <= 0.5
        );

        if (allBalanced) {
          console.log("성비 균형 달성!");
          break;
        }

        let worstClass = classGenderInfo[0];
        if (worstClass.totalDiff < 0.5) break; // 더 이상 개선할 필요 없음

        // 이 반이 남학생이 많은지 여학생이 많은지 판단
        let needMoreGender =
          worstClass.maleDiff > worstClass.femaleDiff ? "여" : "남";
        let needLessGender =
          worstClass.maleDiff > worstClass.femaleDiff ? "남" : "여";

        // 교환할 상대 반 찾기 (반대 상황인 반)
        let targetClass = null;
        for (let info of classGenderInfo) {
          if (info.classIndex === worstClass.classIndex) continue;

          // 상대 반이 내가 필요한 성별을 많이 가지고 있고, 내가 줄 성별을 필요로 하는지 확인
          if (needMoreGender === "남") {
            // 내가 남학생이 필요함 -> 상대는 남학생이 많고 여학생이 부족해야 함
            if (info.maleDiff > 0.5 && info.femaleDiff < -0.5) {
              targetClass = info;
              break;
            }
          } else {
            // 내가 여학생이 필요함 -> 상대는 여학생이 많고 남학생이 부족해야 함
            if (info.femaleDiff > 0.5 && info.maleDiff < -0.5) {
              targetClass = info;
              break;
            }
          }
        }

        if (!targetClass) break;

        // worstClass에서 needLessGender 학생 중 비고 없는 학생 찾기
        let student1Index = new_AdaptClass[worstClass.classIndex].findIndex(
          (stu) =>
            stu &&
            stu.gender === needLessGender &&
            (!stu.note || stu.note.trim() === "")
        );

        if (student1Index === -1) break;

        // targetClass에서 needMoreGender 학생 중 비고 없는 학생 찾기
        let student2Index = new_AdaptClass[targetClass.classIndex].findIndex(
          (stu) =>
            stu &&
            stu.gender === needMoreGender &&
            (!stu.note || stu.note.trim() === "")
        );

        if (student2Index === -1) break;

        // 두 학생 교환
        let temp = new_AdaptClass[worstClass.classIndex][student1Index];
        new_AdaptClass[worstClass.classIndex][student1Index] =
          new_AdaptClass[targetClass.classIndex][student2Index];
        new_AdaptClass[targetClass.classIndex][student2Index] = temp;

        console.log(
          `교환: ${worstClass.classIndex}반 ${needLessGender} <-> ${targetClass.classIndex}반 ${needMoreGender}`
        );
      }

      setNextAdaptClass([...new_AdaptClass]);

      Swal.fire({
        icon: "success",
        title: "자동배분 완료",
        text: "학생들이 균등하게 재배치되었습니다!",
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
  const duplicateCheck = (nowState) => {
    //중복 해제가 되면.. 모든 학생에 있는 배경색 제거
    if (!nowState) {
      nextAdaptClass.forEach((cl) => {
        cl.forEach((s) => {
          document
            .getElementById(`${s.exClass}-${s.num}`)
            .classList.remove(classes["dupli-stu-bg"]);
        });
      });
    } else {
      nextAdaptClass.forEach((cl) => {
        cl.forEach((stu, stu_index) => {
          // 중복학생 인덱스 찾기
          let dupli_index = cl.findIndex(
            (i) => i.name.slice(1) === stu.name.slice(1)
          );

          if (dupli_index !== stu_index) {
            const firstElement = document.getElementById(
              `${cl[dupli_index].exClass}-${cl[dupli_index].num}`
            );
            const secondElement = document.getElementById(
              `${stu.exClass}-${stu.num}`
            );

            // if (nowState) {

            // 상태가 true면 클래스 추가
            if (!firstElement.classList.contains(classes["dupli-stu-bg"])) {
              firstElement.classList.add(classes["dupli-stu-bg"]);
            }
            if (!secondElement.classList.contains(classes["dupli-stu-bg"])) {
              secondElement.classList.add(classes["dupli-stu-bg"]);
            }

            // } else {
            //   // 상태가 false면 클래스 제거
            //   firstElement.classList.remove(classes["dupli-stu-bg"]);
            //   secondElement.classList.remove(classes["dupli-stu-bg"]);
            // }
          }
        });
      });
    }
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
            <button
              className={classes["settingBtn"]}
              onClick={() => setShowAiModal(true)}
              title="AI를 이용한 학급 재배치"
            >
              1. AI편성 🤖
            </button>
            <button className={classes["settingBtn"]} onClick={autoDistribute}>
              2. 자동배분
            </button>
            <button
              className={classes["settingBtn"]}
              onClick={handleDuplicateCheck}
            >
              {!checkDupliName ? "3. 중복이름확인" : "중복해제"}
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
                let new_AdaptClass = orderByGenderName(nextAdaptClass, "male");
                setNextAdaptClass([...new_AdaptClass]);
              }}
            >
              남자 앞번호
            </button>
            <button
              className={`${classes["settingBtn"]} ${classes["male"]}`}
              onClick={() => {
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
                let new_AdaptClass = orderByGenderName(nextAdaptClass, "whole");
                setNextAdaptClass([...new_AdaptClass]);
              }}
            >
              혼성번호
            </button>

            <button className={classes["settingBtn"]} onClick={makeExcelFile}>
              4. 엑셀파일 저장
            </button>
          </div>
          {/* 설명보여주기 부분의 설명*/}
          {showExplain && (
            <div className={classes["explainDiv"]}>
              {EXPLAINS.map((expl, index) => (
                <p key={"expl" + index} className={classes["explainSpan"]}>
                  {expl}
                </p>
              ))}
            </div>
          )}
          {/* AI 학급편성 모달 */}
          {showAiModal && (
            <div
              className={classes["explainDiv"]}
              style={{ marginTop: "20px", backgroundColor: "#f0f8ff" }}
            >
              <h2
                className={classes["expl-desk"]}
                style={{ width: "100%", fontSize: "26px" }}
              >
                AI로 학급 재배치하기 🤖
              </h2>
              {/* 사용방법 및 예시 */}
              <div style={{ paddingLeft: "60px" }}>
                {AI_CLASS_EXAMPLES?.map((ex, index) => (
                  <div key={index} className={classes["ex-div"]}>
                    {ex}
                  </div>
                ))}
              </div>
              <div
                className={classes["expl-desk"]}
                style={{ width: "100%", marginTop: "20px" }}
              >
                <textarea
                  onChange={(e) => setAiConditionInput(e.target.value?.trim())}
                  cols={50}
                  rows={6}
                  style={{
                    resize: "none",
                    padding: "10px",
                    borderRadius: "10px",
                    width: "80%",
                  }}
                  placeholder={`예) 1반 김원준, 1반 김태준, 3반 박혜성 한 학급에 두 명 이상 들어가지 않게
예) 2반 이준우, 4반 최민재 같은 반으로
예) 1반 송아린, 3반 임수진 다른 반으로`}
                />
              </div>
              {/* AI 학급편성 버튼 */}
              <div
                className={classes["aiBtnDiv"]}
                style={{ marginTop: "20px" }}
              >
                <button
                  onClick={aiClassArrange}
                  className={classes["settingBtn"]}
                  disabled={isAiButtonDisabled}
                  style={{ marginRight: "10px" }}
                >
                  초안 생성하기 🤖
                </button>
                <button
                  onClick={() => {
                    setShowAiModal(false);
                    setAiConditionInput("");
                  }}
                  className={classes["settingBtn"]}
                >
                  닫기
                </button>
              </div>
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
                        stu.note === "특수반" ? classes["specialStudent"] : ""
                      }`}
                      // className={`${classes["newClass-li"]} ${
                      //   stu.teamWork === 1 ? classes["cl1"] : ""
                      // } ${stu.teamWork === 2 ? classes["cl2"] : ""} ${
                      //   stu.teamWork === 3 ? classes["cl3"] : ""
                      // } ${stu.teamWork === 4 ? classes["cl4"] : ""} ${
                      //   stu.teamWork === 5 ? classes["cl5"] : ""
                      // } ${stu.teamWork === 6 ? classes["cl6"] : ""}`}
                      key={stu.exClass + stu_index + stu.name}
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
                                // 테두리 점선으로 파랗게
                                currentT.style.border = "";
                                Swal.fire({
                                  icon: "error",
                                  title: "저장불가",
                                  text: "빈 내용을 저장할 수 없어요. 내용을 확인해주세요!",
                                });

                                return;
                              }

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
                                change_reason: result.value,
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
                      <span className={classes["newClassSpan-name"]}>
                        {stu.name}
                      </span>
                      <span className={classes["newClassSpan-exClass"]}>
                        {orderOriginClass ? stu?.nextClass : stu.exClass}
                      </span>
                      <span className={classes["newClassSpan-gender"]}>
                        {stu.gender}
                      </span>
                      <span className={classes["newClassSpan-score"]}>
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
                  className={classes["specialStudent"]}
                  title="비고에 '특수반' 기록 학생 수"
                >
                  특수반 -{" "}
                  {cl.filter((stu) => stu.note.includes("특수반")).length} 명
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
                <div title="비고에 '전출' 기록 학생 수">
                  전출예정 -{" "}
                  {cl.filter((stu) => stu.note.includes("전출")).length} 명
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
                <div
                  className={classes["grayBack"]}
                  style={{ fontSize: "20px" }}
                >
                  남 {cl.filter((stu) => stu.gender === "남").length} / 여{" "}
                  {cl.filter((stu) => stu.gender === "여").length} <br /> 총{" "}
                  {cl.length}명
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

      <footer className={classes["footer"]}>
        by 말랑한거봉🍇 kerbong@gmail.com
      </footer>
    </div>
  );
}

export default App;
