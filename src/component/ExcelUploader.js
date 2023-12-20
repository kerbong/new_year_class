import React, { useEffect, useRef, useState } from "react";
import classes from "../App.module.css";
import { read, utils } from "xlsx";
import Swal from "sweetalert2";

const ExcelUploader = (props) => {
  const [classStudents, setClassStudents] = useState([]);
  const [isNew, setIsNew] = useState(true);

  const fileInfoInput = useRef(null);
  const savedInfoInput = useRef(null);

  useEffect(() => {
    //학생정보 배열 App으로 보내기
    props.setStudents(classStudents, isNew);
    setIsNew(true);
  }, [classStudents]);

  const excelFileHandler = (e, isNew) => {
    let input = e.target;
    let class_students = [];
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
        //파일 크기가 적당하면
        if (!isBig) {
          try {
            let data = reader.result;
            let workBook = read(data, { type: "binary" });

            //새로운 양식으로 새롭게 작업하는 경우
            if (isNew) {
              //시트 각각을 작업하기
              workBook.SheetNames.forEach((sheetName) => {
                // 시트마다 줄을 객체로 저장하기
                let rows = [...utils.sheet_to_json(workBook.Sheets[sheetName])];
                let new_rows = [];
                rows.forEach((row) => {
                  new_rows.push({
                    exClass: +row["반"],
                    birthday: +row["생년월일"],
                    num: +row["번호"],
                    gender: row["성별"],
                    name: row["이름"],
                    score: +row["총점"],
                    note: row["비고"] || "",
                    teamWork: row["협동"] || "",
                  });
                });
                //스코어 높은순으로 정렬하기
                new_rows.sort((a, b) => {
                  return b["score"] - a["score"];
                });

                class_students.push([...new_rows]);
              });

              // 기존 자료를 이어서 할 경우
            } else {
              //기존 자료면 상태 바꾸기
              setIsNew(false);
              //시트 각각을 작업하기
              workBook.SheetNames.forEach((sheetName) => {
                // 시트마다 줄을 객체로 저장하기
                let rows = [...utils.sheet_to_json(workBook.Sheets[sheetName])];
                let new_rows = [];
                rows.forEach((row) => {
                  new_rows.push({
                    exClass: +row["이전반"],
                    birthday: +row["생년월일"] || "-",
                    num: +row["번호"] || "-",
                    gender: row["성별"],
                    name: row["이름"],
                    score: +row["총점"] || "-",
                    note: row["비고"] || "",
                    teamWork: row["협동"] || "",
                  });
                });

                class_students.push([...new_rows]);
              });
            }

            setClassStudents([...class_students]);
            //학생정보가 저장되면 로컬스토리지에 문자로 저장해두기
            // localStorage.setItem("randomStudents", JSON.stringify(new_rows));
          } catch (error) {
            Swal.fire({
              icon: "error",
              title: "업로드불가",
              text: "엑셀파일에 비어있는 행, 열이 있는지 확인해주세요! 문제가 지속될 경우 알려주세요!",
            });
          }

          //파일 크기가 너무 큰 경우
        } else {
          Swal.fire({
            icon: "error",
            title: "업로드불가",
            text: "엑셀파일의 크기가 너무 크네요! 중복된 시트가 없는지 확인해주세요. 문제가 지속되시면 kerbong@gmail.com으로 알려주세요!",
          });
          return false;
        }
      };

      reader.readAsBinaryString(input.files[0]);
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
            <a href="https://docs.google.com/spreadsheets/d/1tdHVIke3tlak2xCvIV_GAj0UcRRSIjjZ/edit?usp=share_link&ouid=105506373897967517533&rtpof=true&sd=true">
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
