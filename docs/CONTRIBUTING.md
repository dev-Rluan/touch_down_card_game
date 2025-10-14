# 기여 가이드 (Contributing Guide)

## 🤝 기여하기 전에

Touch Down Card Game 프로젝트에 기여해주셔서 감사합니다! 이 문서는 프로젝트에 기여하는 방법을 안내합니다.

## 📋 기여 방법

### 1. 이슈 생성
- 버그 리포트나 기능 요청은 GitHub Issues를 사용해주세요
- 기존 이슈가 있는지 먼저 확인해주세요
- 명확한 제목과 상세한 설명을 작성해주세요

### 2. 개발 환경 설정
```bash
# 저장소 포크
git clone https://github.com/your-username/touch_down_card_game.git
cd touch_down_card_game

# 의존성 설치
npm install

# 개발 서버 시작
npm run dev
```

### 3. 브랜치 생성
```bash
# 기능 개발
git checkout -b feature/새로운기능명

# 버그 수정
git checkout -b bugfix/버그설명

# 문서 수정
git checkout -b docs/문서수정내용
```

## 🛠️ 개발 규칙

### 코딩 스타일
- **JavaScript**: ES6+ 문법 사용
- **들여쓰기**: 2칸 공백
- **따옴표**: 작은따옴표(') 사용
- **세미콜론**: 필수 사용

### 함수 작성 규칙
```javascript
/**
 * 함수 설명
 * @param {string} param1 - 매개변수 설명
 * @param {number} param2 - 매개변수 설명
 * @returns {Object} 반환값 설명
 * @throws {Error} 에러 상황 설명
 */
function functionName(param1, param2) {
  // 함수 구현
}
```

### 에러 처리
```javascript
// ✅ 좋은 예
try {
  const result = someFunction();
  return result;
} catch (error) {
  console.error('[FunctionName Error]', error);
  throw new Error('사용자 친화적 에러 메시지');
}

// ❌ 나쁜 예
const result = someFunction();
return result;
```

### 로깅 규칙
```javascript
// 로그 레벨별 사용
console.log('[Info]', '일반 정보');
console.warn('[Warning]', '경고 메시지');
console.error('[Error]', '에러 메시지');
console.debug('[Debug]', '디버그 정보');
```

## 🧪 테스트 작성

### 단위 테스트
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

### 통합 테스트
```javascript
// tests/integration/socket.test.js
describe('Socket.IO Integration', () => {
  let server;
  let client;
  
  beforeEach((done) => {
    server = require('../src/server');
    client = io('http://localhost:3000');
    client.on('connect', done);
  });
  
  afterEach(() => {
    client.disconnect();
    server.close();
  });
  
  it('should handle room creation flow', (done) => {
    client.emit('createRoom', '테스트방', 4);
    
    client.on('roomCreated', (room) => {
      expect(room.name).toBe('테스트방');
      done();
    });
  });
});
```

## 📝 커밋 메시지 규칙

### 커밋 타입
- `feat`: 새로운 기능 추가
- `fix`: 버그 수정
- `docs`: 문서 수정
- `style`: 코드 포맷팅 (기능 변경 없음)
- `refactor`: 코드 리팩토링
- `test`: 테스트 추가/수정
- `chore`: 빌드/설정 변경

### 커밋 메시지 형식
```
<타입>: <간단한 설명>

<상세 설명 (선택사항)>

<관련 이슈 번호 (선택사항)>
```

### 예시
```
feat: 방 생성 기능 추가

- 방 이름 중복 검사 로직 추가
- 최대 인원수 유효성 검사 추가
- 에러 처리 개선

Closes #123
```

## 🔄 Pull Request 가이드

### PR 생성 전 체크리스트
- [ ] 코드가 프로젝트 스타일 가이드를 따르는가?
- [ ] 모든 테스트가 통과하는가?
- [ ] 새로운 기능에 대한 테스트가 작성되었는가?
- [ ] 문서가 업데이트되었는가?
- [ ] 커밋 메시지가 규칙을 따르는가?

### PR 템플릿
```markdown
## 변경 사항
- 변경된 내용을 간단히 설명

## 테스트
- [ ] 단위 테스트 통과
- [ ] 통합 테스트 통과
- [ ] 수동 테스트 완료

## 관련 이슈
- Closes #이슈번호

## 스크린샷 (UI 변경 시)
- 변경 전/후 스크린샷 첨부
```

### PR 리뷰 과정
1. **자동 검사**: CI/CD 파이프라인 실행
2. **코드 리뷰**: 최소 1명의 승인 필요
3. **테스트**: 모든 테스트 통과 확인
4. **병합**: 승인 후 main 브랜치 병합

## 🐛 버그 리포트

### 버그 리포트 템플릿
```markdown
## 버그 설명
- 버그에 대한 명확한 설명

## 재현 단계
1. '...' 페이지로 이동
2. '...' 버튼 클릭
3. '...' 입력
4. 에러 발생

## 예상 결과
- 예상되는 동작 설명

## 실제 결과
- 실제로 발생한 결과

## 환경 정보
- OS: Windows 10
- Node.js: 18.0.0
- 브라우저: Chrome 90.0

## 추가 정보
- 스크린샷, 로그 등 추가 정보
```

## 💡 기능 요청

### 기능 요청 템플릿
```markdown
## 기능 설명
- 요청하는 기능에 대한 명확한 설명

## 사용 사례
- 이 기능이 왜 필요한지 설명
- 어떤 문제를 해결하는지 설명

## 제안하는 해결책
- 구체적인 구현 방안 (선택사항)

## 대안
- 다른 해결 방법이 있는지 설명 (선택사항)
```

## 📚 문서 기여

### 문서 작성 규칙
- **마크다운**: GitHub Flavored Markdown 사용
- **구조**: 명확한 헤딩 구조 사용
- **예시**: 코드 예시는 실행 가능하도록 작성
- **링크**: 관련 문서나 리소스 링크 추가

### 문서 업데이트 체크리스트
- [ ] 새로운 기능에 대한 문서 추가
- [ ] API 변경사항 반영
- [ ] 예시 코드 업데이트
- [ ] 링크 유효성 확인

## 🏷️ 라벨 시스템

### 이슈 라벨
- `bug`: 버그 리포트
- `enhancement`: 기능 개선
- `feature`: 새로운 기능
- `documentation`: 문서 관련
- `help wanted`: 도움 요청
- `good first issue`: 초보자용 이슈

### PR 라벨
- `ready for review`: 리뷰 준비 완료
- `needs changes`: 수정 필요
- `approved`: 승인됨
- `breaking change`: 호환성 깨지는 변경

## 🎯 기여 가이드라인

### 좋은 기여의 예
- 명확한 커밋 메시지
- 적절한 테스트 작성
- 문서 업데이트
- 코드 리뷰 피드백 반영

### 피해야 할 것들
- 불명확한 커밋 메시지
- 테스트 없는 코드
- 문서 업데이트 누락
- 리뷰 피드백 무시

## 📞 문의

기여 과정에서 질문이 있으시면:
- GitHub Issues에 질문 등록
- 프로젝트 관리자에게 직접 문의
- 커뮤니티 토론 참여

감사합니다! 🚀
