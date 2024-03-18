# 서버관련 정보 
## protocol
- 
## room 객체
- roomId        : 방 번호
- roomName      : 방 이름 
- maxUser       : 최대유저수
- status        : 방 상태
- maxUserCnt    : 최대유저 수
- users         : 방안의 유저 목록
    - id           : 유저 id
    - name         : 유저 이름
    - status       : 유저 상태
    - score        : 점수
    - order        : 순서
    - manager      : 방장
    - cardDeck[]   : 들고있는 카드 정보      
- gameInfo          : 현재 게임 정보(게임 시작되면 초기화)
    - order
    - openCardDeck[userId] 
    - turn 
- 
 
## user 객체
- 

## game 객체(반환용)
- userGameInfos :[] // 유저별 게임 정보 - 오픈한 카드리스트, 
- order  :  // 현재 순서
- gameStat : // 현재 게임상태 - 진행중, 누군가 카드 먹어서 다시 시작
- 

# logic
## 준비 
- ready 상태 업데이트 
- input
    - 변경될 ready상태
- output(현재 방 전체) 
    - 변경될 ready상태
## gameStart
- 현재 방의 방장을 제외한 모두가 레디버튼을 누르면 방장이 실행가능
- input 
    - 현재 방의 gameStart요청
- 내부처리 
    - 카드팩 초기화
- output(현재 방 천제)
    - 다음 order 반환,
    - 게임 플레이 정보 반환
## dropCard
- 카드내려놓기
- input 
    - 
- 내부처리
    - 해당유저의 카드팩이 비어있지않으면 한장 꺼내서 내려놓은 카드팩 목록에 반환
- output
    - 게임 플레이 정보 반환
## touch_down
- 종치기
- input 
    - 
- 내부처리 
    - 뒤집혀진 카드의 수가 기준에 맞는지 확인
        - 맞으면
            - 해당유저에게 현재 뒤집혀진 카드 목록 전체 넘겨줌
        - 틀리면
            - 해당유저는 남은 유저 수(gameover되지않은)만큼 카드를 한장씩 돌려야한다. -> 카드가 모자라면 탈락
- output
    - 카드객체 반환






