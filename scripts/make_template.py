# 학급편성 입력양식(public/class_template.xlsx) 생성 스크립트
# 사용: python scripts/make_template.py
# 머리글을 바꾸면 src/component/parseExcel.js 의 별칭도 함께 수정해야 합니다.
from pathlib import Path

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

OUT = Path(__file__).resolve().parent.parent / "public" / "class_template.xlsx"

CLASS_COUNT = 10  # 반별 시트 수
PREFILL_ROWS = 40  # '반' 열을 미리 채워둘 줄 수
LAST_ROW = 61  # 드롭다운/서식을 적용할 마지막 줄 (학생 60명)
GROUP_COUNT = 10

FONT = "맑은 고딕"
REQUIRED_FILL = PatternFill("solid", start_color="1F4E78")
OPTIONAL_FILL = PatternFill("solid", start_color="548235")
INPUT_FILL = PatternFill("solid", start_color="FFF9E5")
THIN = Side(style="thin", color="BFBFBF")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)

# (머리글, 너비, 필수 여부, 메모)
COLUMNS = [
    ("반", 6, True, "현재(올해) 반 숫자.\n미리 입력되어 있습니다.\n시트를 복사해 반을 추가했다면 이 열의 숫자를 꼭 바꿔주세요."),
    ("번호", 6, True, "현재(올해) 번호 숫자.\n한 반 안에서 번호가 겹치면 안 됩니다."),
    ("이름", 11, True, "학생 이름.\n이름이 없는 줄은 읽지 않습니다."),
    ("성별", 7, True, "드롭다운에서 '남' 또는 '여' 선택.\n★ 비어 있으면 업로드가 되지 않습니다."),
    ("생년월일", 13, False, "예) 2015.03.07\n나이스에서 내려받은 그대로 붙여넣으면 됩니다.\n(15.3.7, 20150307, 2015-03-07, 2015년 3월 7일 등 다른 형태도 자동으로 2015.03.07 로 바뀝니다)"),
    ("총점", 8, False, "성적 총점(숫자만).\n점수 높은 순서로 반을 나눕니다.\n비워두면 0점으로 처리됩니다."),
    ("생활지도", 9, False, "생활지도가 필요한 학생만 상/중/하 선택.\n상 = 가장 어려움.\n각 반에 고르게 나눕니다."),
    ("학부모", 8, False, "학부모 민원 등 배려가 필요한 경우만 상/중/하 선택.\n상 = 가장 어려움.\n각 반에 고르게 나눕니다."),
    ("학습부진", 9, False, "해당 학생만 'O' 선택."),
    ("특수반", 8, False, "특수학급 학생만 'O' 선택.\n각 반에 고르게 나누고, 특수 학생이 있는 반은 1명 적게 편성합니다."),
    ("다문화", 8, False, "해당 학생만 'O' 선택."),
    ("쌍둥이", 8, False, "쌍둥이 학생만 'O' 선택.\n'1. 자동배분'을 누르면 같은 반/다른 반을 물어봅니다.\n(성과 생년월일로 짝을 찾습니다)"),
    ("전출", 7, False, "전출 예정 학생만 'O' 선택.\n각 반에 고르게 나누고, 명단 맨 뒤로 가며 인원수에서 제외됩니다."),
    ("그룹", 8, False, "서로 다른 반으로 떨어뜨려야 하는 학생들에게 같은 그룹을 선택.\n예) 사이가 나쁜 3명 → 모두 '그룹1'\n같은 그룹끼리 각 반에 흩어집니다."),
    ("협동", 7, False, "굿 = 학급 분위기를 이끄는 학생\n배드 = 협동이 어려운 학생\n'1. 자동배분'을 누르면 각 반에 고르게 나눕니다. 보통 학생은 비워두세요."),
    ("비고", 30, False, "그 밖에 적어둘 내용을 자유롭게 입력.\n(쉼표로 여러 내용 입력 가능)"),
]
HEADERS = [c[0] for c in COLUMNS]
COL = {h: get_column_letter(i + 1) for i, h in enumerate(HEADERS)}

EXAMPLES = [
    # 반, 번호, 이름, 성별, 생년월일, 총점, 생활지도, 학부모, 학습부진, 특수반, 다문화, 쌍둥이, 전출, 그룹, 협동, 비고, 설명
    (1, 1, "강민서", "여", "2015.03.07", 372, "", "", "", "", "", "", "", "", "굿", "", "협동 '굿': 학급 분위기를 이끄는 학생"),
    (1, 2, "김도윤", "남", "2015.11.21", 318, "상", "", "", "", "", "", "", "그룹1", "", "", "생활지도 '상' + 그룹1 (3번 박서준과 다른 반으로)"),
    (1, 3, "박서준", "남", "2015.06.02", 295, "", "", "", "", "", "", "", "그룹1", "배드", "", "그룹1 + 협동 '배드'"),
    (1, 4, "서지우", "여", "2015.01.15", 341, "", "중", "", "", "", "", "", "", "", "", "학부모 '중'"),
    (1, 5, "오하준", "남", "2015.09.30", 188, "", "", "O", "", "", "", "", "", "", "", "학습부진"),
    (1, 6, "유나은", "여", "2015.04.18", 256, "", "", "", "", "O", "", "", "", "", "", "다문화"),
    (1, 7, "이건우", "남", "2015.08.09", 142, "", "", "", "O", "", "", "", "", "", "", "특수반"),
    (1, 8, "이서아", "여", "2015.12.25", 330, "", "", "", "", "", "O", "", "", "", "2반 이서윤과 쌍둥이", "쌍둥이 + 비고에 자유 입력"),
    (1, 9, "정시우", "남", "2015.02.11", 277, "", "", "", "", "", "", "O", "", "", "", "전출 예정"),
    (1, 10, "최예린", "여", "2015.07.23", 304, "하", "하", "", "", "", "", "", "", "", "알레르기 있음", "여러 항목을 함께 선택해도 됩니다"),
    (1, 11, "한지호", "남", "2015.05.05", 289, "", "", "", "", "", "", "", "", "", "", "특이사항이 없으면 총점까지만 입력"),
]


def font(**kw):
    return Font(name=FONT, **kw)


def write_header(ws):
    for i, (title, width, required, memo) in enumerate(COLUMNS, start=1):
        cell = ws.cell(row=1, column=i, value=title)
        cell.font = font(bold=True, color="FFFFFF", size=11)
        cell.fill = REQUIRED_FILL if required else OPTIONAL_FILL
        cell.alignment = CENTER
        cell.border = BORDER
        comment = Comment(memo, "분반해요")
        comment.width = 280
        comment.height = 110
        cell.comment = comment
        ws.column_dimensions[get_column_letter(i)].width = width
    ws.row_dimensions[1].height = 26
    ws.freeze_panes = "E2"


def style_body(ws, last_row):
    for row in ws.iter_rows(min_row=2, max_row=last_row, max_col=len(COLUMNS)):
        for cell in row:
            cell.font = font(size=11)
            cell.border = BORDER
            cell.alignment = LEFT if cell.column == len(COLUMNS) else CENTER
            if cell.column <= 4:
                cell.fill = INPUT_FILL
    # 생년월일, 이름, 비고는 텍스트 서식 (날짜/숫자 자동 변환 방지)
    for name in ("이름", "생년월일", "비고"):
        for r in range(2, last_row + 1):
            ws[f"{COL[name]}{r}"].number_format = "@"


def add_validations(ws, last_row):
    def rng(name):
        return f"{COL[name]}2:{COL[name]}{last_row}"

    # strict=False: 경고만 표시 (다른 파일에서 복사해 붙여넣는 열은 입력을 막지 않음)
    def list_dv(values, title, names, strict=True):
        dv = DataValidation(type="list", formula1='"' + ",".join(values) + '"', allow_blank=True)
        dv.errorStyle = "stop" if strict else "warning"
        dv.showErrorMessage = True
        dv.errorTitle = "입력 오류"
        dv.error = f"목록에서 선택해주세요: {', '.join(values)}"
        dv.showInputMessage = True
        dv.promptTitle = title
        dv.prompt = f"{' / '.join(values)} 중 선택 (해당 없으면 비워두기)"
        for n in names:
            dv.add(rng(n))
        ws.add_data_validation(dv)

    list_dv(["남", "여"], "성별 (필수)", ["성별"], strict=False)
    list_dv(["상", "중", "하"], "정도 선택", ["생활지도", "학부모"])
    list_dv(["O"], "해당하면 O", ["학습부진", "특수반", "다문화", "쌍둥이", "전출"])
    list_dv([f"그룹{i}" for i in range(1, GROUP_COUNT + 1)], "분리 그룹", ["그룹"])
    list_dv(["굿", "배드"], "협동", ["협동"])

    def num_dv(kind, lo, hi, msg, names):
        dv = DataValidation(type=kind, operator="between", formula1=str(lo), formula2=str(hi), allow_blank=True)
        dv.errorStyle = "warning"
        dv.showErrorMessage = True
        dv.errorTitle = "입력 오류"
        dv.error = msg
        for n in names:
            dv.add(rng(n))
        ws.add_data_validation(dv)

    num_dv("whole", 1, 30, "반은 숫자만 입력해주세요. (예: 3)", ["반"])
    num_dv("whole", 1, 99, "번호는 숫자만 입력해주세요. (예: 12)", ["번호"])
    num_dv("decimal", 0, 100000, "총점은 숫자만 입력해주세요. (예: 285)", ["총점"])


def add_highlights(ws, last_row):
    red = PatternFill("solid", start_color="FFC7CE", end_color="FFC7CE")
    # 이름은 있는데 필수 값이 비어 있으면 빨간색
    for name in ("반", "번호", "성별"):
        c = COL[name]
        ws.conditional_formatting.add(
            f"{c}2:{c}{last_row}",
            FormulaRule(formula=[f'AND(LEN(TRIM(${COL["이름"]}2))>0,LEN(TRIM(${c}2))=0)'], fill=red),
        )
    # 같은 번호가 두 번 나오면 빨간색
    b = COL["번호"]
    ws.conditional_formatting.add(
        f"{b}2:{b}{last_row}",
        FormulaRule(formula=[f"AND(${b}2<>\"\",COUNTIF(${b}$2:${b}${last_row},${b}2)>1)"], fill=red),
    )


def make_class_sheet(wb, class_num):
    ws = wb.create_sheet(f"{class_num}반")
    ws.sheet_properties.tabColor = "1F4E78"
    write_header(ws)
    for r in range(2, PREFILL_ROWS + 2):
        ws.cell(row=r, column=1, value=class_num)
    style_body(ws, LAST_ROW)
    add_validations(ws, LAST_ROW)
    add_highlights(ws, LAST_ROW)


def make_example_sheet(wb):
    ws = wb.create_sheet("작성예시")
    ws.sheet_properties.tabColor = "BF8F00"
    write_header(ws)
    last = len(EXAMPLES) + 1
    for r, row in enumerate(EXAMPLES, start=2):
        for c, value in enumerate(row[: len(COLUMNS)], start=1):
            ws.cell(row=r, column=c, value=value if value != "" else None)
    style_body(ws, last)
    add_validations(ws, last)

    tip_col = len(COLUMNS) + 2
    head = ws.cell(row=1, column=tip_col, value="💡 이 줄은 이런 학생이에요")
    head.font = font(bold=True, color="7F6000", size=11)
    head.fill = PatternFill("solid", start_color="FFF2CC")
    head.alignment = CENTER
    for r, row in enumerate(EXAMPLES, start=2):
        cell = ws.cell(row=r, column=tip_col, value=row[-1])
        cell.font = font(color="7F6000", size=11)
        cell.alignment = LEFT
    ws.column_dimensions[get_column_letter(tip_col - 1)].width = 2
    ws.column_dimensions[get_column_letter(tip_col)].width = 48

    note = ws.cell(
        row=last + 2,
        column=1,
        value="※ 이 시트는 보기용 예시입니다. 사이트에 업로드해도 읽지 않습니다. 실제 자료는 '1반', '2반' ... 시트에 입력하세요. "
        "머리글(1행)에 마우스를 올리면 열마다 설명(메모)이 보입니다.",
    )
    note.font = font(bold=True, color="C00000", size=11)
    note.alignment = Alignment(vertical="top", wrap_text=True)
    ws.merge_cells(start_row=last + 2, start_column=1, end_row=last + 2, end_column=tip_col)
    ws.row_dimensions[last + 2].height = 36


GUIDE = [
    ("title", "분반해요 · 학급편성 입력양식 설명서"),
    ("p", "이 파일에 올해 학생 자료를 입력해 사이트(https://kerbong.github.io/new_year_class/)에 업로드하면 내년 반을 나눌 수 있습니다."),
    ("h", "1. 한눈에 보는 순서"),
    ("n", "① '작성예시' 시트를 보고 입력 방법을 확인합니다."),
    ("n", "② '1반', '2반' ... 시트에 올해 반별로 학생 자료를 입력합니다. (한 시트 = 올해 한 반)"),
    ("n", "③ 여러 선생님이 함께 입력하려면 아래 2번처럼 구글 드라이브로 공유합니다."),
    ("n", "④ 입력이 끝난 엑셀파일(.xlsx)을 사이트의 '엑셀파일 업로드'에 올립니다."),
    ("n", "⑤ 문제가 있으면 사이트가 '어느 시트 몇 행'인지 알려줍니다. 고친 뒤 다시 올리면 됩니다."),
    ("h", "2. 구글 드라이브로 함께 입력하기 (담임 선생님들이 각자 입력)"),
    ("n", "① 대표 선생님이 구글 드라이브(drive.google.com)에서 '새로 만들기 > 파일 업로드'로 이 엑셀파일을 올립니다."),
    ("n", "② 올린 파일을 더블클릭해 엽니다. (구글 스프레드시트로 열리며 파일 이름 옆에 '.XLSX' 표시가 보입니다)"),
    ("n", "③ 오른쪽 위 '공유' 버튼 > '일반 액세스'를 '제한됨'에서 '링크가 있는 모든 사용자'로 바꿉니다."),
    ("n", "④ 바로 오른쪽 역할을 '뷰어'에서 '편집자'로 바꿉니다. ★ '뷰어'로 두면 다른 선생님이 입력할 수 없습니다."),
    ("n", "⑤ '링크 복사'를 눌러 학년 선생님들께만 링크를 전달합니다. (메신저 등)"),
    ("n", "⑥ 각 담임 선생님은 링크를 열어 아래쪽 탭에서 자기 반 시트만 입력합니다. 동시에 입력해도 됩니다."),
    ("n", "⑦ 모두 입력하면 대표 선생님이 '파일 > 다운로드 > Microsoft Excel(.xlsx)'로 내려받아 사이트에 업로드합니다."),
    ("n", "⑧ 작업이 끝나면 공유를 다시 '제한됨'으로 바꾸고, 드라이브의 파일을 삭제합니다. (학생 개인정보 보호)"),
    ("warn", "★ 링크를 아는 사람은 누구나 열고 고칠 수 있습니다. 링크를 공개된 곳(단체방, 게시판 등)에 올리지 말고, 입력 기간에만 공유를 켜두세요. 학교/교육청의 개인정보 지침도 확인해주세요."),
    ("h", "3. 구글 시트에서 입력할 때 주의할 점"),
    ("n", "· 다른 곳에서 복사해 붙여넣을 때는 '값만 붙여넣기'(Ctrl + Shift + V)를 사용하세요. 그냥 붙여넣으면 드롭다운과 서식이 지워질 수 있습니다."),
    ("n", "· 1행(머리글)은 고치거나 지우지 마세요. 줄을 통째로 삽입/삭제하거나 열 순서를 바꾸는 것은 괜찮습니다."),
    ("n", "· 셀 병합, 머리글 위에 제목 줄 추가, 그림 삽입은 하지 마세요."),
    ("n", "· 드롭다운 칸은 화살표(▼)를 눌러 고르거나 같은 글자를 직접 입력해도 됩니다. (남/여, 상/중/하, O, 그룹1, 굿/배드)"),
    ("n", "· 필수 칸(반, 번호, 성별)이 비어 있거나 번호가 겹치면 그 칸이 빨간색으로 표시됩니다."),
    ("n", "· 내려받을 때는 꼭 'Microsoft Excel(.xlsx)'을 선택하세요. (PDF, CSV 등은 업로드할 수 없습니다)"),
    ("h", "4. 반 시트 다루기"),
    ("n", f"· 시트는 1반 ~ {CLASS_COUNT}반까지 준비되어 있습니다. 사용하지 않는 반 시트는 그대로 두거나 삭제하면 됩니다. (빈 시트는 읽지 않습니다)"),
    ("n", "· 반이 더 필요하면 반 시트 탭을 오른쪽 클릭 > '복사(사본 만들기)' 후, 시트 이름과 '반' 열의 숫자를 새 반으로 바꿔주세요."),
    ("n", f"· 학생이 {PREFILL_ROWS}명보다 많으면 아래 줄에 이어서 입력하면 됩니다. ('반' 칸이 비어 있으면 시트 이름의 숫자를 사용합니다)"),
    ("n", "· '설명서', '작성예시' 시트는 사이트가 읽지 않으므로 지우지 않아도 됩니다."),
    ("h", "5. 열별 입력 방법"),
    ("table", None),
    ("h", "6. 자주 생기는 문제와 해결"),
    ("qa", ("분반을 했는데 학생이 한 명도 안 보여요 / 업로드가 안 돼요", "대부분 '성별'이 비어 있는 경우입니다. 성별은 꼭 '남' 또는 '여'로 입력하세요. 사이트가 알려주는 시트/행을 고친 뒤 다시 업로드하면 됩니다.")),
    ("qa", ("'성별' 열(머리글)을 찾지 못했다고 나와요", "1행 머리글이 지워졌거나 바뀐 경우입니다. 다른 반 시트의 1행을 복사해 붙여넣으세요.")),
    ("qa", ("'○반 ○번이 겹칩니다'라고 나와요", "같은 반에 같은 번호가 두 번 있거나, 시트를 복사한 뒤 '반' 열 숫자를 바꾸지 않은 경우입니다.")),
    ("qa", ("생년월일이 이상한 숫자(예: 42070)로 보여요", "날짜 서식으로 바뀐 것입니다. 그대로 업로드해도 사이트에서 자동으로 '2015.03.07' 형태로 바로잡습니다.")),
    ("qa", ("드롭다운(▼)이 사라졌어요", "붙여넣기로 덮어쓴 경우입니다. 글자만 정확하면(남/여, 상/중/하, O, 그룹1, 굿/배드) 그대로 업로드해도 됩니다.")),
    ("qa", ("엑셀파일을 열 수 없다고 나와요", "암호가 걸린 파일이거나 .xlsx 형식이 아닌 경우입니다. 암호를 해제하거나 구글 시트에서 'Microsoft Excel(.xlsx)'로 다시 내려받으세요.")),
    ("qa", ("사이트를 새로고침했더니 작업이 사라졌어요", "사이트는 자료를 저장하지 않습니다. 작업 중간에 '3. 엑셀파일 저장'을 눌러두고, 다음에는 저장된 '명렬표' 파일을 '분반 이어하기'에 올리세요. (파일 이름은 바꾸지 마세요)")),
]


def make_guide_sheet(wb):
    ws = wb.active
    ws.title = "설명서"
    ws.sheet_properties.tabColor = "C00000"
    ws.sheet_view.showGridLines = False
    widths = [2, 14, 9, 30, 70]
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    text_width = sum(widths[1:])

    def line(row, text, fnt, fill=None, height=None):
        ws.merge_cells(start_row=row, start_column=2, end_row=row, end_column=5)
        cell = ws.cell(row=row, column=2, value=text)
        cell.font = fnt
        cell.alignment = Alignment(vertical="center", wrap_text=True, indent=0)
        if fill:
            for c in range(2, 6):
                ws.cell(row=row, column=c).fill = fill
        # 한글은 글자 폭이 넓어 2칸으로 계산
        units = sum(2 if ord(ch) > 0x2E80 else 1 for ch in text)
        lines = max(1, -(-units // int(text_width * 1.15)))
        ws.row_dimensions[row].height = height or (20 * lines)

    row = 2
    for kind, body in GUIDE:
        if kind == "title":
            line(row, body, font(bold=True, size=18, color="1F4E78"), height=36)
        elif kind == "p":
            line(row, body, font(size=11))
        elif kind == "h":
            row += 1
            line(row, body, font(bold=True, size=13, color="FFFFFF"), fill=REQUIRED_FILL, height=26)
        elif kind == "n":
            line(row, body, font(size=11))
        elif kind == "warn":
            line(row, body, font(bold=True, size=11, color="C00000"), fill=PatternFill("solid", start_color="FDE9E7"))
        elif kind == "qa":
            q, a = body
            line(row, "Q. " + q, font(bold=True, size=11, color="1F4E78"))
            row += 1
            line(row, "→ " + a, font(size=11))
        elif kind == "table":
            heads = ["열 이름", "필수", "입력하는 값", "설명"]
            for c, h in enumerate(heads, start=2):
                cell = ws.cell(row=row, column=c, value=h)
                cell.font = font(bold=True, color="FFFFFF", size=11)
                cell.fill = OPTIONAL_FILL
                cell.alignment = CENTER
                cell.border = BORDER
            ws.row_dimensions[row].height = 22
            values = {
                "반": "숫자 (예: 3)",
                "번호": "숫자 (예: 12)",
                "이름": "글자",
                "성별": "남 / 여 (드롭다운)",
                "생년월일": "2015.03.07",
                "총점": "숫자 (예: 285)",
                "생활지도": "상 / 중 / 하 (드롭다운)",
                "학부모": "상 / 중 / 하 (드롭다운)",
                "학습부진": "O (드롭다운)",
                "특수반": "O (드롭다운)",
                "다문화": "O (드롭다운)",
                "쌍둥이": "O (드롭다운)",
                "전출": "O (드롭다운)",
                "그룹": f"그룹1 ~ 그룹{GROUP_COUNT} (드롭다운)",
                "협동": "굿 / 배드 (드롭다운)",
                "비고": "자유 입력",
            }
            for title, _w, required, memo in COLUMNS:
                row += 1
                cells = [title, "필수" if required else "선택", values[title], memo.replace("\n", " ")]
                for c, v in enumerate(cells, start=2):
                    cell = ws.cell(row=row, column=c, value=v)
                    cell.font = font(size=11, bold=(c == 2), color="C00000" if (c == 3 and required) else "000000")
                    cell.alignment = LEFT if c >= 4 else CENTER
                    cell.border = BORDER
                units = sum(2 if ord(ch) > 0x2E80 else 1 for ch in cells[3])
                ws.row_dimensions[row].height = 20 * max(1, -(-units // 80))
            row += 1
            line(row, "※ 선택 항목은 해당하는 학생만 입력하고, 나머지는 비워두세요. 선택 항목(생활지도 ~ 비고)은 사이트에서 '비고'와 '협동'으로 합쳐져 보이며 사이트에서도 수정할 수 있습니다.", font(size=11, color="7F6000"))
        row += 1


def main():
    wb = Workbook()
    make_guide_sheet(wb)
    make_example_sheet(wb)
    for n in range(1, CLASS_COUNT + 1):
        make_class_sheet(wb, n)
    wb.active = 0
    OUT.parent.mkdir(exist_ok=True)
    wb.save(OUT)
    print(f"saved: {OUT}")


if __name__ == "__main__":
    main()
