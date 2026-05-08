# micro:bit 연결 오류 시나리오 및 안정성 개선안

## 1. 검토 범위

이 문서는 `firmware/magnetometer.hex`가 `firmware/v1.1-mg.js` 기반으로 빌드되어 micro:bit에 올라간 상태를 전제로, 해당 micro:bit와 웹앱이 Web Bluetooth로 연결될 때 발생할 수 있는 오류 시나리오와 개선 방향을 정리한다.

검토 대상은 다음 파일이다.

- `firmware/v1.1-mg.js`: micro:bit BLE UART 펌웨어 로직
- `js/bluetooth.js`: Web Bluetooth 연결, UART characteristic 탐색, 알림 수신
- `js/ui/connection-panel.js`: 연결 버튼, 상태 표시, 명령 전송 흐름
- `js/utils/parseSample.js`: 수신 데이터 파싱
- `README.md`, `docs/project-overview.md`: 사용자 안내와 프로젝트 구조 설명

## 2. 현재 연결 흐름 요약

### 2.1 웹앱 흐름

1. 사용자가 `디바이스 연결` 버튼을 누른다.
2. `navigator.bluetooth.requestDevice()`가 `BBC micro:bit`, `micro:bit`, `BBC microbit` 이름 prefix로 장치를 요청한다.
3. 선택된 장치의 GATT 서버에 연결한다.
4. Nordic UART Service UUID `6e400001-b5a3-f393-e0a9-e50e24dcca9e`를 찾는다.
5. 서비스의 characteristic을 열거한 뒤 쓰기 가능 characteristic과 notify 가능 characteristic을 선택한다.
6. notify를 시작하고 수신 핸들러를 등록한다.
7. `magnet\n` 명령을 UART write characteristic으로 전송한다.
8. 명령 전송이 성공하면 웹앱 상태를 `connected`로 바꾼다.

### 2.2 펌웨어 흐름

1. `bluetooth.startUartService()`로 Nordic UART 서비스를 시작한다.
2. 연결 전에는 micro:bit LED에 장치 이름 앞 5글자와 `mg`를 반복 표시한다.
3. BLE 연결 이벤트가 오면 `연결됨 = 1`로 바꾸고 체크 아이콘을 표시한다.
4. UART로 줄 단위 데이터를 수신한다.
5. 수신 문자열이 정확히 `magnet`이면 자기장 모드로 전환한다.
6. 아직 보정하지 않았다면 A 또는 B 버튼이 눌린 경우 보정을 건너뛰고, 그렇지 않으면 `input.calibrateCompass()`를 실행한다.
7. 자기장 모드에서는 100ms마다 `x,y,z,strength` 형식의 CSV 한 줄을 `bluetooth.uartWriteLine()`으로 전송한다.
8. BLE 연결이 끊기면 `control.reset()`으로 micro:bit를 재부팅한다.

## 3. 주요 오류 시나리오

### 3.1 Web Bluetooth 사용 환경 오류

**상황**

- 브라우저가 Web Bluetooth를 지원하지 않는다.
- 페이지가 `https://` 또는 `http://localhost`가 아닌 주소에서 열렸다.
- iOS Safari 계열 브라우저처럼 Web Bluetooth가 막혀 있다.
- Android에서 Bluetooth 또는 위치 권한이 꺼져 있다.

**현재 영향**

웹앱은 `navigator.bluetooth` 존재 여부만 확인한다. 지원하지 않는 환경에서는 연결 버튼이 비활성화되고 안내 문구가 나오지만, 보안 컨텍스트 문제나 권한 문제는 사용자가 연결을 시도한 뒤 브라우저 예외 메시지에 의존하게 된다.

**개선안**

- `window.isSecureContext`를 별도로 검사해 `https://` 또는 `localhost` 접속 필요 메시지를 명확히 표시한다.
- `NotFoundError`, `NotAllowedError`, `SecurityError`, `NetworkError` 같은 Web Bluetooth 예외 이름별로 사용자 메시지를 분리한다.
- Android에서는 Bluetooth/위치 권한 확인 안내를 오류 메시지에 포함한다.

### 3.2 잘못된 micro:bit 또는 잘못된 펌웨어 선택

**상황**

- 사용자가 동일한 이름의 다른 micro:bit를 선택한다.
- stock 펌웨어 또는 다른 프로젝트 펌웨어가 올라간 micro:bit를 선택한다.
- 장치 이름은 맞지만 Nordic UART Service가 광고되지 않거나 GATT에서 찾을 수 없다.

**현재 영향**

`requestDevice()`는 이름 prefix로만 필터링하고 UART 서비스는 `optionalServices`로만 요청한다. 따라서 UART 서비스를 제공하지 않는 micro:bit도 선택될 수 있고, 이후 `getPrimaryService()`에서 실패한다.

**개선안**

- 가능한 브라우저/펌웨어 조합에서는 device filter에 UART service UUID를 포함해 잘못된 장치 선택 가능성을 줄인다.
- UART service filter가 micro:bit 광고 방식과 충돌할 수 있으므로, 우선은 현재 name prefix 방식을 유지하되 `getPrimaryService()` 실패 시 "펌웨어가 맞는지 확인" 메시지를 구체화한다.
- 장기적으로 펌웨어가 연결 직후 `HELLO,mg,1.1` 같은 버전/프로토콜 식별 메시지를 보내도록 하고, 웹앱은 첫 control message를 확인한 뒤에만 연결 완료로 표시한다.

### 3.3 플래시 직후 또는 재부팅 직후 연결 시도

**상황**

- `magnetometer.hex`를 복사한 직후 micro:bit가 아직 재부팅 중이다.
- 이전 연결 해제 후 펌웨어가 `control.reset()`으로 재시작하는 동안 다시 연결을 시도한다.
- OS나 브라우저가 이전 GATT 정보를 캐시한 상태에서 새 펌웨어로 바뀐 장치에 접근한다.

**현재 영향**

웹앱은 연결 실패를 일반 오류로 보여 준다. 사용자는 micro:bit가 준비 중인지, 펌웨어가 잘못됐는지, Bluetooth 캐시 문제인지 구분하기 어렵다.

**개선안**

- 연결 실패 후 2~3초 동안 "micro:bit 재부팅 중일 수 있음" 안내를 표시한다.
- `gattserverdisconnected` 직후에는 즉시 재연결을 유도하지 말고 짧은 대기 메시지를 표시한다.
- 문서와 사용 안내에 "펌웨어 플래시 후 LED 표시가 다시 시작된 뒤 연결"을 명시한다.

### 3.4 명령 전송 성공 후 첫 데이터가 오지 않는 상태

**상황**

- 웹앱은 `magnet\n` 쓰기 성공 직후 상태를 `connected`로 바꾼다.
- 펌웨어는 `magnet` 명령을 받은 뒤 보정을 수행할 수 있고, 보정이 끝날 때까지 데이터가 오지 않는다.
- 사용자가 보정 절차를 완료하지 않거나, micro:bit가 명령을 받지 못했거나, 펌웨어가 다른 모드에 있으면 첫 샘플이 오지 않는다.

**현재 영향**

연결 상태는 `연결됨`이지만 카드/차트/로그는 계속 비어 있을 수 있다. 웹앱에는 "연결은 됐지만 데이터 대기 중" 상태가 없고, 첫 샘플 수신 타임아웃도 없다.

**개선안**

- 연결 상태를 `connecting`, `connected`, `waiting-data`, `streaming`처럼 세분화한다.
- `sendMagnetCommand()` 후 5~10초 안에 첫 유효 샘플이 없으면 "보정 중이거나 명령을 받지 못했습니다" 메시지를 표시한다.
- 첫 샘플이 오기 전에는 UI에 "micro:bit LED 보정 화면을 완료하세요" 안내를 표시한다.
- timeout이 발생하면 `magnet\n` 명령을 1~2회 재전송하되, 무한 재시도는 피한다.

### 3.5 펌웨어의 명령 문자열이 너무 엄격함

**상황**

- 펌웨어는 UART 입력이 정확히 `magnet`일 때만 측정을 시작한다.
- 현재 웹앱은 `magnet\n`을 보내므로 정상 동작해야 하지만, 향후 다른 클라이언트가 `magnet\r\n`, `MAGNET`, `inMagnet` 등을 보내면 실패한다.
- 이전 펌웨어 `v-mg.js`는 `inMagnet`도 허용했지만 `v1.1-mg.js`는 `magnet`만 허용한다.

**현재 영향**

웹앱 단독 사용에서는 문제가 작지만, 펌웨어와 웹앱 버전이 엇갈리거나 외부 도구로 테스트할 때 측정 모드 진입 실패가 조용히 발생할 수 있다.

**개선안**

- 펌웨어에서 입력 문자열을 trim/lowercase 처리한다.
- `magnet`, `inmagnet`, `start` 같은 호환 명령을 명시적으로 허용한다.
- 알 수 없는 명령을 받으면 `ERR,unknown-command` 같은 control message를 전송한다.

### 3.6 characteristic 자동 선택의 모호성

**상황**

- `js/bluetooth.js`는 service 안의 characteristic을 모두 열거한 뒤 write 속성이 있는 첫 항목을 TX, notify 속성이 있는 첫 항목을 RX로 선택한다.
- Nordic UART는 일반적으로 characteristic이 두 개뿐이지만, 펌웨어나 런타임이 확장되면 속성만으로 고르는 방식이 모호해질 수 있다.

**현재 영향**

현재 펌웨어에서는 동작 가능성이 높다. 다만 잘못된 characteristic을 선택하면 쓰기 성공/알림 실패 또는 알림 성공/명령 실패 같은 혼란스러운 상태가 생길 수 있다.

**개선안**

- UUID 기준 선택을 1순위로 하고, 속성 기반 탐색은 fallback으로 낮춘다.
- 선택된 service/characteristic UUID를 개발자 콘솔에 구조화해 출력한다.
- 연결 오류 메시지에 "UART characteristic 탐색 실패"와 "쓰기 characteristic 없음", "알림 characteristic 없음"을 분리해 표시한다.

### 3.7 데이터 스트림 중단 감지 부재

**상황**

- BLE 연결은 유지되지만 notify 데이터가 더 이상 오지 않는다.
- micro:bit가 보정 화면, 내부 오류, 전원 부족, BLE 스택 문제로 송신을 멈춘다.
- 브라우저 탭이 백그라운드로 가면서 이벤트 처리가 지연된다.

**현재 영향**

마지막 업데이트 시간은 표시되지만, 일정 시간 이상 데이터가 멈춰도 별도 경고나 복구 절차가 없다.

**개선안**

- 마지막 샘플 수신 후 2초 이상 새 샘플이 없으면 `stream-stale` 상태를 표시한다.
- 5초 이상 샘플이 없으면 `magnet\n` 명령 재전송 버튼 또는 자동 1회 재전송을 제공한다.
- 10초 이상 샘플이 없으면 연결 해제 후 다시 연결하도록 안내한다.

### 3.8 수신 데이터 파싱의 허용 범위가 넓음

**상황**

- `parseSample()`은 쉼표 4개 필드와 `Number.parseFloat()` 결과가 유한한지만 확인한다.
- `Number.parseFloat("12abc")`는 `12`로 해석되므로, 일부 손상된 데이터가 정상 샘플로 들어올 수 있다.
- 줄바꿈이 오지 않는 손상 패킷이 계속 누적되면 `rxBuffer`가 커질 수 있다.

**현재 영향**

일반적인 `x,y,z,strength` 데이터는 잘 처리된다. 그러나 노이즈가 섞이거나 향후 control message가 추가될 때 파서가 의도하지 않은 값을 받아들일 수 있다.

**개선안**

- `Number.parseFloat()` 대신 전체 문자열이 숫자인지 확인하는 정규식 또는 `Number()` 기반 검증을 사용한다.
- 자기장 값의 합리적 범위를 정해 비정상적으로 큰 값을 버리거나 경고한다.
- `rxBuffer` 최대 길이를 정하고, 일정 길이를 넘으면 버퍼를 비우고 경고 로그를 남긴다.
- control message와 sample message를 분리하는 파서 계층을 둔다.

### 3.9 연결 해제와 재연결 UX

**상황**

- 펌웨어는 연결 해제 시 즉시 `control.reset()`을 호출한다.
- 웹앱은 `gattserverdisconnected`를 받으면 상태를 초기화하고 "디바이스 연결이 종료되었습니다"를 표시한다.
- 사용자가 수동으로 연결 해제한 경우와 예기치 않은 끊김은 `manualDisconnect` 플래그로 어느 정도 구분한다.

**현재 영향**

수동 해제 흐름은 비교적 명확하다. 다만 예기치 않은 연결 해제 후 micro:bit가 재부팅 중인 동안 사용자가 바로 다시 연결하면 실패할 수 있다.

**개선안**

- 예기치 않은 연결 해제 후 3초 정도 재연결 대기 안내를 표시한다.
- 연결 해제 사유를 "사용자 해제", "장치 전원/거리 문제", "GATT 연결 종료"처럼 분류해 UI 메시지를 다르게 보여 준다.
- 가능하면 `navigator.bluetooth.getDevices()`를 활용해 이전에 허용한 장치에 대한 재연결 버튼을 제공한다. 단, 브라우저 지원 여부가 제한적이므로 fallback이 필요하다.

## 4. 권장 개선 우선순위

아래 상태는 2026-05-09 기준 웹앱 수정 반영 상황이다. 펌웨어는 수정하지 않았다.

### 우선순위 1: 첫 데이터 수신 확인과 상태 세분화

**상태: 부분 완료**

가장 먼저 개선해야 할 부분은 `magnet\n` 명령 전송 성공을 최종 연결 성공으로 보지 않는 것이다.

권장 흐름은 다음과 같다.

1. GATT 연결 성공: `connecting`
2. notification 시작 성공: 현재 별도 상태 없이 내부 처리
3. `magnet\n` 명령 전송 성공: `waiting-data`로 표시
4. 첫 유효 샘플 수신: 현재 `connected`로 표시
5. 일정 시간 샘플 없음: 후속 과제(`stream-stale`)

이 변경만으로 "연결됨인데 데이터가 없음" 문제를 사용자가 이해할 수 있고, 보정 중인지 실제 오류인지 구분할 여지가 생긴다.

### 우선순위 2: 펌웨어-웹앱 간 간단한 handshake 추가

**상태: 후속 과제**

현재 프로토콜은 sample line만 존재한다. 안정성을 높이려면 펌웨어가 상태 메시지를 보내고 웹앱이 이를 해석해야 한다.

권장 control message 예시는 다음과 같다.

```text
HELLO,mg,1.1
ACK,magnet
STATUS,calibrating
STATUS,streaming
ERR,unknown-command
```

sample message는 기존 호환성을 위해 다음 형식을 유지한다.

```text
x,y,z,strength
```

웹앱은 4필드 숫자 CSV는 샘플로 처리하고, 그 외 `HELLO`, `ACK`, `STATUS`, `ERR` prefix는 control message로 처리한다.

### 우선순위 3: 오류 메시지 세분화

**상태: 완료**

현재 오류는 대부분 예외의 `message`를 그대로 보여 준다. 사용자에게 필요한 조치는 예외 종류별로 다르므로 메시지를 매핑하는 계층이 필요하다.

예시:

- `NotFoundError`: 장치 선택이 취소되었거나 주변에서 장치를 찾지 못함
- `NotAllowedError`: Bluetooth 권한이 거부됨
- `SecurityError`: HTTPS 또는 localhost가 아닌 환경
- `NetworkError`: GATT 연결 실패, 장치가 꺼졌거나 다른 기기에 연결됨
- `getPrimaryService` 실패: 펌웨어가 다르거나 아직 재부팅 중일 가능성

### 우선순위 4: characteristic 선택 로직 보강

**상태: 후속 과제**

UUID 기반 선택을 우선하고 속성 기반 탐색을 fallback으로 사용한다.

권장 순서:

1. `6e400002-b5a3-f393-e0a9-e50e24dcca9e`를 write characteristic으로 선택
2. `6e400003-b5a3-f393-e0a9-e50e24dcca9e`를 notify characteristic으로 선택
3. UUID 탐색 실패 시 현재처럼 properties 기반 탐색
4. 최종 선택 결과를 debug log로 기록

### 우선순위 5: 파서와 버퍼 방어 로직 추가

**상태: 후속 과제**

수신 데이터가 항상 정상이라는 가정을 줄인다.

- 숫자 필드는 전체 문자열이 숫자일 때만 허용한다.
- `rxBuffer` 최대 길이를 둔다.
- control message와 sample message를 분리한다.
- 파싱 실패 횟수가 연속으로 증가하면 UI에 "알 수 없는 데이터 수신" 경고를 표시한다.

## 5. 펌웨어 개선 제안

### 5.1 명령 처리 완화

현재:

```javascript
if (inputs == "magnet") {
```

개선 방향:

- 입력 문자열 앞뒤 공백을 제거한다.
- 대소문자를 통일한다.
- 기존 호환 명령을 함께 허용한다.

MakeCode JavaScript 환경에서 지원 가능한 문자열 API 범위를 확인해야 하지만, 의도는 다음과 같다.

```javascript
inputs = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))
let command = inputs.trim().toLowerCase()
if (command == "magnet" || command == "inmagnet" || command == "start") {
    bluetooth.uartWriteLine("ACK,magnet")
    ...
} else {
    bluetooth.uartWriteLine("ERR,unknown-command")
}
```

### 5.2 상태 메시지 전송

보정과 측정 시작을 웹앱이 구분할 수 있도록 다음 메시지를 추가한다.

- BLE 연결 직후: `HELLO,mg,1.1`
- 보정 시작 전: `STATUS,calibrating`
- 보정 생략 시: `STATUS,calibration-skipped`
- 측정 시작 직전: `STATUS,streaming`

### 5.3 연결 해제 재부팅 정책 검토

`control.reset()`은 상태 초기화에는 확실하지만, 재연결 직후 실패 가능성을 만든다. 현재 프로젝트처럼 단일 용도 펌웨어라면 유지해도 된다. 다만 웹앱은 재부팅 시간을 고려해 재연결 안내를 늦춰야 한다.

대안은 연결 해제 시 reset 대신 다음 동작을 수행하는 것이다.

- `modes = "none"`
- `연결됨 = 0`
- LED 초기 표시 복귀
- UART service 유지

단, MakeCode BLE 런타임에서 reset 없는 반복 연결이 충분히 안정적인지는 실제 micro:bit v1/v2에서 검증해야 한다.

## 6. 웹앱 개선 제안

### 6.1 연결 상태 모델 확장

현재 `state.js`의 `connectionStatus`는 `disconnected`, `connecting`, `connected` 중심이다. 다음 상태를 추가하는 것이 좋다.

- `subscribed`: GATT 연결과 notify 구독 완료
- `waiting-data`: 시작 명령 전송 후 첫 샘플 대기
- `streaming`: 유효 샘플 수신 중
- `stream-stale`: 연결은 유지되지만 최근 샘플이 끊김

### 6.2 첫 샘플 타임아웃

`connection-panel.js`에서 `sendMagnetCommand()` 이후 타이머를 시작한다.

- 5초: 보정 안내 메시지 표시
- 10초: `magnet\n` 1회 재전송
- 15초: 연결 실패로 보고 사용자가 재시도하도록 안내

첫 샘플이 오면 타이머를 정리하고 상태를 `streaming`으로 바꾼다.

### 6.3 스트림 watchdog

마지막 샘플 수신 시각을 기준으로 주기적으로 확인한다.

- 2초 이상 미수신: 경고 표시
- 5초 이상 미수신: 시작 명령 재전송 옵션 제공
- 10초 이상 미수신: 연결 해제 후 재연결 안내

### 6.4 오류 메시지 매핑 함수 추가

Bluetooth 예외를 UI 친화 메시지로 변환하는 유틸리티를 둔다.

예:

```javascript
const toBluetoothErrorMessage = (error) => {
  if (error?.name === 'NotFoundError') return '장치 선택이 취소되었거나 주변에서 micro:bit를 찾지 못했습니다.'
  if (error?.name === 'SecurityError') return 'Web Bluetooth는 HTTPS 또는 localhost에서만 사용할 수 있습니다.'
  if (error?.name === 'NetworkError') return 'micro:bit 전원이 꺼졌거나 다른 기기에 연결되어 있을 수 있습니다.'
  return error instanceof Error ? error.message : '디바이스 연결 중 오류가 발생했습니다.'
}
```

### 6.5 UUID 우선 characteristic 탐색

`js/bluetooth.js`에서 characteristic 선택 순서를 UUID 우선으로 바꾼다. 현재 fallback UUID 상수는 이미 있으므로, 선택 순서만 바꿔도 된다.

### 6.6 파서 강화

`parseSample()`은 다음 조건을 만족하도록 강화한다.

- 네 필드 모두 전체 문자열이 숫자여야 한다.
- `NaN`, `Infinity`, 빈 문자열, 숫자 뒤 문자 혼합을 거부한다.
- 향후 control message를 추가할 경우 sample parser와 control parser를 분리한다.

## 7. 문서 및 사용자 안내 개선

사용자 안내에는 다음 문구를 추가하는 것이 좋다.

- 펌웨어 플래시 후 micro:bit LED가 다시 표시될 때까지 기다린 뒤 연결한다.
- 연결 직후 데이터가 바로 나오지 않으면 micro:bit LED의 나침반 보정 화면을 완료한다.
- A/B 버튼을 누른 채 연결하면 보정을 건너뛰지만 최초 사용 시에는 권장하지 않는다.
- 연결이 끊긴 직후에는 micro:bit가 재부팅될 수 있으므로 몇 초 기다렸다가 다시 연결한다.
- 장치 목록에 여러 micro:bit가 보이면 LED에 표시되는 장치 이름을 확인하고 선택한다.

## 8. 권장 구현 순서

1. 완료: 웹앱에 `waiting-data` 상태를 추가하고 첫 샘플 수신 전 보정 안내를 표시한다.
2. 완료: 첫 샘플 타임아웃 안내를 추가한다.
3. 완료: 오류 메시지 매핑 함수를 추가한다.
4. 완료: 예기치 않은 연결 해제 후 3초 대기 및 자동 재연결 1회 시도를 추가한다.
5. 후속: 연결 후 스트림 중단을 감지하는 `stream-stale` watchdog을 추가한다.
6. 후속: characteristic 선택을 UUID 우선으로 바꾼다.
7. 후속: `parseSample()`의 숫자 검증과 `rxBuffer` 최대 길이를 추가한다.
8. 후속: 펌웨어에 `ACK`, `STATUS`, `HELLO` control message를 추가한다.
9. 후속: 펌웨어 명령 파서를 trim/lowercase 기반으로 완화한다.
10. 후속: 실제 micro:bit v1/v2, 데스크톱 Chrome/Edge, Android Chrome에서 연결-보정-해제-재연결 반복 테스트를 수행한다.

## 9. 구현 반영 현황

### 9.1 웹앱 반영 완료

- `index.html`에 연결 안내 메시지 영역을 추가했다.
- `styles.css`에 안내 카드와 오류 카드 줄바꿈 스타일을 추가했다.
- `state.js`에 `noticeMessage`, `noticeTone`, `setNotice` 액션을 추가했다.
- `connection-panel.js`에 첫 샘플 대기 안내, 7초 타임아웃 안내, 오류 메시지 세분화, 예기치 않은 해제 후 자동 재연결 1회 시도를 추가했다.
- `bluetooth.js`에 기존 장치 객체로 재연결할 때 `gattserverdisconnected` listener가 다시 붙도록 보강했다.

### 9.2 검증 완료

- `node --check js/state.js`
- `node --check js/bluetooth.js`
- `node --check js/ui/connection-panel.js`
- ESM import 검증

### 9.3 검증 필요

- 실제 micro:bit 보정 화면에서 첫 샘플 대기 안내가 충분히 자연스러운지 확인한다.
- 전원 분리 또는 거리 이탈로 예기치 않은 해제가 발생했을 때 3초 후 자동 재연결이 브라우저별로 안정적인지 확인한다.
- Android Chrome/삼성 인터넷에서 권한 오류 메시지가 실제 오류와 잘 맞는지 확인한다.

## 10. 결론

현재 구현은 기본적인 Nordic UART 연결과 100ms 자기장 샘플 수신에는 필요한 구조를 갖추고 있다. 가장 큰 안정성 리스크는 BLE/GATT 연결 성공을 데이터 스트리밍 성공과 동일하게 취급한다는 점이다. 특히 `v1.1-mg.js`는 첫 명령 후 보정 과정이 끼어들 수 있으므로, 웹앱은 첫 유효 샘플 수신 전까지 별도 대기 상태를 보여 주고 타임아웃/재전송/안내를 제공해야 한다.

2026-05-09 기준으로 웹앱에는 첫 샘플 대기 안내, 첫 샘플 타임아웃 안내, 오류 메시지 세분화, 예기치 않은 연결 해제 후 자동 재연결 1회 시도가 반영되었다. 남은 단기 과제는 연결 후 데이터 스트림 중단을 감지하는 watchdog과 파서/버퍼 방어 로직이다. 중장기적으로는 펌웨어와 웹앱 사이에 간단한 handshake/control message를 도입해 "연결됨", "명령 수신됨", "보정 중", "측정 중"을 명확히 구분하는 것이 가장 안정적인 방향이다.
