const socket = io();

// DOM 요소들을 안전하게 가져오기
let nickForm, nick, createForm, connectStatus, lobby, gameroom, rooms, roomname, headCount, headCountList, refreshRoom, userList, roomId, readyButton;

// DOM 로딩 완료 후 요소들 초기화
function initializeElements() {
    nickForm = document.getElementById("nickForm");
    nick = document.getElementById("nick");
    createForm = document.getElementById("createForm");
    connectStatus = document.getElementById("connectStatus");
    lobby = document.getElementById("lobby");
    gameroom = document.getElementById("gameroom");
    rooms = document.getElementById("rooms");
    roomname = document.getElementById("roomname");
    headCount = document.getElementById("headCount");
    headCountList = document.getElementById("headCountList");
    refreshRoom = document.getElementById("refreshRoom");
    userList = document.getElementById("userList");
    roomId = document.getElementById("roomId");
    readyButton = document.getElementById("readyButton");
    
    console.log('DOM 요소들 초기화:', {
        nickForm: !!nickForm,
        nick: !!nick,
        createForm: !!createForm,
        connectStatus: !!connectStatus,
        lobby: !!lobby,
        gameroom: !!gameroom,
        rooms: !!rooms,
        roomname: !!roomname,
        headCount: !!headCount,
        userList: !!userList,
        roomId: !!roomId,
        readyButton: !!readyButton
    });
}

// DOM 로딩 완료 시 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeElements);
} else {
    initializeElements();
}



let maxUserCnt = 0;

const user = [];

// function start
function handleNickFormSubmit(event){
    // 기본 이벤트 막는 처리
    event.preventDefault();
    const input = nickForm.querySelector("input");
    socket.emit("change name", input.value);
    input.value='';
}
function handleCreateFormSubmit(event){
    event.preventDefault();
    const input = createForm.querySelector("input");
    socket.emit("createRoom", input.value, 4);
    input.value='';
}
function handleRefreshRoom(event){
    event.preventDefault();    
    console.log("refreshRoom");
    socket.emit("roomList");
}
function handleCreateRoom(event){

}
function joinRoom(roomId){
   
    socket.emit("joinRoom",roomId);
}

function isEmptyArr(arr)  {
    if(Array.isArray(arr) && arr.length === 0)  {
      return true;
    }
    
    return false;
  }

function leaveRoom(){   
    alert(roomId.value);  
    socket.emit("leaveRoom",roomId.value);
}
  
function ready(){
    socket.emit("ready", { roomId: roomId.value });
}
// function end

// 이벤트 리스너 등록
function setupEventListeners() {
    if (nickForm) {
        nickForm.addEventListener("submit", handleNickFormSubmit);
    }
    if (createForm) {
        createForm.addEventListener("submit", handleCreateFormSubmit);
    }
    if (refreshRoom) {
        refreshRoom.addEventListener("submit", handleRefreshRoom);
    }
    if (readyButton) {
        readyButton.addEventListener('click', function() {
            ready();
        });
    }
}

// DOM 로딩 완료 후 이벤트 리스너 등록
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupEventListeners);
} else {
    setupEventListeners();
}

// recv socket start
// default 이름

socket.on('connecting', (msg)=>{
    // const li = document.createElement('li');
    // li.innerText = msg;
    // document.getElementById('nick').appendChild(li);
    user.push({nickname : msg.nickname});
    nick.textContent = msg.nickname;

    rooms.innerHTML = "";
    let lis = "";    
    debugger;
    const roomList = msg.roomList;
    if(isEmptyArr(roomList)){
        rooms.innerHTML = `
        <div class="text-center py-4">
            <i class="icon ion-ios-people text-muted" style="font-size: 3rem;"></i>
            <h6 class="text-muted mt-2">현재 생성된 방이 없습니다</h6>
            <p class="text-muted small">새로운 방을 만들어보세요!</p>
        </div>`;
        return;
    }
    roomList.forEach(room => {
        console.log('here');
        lis += `
        <div class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center">
                    <div class="me-3">
                        <div class="badge bg-primary">${room.users.length}/${room.maxUserCnt}</div>
                    </div>
                    <div>
                        <h6 class="mb-1">${room.name}</h6>
                        <small class="text-muted">${room.users.length}명 참여 중</small>
                    </div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="joinRoom('${room.id}')">
                    <i class="icon ion-log-in me-1"></i>입장
                </button>
            </div>
        </div>`;
        console.log(room);
      });
    rooms.innerHTML = lis;
    
    // 애니메이션 효과 추가
    setTimeout(() => {
        const roomItems = rooms.querySelectorAll('.list-group-item');
        roomItems.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
            setTimeout(() => {
                item.style.transition = 'all 0.3s ease';
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }, 50);

    connectStatus.innerHTML = `<i class="icon ion-checkmark-circle me-1"></i>연결 성공`;
    connectStatus.className = 'badge bg-success';
})

socket.on('name change successful',(msg) => {
    nick.textContent = msg;
    // document.getElementById('nick')
    // .querySelector("li").textContent=msg;
})

// roomList
socket.on('roomList', (roomInfos) => {
    
    console.log(roomInfos);
    console.log(roomInfos.name);
    console.log('룸 리스트 새로고침');
    const roomList = roomInfos;
    console.log("========");
    console.log(roomList);
    rooms.innerHTML = "";
    let lis = "";    
    if(isEmptyArr(roomList)){
        rooms.innerHTML = `
        <div class="text-center py-4">
            <i class="icon ion-ios-people text-muted" style="font-size: 3rem;"></i>
            <h6 class="text-muted mt-2">현재 생성된 방이 없습니다</h6>
            <p class="text-muted small">새로운 방을 만들어보세요!</p>
        </div>`;
        return;
    }
    console.log('GGGG: ');
   

    
    roomList.forEach(room => {
        console.log('here');
        lis += `
        <div class="list-group-item">
            <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center">
                    <div class="me-3">
                        <div class="badge bg-primary">${room.users.length}/${room.maxUserCnt}</div>
                    </div>
                    <div>
                        <h6 class="mb-1">${room.name}</h6>
                        <small class="text-muted">${room.users.length}명 참여 중</small>
                    </div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="joinRoom('${room.id}')">
                    <i class="icon ion-log-in me-1"></i>입장
                </button>
            </div>
        </div>`;
        console.log(room);
        });
        
    
    rooms.innerHTML = lis;
    
    // 애니메이션 효과 추가
    setTimeout(() => {
        const roomItems = rooms.querySelectorAll('.list-group-item');
        roomItems.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
            setTimeout(() => {
                item.style.transition = 'all 0.3s ease';
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }, 50);
})
// 방 생성 성공
socket.on('roomCreated', (roomInfo)=>{
    lobby.style.display = 'none';
    gameroom.style.display = 'block'
    roomId.value = roomInfo.id;
    
        console.log(roomInfo);
        console.log(roomInfo.name)
        roomname.innerText=roomInfo.name;
        maxUserCnt = roomInfo.maxUserCnt;
        const users = roomInfo.users;
        
        headCount.textContent = users.length + " / " + maxUserCnt;
        // headCount.innerHtml = 
        
        console.log( "dd:" + users.length);
        console.log("ff:" + users);
        let userListHtml = '';
        users.forEach(user => {
            
            userListHtml  += 
            `<div id="${user.id}">
                <div class="row">
                    <div class="col"><span>user : ${user.name}</span></div>
                    <div class="col"><span>status : ${user.readyStatus}</span></div>
                </div>
            </div>`;
            
        })
        userList.innerHTML=userListHtml;
    
    // 플레이어 카드 애니메이션
    setTimeout(() => {
        const playerCards = userList.querySelectorAll('.player-card');
        playerCards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'scale(0.8)';
            setTimeout(() => {
                card.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                card.style.opacity = '1';
                card.style.transform = 'scale(1)';
            }, index * 150);
        });
    }, 50);
})


// 방 생성 성공
socket.on('roomCreated', (roomInfo) => {
    console.log('방 생성 성공:', roomInfo);
    
    // DOM 요소들이 초기화되었는지 확인
    if (!lobby || !gameroom || !roomname || !headCount || !userList || !roomId) {
        console.error('DOM 요소들이 초기화되지 않았습니다');
        initializeElements();
        
        if (!lobby || !gameroom || !roomname || !headCount || !userList || !roomId) {
            console.error('DOM 요소 초기화 실패');
            showNotification('UI 초기화에 실패했습니다. 페이지를 새로고침해주세요.', 'error');
            return;
        }
    }
    
    try {
        // 화면 전환
        lobby.style.display = 'none';
        gameroom.style.display = 'block';
        
        // CSS 재렌더링 강제 (Reflow 유도)
        void gameroom.offsetHeight;
        
        roomname.innerText = roomInfo.name;
        roomId.value = roomInfo.id;
        maxUserCnt = roomInfo.maxUserCnt;
        
        const users = roomInfo.users;
        headCount.textContent = users.length + " / " + maxUserCnt;
        
        let userListHtml = '';
        if (users && Array.isArray(users)) {
            users.forEach(user => {
                if (!user || !user.id || !user.name) {
                    console.warn('잘못된 유저 데이터:', user);
                    return;
                }
                
                userListHtml += 
                `<div class="player-card ${user.readyStatus === 'ready' ? 'ready' : ''} ${user.manager ? 'manager' : ''}" id="${user.id}">
                    <div class="player-info">
                        <div class="player-avatar">
                            ${user.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="player-details">
                            <h6>${user.name}</h6>
                            <div class="player-status">
                                <span class="status-badge status-${user.readyStatus || 'waiting'}">
                                    ${user.readyStatus === 'ready' ? '준비완료' : '대기중'}
                                </span>
                                ${user.manager ? '<span class="badge bg-warning">방장</span>' : ''}
                            </div>
                        </div>
                    </div>
                </div>`;
                
                console.log('user 처리됨:', user.id, user.name);
            });
        }
        userList.innerHTML = userListHtml;
        
        // CSS 재렌더링 강제 (Reflow 유도)
        void userList.offsetHeight;
        
        console.log('roomCreated HTML 생성 완료:', userListHtml);
    } catch (error) {
        console.error('roomCreated 처리 중 에러:', error);
        showNotification('방 생성 처리 중 오류가 발생했습니다.', 'error');
    }
    
    // 플레이어 카드 애니메이션
    setTimeout(() => {
        const playerCards = userList.querySelectorAll('.player-card');
        console.log('애니메이션 대상 플레이어 카드 수:', playerCards.length);
        playerCards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'scale(0.8)';
            setTimeout(() => {
                card.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                card.style.opacity = '1';
                card.style.transform = 'scale(1)';
            }, index * 150);
        });
    }, 50);
});
// 방 생성 실패
socket.on('createRoomError',(msg) =>{
    alert(msg);
})
// 방 입장 성공 (구버전 제거됨)
socket.on('successJoinRoom', (roomInfo) =>{
    console.log('방입장 성공:', roomInfo);
    
    // DOM 요소들이 초기화되었는지 확인
    if (!lobby || !gameroom || !roomname || !headCount || !userList || !roomId) {
        console.error('DOM 요소들이 초기화되지 않았습니다:', {
            lobby: !!lobby,
            gameroom: !!gameroom,
            roomname: !!roomname,
            headCount: !!headCount,
            userList: !!userList,
            roomId: !!roomId
        });
        
        // DOM 요소들을 다시 초기화 시도
        initializeElements();
        
        // 여전히 요소들이 없으면 에러 처리
        if (!lobby || !gameroom || !roomname || !headCount || !userList || !roomId) {
            console.error('DOM 요소 초기화 실패');
            showNotification('UI 초기화에 실패했습니다. 페이지를 새로고침해주세요.', 'error');
            return;
        }
    }
    
    try {
        // 화면 전환
        lobby.style.display = 'none';
        gameroom.style.display = 'block';
        
        // CSS 재렌더링 강제 (Reflow 유도)
        void gameroom.offsetHeight;
        
        roomname.innerText = roomInfo.name;
        console.log("roomInfo : ", roomInfo);
        roomId.value = roomInfo.id;

        const users = roomInfo.users;
        maxUserCnt = roomInfo.maxUserCnt;
        headCount.textContent = users.length + " / " + maxUserCnt;
        
        let userListHtml = '';
        if (users && Array.isArray(users)) {
            users.forEach(user => {
                if (!user || !user.id || !user.name) {
                    console.warn('잘못된 유저 데이터:', user);
                    return;
                }
                
                userListHtml += 
                `<div class="player-card ${user.readyStatus === 'ready' ? 'ready' : ''} ${user.manager ? 'manager' : ''}" id="${user.id}">
                    <div class="player-info">
                        <div class="player-avatar">
                            ${user.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="player-details">
                            <h6>${user.name}</h6>
                            <div class="player-status">
                                <span class="status-badge status-${user.readyStatus || 'waiting'}">
                                    ${user.readyStatus === 'ready' ? '준비완료' : '대기중'}
                                </span>
                                ${user.manager ? '<span class="badge bg-warning">방장</span>' : ''}
                            </div>
                        </div>
                    </div>
                </div>`;
                
                console.log('user 처리됨:', user.id, user.name);
            });
        }
        userList.innerHTML = userListHtml;
        
        // CSS 재렌더링 강제 (Reflow 유도)
        void userList.offsetHeight;
        
        console.log('successJoinRoom HTML 생성 완료:', userListHtml);
        console.log('userList 요소:', userList);
        console.log('userList 클래스:', userList.className);
        console.log('userList computed style:', window.getComputedStyle(userList).display);
    } catch (error) {
        console.error('successJoinRoom 처리 중 에러:', error);
        showNotification('방 입장 처리 중 오류가 발생했습니다.', 'error');
    }
    
    // 플레이어 카드 애니메이션
    setTimeout(() => {
        const playerCards = userList.querySelectorAll('.player-card');
        playerCards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'scale(0.8)';
            setTimeout(() => {
                card.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                card.style.opacity = '1';
                card.style.transform = 'scale(1)';
            }, index * 150);
        });
    }, 50);
})

socket.on('joinUser', (payload, secondArg)=>{
    // 서버가 { users, maxUserCnt } 형태로 보내는 경우와, (users, maxUserCnt)로 보내는 구버전 모두 지원
    let users;
    let maxCnt;
    if (Array.isArray(payload)) {
        users = payload;
        maxCnt = secondArg;
    } else if (payload && typeof payload === 'object') {
        users = payload.users || [];
        maxCnt = payload.maxUserCnt;
    } else {
        users = [];
        maxCnt = maxUserCnt; // fallback to last known
    }

    console.log('joinUser list : ', users);
    
    if (!headCount) {
        console.error('headCount 요소를 찾을 수 없습니다');
        return;
    }
    
    if (!userList) {
        console.error('userList 요소를 찾을 수 없습니다');
        return;
    }
    
    try {
        headCount.textContent = users.length + " / " + (maxCnt ?? maxUserCnt);
        
        let userListHtml = '';
        if (users && Array.isArray(users)) {
            users.forEach(user => {
                if (!user || !user.id || !user.name) {
                    console.warn('잘못된 유저 데이터:', user);
                    return;
                }
                
                userListHtml += 
                `<div class="player-card ${user.readyStatus === 'ready' ? 'ready' : ''} ${user.manager ? 'manager' : ''}" id="${user.id}">
                    <div class="player-info">
                        <div class="player-avatar">
                            ${user.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="player-details">
                            <h6>${user.name}</h6>
                            <div class="player-status">
                                <span class="status-badge status-${user.readyStatus || 'waiting'}">
                                    ${user.readyStatus === 'ready' ? '준비완료' : '대기중'}
                                </span>
                                ${user.manager ? '<span class="badge bg-warning">방장</span>' : ''}
                            </div>
                        </div>
                    </div>
                </div>`;
                
                console.log('user 처리됨:', user.id, user.name);
            });
        }
        userList.innerHTML = userListHtml;
        
        console.log('joinUser HTML 생성 완료:', userListHtml);
        console.log('userList 요소:', userList);
        console.log('userList 클래스:', userList.className);
    } catch (error) {
        console.error('joinUser 처리 중 에러:', error);
    }
    
    // 플레이어 카드 애니메이션
    setTimeout(() => {
        const playerCards = userList.querySelectorAll('.player-card');
        playerCards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'scale(0.8)';
            setTimeout(() => {
                card.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                card.style.opacity = '1';
                card.style.transform = 'scale(1)';
            }, index * 150);
        });
    }, 50);
})

socket.on('leaveRoomResult', (result) => {
    // 방정보 삭제
    roomId.value = "";
    // 방 html li삭제후 숨기기
    roomname.innerText = "roomName";
    userList.innerHTML = "";
    lobby.style.display = 'block';
    gameroom.style.display = 'none';
    headCount.textContent = "0/0";

})

socket.on('leaveUser', (payload)=>{
    // 서버가 { users, newManager } 형태로 보냄. 구버전 배열도 대응
    const users = Array.isArray(payload) ? payload : (payload && payload.users) ? payload.users : [];
    headCount.textContent = users.length + " / " + maxUserCnt;
    
    let userListHtml = '';
    users.forEach(user => {
        const userItem = document.createElement('li');
        userItem.textContent = user.name;
        
        userListHtml += 
        `<div class="player-card ${user.readyStatus === 'ready' ? 'ready' : ''} ${user.manager ? 'manager' : ''}" id="${user.id}">
            <div class="player-info">
                <div class="player-avatar">
                    ${user.name.charAt(0).toUpperCase()}
                </div>
                <div class="player-details">
                    <h6>${user.name}</h6>
                    <div class="player-status">
                        <span class="status-badge status-${user.readyStatus}">
                            ${user.readyStatus === 'ready' ? '준비완료' : '대기중'}
                        </span>
                        ${user.manager ? '<span class="badge bg-warning">방장</span>' : ''}
                    </div>
                </div>
            </div>
        </div>`;
        
        console.log('user : ' + user.id);
    });
    userList.innerHTML=userListHtml;
    
    // 플레이어 카드 애니메이션
    setTimeout(() => {
        const playerCards = userList.querySelectorAll('.player-card');
        playerCards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'scale(0.8)';
            setTimeout(() => {
                card.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                card.style.opacity = '1';
                card.style.transform = 'scale(1)';
            }, index * 150);
        });
    }, 50);
})

// ready 버튼 이벤트는 setupEventListeners에서 처리됨

// 준비 상태 갱신 시
socket.on('updateReadyStatus', function(users) {
    console.log('updateReadyStatus 호출됨:', users);
    
    if (!users || !Array.isArray(users)) {
        console.error('users가 배열이 아닙니다:', users);
        return;
    }
    
    if (!userList) {
        console.error('userList 요소를 찾을 수 없습니다');
        return;
    }
    
    try {
        let userListHtml = '';
        users.forEach(user => {
            if (!user || !user.id || !user.name) {
                console.warn('잘못된 유저 데이터:', user);
                return;
            }
            
            userListHtml += 
            `<div class="player-card ${user.readyStatus === 'ready' ? 'ready' : ''} ${user.manager ? 'manager' : ''}" id="${user.id}">
                <div class="player-info">
                    <div class="player-avatar">
                        ${user.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="player-details">
                        <h6>${user.name}</h6>
                        <div class="player-status">
                            <span class="status-badge status-${user.readyStatus || 'waiting'}">
                                ${user.readyStatus === 'ready' ? '준비완료' : '대기중'}
                            </span>
                            ${user.manager ? '<span class="badge bg-warning">방장</span>' : ''}
                        </div>
                    </div>
                </div>
            </div>`;
        });
        userList.innerHTML = userListHtml;
        
        console.log('updateReadyStatus 완료');
    } catch (error) {
        console.error('updateReadyStatus 에러:', error);
    }
});



// 게임 시작 시
socket.on('gameStarted', function(data) {
    console.log('게임 시작:', data);
    
    // 게임 UI 표시
    if (data) {
        showGameUI(data);
        renderMyCards(data.myCards);
    } else {
        console.error('게임 데이터가 없습니다:', data);
        showNotification('게임 데이터를 받지 못했습니다.', 'error');
        return;
    }
    
    // 게임 시작 알림
    showNotification('게임이 시작됩니다!', 'success');
});

function showGameUI(gameData) {
    lobby.style.display = 'none';
    gameroom.style.display = 'block';
    // other UI updates
}

function renderMyCards(cards) {
    const myCardList = document.querySelector('.player-hand-area .card-list');
    myCardList.innerHTML = '';
    cards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.classList.add('card-item'); // You'll need to style this class
        cardElement.innerHTML = `<span>${card.fruit} ${card.count}</span>`;
        myCardList.appendChild(cardElement);
    });
}

/**
 * 카드 내기
 */
function playCard(cardIndex) {
    if (!isMyTurn) {
        showNotification('당신의 턴이 아닙니다!', 'warning');
        return;
    }
    
    socket.emit('playCard', cardIndex);
}

/**
 * 할리갈리 버튼 클릭
 */
function halliGalli() {
    socket.emit('halliGalli');
}

/**
 * 과일 이모지 가져오기
 */
function getFruitEmoji(fruit) {
    const fruitEmojis = {
        'strawberry': '🍓',
        'banana': '🍌',
        'plum': '🍇',
        'lemon': '🍋'
    };
    return fruitEmojis[fruit] || '🃏';
}

/**
 * 알림 표시
 */
function showNotification(message, type = 'info') {
    // 간단한 알림 구현
    const alertClass = {
        'success': 'alert-success',
        'error': 'alert-danger',
        'warning': 'alert-warning',
        'info': 'alert-info'
    }[type] || 'alert-info';
    
    const notification = document.createElement('div');
    notification.className = `alert ${alertClass} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // 3초 후 자동 제거
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

/**
 * 게임 디스플레이 업데이트
 */
function updateGameDisplay(data) {
    // 중앙 카드 업데이트
    updateCenterCards(data.result.centerCards);
    
    // 턴 업데이트
    if (currentGameData) {
        currentGameData.currentTurn = data.result.nextTurn;
        updateTurnDisplay(data.result.nextTurn);
    }
    
    // 할리갈리 조건 확인
    if (data.result.isHalliGalli) {
        showNotification('할리갈리! 벨을 누르세요!', 'warning');
        showHalliGalliButton();
    }
}

/**
 * 할리갈리 버튼 표시
 */
function showHalliGalliButton() {
    const halliGalliBtn = document.getElementById('halliGalliBtn');
    if (!halliGalliBtn) {
        const gameArea = document.querySelector('.player-section');
        const btn = document.createElement('button');
        btn.id = 'halliGalliBtn';
        btn.className = 'btn btn-warning btn-lg w-100 mb-3';
        btn.innerHTML = '<i class="icon ion-ios-bell me-2"></i>할리갈리!';
        btn.onclick = halliGalli;
        gameArea.appendChild(btn);
    }
    document.getElementById('halliGalliBtn').style.display = 'block';
}

/**
 * 할리갈리 결과 표시
 */
function showHalliGalliResult(data) {
    const result = data.result;
    if (result.success) {
        showNotification(`할리갈리 성공! ${result.playerName}이 ${result.scoreGained}점 획득!`, 'success');
    } else {
        showNotification(`할리갈리 실패! ${result.playerName}이 카드를 버렸습니다.`, 'error');
    }
    
    // 할리갈리 버튼 숨기기
    const halliGalliBtn = document.getElementById('halliGalliBtn');
    if (halliGalliBtn) {
        halliGalliBtn.style.display = 'none';
    }
    
    // 게임 상태 업데이트
    socket.emit('getGameState');
}

/**
 * 게임 종료 표시
 */
function showGameEnd(data) {
    const winner = data.winner;
    const finalScores = data.finalScores;
    
    let endMessage = `
    <div class="text-center">
        <h4 class="text-success mb-3">🎉 게임 종료! 🎉</h4>
        <h5 class="mb-3">승자: ${winner.name} (${winner.score}점)</h5>
        <h6 class="text-muted mb-3">최종 점수</h6>
        <div class="list-group">
    `;
    
    finalScores.sort((a, b) => b.score - a.score).forEach((player, index) => {
        endMessage += `
        <div class="list-group-item d-flex justify-content-between align-items-center">
            <span>${index + 1}. ${player.name}</span>
            <span class="badge bg-primary">${player.score}점</span>
        </div>`;
    });
    
    endMessage += `
        </div>
        <button class="btn btn-primary mt-3" onclick="location.reload()">새 게임</button>
    </div>`;
    
    // 모달로 게임 종료 표시
    const modal = document.createElement('div');
    modal.className = 'modal fade show';
    modal.style.display = 'block';
    modal.innerHTML = `
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-body">
                ${endMessage}
            </div>
        </div>
    </div>`;
    
    document.body.appendChild(modal);
}