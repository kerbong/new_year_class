# 새 학년 학급 편성 프로그램

올해 반별 명단(엑셀)을 올리면 내년 반을 나눠주는 프로그램입니다. 학생 정보는 브라우저 안에서만 처리되고 어디에도 전송·저장되지 않습니다.

## 사용 순서

1. 입력양식(`public/class_template.xlsx`)에 올해 반별 명단을 입력해 업로드합니다.
2. 분반 방식(Z / ㄹ), 성적 우선 / 성비 고려, 내년 학급 수를 정하고 분반합니다.
   현재 반마다 점수 순으로 1등부터 내년 반에 차례로 넣습니다.
3. **1. 자동배분**: 그룹 분리·쌍둥이(같은 반/다른 반을 물어봄) → 특수 학생 → 굿/배드 → 생활지도·학부모·학습부진·다문화·전출 → 인원수(전출 제외, 특수 학생이 있는 반은 1명 적게) → 성비 → 반별 평균 점수 순서로 맞춥니다.
   학생을 옮길 때는 같은 현재반·같은 성별·점수가 가장 비슷한 학생과 맞바꿉니다.
4. 2. 중복이름확인 → 3. 엑셀파일 저장 → 4. 한글 양식 저장

## 로컬 개발

```bash
npm install
npm start
```

입력양식을 다시 만들려면 `python scripts/make_template.py` (openpyxl 필요)

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
