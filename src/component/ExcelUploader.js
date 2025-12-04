import React, { useEffect, useRef, useState } from "react";
import classes from "../App.module.css";
import { read, utils } from "xlsx";
import Swal from "sweetalert2";

const ExcelUploader = (props) => {
  const [classStudents, setClassStudents] = useState([]);
  const [isNew, setIsNew] = useState(true);
  const [yearGr, setYearGr] = useState("");

  const fileInfoInput = useRef(null);
  const savedInfoInput = useRef(null);
  // 보이지 않는 문자, 양쪽 공백 제거
  function cleanString(v) {
    if (v === undefined || v === null) return "";
    return String(v)
      .replace(/[\u200B-\u200D\uFEFF]/g, "") // 제로폭 문자 제거
      .replace(/\s+/g, " ") // 중복 공백 정리
      .trim();
  }

  // 한 줄(row)의 key 문제 정리
  function cleanRow(row) {
    let cleaned = {};
    Object.keys(row).forEach((key) => {
      const cleanKey = cleanString(key);
      cleaned[cleanKey] = cleanString(row[key]);
    });
    return cleaned;
  }

  // 시트 → JSON 후 전체 정제
  function normalizeSheet(sheet) {
    let rows = utils.sheet_to_json(sheet, { defval: "" });

    // row-level cleanup
    rows = rows
      .map((row) => cleanRow(row))
      .filter((row) => Object.values(row).some((v) => v !== "")); // 완전 빈줄 제거

    return rows;
  }

  // 숫자 변환 안전 처리
  function toNumber(v) {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  useEffect(() => {
    //학생정보 배열 App으로 보내기

    props.setStudents(classStudents, isNew, yearGr);
    setIsNew(true);
  }, [classStudents]);

  const excelFileHandler = (e, isNew) => {
    let input = e.target;
    let class_students = [];

    const getFileName = (file) => {
      return file.name;
    };

    if (input.files[0] !== undefined) {
      let reader = new FileReader();
      let isBig = false;
      reader.onprogress = (e) => {
        //엑셀파일 크기가 500KB이상이면(20반이상;)
        if (e.total > 500000) {
          isBig = true;
        }
      };
      reader.onload = function () {
        if (!isBig) {
          try {
            let data = reader.result;
            let workBook = read(data, { type: "binary" });

            // 새 작업
            if (isNew) {
              workBook.SheetNames.forEach((sheetName) => {
                const sheet = workBook.Sheets[sheetName];

                // 자동 정제 적용
                let rows = normalizeSheet(sheet);

                let new_rows = [];

                rows.forEach((row) => {
                  new_rows.push({
                    exClass: toNumber(row["반"]),
                    birthday: cleanString(row["생년월일"]),
                    num: toNumber(row["번호"]),
                    gender: cleanString(row["성별"]),
                    name: cleanString(row["이름"]),
                    score: toNumber(row["총점"]),
                    note: cleanString(row["비고"] || ""),
                    teamWork: cleanString(row["협동"] || ""),
                  });
                });

                // 점수 내림차순
                new_rows.sort((a, b) => b.score - a.score);

                class_students.push([...new_rows]);
              });

              // 이어서 작업
            } else {
              let fileName = getFileName(input.files[0]);
              let yG = fileName.split(" 학급편성자료")[0];
              setYearGr(yG);
              setIsNew(false);

              workBook.SheetNames.forEach((sheetName) => {
                const sheet = workBook.Sheets[sheetName];

                // 자동 정제 적용
                let rows = normalizeSheet(sheet);

                let new_rows = [];

                rows.forEach((row) => {
                  if (!cleanString(row["이름"])) return;

                  new_rows.push({
                    exClass: toNumber(row["이전반"]),
                    birthday: cleanString(row["생년월일"] || "-"),
                    num: toNumber(row["이전번호"]),
                    gender: cleanString(row["성별"]),
                    name: cleanString(row["이름"]),
                    score: toNumber(row["총점"]),
                    note: cleanString(row["비고"] || ""),
                    teamWork: cleanString(row["협동"] || ""),
                  });
                });

                class_students.push([...new_rows]);
              });
            }

            setClassStudents([...class_students]);
          } catch (error) {
            console.error(error);
            Swal.fire({
              icon: "error",
              title: "업로드불가",
              text: "엑셀파일에 숨은 문자나 깨진 값이 있는 것 같습니다. 자동 정제를 추가했는데도 문제가 있으면 알려주세요!",
            });
          }
        } else {
          Swal.fire({
            icon: "error",
            title: "업로드불가",
            text: "엑셀파일의 크기가 너무 큽니다. 시트 중복을 확인해주세요.",
          });
          return false;
        }
      };
      reader.readAsArrayBuffer(input.files[0]);
    } else {
      return;
    }
  };

  return (
    <div style={{ fontSize: "1.5rem" }}>
      {" "}
      <h1> 분 반 해 요 😄</h1>
      <div className={classes["yearLabel"]}>
        {/* 설명부분 */}
        <div className={classes["how-to-use"]}>
          <h2>어떻게 사용하나요? 🤔</h2>
          <p>1. 양식 엑셀파일을 다운</p>
          <p>2. "메모" 부분 확인하기</p>
          <p>3. 누락된 줄 없이 자료 입력하기</p>
          <p>* 사이트 새로고침 시 정보가 사라져요!</p>
          <p>
            <a href="https://drive.google.com/uc?export=download&id=1K8n8-7tZF3oVZyRx-vykKOXv3UcwLHCr">
              양식파일 다운
            </a>
          </p>
        </div>
        {/* 파일 업로드 부분 */}
        <div>
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
