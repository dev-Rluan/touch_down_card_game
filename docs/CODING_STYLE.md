# 코딩 스타일 가이드 (Coding Style Guide)

## 📋 개요

이 문서는 Touch Down Card Game 프로젝트의 일관된 코드 스타일을 정의합니다. 모든 개발자는 이 가이드를 따라 코드를 작성해야 합니다.

## 🎯 JavaScript 코딩 규칙

### 1. 기본 규칙

#### 들여쓰기
```javascript
// ✅ 2칸 공백 사용
function example() {
  if (condition) {
    return true;
  }
}

// ❌ 탭 또는 4칸 공백 사용 금지
function example() {
    if (condition) {
        return true;
    }
}
```

#### 세미콜론
```javascript
// ✅ 세미콜론 필수 사용
const name = 'value';
function example() {
  return true;
}

// ❌ 세미콜론 생략 금지
const name = 'value'
function example() {
  return true
}
```

#### 따옴표
```javascript
// ✅ 작은따옴표 사용
const message = 'Hello World';
const template = `Hello ${name}`;

// ❌ 큰따옴표 사용 금지
const message = "Hello World";
```

### 2. 변수 및 함수명

#### 변수명 (camelCase)
```javascript
// ✅ 좋은 예
const userName = 'john';
const maxUserCount = 10;
const isUserReady = true;
const roomList = [];

// ❌ 나쁜 예
const user_name = 'john';
const maxusercount = 10;
const isuserready = true;
const rl = [];
```

#### 함수명 (camelCase)
```javascript
// ✅ 좋은 예
function createRoom() {}
function getUserName() {}
function updateUserStatus() {}

// ❌ 나쁜 예
function create_room() {}
function get_user_name() {}
function updateuserstatus() {}
```

#### 상수명 (UPPER_SNAKE_CASE)
```javascript
// ✅ 좋은 예
const MAX_ROOM_COUNT = 100;
const DEFAULT_PORT = 3000;
const API_ENDPOINTS = {
  CREATE_ROOM: '/api/room',
  JOIN_ROOM: '/api/room/join'
};

// ❌ 나쁜 예
const maxRoomCount = 100;
const defaultPort = 3000;
```

### 3. 함수 작성 규칙

#### 함수 선언
```javascript
// ✅ 함수 선언문 사용
function createRoom(socketId, roomName, maxUserCnt) {
  // 함수 구현
}

// ✅ 화살표 함수 (콜백에서)
const users = roomList.map(user => user.name);

// ❌ 함수 표현식 사용 금지 (일반적인 경우)
const createRoom = function(socketId, roomName, maxUserCnt) {
  // 함수 구현
};
```

#### 매개변수
```javascript
// ✅ 명확한 매개변수명
function createRoom(socketId, roomName, maxUserCnt) {
  // 함수 구현
}

// ❌ 불명확한 매개변수명
function createRoom(id, name, cnt) {
  // 함수 구현
}
```

#### JSDoc 주석
```javascript
/**
 * 방 생성 함수
 * @param {string} socketId - 소켓 ID
 * @param {string} roomName - 방 이름
 * @param {number} maxUserCnt - 최대 인원수
 * @returns {Object} 생성된 방 정보
 * @throws {Error} 방 이름 중복 또는 유효하지 않은 입력값
 */
function createRoom(socketId, roomName, maxUserCnt) {
  // 함수 구현
}
```

### 4. 조건문 및 반복문

#### if문
```javascript
// ✅ 좋은 예
if (userName && userName.trim()) {
  // 로직
}

if (room.users.length >= room.maxUserCnt) {
  throw new Error('방 인원이 가득 찼습니다.');
}

// ❌ 나쁜 예
if (userName) {
  // 로직
}

if (room.users.length >= room.maxUserCnt) {
  throw new Error('방 인원이 가득 찼습니다.');
}
```

#### 반복문
```javascript
// ✅ for...of 사용
for (const user of room.users) {
  console.log(user.name);
}

// ✅ forEach 사용
room.users.forEach(user => {
  console.log(user.name);
});

// ❌ 전통적인 for문 사용 금지 (특별한 경우 제외)
for (let i = 0; i < room.users.length; i++) {
  console.log(room.users[i].name);
}
```

### 5. 객체 및 배열

#### 객체 리터럴
```javascript
// ✅ 좋은 예
const room = {
  id: roomId,
  name: roomName,
  users: [],
  status: 'waiting',
  maxUserCnt: maxUserCnt
};

// ❌ 나쁜 예
const room = {
  id: roomId,
  name: roomName,
  users: [],
  status: 'waiting',
  maxUserCnt: maxUserCnt,
};
```

#### 배열
```javascript
// ✅ 좋은 예
const users = ['user1', 'user2', 'user3'];
const roomList = [];

// ❌ 나쁜 예
const users = ['user1', 'user2', 'user3',];
const roomList = [];
```

### 6. 에러 처리

#### try-catch 사용
```javascript
// ✅ 좋은 예
try {
  const room = roomService.createRoom(socketId, roomName, maxCnt);
  socket.emit('roomCreated', room);
} catch (error) {
  console.error('[createRoom Error]', error);
  socket.emit('createRoomError', error.message);
}

// ❌ 나쁜 예
const room = roomService.createRoom(socketId, roomName, maxCnt);
socket.emit('roomCreated', room);
```

#### 에러 메시지
```javascript
// ✅ 명확한 에러 메시지
throw new Error('방 이름이 중복됩니다.');
throw new Error('최대 인원수는 2명 이상 8명 이하여야 합니다.');

// ❌ 불명확한 에러 메시지
throw new Error('에러 발생');
throw new Error('Invalid input');
```

### 7. 로깅

#### 로그 레벨별 사용
```javascript
// ✅ 로그 레벨별 사용
console.log('[Info]', '사용자 연결:', socket.id);
console.warn('[Warning]', '방 인원 초과');
console.error('[Error]', '방 생성 실패:', error.message);
console.debug('[Debug]', '방 목록:', roomList);

// ❌ 일관성 없는 로깅
console.log('사용자 연결:', socket.id);
console.error('방 인원 초과');
console.log('방 생성 실패:', error.message);
```

#### 로그 포맷
```javascript
// ✅ 구조화된 로그
console.log('[Room]', '방 생성 완료 - ID:', room.id, '이름:', room.name);
console.error('[Socket]', '연결 오류 - Socket ID:', socket.id, 'Error:', error.message);

// ❌ 구조화되지 않은 로그
console.log('방 생성 완료');
console.error('연결 오류');
```

## 🔌 Socket.IO 이벤트 규칙

### 1. 이벤트명 규칙

#### 이벤트명 (kebab-case)
```javascript
// ✅ 좋은 예
socket.emit('createRoom', data);
socket.emit('joinRoom', roomId);
socket.emit('leaveRoom', roomId);
socket.emit('updateReadyStatus', status);

// ❌ 나쁜 예
socket.emit('create_room', data);
socket.emit('joinroom', roomId);
socket.emit('leave-room', roomId);
socket.emit('updateReadyStatus', status);
```

#### 이벤트 데이터 구조
```javascript
// ✅ 일관된 데이터 구조
socket.emit('roomCreated', {
  id: roomId,
  name: roomName,
  users: users,
  status: 'waiting',
  maxUserCnt: maxUserCnt,
  createdAt: new Date().toISOString()
});

// ❌ 일관성 없는 데이터 구조
socket.emit('roomCreated', {
  roomId: roomId,
  roomName: roomName,
  userList: users,
  roomStatus: 'waiting'
});
```

### 2. 이벤트 처리

#### 서버 이벤트 처리
```javascript
// ✅ 좋은 예
socket.on('createRoom', (roomName, maxCnt) => {
  try {
    console.log(`[Room] 방 생성 요청 - 이름: ${roomName}, 최대인원: ${maxCnt}`);
    
    const room = roomService.createRoom(socket.id, roomName, maxCnt);
    socket.join(room.id);
    socket.emit('roomCreated', room);
    
    console.log(`[Room] 방 생성 완료 - ID: ${room.id}, 이름: ${room.name}`);
  } catch (error) {
    console.error('[createRoom Error]', error);
    socket.emit('createRoomError', error.message);
  }
});

// ❌ 나쁜 예
socket.on('createRoom', (roomName, maxCnt) => {
  const room = roomService.createRoom(socket.id, roomName, maxCnt);
  socket.join(room.id);
  socket.emit('roomCreated', room);
});
```

## 📁 파일 구조 규칙

### 1. 파일명 규칙

#### JavaScript 파일 (camelCase)
```javascript
// ✅ 좋은 예
roomService.js
userServices.js
gameController.js
socketEvents.js

// ❌ 나쁜 예
room_service.js
user-services.js
GameController.js
socket_events.js
```

#### HTML 파일 (kebab-case)
```html
<!-- ✅ 좋은 예 -->
index.html
game-room.html
user-profile.html

<!-- ❌ 나쁜 예 -->
index.html
gameRoom.html
user_profile.html
```

### 2. 폴더 구조

#### 서비스 파일
```
src/services/
├── roomService.js      # 방 관리 서비스
├── userServices.js     # 사용자 관리 서비스
└── gameService.js      # 게임 로직 서비스
```

#### 컨트롤러 파일
```
src/controllers/
├── roomController.js   # 방 관련 컨트롤러
├── gameController.js   # 게임 관련 컨트롤러
└── userController.js   # 사용자 관련 컨트롤러
```

## 🧪 테스트 코드 스타일

### 1. 테스트 파일 구조
```javascript
// tests/unit/services/roomService.test.js
describe('roomService', () => {
  describe('createRoom', () => {
    it('should create room with valid input', () => {
      // Given
      const socketId = 'test-socket-id';
      const roomName = '테스트방';
      const maxUserCnt = 4;
      
      // When
      const room = roomService.createRoom(socketId, roomName, maxUserCnt);
      
      // Then
      expect(room).toBeDefined();
      expect(room.name).toBe(roomName);
      expect(room.maxUserCnt).toBe(maxUserCnt);
    });
    
    it('should throw error with invalid input', () => {
      // Given
      const socketId = '';
      const roomName = '테스트방';
      const maxUserCnt = 4;
      
      // When & Then
      expect(() => {
        roomService.createRoom(socketId, roomName, maxUserCnt);
      }).toThrow('필수 입력값이 누락되었습니다.');
    });
  });
});
```

### 2. 테스트 명명 규칙
```javascript
// ✅ 좋은 예
describe('roomService', () => {
  describe('createRoom', () => {
    it('should create room with valid input', () => {});
    it('should throw error with invalid input', () => {});
    it('should throw error when room name already exists', () => {});
  });
});

// ❌ 나쁜 예
describe('roomService', () => {
  describe('createRoom', () => {
    it('test1', () => {});
    it('test2', () => {});
    it('test3', () => {});
  });
});
```

## 📚 문서화 스타일

### 1. JSDoc 주석
```javascript
/**
 * 방 생성 함수
 * @param {string} socketId - 소켓 ID
 * @param {string} roomName - 방 이름
 * @param {number} maxUserCnt - 최대 인원수
 * @returns {Object} 생성된 방 정보
 * @throws {Error} 방 이름 중복 또는 유효하지 않은 입력값
 * @example
 * const room = createRoom('socket123', '테스트방', 4);
 * console.log(room.name); // '테스트방'
 */
function createRoom(socketId, roomName, maxUserCnt) {
  // 함수 구현
}
```

### 2. 인라인 주석
```javascript
// ✅ 좋은 예
// 사용자가 이미 다른 방에 있는지 확인
const currentRoom = userService.getUserRoom(socketId);
if (currentRoom) {
  throw new Error('이미 다른 방에 참여 중입니다.');
}

// ❌ 나쁜 예
// 사용자 확인
const currentRoom = userService.getUserRoom(socketId);
if (currentRoom) {
  throw new Error('이미 다른 방에 참여 중입니다.');
}
```

## 🔧 도구 설정

### 1. ESLint 설정
```json
{
  "extends": ["eslint:recommended"],
  "env": {
    "node": true,
    "es6": true
  },
  "rules": {
    "indent": ["error", 2],
    "quotes": ["error", "single"],
    "semi": ["error", "always"],
    "camelcase": "error",
    "no-unused-vars": "error"
  }
}
```

### 2. Prettier 설정
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "none",
  "printWidth": 80
}
```

## 🎯 코드 리뷰 체크리스트

### 필수 확인 사항
- [ ] 코드가 스타일 가이드를 따르는가?
- [ ] 함수에 JSDoc 주석이 있는가?
- [ ] 에러 처리가 적절한가?
- [ ] 로깅이 일관성 있게 작성되었는가?
- [ ] 테스트 코드가 작성되었는가?
- [ ] 변수명과 함수명이 명확한가?

### 개선 사항
- [ ] 중복 코드가 제거되었는가?
- [ ] 함수가 단일 책임을 가지는가?
- [ ] 매직 넘버가 상수로 정의되었는가?
- [ ] 불필요한 주석이 제거되었는가?

이 스타일 가이드를 따라 코드를 작성하면 일관되고 유지보수 가능한 코드를 작성할 수 있습니다! 🚀
