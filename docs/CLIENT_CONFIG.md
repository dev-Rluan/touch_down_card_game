# 🌐 클라이언트 서버 URL 설정 가이드

클라이언트에서 서버로 연결하는 URL을 변경하는 방법을 설명합니다.

## 📍 설정 파일 위치

- **설정 파일**: `src/public/js/config.js`
- **사용 위치**: `src/public/js/app.js`
- **로드 순서**: `src/view/index.html`

## 🎯 자동 환경 감지 (기본 설정)

현재 설정은 자동으로 환경을 감지합니다:

```javascript
// localhost 또는 127.0.0.1 → http://localhost:3000
// Docker 환경 → http://docker-host:3000
// 기타 → 현재 페이지의 origin 사용
```

## 🔧 URL 변경 방법

### 방법 1: 브라우저 콘솔에서 즉시 변경

개발자 도구(F12)를 열고 콘솔에서:

```javascript
// 서버 URL 변경
ClientConfig.setServerUrl('http://192.168.0.100:3000');

// 페이지 새로고침
location.reload();
```

### 방법 2: config.js 파일 수정 (영구 적용)

`src/public/js/config.js` 파일의 `getServerUrl()` 메서드 수정:

#### 예시 1: 특정 IP로 고정
```javascript
getServerUrl() {
  // 항상 특정 서버로 연결
  return 'http://192.168.0.100:3000';
}
```

#### 예시 2: 환경별 분기
```javascript
getServerUrl() {
  const { hostname, protocol } = window.location;
  
  // 로컬 개발 환경
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }
  
  // 스테이징 환경
  if (hostname.includes('staging')) {
    return 'https://staging-server.com';
  }
  
  // 프로덕션 환경
  return 'https://production-server.com';
}
```

#### 예시 3: 환경 변수 사용 (빌드 도구 필요)
```javascript
getServerUrl() {
  // Webpack/Vite 등의 빌드 도구를 사용하는 경우
  return process.env.SERVER_URL || window.location.origin;
}
```

### 방법 3: HTML에서 직접 설정

`src/view/index.html`에서 config.js 로드 후 바로 설정:

```html
<script src="/public/js/config.js"></script>
<script>
  // 페이지 로드 시 즉시 서버 URL 설정
  ClientConfig.setServerUrl('http://your-server:3000');
</script>
<script src="/public/js/app.js"></script>
```

### 방법 4: 쿼리 파라미터로 동적 설정

`config.js`에 다음 코드 추가:

```javascript
getServerUrl() {
  // URL 쿼리 파라미터에서 서버 URL 읽기
  const params = new URLSearchParams(window.location.search);
  const serverUrl = params.get('server');
  
  if (serverUrl) {
    return serverUrl;
  }
  
  // 기본 로직...
  return window.location.origin;
}
```

사용 예시:
```
http://localhost:3000/?server=http://192.168.0.100:3000
```

## 🌍 실제 사용 시나리오

### 시나리오 1: 로컬 개발 (기본)
- **현재 설정**: 자동으로 `http://localhost:3000` 연결
- **변경 필요**: 없음

### 시나리오 2: 같은 네트워크의 다른 PC에서 접속
- **상황**: PC A(192.168.0.100)에서 서버 실행, PC B에서 접속
- **방법**: PC B의 브라우저에서
```javascript
ClientConfig.setServerUrl('http://192.168.0.100:3000');
location.reload();
```

### 시나리오 3: Docker 컨테이너로 실행
- **상황**: Docker로 서버 실행 후 호스트에서 접속
- **기본**: 자동으로 감지
- **수동 설정** (필요시):
```javascript
// config.js에서
if (hostname.includes('docker')) {
  return 'http://localhost:3000';
}
```

### 시나리오 4: 클라우드 서버 배포
- **상황**: AWS/Azure 등에 배포
- **방법**: `config.js` 수정
```javascript
getServerUrl() {
  // 프로덕션 서버 URL
  return 'https://your-domain.com';
}
```

### 시나리오 5: 개발/스테이징/프로덕션 분리
```javascript
getServerUrl() {
  const { hostname } = window.location;
  
  if (hostname.includes('localhost')) {
    return 'http://localhost:3000'; // 개발
  } else if (hostname.includes('dev.')) {
    return 'https://dev-api.your-domain.com'; // 개발 서버
  } else if (hostname.includes('staging.')) {
    return 'https://staging-api.your-domain.com'; // 스테이징
  } else {
    return 'https://api.your-domain.com'; // 프로덕션
  }
}
```

## 🔍 디버깅

### 현재 연결된 서버 URL 확인

브라우저 개발자 도구(F12) → Console 탭:

```javascript
// 현재 서버 URL 확인
console.log('서버 URL:', ClientConfig.serverUrl);

// Socket.IO 연결 상태 확인
console.log('Socket 연결:', socket.connected);
console.log('Socket ID:', socket.id);
```

### 연결 문제 해결

#### 1. CORS 에러
```
Access to XMLHttpRequest at 'http://server:3000' from origin 'http://client' has been blocked
```

**해결**: 서버의 `src/server.js`에서 CORS 설정:
```javascript
const cors = require('cors');
app.use(cors({
  origin: 'http://client-url',
  credentials: true
}));
```

#### 2. 연결 타임아웃
```javascript
// config.js에서 타임아웃 증가
socketOptions: {
  timeout: 20000, // 20초로 증가
}
```

#### 3. 방화벽 문제
- 서버 포트(3000) 방화벽 오픈 확인
- Windows: `netsh advfirewall firewall add rule name="Node" dir=in action=allow protocol=TCP localport=3000`

## 📱 모바일 접속

같은 Wi-Fi 네트워크의 모바일에서 접속:

1. **서버 PC의 IP 확인**
   ```bash
   # Windows
   ipconfig
   
   # Linux/Mac
   ifconfig
   ```

2. **방화벽 오픈** (Windows)
   ```bash
   netsh advfirewall firewall add rule name="Node 3000" dir=in action=allow protocol=TCP localport=3000
   ```

3. **모바일에서 접속**
   ```
   http://192.168.0.100:3000
   ```
   
   서버가 자동으로 해당 IP로 연결합니다.

## 🔒 보안 고려사항

### 프로덕션 환경
1. **HTTPS 사용**
   ```javascript
   return 'https://your-domain.com';
   ```

2. **API 키 숨기기**
   - config.js에 민감 정보 직접 작성 금지
   - 환경 변수나 별도 설정 서버 사용

3. **CORS 제한**
   ```javascript
   // 서버에서 특정 도메인만 허용
   app.use(cors({
     origin: ['https://your-domain.com']
   }));
   ```

## 📝 체크리스트

설정 변경 후 확인사항:

- [ ] `config.js` 파일 수정 완료
- [ ] 브라우저 캐시 클리어 (Ctrl+Shift+Delete)
- [ ] 페이지 새로고침 (Ctrl+F5)
- [ ] 개발자 도구에서 서버 URL 확인
- [ ] Socket.IO 연결 상태 확인
- [ ] 실제 기능 동작 테스트

## 🆘 문제 발생 시

1. **브라우저 콘솔 확인** (F12 → Console)
2. **서버 로그 확인**
3. **네트워크 탭에서 WebSocket 연결 확인**
4. **방화벽/보안 프로그램 확인**

## 💡 권장 사항

1. **개발 중**: 자동 감지 사용 (기본 설정)
2. **테스트**: 쿼리 파라미터 방식으로 유연하게
3. **프로덕션**: 환경별로 명확하게 분기

---

**참고 문서**
- [Socket.IO 클라이언트 API](https://socket.io/docs/v4/client-api/)
- [프로젝트 README](../README.md)
- [Docker 실행 가이드](../DOCKER.md)

