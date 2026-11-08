import React, { useEffect, useRef, useState } from "react";
import classes from "../App.module.css";
import { parseExcelFile, getYearGrade } from "./parseExcel";
import Swal from "sweetalert2";

const ExcelUploader = (props) => {
  const [classStudents, setClassStudents] = useState([]);
  const [isNew, setIsNew] = useState(true);
  const [yearGr, setYearGr] = useState("");

  const fileInfoInput = useRef(null);
  const savedInfoInput = useRef(null);
  useEffect(() => {
    //학생정보 배열 App으로 보내기

    props.setStudents(classStudents, isNew, yearGr);
    setIsNew(true);
  }, [classStudents]);

  // 오류/경고 목록을 팝업용 html로 만들기
  const escapeHtml = (str) =>
    String(str).replace(
      /[&<>"']/g,
      (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
          c
        ])
    );

  const listHtml = (items, max = 12) => {
    const shown = items.slice(0, max).map((item) => `<li>${escapeHtml(item)}</li>`);
    if (items.length > max) shown.push(`<li>... 외 ${items.length - max}건</li>`);
    return `<ul style="text-align:left; font-size:14px; line-height:1.6; padding-left:20px;">${shown.join(
      ""
    )}</ul>`;
  };

  const excelFileHandler = (e, isNew) => {
    const input = e.target;
    const file = input.files[0];
    if (file === undefined) return;

    //엑셀파일 크기가 3MB이상이면
    if (file.size > 3000000) {
      input.value = "";
      Swal.fire({
        icon: "error",
        title: "업로드불가",
        text: "엑셀파일의 크기가 너무 큽니다. 시트 중복이나 불필요한 내용(그림 등)을 확인해주세요.",
      });
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      Swal.fire({
        icon: "error",
        title: "업로드불가",
        text: "파일을 읽지 못했습니다. 파일이 다른 프로그램에서 열려 있다면 닫고 다시 시도해주세요.",
      });
    };
    reader.onload = function () {
      let result;
      try {
        result = parseExcelFile(reader.result, isNew);
      } catch (error) {
        console.error(error);
        Swal.fire({
          icon: "error",
          title: "업로드불가",
          text: "엑셀파일을 열 수 없습니다. 암호가 걸려 있거나 엑셀(.xlsx) 형식이 아닌 것 같습니다. 구글 시트에서 '파일 > 다운로드 > Microsoft Excel(.xlsx)'로 받은 파일인지 확인해주세요.",
        });
        return;
      }

      if (result.errors.length > 0) {
        Swal.fire({
          icon: "error",
          title: `수정이 필요한 곳이 ${result.errors.length}군데 있어요`,
          html:
            listHtml(result.errors) +
            `<p style="font-size:14px;">엑셀파일을 수정한 뒤 다시 업로드해주세요.</p>`,
          width: 700,
        });
        return;
      }

      const warnings = [...result.warnings];
      if (!isNew) {
        const { yearGrade, guessed } = getYearGrade(file.name, result.grade);
        if (guessed) {
          warnings.push(
            `파일 이름에서 학년도/학년을 찾지 못해 '${yearGrade}'(으)로 설정했습니다.`
          );
        }
        setYearGr(yearGrade);
        setIsNew(false);
      }

      const total = result.loaded.reduce((sum, s) => sum + s.count, 0);
      Swal.fire({
        icon: warnings.length > 0 ? "warning" : "success",
        title: `${result.loaded.length}개 반, ${total}명을 불러왔어요`,
        html:
          `<p style="font-size:14px;">${escapeHtml(
            result.loaded.map((s) => `${s.sheet}(${s.count}명)`).join(", ")
          )}</p>` + (warnings.length > 0 ? listHtml(warnings) : ""),
        width: 600,
      });

      setClassStudents([...result.classes]);
    };
    reader.readAsArrayBuffer(file);
    // 같은 파일을 수정 후 다시 올릴 수 있도록 초기화
    input.value = "";
  };

  return (
    <div style={{ fontSize: "1.5rem" }}>
      {" "}
      <h1> 분 반 해 요 😄</h1>
      {/* 왜 골고루 섞어야 하는지 짧은 안내 */}
      <div className={classes["whyMix"]}>
        <p className={classes["whyMixTitle"]}>
          어차피 내년에도 문제는 생길 텐데, 왜 골고루 섞을까요?
        </p>
        <ul>
          <li>
            담임과의 <b>케미는 고를 수 없지만, 출발선은 고를 수 있어요.</b>
          </li>
          <li>
            어려움이 한 반에 몰리면 <b>1+1이 2가 아니라 3</b>이 돼요. 섞으면
            문제의 총량이 줄어요.
          </li>
          <li>
            목표는 문제 없는 반이 아니라, <b>어느 반도 처음부터 불리하지 않은 반</b>
            이에요.
          </li>
        </ul>
        <a
          href={`${process.env.PUBLIC_URL}/why-mix.html`}
          target="_blank"
          rel="noreferrer"
        >
          자세히 보기 →
        </a>
      </div>
      <div className={classes["uploaderWrap"]}>
        {/* 설명부분 */}
        <div className={classes["how-to-use"]}>
          <h2>어떻게 사용하나요? 🤔</h2>
          <p>1. 양식 엑셀파일을 다운 ("설명서", "작성예시" 시트 확인)</p>
          <p>2. 반별 시트에 학생 자료 입력</p>
          <p>3. 함께 입력할 땐 구글 드라이브로 공유</p>
          <p>4. 완성된 엑셀파일을 업로드</p>
          <p>* 반, 번호, 이름, 성별은 꼭 입력해주세요!</p>
          <p>* 사이트 새로고침 시 정보가 사라져요!</p>
          <p>
            <a
              href={`${process.env.PUBLIC_URL}/class_template.xlsx`}
              download="학급편성 입력양식.xlsx"
            >
              양식파일 다운
            </a>
            {" | "}
            <a
              href={`${process.env.PUBLIC_URL}/guide.html`}
              target="_blank"
              rel="noreferrer"
            >
              설명서 보기
            </a>
          </p>
        </div>
        {/* 파일 업로드 부분 */}
        <div className={classes["uploadBox"]}>
          <h2>새롭게 분반하기 🫡</h2>
          <p>자료를 입력한 엑셀양식파일을 업로드해주세요. </p>
          <div className={classes["fileUpload"]}>
            <label className={classes["excelLabel"]} htmlFor="excelFileInput">
              엑셀파일 업로드
            </label>
            <input
              type="file"
              id="excelFileInput"
              name="excelFileInput"
              ref={fileInfoInput}
              onChange={(e) => {
                excelFileHandler(e, true);
              }}
              accept={".xls,.xlsx"}
            />
          </div>
          <br />

          <h2>분반 이어하기 😕</h2>
          <p>저장된 엑셀파일 중 명렬표를 업로드 해주세요. </p>
          <div className={classes["fileUpload"]}>
            <label className={classes["excelLabel"]} htmlFor="savedFileInput">
              분반 이어하기(명렬표 업로드)
            </label>
            <input
              type="file"
              id="savedFileInput"
              name="savedFileInput"
              ref={savedInfoInput}
              onChange={(e) => {
                excelFileHandler(e, false);
              }}
              accept={".xls,.xlsx"}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExcelUploader;
