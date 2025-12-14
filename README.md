# 새 학년 학급 편성 프로그램

AI 기반 학급 편성 프로그램입니다. OpenAI API를 활용하여 학생들을 균형있게 배치할 수 있습니다.

## 🤖 AI 기능 사용 제한

배포된 사이트에서는 AI 편성 기능이 **하루 10회로 제한**됩니다.
- 일반 사용자: 하루 10회 제한
- 개발자 모드: 무제한 사용 가능 (개발자 인증 필요)

## 🔐 배포 환경 설정 (GitHub Pages)

### 1. GitHub Secrets 설정

배포 환경에서 AI 기능을 사용하려면 GitHub Secrets에 API 키를 등록해야 합니다.

1. GitHub 저장소 페이지로 이동
2. `Settings` → `Secrets and variables` → `Actions` 클릭
3. `New repository secret` 버튼 클릭
4. 다음 두 개의 Secret을 추가:

**REACT_APP_OPEN_API_KEY**
- Name: `REACT_APP_OPEN_API_KEY`
- Value: OpenAI API 키 (https://platform.openai.com/api-keys 에서 발급)

**REACT_APP_DEVELOPER_KEY**
- Name: `REACT_APP_DEVELOPER_KEY`
- Value: 개발자 인증에 사용할 비밀번호 (원하는 문자열)

### 2. OpenAI API 키 발급 방법

1. https://platform.openai.com 접속
2. 로그인 또는 회원가입
3. API keys 메뉴로 이동
4. `Create new secret key` 클릭
5. 생성된 키를 복사하여 GitHub Secrets에 저장

### 3. 개발자 모드 사용 방법

배포된 사이트에서:
1. "1. AI편성" 버튼 클릭
2. "🔐 개발자 인증" 버튼 클릭
3. GitHub Secrets에 설정한 `REACT_APP_DEVELOPER_KEY` 값 입력
4. 인증 완료 후 무제한으로 AI 편성 사용 가능

## 💻 로컬 개발 환경 설정

### 1. 저장소 클론

```bash
git clone https://github.com/your-username/new_year_class.git
cd new_year_class
```

### 2. 환경 변수 설정

`.env.example` 파일을 복사하여 `.env` 파일 생성:

```bash
cp .env.example .env
```

`.env` 파일을 열어서 API 키 입력:

```env
REACT_APP_OPEN_API_KEY=your-openai-api-key-here
REACT_APP_DEVELOPER_KEY=your-secret-developer-key
```

### 3. 의존성 설치 및 실행

```bash
npm install
npm start
```

## 📌 주의사항

- `.env` 파일은 절대 Git에 커밋하지 마세요 (이미 .gitignore에 추가되어 있음)
- OpenAI API는 유료 서비스입니다. 사용량에 따라 비용이 발생할 수 있습니다.
- GitHub Secrets는 암호화되어 저장되므로 안전합니다.
- 개발자 키는 충분히 복잡하게 설정하세요.

---

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
