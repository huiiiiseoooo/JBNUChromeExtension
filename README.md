# 전북대 공지 키워드 알림 (Chrome 확장)

> 전북대학교의 공식 서비스가 아닌, 개인이 만든 비공식 오픈소스 프로젝트입니다.

새 탭을 열면 전북대·학과 공지사항 중 **내 키워드가 들어간 글**, **오늘의 학식**, **전북대 주요 뉴스**를 보여주는 크롬 확장입니다.

- 처음 새 탭을 열면 **내 학과를 선택**합니다 (106개 학과, 복수전공이면 여러 개). 학과 공지도 키워드 검색 대상이 됩니다.
- 키워드는 설정한 기간(2주/1개월/3개월, 기본 1개월) 안의 공지에서 찾습니다. 처음에 게시판의 지난 페이지를 읽어 기간을 채우고, 이후에는 새 글만 확인합니다.
- 30분마다(설정 가능) 백그라운드에서 게시판을 확인하고, 키워드에 걸린 새 글 수를 확장 아이콘 배지에 표시합니다.
- 기본 게시판: 전북대 교내공지·학생공지, JBNU News + 선택한 학과 공지 (설정에서 켜고 끌 수 있음)
- 오늘의 식단: 진수원·의대식당·후생관 (설정에서 식당 선택)
- 검색창: 구글 추천검색어 자동완성 (입력한 글자가 suggestqueries.google.com 으로 전송됨), 검색은 크롬 기본 검색엔진으로
- 바로가기: 최대 10개, 마지막 + 칸에서 이름·주소만 넣어 추가, 마우스를 올리면 × 로 삭제
- 학과 목록에서 자동 연결이 안 되는 학과는 설정에서 게시판 주소(`…/bbs/…/artclList.do`)를 붙여넣어 추가할 수 있습니다.

## 개발

```bash
npm install
npm run dev      # 파일 변경 시 dist/ 자동 빌드
npm run build    # 타입체크 + 배포용 빌드
npm test         # 파서 테스트 (tests/fixtures 의 실제 HTML 사용)
npm run zip      # 웹스토어 업로드용 zip 생성
```

크롬에서 `chrome://extensions` → 개발자 모드 켜기 → **압축해제된 확장 프로그램 로드** → `dist` 폴더 선택.
코드를 고친 뒤에는 확장 카드의 새로고침 버튼을 누르세요. 깜빡해도 새 탭 상단에 "업데이트 적용" 배너가 뜹니다
(새 탭 화면은 디스크의 새 파일을 쓰지만 백그라운드는 새로고침 전까지 옛 코드로 돌기 때문에, 빌드 ID 를 비교해서 알려줌).

## 구조

```
src/
├─ core/            타입, 저장소(chrome.storage), 키워드 매칭, 여러 페이지 수집 규칙(collect.ts)
├─ adapters/        게시판 HTML → 게시글 목록 변환 (사이트 CMS 형식별)
│   ├─ jbnuMain.ts    전북대 본부 홈페이지 (공지 표 / 뉴스 카드)
│   └─ k2web.ts       학과 홈페이지 공통 CMS (…/artclList.do)
├─ sources/
│   ├─ catalog.ts       전북대 공통 게시판 목록 (데이터)
│   └─ departments.json 학과 목록 + 학과 공지 주소 (scripts/build-departments.ts 로 생성)
├─ features/meal/   학식 (식단 페이지 요청 + 파싱)
├─ background/      주기적 수집, 배지, 메시지 처리 (서비스워커)
├─ offscreen/       HTML 파싱 전용 문서 (서비스워커엔 DOMParser 가 없음)
├─ newtab/          새 탭 대시보드 + 위젯
└─ options/         설정 화면
```

데이터 흐름: `background`가 게시판 HTML을 받아옴 → `offscreen`에서 어댑터로 파싱 → `chrome.storage.local`에 저장 → `newtab`이 저장소 변경을 구독해서 다시 그림.

## 확장하는 방법

| 하고 싶은 것 | 할 일 |
|---|---|
| 학과 목록 갱신 (학과 개편, 홈페이지 변경) | `npx tsx scripts/build-departments.ts` 실행 → `departments.json` 변경 확인 |
| 전북대 공통 게시판 추가 | `src/sources/catalog.ts`에 항목 1개 추가 |
| 새로운 형식의 사이트 지원 | `src/adapters/`에 `Adapter` 구현 → `adapters/index.ts`에 등록 → `tests/`에 fixture 테스트 추가 |
| 새 탭에 새 기능(학사일정, 식단 등) | `src/newtab/widgets/`에 `Widget` 구현 → `widgets/index.ts`에 등록 |
| 설정 항목 추가 | `core/types.ts`의 `Settings`와 `core/storage.ts`의 `DEFAULT_SETTINGS`에 추가 (구조가 바뀌면 `migrateSettings` 갱신) |

사이트 구조가 바뀌어 파싱이 깨지면, 새 탭 하단에 "n개 게시판 불러오기 실패"가 표시됩니다. 해당 페이지 HTML을 `tests/fixtures/`에 다시 저장하고 테스트를 고치면 됩니다.

## 학식 데이터에 대해

전북대 식단 페이지는 페이지가 발급한 CSRF 토큰과 세션 쿠키로 `POST /web/unvrslife/campuslife/cafeteria/dataAjax.do`를 호출해 식단을 불러옵니다.
확장도 브라우저와 같은 순서로 요청합니다: 식단 페이지를 받고 → 토큰을 읽고 → 식단을 요청 (`src/features/meal/fetch.ts`).
로그인 없이 누구나 볼 수 있는 공개 식단입니다. 하루에 몇 번만 요청합니다 (날짜가 바뀌거나 3시간이 지났을 때).

## 배포 (크롬 웹스토어)

- 제출 자료는 `store/LISTING.md` 에 정리돼 있습니다 (설명 문구, 권한별 사용 이유, 개인정보 항목 답변).
- 업로드 파일: `npm run zip` → `jbnu-keyword-notifier.zip`
- 그래픽: `store/screenshot-1~3.png` (1280×800), `store/promo-small.png` (440×280), 아이콘 `public/icons/icon128.png`
- 개인정보처리방침: `docs/` 폴더를 GitHub Pages(main 브랜치 `/docs`)로 공개 → https://huiiiiseoooo.github.io/JBNUChromeExtension/privacy.html

## 기여

버그 제보와 제안은 [Issues](https://github.com/huiiiiseoooo/JBNUChromeExtension/issues)에 남겨주세요. Pull Request도 환영합니다.
게시판 파싱을 고칠 때는 `tests/fixtures/`에 실제 페이지 HTML을 넣고 `npm test`가 통과하는지 확인해주세요.

## 라이선스

[MIT](LICENSE)
