# Magnetometer Dashboard 온보딩 안내 구현 계획

## 목표와 범위
- 웹앱 첫 방문자도 README의 핵심 사용법을 바로 이해할 수 있도록 상단 헤더에 `사용 안내` 버튼을 추가한다.
- 버튼을 누르면 `<dialog>` + `dialog-polyfill` 기반의 모달이 열리고, README 내용을 웹앱 맥락에 맞게 축약·수정한 안내를 보여준다.
- 안내서는 다음 항목만 다룬다: micro:bit 준비, 웹앱 연결 절차, 자기장 보정/측정 TIP, 문제 해결 요약, GitHub 저장소 링크.
- README 대비 차이점은 펌웨어 다운로드 링크 직접 제공, 웹앱 링크 설명 제외, 개발자 섹션 대신 저장소 링크 제시.

## 구현 단계
1. **안내 콘텐츠 정리**
   - README에서 사용자에게 필요한 단계만 추려 한글 가이드 문안을 작성한다.
   - `firmware/magnetometer.hex`를 가리키는 절대 경로(예: `/firmware/magnetometer.hex`) 또는 GitHub Pages 정적 경로를 확인해 다운로드 링크를 준비한다.
   - 모달에 들어갈 섹션 순서를 확정한다.
2. **UI 마크업 수정**
   - `index.html` 헤더의 `Magnetometer Dashboard` 타이틀 옆에 `button` 요소를 추가하고, 접근성을 위해 `aria-label`/`title`을 지정한다.
   - 타이틀과 버튼을 묶는 래퍼(`header-controls` 등)를 만들어 레이아웃이 깨지지 않도록 한다.
3. **모달 다이얼로그 추가**
   - `index.html` 하단에 `id="usage-guide-dialog"`를 갖는 `<dialog>` 블록을 추가하고, 정리된 문안을 섹션/목록 형태로 배치한다.
   - 기존 `supported-browsers-dialog`와 동일한 패턴으로 `form` + `method="dialog"` 버튼을 사용해 닫기 기능을 제공한다.
4. **상호작용 로직 연결**
   - `js/app.js` 또는 별도 UI 초기화 스크립트에서 새 버튼과 다이얼로그 요소를 찾고, `showModal()`/`close()` 이벤트를 연결한다.
   - 이미 존재하는 `dialog-polyfill`가 DOMContentLoaded 시 `dialog` 요소를 등록하므로, 필요 시 명시적으로 `registerDialog`를 호출하는 방어 로직을 추가한다.
   - 닫기 시 포커스를 버튼으로 돌려 접근성을 확보한다.
5. **스타일 및 QA**
   - 필요하다면 `styles.css`에 모달 안의 헤딩, 리스트, 스크롤 처리를 위한 최소 스타일을 추가한다.
   - 데스크톱/모바일 뷰에서 버튼 위치와 모달 스크롤을 확인하고, 외부 의존성 없이 안내가 잘 노출되는지 수동 테스트한다.

## 모달 안내 문안 초안
- **micro:bit 준비**: `펌웨어 다운로드` 버튼(또는 링크) → 파일 저장 후 micro:bit 드라이브에 복사.
- **연결하기**: 웹앱에서 `디바이스 연결` → 브라우저 장치 목록에서 `BBC micro:bit` 선택 → 권한 허용.
- **보정/사용 TIP**: 연결 직후 보정 절차, 버튼으로 보정 건너뛰기 가능하나 최초 연결 땐 권장하지 않음.
- **문제 해결**: 디바이스 표시 안 됨/오류 발생/데이터 이상 시 빠른 해결법 1~2줄 요약.
- **추가 자료**: GitHub 저장소 주소(`https://github.com/Cho-WH/MagnetometerBit`) 하이퍼링크.

## 검증 체크리스트
- 새 버튼이 키보드 탭 순서에 포함되고 `Enter`/`Space`로 동작하는지 확인.
- 모달 내 링크/버튼이 포커스를 잡고, `Escape` 키로 닫힐 때 포커스가 헤더 버튼으로 되돌아오는지 확인.
- `dialog-polyfill`가 비지원 브라우저에서 정상 작동하는지 수동 테스트(가능하면 chrome devtools device mode 등) 후 README와 내용 일관성 재검토.

## 구체적 코드 구현 계획
1. **헤더 구조 보강 (`index.html`)**
   - 기존 `<header class="header">` 안의 `h1.title`과 `span.badge` 사이에 `<div class="header-leading">` 래퍼를 추가하고, 그 안에 `h1`과 새 버튼을 배치한다. 레이아웃 예시는 아래와 같다.
     ```html
     <header class="header">
       <div class="header-leading">
         <h1 class="title">Magnetometer Dashboard</h1>
         <button type="button" class="usage-guide-button" data-action="open-usage-guide" aria-haspopup="dialog" aria-controls="usage-guide-dialog" title="사용 안내">사용 안내</button>
       </div>
       <span class="badge">Vanilla build</span>
     </header>
     ```
   - `usage-guide-button`은 헤더 영역에 맞춘 별도의 스타일을 적용하고, `data-action="open-usage-guide"`로 스크립트에서 식별한다.
2. **사용 안내 다이얼로그 마크업 추가 (`index.html`)**
   - 기존 `supported-browsers-dialog` 바로 뒤에 `<dialog id="usage-guide-dialog" class="usage-dialog">`를 추가한다.
   - 내부는 `<form method="dialog" class="usage-dialog__content">`로 감싸고, 각 가이드 섹션을 `<section class="usage-dialog__section">`과 `<h3>`/`<ul>` 조합으로 구성한다.
   - 펌웨어 링크는 다음 두 가지를 모두 제공한다: `<a href="firmware/magnetometer.hex" download>` (로컬 호스팅 대응)와 `<a href="https://cho-wh.github.io/MagnetometerBit/firmware/magnetometer.hex" target="_blank" rel="noopener">` (GitHub Pages 대응). 같은 리스트 항목 안에 두 링크를 나란히 배치한다.
   - 닫기 버튼은 기존 패턴과 동일하게 `<button type="submit" class="button small">닫기</button>`을 사용한다.
3. **스타일 확장 (`styles.css`)**
   - `.header` 규칙은 그대로 두고, `.header-leading`(flex 정렬, `gap: 0.75rem`)과 `.usage-guide-button`(헤더 배경색과 배지 톤에 맞춘 `padding: 0.35rem 0.75rem`, `border-radius: 9999px`, `font-size: 0.85rem`, `background: rgba(148,163,184,0.12)`)을 신규 정의한다. `:hover`와 `:focus-visible` 상태에서 대비가 확보되도록 `border`/`outline`을 지정한다.
   - 기존 `.supported-dialog` 스타일을 재사용하기 위해 `.supported-dialog, .usage-dialog` 같이 다중 선택자로 확장한다(디스플레이, 배경, 크기 등 공통 속성). 필요 시 `.usage-dialog__content`와 `.usage-dialog__section`에만 적용되는 여백·스크롤(`max-height: 75vh; overflow-y: auto`)을 추가한다.
   - 다운로드 링크와 외부 링크를 구분하기 위해 `.usage-dialog__links` 등 보조 클래스를 정의해 `display: flex; gap: 0.5rem; flex-wrap: wrap;` 형태로 정리한다.
4. **상호작용 모듈 작성 (`js/ui/usage-guide.js`)**
   - 새 파일을 만들고 `export const initUsageGuide = () => { ... }` 형태로 구현한다.
   - 내부에서 `document.querySelector('[data-action="open-usage-guide"]')`와 `document.getElementById('usage-guide-dialog')`를 찾는다. 두 요소 중 하나라도 없으면 `undefined`를 반환한다.
   - 다이얼로그가 존재하면 `window.dialogPolyfill?.registerDialog(dialogEl)`을 호출한다.
   - 이벤트 핸들러는 다음을 수행한다: 버튼 `click` → `dialog.showModal()`; 다이얼로그 `click` → `event.target === dialog`일 때 `close()`(백드롭 닫기); 다이얼로그 `close` → `openButton.focus()`로 포커스 복귀.
   - 모듈은 추가한 이벤트 리스너를 해제하는 클린업 함수를 반환해 `app.js`에서 기존 패턴대로 관리할 수 있게 한다.
5. **부트스트랩 연결 (`js/app.js`)**
   - 파일 상단에 `import { initUsageGuide } from './ui/usage-guide.js'`를 추가한다.
   - `boot()` 내부에서 다른 UI 초기화와 동일한 패턴으로 `registerCleanup(initUsageGuide())`를 호출한다. 반환값이 `undefined`일 수 있으므로 `registerCleanup` 함수가 이미 처리하듯 방어적으로 사용한다.
6. **QA 및 호환성 확인**
   - 키보드 탭 순서, `Esc` 키 닫기, 포커스 복귀를 실제 브라우저에서 확인한다.
   - `?mock=1` 옵션을 켠 상태에서도 다이얼로그 동작이 동일한지 확인한다.
   - 필요 시 `npm run lint`(또는 제공된 정적 검사)가 존재하면 실행해 HTML/JS 포맷 오류를 점검한다.

## 한글 가이드 내용
> 이 프로젝트는 자바실험실 (https://javalab.org) 에서 영감을 받았습니다. 
micro:bit에서 보내는 자기장 값을 실시간으로 보여주는 웹 대시보드입니다. Web Bluetooth을 지원하는 모든 브라우저(크롬, 엣지, 안드로이드 크롬, 삼성브라우저 등)에서 동작합니다.

### micro:bit 준비
- 아래 `펌웨어 다운로드` 링크를 눌러 `magnetometer.hex` 파일을 저장합니다.
- micro:bit를 USB로 연결하고 다운로드한 HEX 파일을 micro:bit 드라이브에 복사한 뒤 안전하게 분리하세요.

### 웹앱에서 연결하기
- 상단 `디바이스 연결` 버튼을 누르면 브라우저가 BLE 장치 목록을 표시합니다.
- 목록에서 `BBC micro:bit`를 선택하고, Bluetooth·위치 권한 요청이 뜨면 모두 허용하세요.

### 자기장 보정 & 활용 팁
- 연결 직후 micro:bit LED에 점이 회전하면 미세하게 흔들며 모든 방향으로 돌려 LED가 가득 찰 때까지 움직입니다.
- A/B 버튼을 누른 채로 연결하면 보정을 건너뛸 수 있으나, 첫 연결 시에는 보정을 완료하는 것이 좋습니다.
- 측정 중에는 화면 하단 `CSV 다운로드` 버튼으로 현재 세션 데이터를 저장할 수 있습니다.

### 문제가 생길 때
- **브라우저 미지원**: 좌측의 '지원 브라우저' 안내를 참고하세요.
- **장치가 목록에 없음**: micro:bit 전원이 켜져 있고 다른 기기에 연결돼 있지 않은지 확인한 뒤 다시 검색하세요.
- **연결 직후 오류**: 펌웨어를 다시 플래시하고 micro:bit가 재부팅될 시간을 준 뒤 재시도하세요.
- **데이터가 이상함**: 주변 자성 물체를 멀리하고, 보정 과정을 다시 진행해 값을 초기화합니다.

### 추가 자료
- GitHub 저장소: https://github.com/Cho-WH/MagnetometerBit
- 펌웨어 직접 다운로드: https://cho-wh.github.io/MagnetometerBit/firmware/magnetometer.hex
