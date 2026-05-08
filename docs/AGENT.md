# Magnetometer Dashboard 개선 작업 정리

## 1. 문서 목적

이 문서는 기존 수정 계획을 현재 구현 상태 기준으로 다시 정리한 작업 기록이다. 완료된 항목과 남은 후속 과제를 구분해, 이후 작업자가 같은 맥락을 빠르게 이어받을 수 있도록 한다.

## 2. 완료된 작업

### 2.1 사용 안내 모달

- 헤더에 `사용 안내` 버튼을 추가했다.
- `usage-guide-dialog` 모달을 추가해 micro:bit 준비, 연결 절차, 자기장 보정 팁, 문제 해결, GitHub 저장소 링크를 안내한다.
- `js/ui/usage-guide.js`를 통해 `<dialog>` 열기/닫기, 백드롭 클릭 닫기, 닫기 후 포커스 복귀를 처리한다.
- `dialog-polyfill`가 있는 환경에서도 동작하도록 방어 로직을 추가했다.

### 2.2 첫 샘플 대기 안내 UI

- 연결 명령 전송 직후 상태를 바로 최종 `연결됨`으로 보지 않고, `waiting-data` 상태로 표시한다.
- 첫 데이터 수신 전에는 연결 패널에 보정 안내 메시지를 표시한다.
- 7초 안에 첫 유효 샘플이 오지 않으면 micro:bit LED 보정 화면을 완료하라는 경고 안내를 표시한다.
- 첫 유효 샘플을 받으면 안내 메시지를 닫고 상태를 `connected`로 전환한다.

### 2.3 오류 메시지 세분화

- Web Bluetooth 오류를 사용자 조치 중심 메시지로 매핑했다.
- 현재 구분하는 대표 오류는 다음과 같다.
  - 장치 선택 취소 또는 미발견
  - Bluetooth 권한 거부
  - HTTPS/localhost가 아닌 보안 컨텍스트 문제
  - GATT 연결 실패
  - UART 서비스 미발견
  - UART characteristic 미발견
- 오류 UI는 줄바꿈이 유지되도록 조정해 원인과 조치를 한 카드 안에 함께 보여 준다.

### 2.4 예기치 않은 연결 해제 후 재연결

- 사용자가 누른 `연결 해제`와 예기치 않은 GATT 해제를 구분한다.
- 예기치 않은 연결 해제 시 micro:bit 재부팅 가능성을 안내하고 3초 뒤 자동으로 한 번 재연결을 시도한다.
- 이전에 선택했던 `BluetoothDevice` 객체를 재사용해 브라우저 장치 선택창을 다시 띄우지 않는 재연결 경로를 추가했다.
- 재사용 장치에도 `gattserverdisconnected` listener가 다시 등록되도록 `js/bluetooth.js`를 보강했다.

### 2.5 상태 저장소 확장

- `state.js`에 `noticeMessage`, `noticeTone`을 추가했다.
- 연결 안내 메시지와 오류 메시지를 분리해, 보정/재연결 안내와 실제 오류를 각각 다르게 표현할 수 있게 했다.
- `setSample` 액션에서 첫 샘플 수신 시 `waiting-data` 상태를 `connected`로 정리한다.

## 3. 변경된 주요 파일

- `index.html`: 연결 패널 안내 영역, 사용 안내 모달
- `styles.css`: 안내 카드, 오류 카드, 사용 안내 모달 스타일
- `js/state.js`: 안내 메시지 상태와 액션
- `js/bluetooth.js`: 재연결 시 disconnect listener 재등록
- `js/ui/connection-panel.js`: 연결 상태 세분화, 첫 샘플 타임아웃, 오류 메시지 매핑, 자동 재연결
- `js/ui/usage-guide.js`: 사용 안내 모달 상호작용

## 4. 검증 상태

완료한 검증:

- `node --check js/state.js`
- `node --check js/bluetooth.js`
- `node --check js/ui/connection-panel.js`
- ESM import 검증

제한 사항:

- Codex 인앱 브라우저가 `localhost` 및 `file://` 접근을 차단해 실제 화면 자동 검증은 수행하지 못했다.
- 실제 micro:bit BLE 연결, 보정 UI, 연결 해제 후 자동 재연결은 사용자가 로컬 Chrome/Edge에서 수동 확인해야 한다.

로컬 테스트 권장 방법:

```powershell
cd C:\antigravity\work\MagnetometerBit
npx http-server . -p 8080
```

브라우저에서 다음 주소로 접속한다.

```text
http://localhost:8080
http://localhost:8080/?mock=1
```

## 5. 남은 후속 과제

### 5.1 실제 장치 검증

- micro:bit v1/v2에서 연결, 보정, 첫 샘플 수신, 수동 해제, 예기치 않은 전원 차단을 반복 테스트한다.
- Android Chrome 또는 삼성 인터넷에서 Bluetooth/위치 권한 흐름을 확인한다.
- 여러 micro:bit가 주변에 있을 때 장치 선택 UX가 충분히 명확한지 확인한다.

### 5.2 스트림 중단 감지

- 현재 구현은 첫 샘플 대기까지만 다룬다.
- 연결 후 데이터가 일정 시간 멈추는 상황을 감지하는 `stream-stale` 상태는 아직 남아 있다.
- 후속 구현 시 마지막 샘플 수신 후 2초/5초/10초 기준으로 경고, 명령 재전송, 재연결 안내를 단계화하는 것이 좋다.

### 5.3 characteristic 선택 로직 개선

- 현재 `js/bluetooth.js`는 characteristic 속성 기반 탐색을 먼저 사용하고 UUID fallback을 수행한다.
- 안정성을 더 높이려면 Nordic UART UUID를 우선 선택하고, 실패 시 속성 기반 탐색으로 fallback하는 구조로 바꾸는 것이 좋다.

### 5.4 파서와 버퍼 방어

- `parseSample()`은 아직 `Number.parseFloat()` 기반이다.
- `12abc` 같은 손상 문자열이 숫자로 해석될 여지가 있다.
- 후속 작업에서는 전체 문자열 숫자 검증, `rxBuffer` 최대 길이, 연속 파싱 실패 경고를 추가한다.

### 5.5 펌웨어 프로토콜 개선

- 이번 작업 범위에서는 펌웨어를 수정하지 않았다.
- 장기적으로는 펌웨어가 `HELLO`, `ACK`, `STATUS`, `ERR` 같은 control message를 보내도록 개선하면 웹앱이 보정 중/측정 중/명령 오류를 더 정확히 구분할 수 있다.

## 6. 현재 결론

웹앱만 수정하는 범위에서는 첫 샘플 대기 안내, 오류 메시지 세분화, 예기치 않은 해제 후 자동 재연결까지 반영했다. 남은 안정성 개선의 핵심은 실제 micro:bit 반복 테스트와, 연결 후 스트림 중단을 감지하는 watchdog 구현이다.
