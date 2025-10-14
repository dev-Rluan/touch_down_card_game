# Touch Down Card Game - API 통신 규격 문서

## 📋 개요

이 문서는 Touch Down Card Game의 클라이언트-서버 간 Socket.IO 통신 규격을 정의합니다.

## 🔌 연결 정보

- **서버 주소**: `http://localhost:3000`
- **통신 방식**: Socket.IO (WebSocket 기반)
- **포트**: 3000 (기본값)

## 📡 이벤트 규격

### 1. 연결 이벤트

#### 1.1 클라이언트 연결 시
**서버 → 클라이언트**

```javascript
// 이벤트명: 'connecting'
// 데이터: 초기 연결 정보
{
  nickname: string,        // 기본 닉네임 (예: "User_12345678")
  roomList: Array<Room>    // 현재 대기 중인 방 목록
}
```

**Room 객체 구조:**
```javascript
{
  id: string,              // 방 고유 ID
  name: string,            // 방 이름
  users: Array<User>,      // 방에 참여 중인 사용자 목록
  status: string,          // 방 상태 ('waiting', 'playing', 'finished')
  maxUserCnt: number,      // 최대 인원수
  createdAt: string        // 방 생성 시간 (ISO 8601)
}
```

**User 객체 구조:**
```javascript
{
  id: string,              // 사용자 소켓 ID
  name: string,            // 사용자 닉네임
  readyStatus: string,     // 준비 상태 ('waiting', 'ready')
  score: number,           // 점수
  order: number,           // 순서
  manager: boolean,        // 방장 여부
  cardPack: Array<Card>   // 보유 카드 (게임 중)
}
```

### 2. 사용자 관리 이벤트

#### 2.1 닉네임 변경
**클라이언트 → 서버**
```javascript
// 이벤트명: 'change name'
// 데이터: 새로운 닉네임
"새로운닉네임"
```

**서버 → 클라이언트 (성공)**
```javascript
// 이벤트명: 'name change successful'
// 데이터: 변경된 닉네임
"새로운닉네임"
```

**서버 → 클라이언트 (실패)**
```javascript
// 이벤트명: 'name change error'
// 데이터: 에러 메시지
"닉네임을 입력해주세요."
```

### 3. 채팅 이벤트

#### 3.1 채팅 메시지 전송
**클라이언트 → 서버**
```javascript
// 이벤트명: 'chat message'
// 데이터: 메시지 내용
"안녕하세요!"
```

**서버 → 모든 클라이언트**
```javascript
// 이벤트명: 'chat message'
// 데이터: 채팅 정보
{
  user: string,            // 발신자 닉네임
  message: string,         // 메시지 내용
  timestamp: string        // 전송 시간 (ISO 8601)
}
```

### 4. 방 관리 이벤트

#### 4.1 방 생성
**클라이언트 → 서버**
```javascript
// 이벤트명: 'createRoom'
// 데이터: 방 이름, 최대 인원수
"방이름", 4
```

**서버 → 클라이언트 (성공)**
```javascript
// 이벤트명: 'roomCreated'
// 데이터: 생성된 방 정보
{
  id: "room-uuid",
  name: "방이름",
  users: [User],
  status: "waiting",
  maxUserCnt: 4,
  upCardList: [],
  turn: 0,
  createdAt: "2024-01-01T00:00:00.000Z"
}
```

**서버 → 클라이언트 (실패)**
```javascript
// 이벤트명: 'createRoomError'
// 데이터: 에러 메시지
"이미 같은 이름의 방이 존재합니다."
```

#### 4.2 방 목록 조회
**클라이언트 → 서버**
```javascript
// 이벤트명: 'roomList'
// 데이터: 없음
```

**서버 → 클라이언트**
```javascript
// 이벤트명: 'roomList'
// 데이터: 대기 중인 방 목록
[
  {
    id: "room-uuid-1",
    name: "방이름1",
    users: [User, User],
    status: "waiting",
    maxUserCnt: 4,
    createdAt: "2024-01-01T00:00:00.000Z"
  }
]
```

#### 4.3 방 입장
**클라이언트 → 서버**
```javascript
// 이벤트명: 'joinRoom'
// 데이터: 방 ID
"room-uuid"
```

**서버 → 클라이언트 (성공)**
```javascript
// 이벤트명: 'successJoinRoom'
// 데이터: 방 정보
{
  id: "room-uuid",
  name: "방이름",
  users: [User, User, User],
  status: "waiting",
  maxUserCnt: 4,
  upCardList: [],
  turn: 0,
  createdAt: "2024-01-01T00:00:00.000Z"
}
```

**서버 → 클라이언트 (실패)**
```javascript
// 이벤트명: 'faildJoinRoom'
// 데이터: 에러 메시지
"방 인원이 가득 찼습니다."
```

**서버 → 같은 방의 다른 사용자들**
```javascript
// 이벤트명: 'joinUser'
// 데이터: 업데이트된 사용자 정보
{
  users: [User, User, User],
  maxUserCnt: 4
}
```

#### 4.4 방 나가기
**클라이언트 → 서버**
```javascript
// 이벤트명: 'leaveRoom'
// 데이터: 방 ID
"room-uuid"
```

**서버 → 클라이언트**
```javascript
// 이벤트명: 'leaveRoomResult'
// 데이터: 결과 정보
{
  status: 200,                    // 200: 성공, 400: 실패
  message: "successLeaveRoom"     // 결과 메시지
}
```

**서버 → 같은 방의 다른 사용자들**
```javascript
// 이벤트명: 'leaveUser'
// 데이터: 업데이트된 사용자 정보
{
  users: [User, User],            // 남은 사용자들
  newManager: User | null          // 새로운 방장 (방장이 나간 경우)
}
```

### 5. 게임 이벤트

#### 5.1 준비 상태 변경
**클라이언트 → 서버**
```javascript
// 이벤트명: 'ready'
// 데이터: 없음
```

**서버 → 같은 방의 모든 사용자**
```javascript
// 이벤트명: 'updateReadyStatus'
// 데이터: 업데이트된 사용자 목록
[User, User, User]
```

**서버 → 같은 방의 모든 사용자 (모든 사용자 준비 완료)**
```javascript
// 이벤트명: 'allReady'
// 데이터: 준비된 사용자 목록
[User, User, User]
```

**서버 → 같은 방의 모든 사용자 (게임 시작)**
```javascript
// 이벤트명: 'gameStart'
// 데이터: 게임 시작 정보
{
  message: "게임이 시작됩니다!",
  users: [User, User, User]
}
```

## 🔄 이벤트 흐름

### 1. 사용자 연결 및 방 생성 흐름

```
1. 클라이언트 연결
   ↓
2. 서버 → 클라이언트: 'connecting' (초기 데이터)
   ↓
3. 클라이언트 → 서버: 'change name' (닉네임 변경)
   ↓
4. 서버 → 클라이언트: 'name change successful'
   ↓
5. 클라이언트 → 서버: 'createRoom' (방 생성)
   ↓
6. 서버 → 클라이언트: 'roomCreated' (방 생성 성공)
   ↓
7. 서버 → 모든 클라이언트: 'roomList' (방 목록 업데이트)
```

### 2. 방 입장 및 게임 시작 흐름

```
1. 클라이언트 → 서버: 'joinRoom' (방 입장)
   ↓
2. 서버 → 클라이언트: 'successJoinRoom' (입장 성공)
   ↓
3. 서버 → 같은 방 사용자들: 'joinUser' (사용자 입장 알림)
   ↓
4. 클라이언트 → 서버: 'ready' (준비)
   ↓
5. 서버 → 같은 방 사용자들: 'updateReadyStatus' (준비 상태 업데이트)
   ↓
6. 모든 사용자 준비 완료 시:
   서버 → 같은 방 사용자들: 'allReady'
   ↓
7. 3초 후:
   서버 → 같은 방 사용자들: 'gameStart' (게임 시작)
```

### 3. 방 나가기 흐름

```
1. 클라이언트 → 서버: 'leaveRoom' (방 나가기)
   ↓
2. 서버 → 클라이언트: 'leaveRoomResult' (나가기 결과)
   ↓
3. 방이 삭제되지 않은 경우:
   서버 → 같은 방 사용자들: 'leaveUser' (사용자 나가기 알림)
   ↓
4. 서버 → 모든 클라이언트: 'roomList' (방 목록 업데이트)
```

## ⚠️ 에러 처리

### 에러 코드 및 메시지

| 에러 상황 | 에러 메시지 |
|-----------|-------------|
| 필수 입력값 누락 | "필수 입력값이 누락되었습니다." |
| 방 이름 중복 | "이미 같은 이름의 방이 존재합니다." |
| 방이 존재하지 않음 | "존재하지 않는 방입니다." |
| 방 인원 초과 | "방 인원이 가득 찼습니다." |
| 방 상태 오류 | "이 방은 입장할 수 없는 상태입니다." |
| 중복 참여 | "이미 다른 방에 참여 중입니다." |
| 사용자 정보 없음 | "사용자 정보를 찾을 수 없습니다." |
| 최대 인원수 오류 | "최대 인원수는 2명 이상 8명 이하여야 합니다." |

## 📝 사용 예시

### JavaScript 클라이언트 예시

```javascript
// Socket.IO 클라이언트 초기화
const socket = io('http://localhost:3000');

// 연결 시 초기 데이터 수신
socket.on('connecting', (data) => {
  console.log('닉네임:', data.nickname);
  console.log('방 목록:', data.roomList);
});

// 닉네임 변경
socket.emit('change name', '새로운닉네임');

// 방 생성
socket.emit('createRoom', '테스트방', 4);

// 방 입장
socket.emit('joinRoom', 'room-uuid');

// 준비
socket.emit('ready');

// 채팅 메시지 전송
socket.emit('chat message', '안녕하세요!');

// 방 나가기
socket.emit('leaveRoom', 'room-uuid');
```

## 🔧 개발자 가이드

### 서버 설정
```javascript
// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버가 ${PORT}번 포트에서 시작되었습니다.`);
});
```

### 클라이언트 설정
```javascript
// Socket.IO 클라이언트 라이브러리 포함
<script src="/socket.io/socket.io.js"></script>

// 연결
const socket = io();
```

## 📊 성능 고려사항

- **동시 연결 수**: 최대 1000명 (기본 설정)
- **방당 최대 인원**: 8명
- **메시지 전송 주기**: 실시간 (WebSocket)
- **재연결**: 자동 재연결 지원

## 🛡️ 보안 고려사항

- **입력값 검증**: 모든 입력값에 대한 유효성 검사
- **에러 처리**: 적절한 에러 메시지 및 상태 코드
- **메모리 관리**: 사용자 연결 해제 시 적절한 정리
- **동시성 처리**: Race condition 방지

이 문서는 Touch Down Card Game의 API 통신 규격을 정의하며, 클라이언트와 서버 간의 일관된 통신을 보장합니다.
