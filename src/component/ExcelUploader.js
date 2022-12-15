import React, { useEffect, useRef, useState } from "react";
import classes from "../App.module.scss";
import { read, utils } from "xlsx";
import Swal from "sweetalert2";

const ExcelUploader = (props) => {
  const [classStudents, setClassStudents] = useState([]);
  const fileInfoInput = useRef(null);

  useEffect(() => {
    //학생정보 배열 App으로 보내기
    props.setStudents(classStudents);
  }, [classStudents]);

  const excelFileHandler = (e) => {
    let input = e.target;
    let class_students = [];
    if (input.files[0] !== undefined) {
      let reader = new FileReader();
      let isBig = false;
      reader.onprogress = (e) => {
        //엑셀파일 크기가 100KB이상이면(20반이상;)
        if (e.total > 100000) {
          isBig = true;
        }
      };
      reader.onload = function () {
        //파일 크기가 적당하면
        if (!isBig) {
          try {
            let data = reader.result;
            let workBook = read(data, { type: "binary" });

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
      <h2> 🎒 분 반 해 요 🎶</h2>
      <p>양식 엑셀파일을 다운받아서 작성후 업로드하세요.</p>
      <p style={{ fontWeight: "bold" }}>양식파일의 "메모"를 꼭 확인해주세요.</p>
      <p>
        <a href="https://drive.google.com/uc?export=download&id=1K8n8-7tZF3oVZyRx-vykKOXv3UcwLHCr">
          양식파일 다운
        </a>
      </p>
      <p>*필수존재항목 - 반 번호 성별 생년월일 이름 총점 비고 협동</p>
      <p>*필수입력항목 - 반 번호 성별 생년월일 이름 총점 </p>
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
            excelFileHandler(e);
          }}
          accept={".xls,.xlsx"}
        />
      </div>
    </div>
  );
};

export default ExcelUploader;
