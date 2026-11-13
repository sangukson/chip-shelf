# 클립 서랍

유튜브 영상에서 다시 보고 싶은 구간(예: 30분 영상의 5:20~5:40)만 찍어 보관하는 앱.

- 링크를 붙여넣거나 유튜브 앱의 **공유 → 클립 서랍**으로 영상을 연다.
- 앱 안에서 영상을 보면서 **시작 찍기 / 끝 찍기**로 구간을 잡는다.
- 저장한 클립을 누르면 그 구간만 반복 재생된다.
- 클립을 서랍(분류)별로 나눠 보관한다.
- 클립은 기기 안에만 저장된다. 백업·복원은 목록 아래 "백업과 복원".

영상 파일을 내려받아 자르지 않는다. 구간 위치만 저장하고 재생은 유튜브 플레이어가 한다
(유튜브 약관상 영상 다운로드 앱은 플레이 스토어에 올릴 수 없다).

## 디자인

스티커 같은 화면: 굵은 테두리, 누르면 내려앉는 두툼한 버튼, 서랍마다 다른 색. 색·모서리 값은 `www/app.css` 맨 위 토큰에 있다.
재미 요소는 저장할 때 색종이와 응원 문구, 시작/끝을 찍을 때 튀는 숫자, 서랍 카드 등장 애니메이션
(기기의 "동작 줄이기" 설정을 켜면 모두 꺼진다).

## 서랍(분류)

클립은 서랍에 나눠 담는다(예: 가슴, 팔, 어깨). 홈은 서랍 목록이고, 서랍을 누르면 그 안의 클립만 보인다.
서랍 안에서 링크를 넣으면 그 서랍이 미리 골라진다. 서랍을 지우면 안의 클립은 "미분류"로 남는다.
서랍은 `clip-shelf-cats-v1`, 클립은 `clip-shelf-v1` 키로 기기 안에 저장되고, 백업에는 둘 다 들어간다.

## 구조

| 경로 | 내용 |
|---|---|
| `www/` | 앱 본체(HTML/CSS/JS, 빌드 단계 없음). `core.js`는 순수 함수 |
| `android/` | Capacitor 안드로이드 프로젝트. `ShareInboxPlugin.java`가 공유 메뉴 수신 담당 |
| `ios/` | Capacitor iOS 프로젝트(Xcode로 연다) |
| `test/` | `core.js` 단위 테스트 (`npm test`) |
| `.github/workflows/android.yml` | APK/AAB 빌드 |

## 로컬에서 보기

```
npm install
npm run serve        # http://localhost:5173 (같은 와이파이의 휴대폰에서도 열린다)
```

## 안드로이드 빌드

Android Studio(SDK 36, JDK 21)가 있으면:

```
npm run android:debug     # android/app/build/outputs/apk/debug/app-debug.apk
```

없으면 GitHub에 올리기만 하면 된다. Actions가 `clip-shelf-debug-apk`를 만들어 주고,
그 APK를 휴대폰에 옮겨 바로 설치할 수 있다.

## 아이폰에서 확인하기

**배포된 웹앱 (권장)**: https://sangukson.github.io/chip-shelf/ 를 사파리로 열고 공유 → 홈 화면에 추가.
사파리에서 열면 화면 아래에 이 방법을 알려주는 안내가 뜬다(닫으면 다시 안 뜬다). 홈 화면 앱은
주소창 없이 전체 화면으로 열리고, `www/sw.js` 덕분에 인터넷이 없어도 목록은 열린다.
홈 화면 앱과 사파리는 저장 공간이 따로라서, 클립은 홈 화면 앱에서만 쓰는 게 좋다.

**같은 와이파이에서 열기 (개발용)**

```
npm run serve            # 컴퓨터에서 실행
```
아이폰 사파리에서 `http://<컴퓨터 IP>:5173` 을 연다(맥: 시스템 설정 → Wi-Fi → 세부사항, 윈도우: `ipconfig`).
공유 버튼 → "홈 화면에 추가"를 누르면 앱 아이콘으로 뜬다. 클립은 그 아이폰 안에 저장된다.

**집 밖에서도 쓰려면: Firebase 무료 호스팅**

```
npx firebase-tools login
npx firebase-tools init hosting   # 기존 firebase.json 사용, public 은 www
npx firebase-tools deploy --only hosting
```
나오는 `https://….web.app` 주소를 아이폰 사파리에서 열고 홈 화면에 추가한다.

**네이티브 iOS 앱 (`ios/` 폴더)**

맥과 Xcode가 있어야 한다.
```
npm install
npm run ios:open     # Xcode 가 열린다
```
Xcode → App 타깃 → Signing & Capabilities 에서 Team 을 본인 Apple ID로 고르고, 아이폰을 연결해 실행.
무료 Apple ID로도 내 아이폰에 설치할 수 있지만 7일마다 다시 설치해야 한다. TestFlight·앱스토어 배포는
Apple Developer Program(연 99달러)이 필요하다.

iOS에서 아직 안 되는 것:
- 유튜브 앱 공유 메뉴에서 바로 열기. iOS는 공유 확장(Share Extension)이라는 별도 타깃이 필요하다. 지금은 링크를 붙여넣어 연다.
- 앱 안 유튜브 재생은 실기기 확인 전이다. iOS 앱은 `capacitor://localhost` 주소로 동작해서 유튜브가 일부 영상 재생을
  거부할 수 있다. 그 경우 화면에 안내가 뜨고 "유튜브 앱" 버튼으로 열 수 있다.

## 구글 플레이 배포

1. **개발자 계정** — https://play.google.com/console 에서 등록. 등록비 미화 25달러(1회).
   2023년 11월 이후 만든 개인 계정은 프로덕션 공개 전에 **테스터 12명 이상이 14일 연속**
   참여하는 비공개 테스트를 거쳐야 한다. 내부 테스트 트랙은 이 조건 없이 바로 쓸 수 있다.
2. **패키지 이름** — 지금은 `com.clipshelf.app`. 첫 업로드 뒤에는 바꿀 수 없으니 바꾸려면 먼저
   `capacitor.config.json`, `android/app/build.gradle`, `android/app/src/main/java/` 경로를 함께 고친다.
3. **업로드 키 만들기** (한 번만, 파일과 비밀번호는 잃어버리면 안 된다)
   ```
   keytool -genkeypair -v -keystore release.jks -alias clipshelf -keyalg RSA -keysize 2048 -validity 10000
   ```
4. **GitHub 시크릿 등록** — `CLIP_KEYSTORE_BASE64`(`base64 -w0 release.jks` 결과),
   `CLIP_KEYSTORE_PASSWORD`, `CLIP_KEY_ALIAS`, `CLIP_KEY_PASSWORD`.
   등록 후 Actions를 돌리면 `clip-shelf-release-aab`가 나온다. versionCode는 실행 번호가 들어간다.
5. **플레이 콘솔** — 앱 만들기 → 내부 테스트 → AAB 업로드. 스토어 등록정보(설명, 스크린샷,
   512px 아이콘은 `www/icon-512.png`), 개인정보처리방침 URL, 데이터 보안 양식(수집 데이터 없음),
   콘텐츠 등급 설문을 채운다.

## 0원으로 먼저 써 보기

- 디버그 APK를 직접 설치(위 Actions 산출물).
- 또는 웹앱으로 배포: `npx firebase-tools deploy --only hosting` (Firebase 무료 요금제).
  크롬에서 "홈 화면에 추가"하면 앱처럼 뜨고 공유 메뉴에도 나타난다.

## 아직 실기기에서 확인하지 못한 것

이 프로젝트를 만든 환경에서는 Android SDK와 유튜브에 접속할 수 없었다. 화면 흐름은 유튜브
플레이어를 대역으로 바꿔 검증했고, 아래는 첫 빌드 후 직접 확인이 필요하다.

- Gradle 빌드 자체(네이티브 코드 컴파일 포함)
- 앱 안 WebView에서 유튜브 영상이 재생되는지 (게시자가 외부 재생을 막은 영상은 원래 안 된다)
- 유튜브 앱 공유 메뉴에서 넘어온 링크가 바로 열리는지
