import React, { useState, useEffect, useRef } from "react";
import { utils, writeFile } from "xlsx";
import Swal from "sweetalert2";
import classes from "./App.module.scss";
import ExcelUploader from "./component/ExcelUploader";

// 총 14반까지만 가능..
const CLASS_NAME = [
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
];

const EXPLAINS = [
  "* 브라우저 확대/축소 (Ctrl+마우스휠) 로 한 눈에 보이도록 설정한 후 사용하세요.",
  "* 이름 / 이전반 / 성별 / 점수 / 비고 순서로 보여집니다.",
  "* 초기화 버튼을 누르면 처음 반배정되었던 상태로 되돌아갑니다.",
  "* 중복이름확인 버튼을 누르면 현재 상태에서 이름(성 제외)이 같은학생이 있는지 확인해서 빨간색으로 표시합니다.",
  "* 남자 앞번호 / 여자 앞번호 / 혼성번호 버튼을 누르면 현재 상태에서 성별을 기준으로 정렬됩니다.",
  "* 두 학생을 차례로 클릭하면 테두리가 표시 되고, 2초 후에 학급이 이동됩니다.",
  "* 학생을 클릭한 후 빈자리에 넣기를 누르면 해당 학급으로 이동됩니다.",
  "* 비고가 '전출'인 학생은 정렬에 상관없이 가장 뒤로 배치됩니다.",
  "* 엑셀파일로 저장하시면, 나이스 업로드용 / 교사용 명렬표 두 가지 엑셀파일이 저장됩니다.",
  "* 다른 자료로 배정하시려면 사이트를 새로고침(F5) 해주세요.",
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

  const classInput = useRef();
  const gradeInput = useRef();
  const yearInput = useRef();

  //분반방식 버튼 누르면 id를 state에 저장하고 이를 바탕으로 btn css속성 다르게 설정함.
  const divideTypeHandler = (e) => {
    setDivideType(e.target.id);
  };

  // 남, 여학생 모아서 내림차순 정렬하기
  const orderByGenderName = (nextWholeClass, how) => {
    let new_wholeClass = [];
    nextWholeClass.forEach((cl) => {
      let maleFilter = cl.filter((stu) => stu.gender === "남");
      let femaleFilter = cl.filter((stu) => stu.gender === "여");

      let wholeFilter = cl.filter((stu) => stu);

      maleFilter.sort((a, b) => {
        return a.name.localeCompare(b.name);
      });
      femaleFilter.sort((a, b) => {
        return a.name.localeCompare(b.name);
      });
      wholeFilter.sort((a, b) => {
        return a.name.localeCompare(b.name);
      });

      const new_cl = [];
      if (how === "male") {
        new_cl.push(...maleFilter, ...femaleFilter);
      } else if (how === "female") {
        new_cl.push(...femaleFilter, ...maleFilter);
      } else if (how === "whole") {
        new_cl.push(...wholeFilter);
      }
      //전출학생 제외하고 배열만들기
      let new_cl_transfer = new_cl.filter((stu) => stu.note !== "전출");
      //전출인 학생 제일 뒤에 붙이기
      new_cl.forEach((stu) => {
        if (stu["note"] === "전출") {
          new_cl_transfer.push(stu);
        }
      });
      new_wholeClass.push(new_cl_transfer);
    });
    return new_wholeClass;
  };

  //내년 학급 초기자료 만들기!
  const divideClassHandler = (nextYearClass) => {
    let nextWholeClass = [];
    //내년도 학급 만들어서 nextWholeClass에 넣어두기
    for (let i = 0; i < nextYearClass; i++) {
      nextWholeClass.push([]);
    }
    // console.log(nextWholeClass);

    //현재 학급 자료로 배정 시작하기
    classStudents?.forEach((cl, cl_index) => {
      // console.log(cl);
      let go_forward = true;
      cl.forEach((student, index) => {
        //학생인덱스+ 학급인덱스 / 학급수의 나머지 (1반은 내년 1반 1등부터, 2반은 내년 2반 1등부터...)
        let clNum = +((index + cl_index) % nextYearClass);
        if (go_forward) {
          // console.log("index" + index);
          // console.log("cl_index" + cl_index);
          // console.log("clNum" + clNum);
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
            console.log(go_forward);
            go_forward = !go_forward;
            console.log(go_forward);
          }
        }
      });
    });
    const new_wholeClass = orderByGenderName(nextWholeClass, firstMale);

    setNextOriginClass(JSON.parse(JSON.stringify(new_wholeClass)));
    setNextAdaptClass([...new_wholeClass]);
    setDivided(true);
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

  //각반의 중복이름 체크함수
  const duplicateCheck = () => {
    nextAdaptClass.forEach((cl, cl_index) => {
      cl.forEach((stu, stu_index) => {
        //중복학생 인덱스찾기
        let dupli_index = cl.findIndex(
          (i) => i.name.slice(1) === stu.name.slice(1)
        );
        if (dupli_index !== stu_index) {
          document.getElementById(
            `${cl[dupli_index].exClass}-${cl[dupli_index].num}`
          ).className += ` ${classes["dupli-stu-bg"]}`;
          document.getElementById(
            `${stu.exClass}-${stu.num}`
          ).className += ` ${classes["dupli-stu-bg"]}`;
        }
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
  };

  //엑셀파일 만들어서 저장
  const makeExcelFile = () => {
    // 나이스 업로드 용
    const book = utils.book_new();
    // 명렬표 용
    const book2 = utils.book_new();

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
        ]);
      });
      const sheetData = utils.aoa_to_sheet(new_cl);
      sheetData["!cols"] = [
        { wpx: 80 }, // 성명
        { wpx: 60 }, // 이전학년
        { wpx: 60 }, // 이전반명
        { wpx: 60 }, // 이전번호
        { wpx: 60 }, // 진급학년명
        { wpx: 60 }, // 진급반번호
        { wpx: 40 }, // 성별
      ];

      //시트에 작성한 데이터 넣기 파일명, 데이터, 시트명
      utils.book_append_sheet(book, sheetData, `${CLASS_NAME[cl_index]}반`);

      //교사용 명렬표
      let new_cl_2 = [];
      new_cl_2.push([
        "학년",
        "반",
        "번호 ",
        "성명",
        "성별",
        "이전반",
        "비고",
        "협동",
      ]);
      cl.forEach((stu, stu_index) => {
        new_cl_2.push([
          +yearGrade.slice(8, 9),
          CLASS_NAME[cl_index],
          stu_index + 1,
          stu.name,
          stu.gender,
          stu.exClass,
          stu.note || "",
          stu.teamWork || "",
        ]);
      });
      const sheetData2 = utils.aoa_to_sheet(new_cl_2);
      sheetData2["!cols"] = [
        { wpx: 40 }, // 진급학년
        { wpx: 40 }, // 진급반
        { wpx: 40 }, // 진급번호
        { wpx: 80 }, // 성명
        { wpx: 40 }, // 성별
        { wpx: 50 }, // 이전반
        { wpx: 80 }, // 비고
        { wpx: 40 }, // 협동
      ];

      //시트에 작성한 데이터 넣기 파일명, 데이터, 시트명
      utils.book_append_sheet(book2, sheetData2, `${CLASS_NAME[cl_index]}반`);
    });

    writeFile(book, `${yearGrade} 학급편성자료(나이스용).xlsx`);

    writeFile(book2, `${yearGrade} 학급편성자료(명렬표).xlsx`);
  };

  return (
    <div className={classes["App"]}>
      {/* localStorage에 학생정보가 없으면...엑셀업로드화면 보여주기 */}

      {classStudents?.length === 0 && (
        <>
          <ExcelUploader
            setStudents={(students) => {
              setClassStudents([...students]);
            }}
          />
        </>
      )}
      {/* 아직 분반 전에 보일 화면들 */}
      {!divided &&
        // {/* 학생명부가 있으면 반배정 규칙 선택하기 1.ㄹ 2.z  +  내년 학급수 입력 후 반배정!버튼 누르기*/}
        classStudents?.length > 0 && (
          <>
            {/* 분반할 때 방법 ㄹ / z 선택 */}
            <div>
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
            <div>
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
          <span className={classes["gradeClassSpan"]}>{yearGrade}</span>

          <div>
            <button
              className={`${classes["settingBtn"]} ${classes["explainBg"]}`}
              onClick={() => setShowExplain((prev) => !prev)}
            >
              {showExplain ? "설명숨기기" : "설명보기"}
            </button>
            <button className={classes["settingBtn"]} onClick={originReset}>
              초기화
            </button>
            <button className={classes["settingBtn"]} onClick={duplicateCheck}>
              중복이름확인
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
              엑셀파일저장
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
              >
                <span className={classes["gradeClassSpan"]}>
                  {CLASS_NAME[index]} 반
                </span>

                <ul className={classes["newClass-ul"]} key={`newclass${index}`}>
                  {cl.map((stu, stu_index) => (
                    <li
                      id={stu.exClass + "-" + stu.num}
                      className={`${classes["newClass-li"]} ${
                        stu.teamWork === "굿" ? classes["goodStudent"] : ""
                      } ${
                        stu.teamWork === "배드" ? classes["badStudent"] : ""
                      } ${
                        stu.teamWork === "특수반"
                          ? classes["specialStudent"]
                          : ""
                      }`}
                      key={stu.exClass + stu.name}
                      onClick={(e) => {
                        // 클릭된 학생이 없었으면 템프에 추가해두고 테두리 진하게!

                        if (Object.keys(tempStudent).length === 0) {
                          setTempStudent({
                            ...stu,
                            next_cl_index: index,
                            next_stu_index: stu_index,
                          });

                          // 테두리 점선으로 파랗게
                          e.currentTarget.style.border = "dashed #2771df";

                          //같은 학생을 클릭하면 초기화
                        } else if (
                          tempStudent.exClass === stu.exClass &&
                          tempStudent.num === stu.num
                        ) {
                          setTempStudent("");
                          e.currentTarget.style.border = "";
                          //다른 학생을 클릭하면 두 학생 바꾸기
                        } else {
                          // 테두리 점선으로 파랗게
                          e.currentTarget.style.border = "dashed #2771df";
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
                          setTimeout(() => {
                            setNextAdaptClass([...new_AdaptClass]);
                            setTempStudent("");
                          }, 2000);
                        }
                      }}
                    >
                      <span className={classes["newClassSpan-name"]}>
                        {stu.name}
                      </span>
                      <span className={classes["newClassSpan-exClass"]}>
                        {stu.exClass}
                      </span>
                      <span className={classes["newClassSpan-gender"]}>
                        {stu.gender}
                      </span>
                      <span className={classes["newClassSpan-score"]}>
                        {stu.score}
                      </span>
                      <span className={classes["newClassSpan-note"]}>
                        {stu.note}
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
                <div className={classes["goodStudent"]}>
                  에이스 - {cl.filter((stu) => stu.teamWork === "굿").length} 명
                </div>
                <div className={classes["badStudent"]}>
                  마이너스 -{" "}
                  {cl.filter((stu) => stu.teamWork === "배드").length} 명
                </div>
                <div className={classes["specialStudent"]}>
                  특수반 -{" "}
                  {cl.filter((stu) => stu.teamWork === "특수반").length} 명
                </div>
                <div>비고 - {cl.filter((stu) => stu.note !== "").length}</div>
                <div>
                  남 {cl.filter((stu) => stu.gender === "남").length} / 여{" "}
                  {cl.filter((stu) => stu.gender === "여").length} / 총{" "}
                  {cl.length}명
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
