// 서버 URL 설정 (config.js에서 자동으로 환경 감지)
// 수동으로 변경하려면: ClientConfig.setServerUrl('http://your-server:3000');
const socket = io(ClientConfig.serverUrl, ClientConfig.socketOptions);

// ──────────────────────────────────────────
// 로딩 화면 제어
// ──────────────────────────────────────────
function hideLoadingScreen() {
    const el = document.getElementById('loadingScreen');
    if (!el) return;
    el.classList.add('hidden');
    // 트랜지션 후 DOM에서 제거해 레이어 비용 없앰
    el.addEventListener('transitionend', () => el.remove(), { once: true });
}

function setLoadingStatus(text) {
    const el = document.getElementById('loadingStatus');
    if (el) el.textContent = text;
}

// Socket.IO 네이티브 connect / connect_error 이벤트 활용
socket.on('connect', () => {
    setLoadingStatus('서버 연결 완료, 초기화 중...');
});

socket.on('connect_error', () => {
    setLoadingStatus('연결 실패 – 재시도 중...');
});

// DOM 요소들을 안전하게 가져오기
let nickForm, nick, modalCreateForm, modalRoomName, modalMaxUsers, connectStatus, lobby, gameroom, rooms, roomname, headCount, headCountList, refreshRoom, userList, roomId, readyButton;
let readyButtonDefaultHTML = '';

// DOM 로딩 완료 후 요소들 초기화
function initializeElements() {
    nickForm = document.getElementById("nickForm");
    nick = document.getElementById("nick");
    modalCreateForm = document.getElementById("modalCreateForm");
    modalRoomName = document.getElementById("modalRoomName");
    modalMaxUsers = document.getElementById("modalMaxUsers");
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
    if (readyButton && !readyButtonDefaultHTML) {
        readyButtonDefaultHTML = readyButton.innerHTML;
    }

    // 벨 버튼 터치 최적화 (300ms 딜레이 제거 + 햅틱)
    const bellBtn = document.getElementById('halliGalliBell');
    if (bellBtn && window.TDTouch) {
        TDTouch.addBellFastClick(bellBtn, halliGalli);
    }

    console.log('DOM 요소들 초기화:', {
        nickForm: !!nickForm,
        nick: !!nick,
        modalCreateForm: !!modalCreateForm,
        modalRoomName: !!modalRoomName,
        modalMaxUsers: !!modalMaxUsers,
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

/**
 * 유저 상태를 한글로 표시
 * @param {string} status - ready, playing, waiting
 * @returns {string} 한글 상태
 */
function getStatusText(status) {
    switch(status) {
        case 'ready':
            return '준비완료';
        case 'playing':
            return '게임중';
        case 'waiting':
            return '대기중';
        default:
            return '대기중';
    }
}

/**
 * 플레이어 리스트 UI 업데이트
 * @param {Array} players - 플레이어 배열
 */
function updatePlayerList(players) {
    if (!players || !Array.isArray(players) || !userList) {
        return;
    }
    
    let userListHtml = '';
    players.forEach(player => {
        if (!player || !player.id || !player.name) {
            console.warn('잘못된 플레이어 데이터:', player);
            return;
        }
        
        userListHtml += 
        `<div class="player-card ${player.readyStatus || ''} ${player.manager ? 'manager' : ''}" id="${player.id}">
            <div class="player-info">
                <div class="player-avatar">
                    ${player.name.charAt(0).toUpperCase()}
                </div>
                <div class="player-details">
                    <h6>${player.name}</h6>
                    <div class="player-status">
                        <span class="status-badge status-${player.readyStatus || 'waiting'}">
                            ${getStatusText(player.readyStatus)}
                        </span>
                        ${player.manager ? '<span class="badge bg-warning">방장</span>' : ''}
                    </div>
                </div>
            </div>
        </div>`;
    });
    
    userList.innerHTML = userListHtml;
    console.log('[UI] 플레이어 리스트 업데이트:', players);
}

// function start
function handleNickFormSubmit(event){
    // 기본 이벤트 막는 처리
    event.preventDefault();
    const input = nickForm.querySelector("input");
    socket.emit("change name", input.value);
    input.value='';
}

/**
 * 방 만들기 모달 폼 제출 처리
 */
function handleModalCreateFormSubmit(event){
    event.preventDefault();
    
    const roomName = modalRoomName.value.trim();
    const maxUsers = parseInt(modalMaxUsers.value);
    
    if (!roomName) {
        alert('방 이름을 입력해주세요.');
        return;
    }
    
    console.log('[방 생성] 이름:', roomName, '최대 인원:', maxUsers);
    socket.emit("createRoom", roomName, maxUsers);
    
    // 입력 초기화
    modalRoomName.value = '';
    modalMaxUsers.value = '4';
    
    // 모달 닫기
    const modal = bootstrap.Modal.getInstance(document.getElementById('modal_createRoom'));
    if (modal) {
        modal.hide();
    }
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

function setReadyButtonEnabled(enabled) {
    if (!readyButton) return;
    readyButton.disabled = !enabled;
    readyButton.classList.toggle('btn-success', enabled);
    readyButton.classList.toggle('btn-secondary', !enabled);
    readyButton.innerHTML = enabled
        ? readyButtonDefaultHTML || '<i class="icon ion-checkmark"></i> Ready'
        : '<i class="icon ion-pause"></i> 게임 진행중';
}

/**
 * 대기실 상태 바 (준비 진행바 + 카운트 뱃지) 업데이트
 * @param {Array} users - 플레이어 목록
 * @param {number} maxCnt - 방 최대 인원
 */
function updateWaitingBar(users, maxCnt) {
    if (!Array.isArray(users)) return;
    const readyCount = users.filter(u => u && u.readyStatus === 'ready').length;
    const totalCount = users.length;
    const pct = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;
    const allReady = totalCount > 0 && readyCount === totalCount;

    const fill  = document.getElementById('readyProgressFill');
    const badge = document.getElementById('readyCountBadge');
    const dot   = document.getElementById('waitingDot');
    const text  = document.getElementById('waitingStatusText');
    const hc    = document.getElementById('headCount');

    if (fill)  fill.style.width = pct + '%';
    if (badge) badge.textContent = `${readyCount} / ${totalCount} 준비`;
    if (dot)   dot.classList.toggle('all-ready', allReady);
    if (text)  text.textContent = allReady
        ? '모든 플레이어 준비완료!'
        : `${readyCount}명 준비 완료 (${totalCount - readyCount}명 대기)`;
    if (hc && maxCnt) hc.textContent = `${totalCount} / ${maxCnt}`;
}
// function end

// 이벤트 리스너 등록
function setupEventListeners() {
    if (nickForm) {
        nickForm.addEventListener("submit", handleNickFormSubmit);
    }
    if (modalCreateForm) {
        modalCreateForm.addEventListener("submit", handleModalCreateFormSubmit);
    }
    if (refreshRoom) {
        refreshRoom.addEventListener("click", handleRefreshRoom);
    }
    if (readyButton) {
        readyButton.addEventListener('click', function() {
            ready();
        });
    }
    
    // 방 만들기 모달이 열릴 때 이벤트
    const createRoomModal = document.getElementById('modal_createRoom');
    if (createRoomModal) {
        createRoomModal.addEventListener('shown.bs.modal', function () {
            // 모달이 완전히 보여진 후 입력란에 포커스
            if (modalRoomName) {
                modalRoomName.focus();
            }
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
    // 서버 연결 완료 → 로딩 화면 숨기기
    hideLoadingScreen();
    mySocketId = socket.id;
    if (connectStatus) {
        connectStatus.textContent = '연결됨';
        connectStatus.className = 'badge bg-success me-2';
    }

    user.push({nickname : msg.nickname});
    nick.textContent = msg.nickname;

    rooms.innerHTML = "";
    let lis = "";
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
        document.body.classList.add('in-game');

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
                `<div class="player-card ${user.readyStatus || ''} ${user.manager ? 'manager' : ''}" id="${user.id}">
                    <div class="player-info">
                        <div class="player-avatar">
                            ${user.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="player-details">
                            <h6>${user.name}</h6>
                            <div class="player-status">
                                <span class="status-badge status-${user.readyStatus || 'waiting'}">
                                    ${getStatusText(user.readyStatus)}
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
        updateWaitingBar(users, roomInfo.maxUserCnt);

        // CSS 재렌더링 강제 (Reflow 유도)
        void userList.offsetHeight;
        setReadyButtonEnabled(true);

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
        document.body.classList.add('in-game');

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
                `<div class="player-card ${user.readyStatus || ''} ${user.manager ? 'manager' : ''}" id="${user.id}">
                    <div class="player-info">
                        <div class="player-avatar">
                            ${user.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="player-details">
                            <h6>${user.name}</h6>
                            <div class="player-status">
                                <span class="status-badge status-${user.readyStatus || 'waiting'}">
                                    ${getStatusText(user.readyStatus)}
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
        
        updateWaitingBar(users, roomInfo.maxUserCnt);
        console.log('successJoinRoom HTML 생성 완료:', userListHtml);
        setReadyButtonEnabled(true);
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
                `<div class="player-card ${user.readyStatus || ''} ${user.manager ? 'manager' : ''}" id="${user.id}">
                    <div class="player-info">
                        <div class="player-avatar">
                            ${user.name.charAt(0).toUpperCase()}
                        </div>
                        <div class="player-details">
                            <h6>${user.name}</h6>
                            <div class="player-status">
                                <span class="status-badge status-${user.readyStatus || 'waiting'}">
                                    ${getStatusText(user.readyStatus)}
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
    document.body.classList.remove('in-game');
    headCount.textContent = "0/0";
    setReadyButtonEnabled(true);

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
    userList.innerHTML = userListHtml;
    updateWaitingBar(users, maxUserCnt);

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

        // 준비 진행바 업데이트
        const readyCount = users.filter(u => u.readyStatus === 'ready').length;
        const totalCount = users.length;
        const pct = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;

        const fill = document.getElementById('readyProgressFill');
        const badge = document.getElementById('readyCountBadge');
        const dot   = document.getElementById('waitingDot');
        const text  = document.getElementById('waitingStatusText');

        if (fill)  fill.style.width = pct + '%';
        if (badge) badge.textContent = `${readyCount} / ${totalCount} 준비`;
        if (dot)   dot.classList.toggle('all-ready', readyCount === totalCount && totalCount > 0);
        if (text)  text.textContent = readyCount === totalCount && totalCount > 0
            ? '모든 플레이어 준비완료!'
            : `${readyCount}명 준비 완료 (${totalCount - readyCount}명 대기)`;

        console.log('updateReadyStatus 완료');
    } catch (error) {
        console.error('updateReadyStatus 에러:', error);
    }
});



// ──────────────────────────────────────────
// 게임 시작 카운트다운 오버레이
// ──────────────────────────────────────────
const countdownOverlay = document.getElementById('countdownOverlay');
const countdownNumber  = document.getElementById('countdownNumber');
const countdownSub     = document.getElementById('countdownSub');

function showCountdown(n, sub) {
    if (!countdownOverlay) return;
    countdownOverlay.style.display = 'flex';
    if (countdownNumber) {
        countdownNumber.textContent = n;
        countdownNumber.className = 'countdown-number' + (n === 'GO!' ? ' go' : '');
        // 팝 애니메이션 재실행
        countdownNumber.style.animation = 'none';
        countdownNumber.offsetHeight; // reflow
        countdownNumber.style.animation = '';
    }
    if (countdownSub && sub) countdownSub.textContent = sub;
}

function hideCountdown() {
    if (countdownOverlay) countdownOverlay.style.display = 'none';
}

socket.on('gameCountdownStart', ({ total }) => {
    showCountdown(total, '모든 플레이어가 준비되었습니다!');
    // 대기 상태 바 업데이트
    const dot  = document.getElementById('waitingDot');
    const text = document.getElementById('waitingStatusText');
    if (dot)  { dot.classList.add('all-ready'); }
    if (text) { text.textContent = '게임 시작 중...'; }
});

socket.on('gameCountdown', ({ secondsLeft }) => {
    showCountdown(secondsLeft, '게임이 곧 시작됩니다!');
});

socket.on('gameCountdownCanceled', ({ reason }) => {
    hideCountdown();
    if (reason !== 'completed') {
        showNotification('게임 시작이 취소되었습니다. (조건 변경)', 'warning');
        setReadyButtonEnabled(true);
    }
});

// 서버의 실제 시작 이벤트 수신
socket.on('gameStart', ({ message, gameData }) => {
    showCountdown('GO!', '');
    setTimeout(hideCountdown, 900);
    console.log('게임 시작:', gameData);
    showNotification(message || '게임이 시작됩니다!', 'success');
    if (gameData) {
        if (gameData.players && Array.isArray(gameData.players)) {
            updatePlayerList(gameData.players);
        }
        showGameUI(gameData);
    }
    setReadyButtonEnabled(false);
});

// 서버가 내 핸드를 개별로 내려줌
let mySocketId = null;
let isMyTurn = false;
socket.on('yourHand', ({ cards }) => {
    console.log('내 핸드 수신:', cards);
    if (Array.isArray(cards)) {
        renderMyCards(cards);
        // 내 덱 업데이트 (플레이어 카드 영역에)
        updateMyDeckInPlayerCard(cards);
    }
});

// 카드를 낸 후 업데이트
socket.on('cardPlayed', (data) => {
    console.log('카드 플레이 결과:', data);
    // 중앙에 카드 추가 표시
    if (data.result && data.result.playedCard) {
        addCenterCard(data.playerId, data.playerName, data.result.playedCard);
    }
});

// 게임 상태 수신
socket.on('gameState', (state) => {
    console.log('게임 상태 수신:', state);
    // 플레이어 카드 수 업데이트
    updatePlayerCardCounts(state.players);
    // 현재 턴 표시
    updateTurnIndicator(state.currentTurn, state.players);
    // 버림 카드 더미 업데이트
    updateDiscardPile(state.discardedCards || []);
});

// 게임 종료 이벤트
socket.on('gameEnd', (data) => {
    console.log('게임 종료:', data);
    showGameEnd(data);
    setReadyButtonEnabled(true);
});

// 할리갈리 결과 이벤트
socket.on('halliGalliResult', (data) => {
    console.log('할리갈리 결과:', data);
    
    const bell = document.getElementById('halliGalliBell');
    if (!bell) return;
    
    if (data.success) {
        // 성공 시 효과
        showHalliGalliSuccess(data);
        bell.classList.add('bell-success');
        setTimeout(() => bell.classList.remove('bell-success'), 1000);
        
        // 중앙 카드 더미 및 버림 카드 더미 비우기
        clearAllCenterCards();
        clearDiscardPile();
    } else {
        // 실패 시 효과
        showHalliGalliFailure(data);
        bell.classList.add('bell-failure');
        setTimeout(() => bell.classList.remove('bell-failure'), 500);
        
        // 실패 시 버림 카드 더미에 추가
        if (data.discardedCard) {
            updateDiscardPile(data.discardedCards || []);
        }
    }
});

function showGameUI(gameData) {
    console.log('showGameUI 호출됨:', gameData);
    // 게임 보드 영역 보이기
    const gameBoard = document.querySelector('.game-board');
    if (gameBoard) {
        gameBoard.style.display = 'flex';
    }
    
    // 중앙 플레이어별 카드 더미 초기화
    if (gameData && gameData.players) {
        initializePlayerStacks(gameData.players);
    }
}

/**
 * 중앙에 플레이어별 카드 더미 영역 초기화
 */
function initializePlayerStacks(players) {
    if (!Array.isArray(players)) return;
    
    const playerStacks = document.getElementById('playerStacks');
    if (!playerStacks) return;
    
    playerStacks.innerHTML = '';
    
    players.forEach(player => {
        const stackContainer = document.createElement('div');
        stackContainer.className = 'player-stack';
        stackContainer.id = `stack-${player.id}`;
        
        // 플레이어 이름과 카드 수
        const playerInfo = document.createElement('div');
        playerInfo.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        `;
        
        const playerName = document.createElement('div');
        playerName.className = 'player-stack-name';
        playerName.textContent = player.name || 'Unknown';
        
        const cardCount = document.createElement('div');
        cardCount.className = 'player-stack-count';
        cardCount.id = `stack-count-${player.id}`;
        cardCount.style.cssText = `
            background: #6366f1;
            color: white;
            padding: 4px 8px;
            border-radius: 0.5rem;
            font-size: 12px;
            font-weight: bold;
        `;
        cardCount.textContent = `🃏 ${player.cardCount || 0}`;
        
        playerInfo.appendChild(playerName);
        playerInfo.appendChild(cardCount);
        
        const stackCards = document.createElement('div');
        stackCards.className = 'player-stack-cards';
        stackCards.id = `stack-cards-${player.id}`;
        
        // 초기 플레이스홀더
        const placeholder = document.createElement('div');
        placeholder.className = 'stack-placeholder';
        placeholder.textContent = '대기중';
        stackCards.appendChild(placeholder);
        
        stackContainer.appendChild(playerInfo);
        stackContainer.appendChild(stackCards);
        playerStacks.appendChild(stackContainer);
    });
}

/**
 * 모든 플레이어의 덱 표시 초기화
 */
function initializePlayerDecks(players) {
    if (!Array.isArray(players)) return;
    
    players.forEach(player => {
        const playerCard = document.getElementById(player.id);
        if (playerCard) {
            // 기존 덱 영역 제거
            const existingDeck = playerCard.querySelector('.player-deck-area');
            if (existingDeck) {
                existingDeck.remove();
            }
            
            // 덱 영역 생성
            const deckArea = document.createElement('div');
            deckArea.className = 'player-deck-area';
            deckArea.setAttribute('data-player-id', player.id);
            deckArea.style.cssText = `
                margin-top: 0.5rem;
                display: flex;
                justify-content: center;
                align-items: center;
            `;
            
            // 덱 카드 (뒷면) - 다른 플레이어용
            const deckCard = document.createElement('div');
            deckCard.className = 'deck-card back-card';
            deckCard.style.cssText = `
                width: 70px;
                height: 100px;
                background: linear-gradient(135deg, #6366f1, #4f46e5);
                border: 2px solid #4f46e5;
                border-radius: 0.5rem;
                display: flex;
                justify-content: center;
                align-items: center;
                color: white;
                font-size: 32px;
                font-weight: bold;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                cursor: default;
            `;
            deckCard.innerHTML = '🃏';
            deckArea.appendChild(deckCard);
            
            playerCard.appendChild(deckArea);
        }
    });
}

/**
 * 내 덱을 플레이어 카드 영역에 업데이트 (맨 위 카드 표시 + 클릭 가능)
 */
function updateMyDeckInPlayerCard(cards) {
    if (!socket || !socket.id) return;
    
    const myPlayerCard = document.getElementById(socket.id);
    if (!myPlayerCard) return;
    
    const deckArea = myPlayerCard.querySelector('.player-deck-area');
    if (!deckArea) return;
    
    // 기존 덱 카드 제거
    deckArea.innerHTML = '';
    
    if (cards.length > 0) {
        // 카드를 뒷면으로 표시 (카드를 내기 전까지는 뒷면)
        const deckCard = document.createElement('button');
        deckCard.type = 'button';
        deckCard.className = 'deck-card my-deck-card back-card';
        deckCard.style.cssText = `
            width: 70px;
            height: 100px;
            background: linear-gradient(135deg, #10b981, #059669);
            border: 3px solid #10b981;
            border-radius: 0.5rem;
            display: flex;
            justify-content: center;
            align-items: center;
            color: white;
            font-size: 32px;
            font-weight: bold;
            box-shadow: 0 4px 6px rgba(0,0,0,0.2);
            cursor: pointer;
            transition: all 0.2s;
        `;
        deckCard.innerHTML = '🃏';
        deckCard.onmouseover = () => {
            deckCard.style.transform = 'translateY(-5px) scale(1.05)';
            deckCard.style.boxShadow = '0 6px 12px rgba(0,0,0,0.3)';
        };
        deckCard.onmouseout = () => {
            deckCard.style.transform = 'translateY(0) scale(1)';
            deckCard.style.boxShadow = '0 4px 6px rgba(0,0,0,0.2)';
        };
        TDTouch.addFastClick(deckCard, () => playCard(0));
        deckArea.appendChild(deckCard);
    } else {
        // 카드가 없을 때
        const emptyDeck = document.createElement('div');
        emptyDeck.className = 'deck-card empty';
        emptyDeck.style.cssText = `
            width: 70px;
            height: 100px;
            background: #e5e7eb;
            border: 2px dashed #9ca3af;
            border-radius: 0.5rem;
            display: flex;
            justify-content: center;
            align-items: center;
            color: #6b7280;
            font-size: 12px;
        `;
        emptyDeck.textContent = '덱 비움';
        deckArea.appendChild(emptyDeck);
    }
}

function renderMyCards(cards) {
    // 하단 내 덱 영역에 표시
    const myDeckCard = document.getElementById('myDeckCard');
    if (!myDeckCard) {
        console.error('myDeckCard 영역을 찾을 수 없습니다');
        return;
    }
    
    myDeckCard.innerHTML = '';
    
    if (cards.length > 0) {
        const deckCard = document.createElement('button');
        deckCard.type = 'button';
        deckCard.className = 'deck-card card-back style-pattern';
        deckCard.innerHTML = `
            <div class="card-back-pattern"></div>
            <div style="position:relative; z-index:1; color:#fbbf24; font-size:16px; font-weight:bold; text-shadow: 0 2px 6px rgba(0,0,0,0.8);">
                ${cards.length}장
            </div>
            <div style="position:relative; z-index:1; color:#fde047; font-size:12px; margin-top:6px; font-weight:600; text-shadow: 0 1px 4px rgba(0,0,0,0.8);">
                클릭하여 플레이
            </div>
        `;
        TDTouch.addFastClick(deckCard, () => playCard(0));
        myDeckCard.appendChild(deckCard);
    } else {
        // 카드가 없을 때
        const emptyCard = document.createElement('div');
        emptyCard.style.cssText = `
            width: 110px;
            height: 160px;
            border: 2px dashed rgba(255, 255, 255, 0.3);
            border-radius: 0.75rem;
            display: flex;
            justify-content: center;
            align-items: center;
            color: rgba(255, 255, 255, 0.5);
            font-size: 14px;
        `;
        emptyCard.textContent = '덱 비움';
        myDeckCard.appendChild(emptyCard);
    }
    
    console.log(`내 카드 ${cards.length}장 (하단 덱에 표시됨)`);
}

/**
 * 플레이어의 카드 더미에 카드 추가
 */
function addCenterCard(playerId, playerName, card) {
    const stackCards = document.getElementById(`stack-cards-${playerId}`);
    if (!stackCards) {
        console.error(`플레이어 ${playerId}의 카드 더미를 찾을 수 없습니다`);
        return;
    }

    // 기존 placeholder 제거
    const placeholder = stackCards.querySelector('.stack-placeholder');
    if (placeholder) {
        placeholder.remove();
    }

    // 기존 카드들을 약간 뒤로 밀어내기
    const existingCards = stackCards.querySelectorAll('.stack-card');
    existingCards.forEach((card, idx) => {
        card.style.transform = `translateY(${(idx + 1) * 3}px)`;
        card.style.zIndex = idx;
    });

    // 새 카드 추가 (맨 위)
        const cardElement = document.createElement('div');
    cardElement.className = 'stack-card';
    cardElement.style.zIndex = existingCards.length;
    cardElement.innerHTML = `
        <div style="font-size:36px; margin-bottom:4px;">${getFruitEmoji(card.fruit)}</div>
        <div style="font-size:24px; font-weight:bold; color:#333;">${card.count}</div>
    `;
    
    stackCards.appendChild(cardElement);
    
    // 최대 3장까지만 보이게 (오래된 카드 제거)
    const allCards = stackCards.querySelectorAll('.stack-card');
    if (allCards.length > 3) {
        allCards[0].remove();
    }
}

/**
 * 버림 카드 더미 업데이트
 */
function updateDiscardPile(discardedCards) {
    const discardPile = document.getElementById('discardPile');
    const discardCount = document.getElementById('discardCount');
    
    if (!discardPile || !discardCount) return;
    
    // 카드 수 업데이트
    discardCount.textContent = `${discardedCards.length}장`;
    
    // 버림 카드가 없으면 플레이스홀더 표시
    if (discardedCards.length === 0) {
        discardPile.innerHTML = '<div class="discard-placeholder">버림 카드 없음</div>';
        return;
    }
    
    // 맨 위 카드 표시 (가장 최근에 버린 카드)
    const topCard = discardedCards[discardedCards.length - 1];
    discardPile.innerHTML = `
        <div class="discard-card">${getFruitEmoji(topCard.fruit)}</div>
        <div class="discard-card-count">${topCard.count}</div>
    `;
}

/**
 * 버림 카드 더미 비우기 (할리갈리 성공 시)
 */
function clearDiscardPile() {
    const discardPile = document.getElementById('discardPile');
    const discardCount = document.getElementById('discardCount');
    
    if (!discardPile || !discardCount) return;
    
    // 페이드아웃 애니메이션
    discardPile.style.transition = 'all 0.3s ease-out';
    discardPile.style.opacity = '0';
    discardPile.style.transform = 'scale(0.8)';
    
    setTimeout(() => {
        discardPile.innerHTML = '<div class="discard-placeholder">버림 카드 없음</div>';
        discardCount.textContent = '0장';
        discardPile.style.opacity = '1';
        discardPile.style.transform = 'scale(1)';
    }, 300);
}

/**
 * 모든 플레이어의 중앙 카드 더미 비우기 (할리갈리 성공 시)
 */
function clearAllCenterCards() {
    const playerStacks = document.getElementById('playerStacks');
    if (!playerStacks) return;
    
    const allStackCards = playerStacks.querySelectorAll('.player-stack-cards');
    allStackCards.forEach(stackCards => {
        // 모든 카드 제거
        const cards = stackCards.querySelectorAll('.stack-card');
        cards.forEach(card => {
            // 페이드아웃 애니메이션 추가
            card.style.transition = 'all 0.3s ease-out';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.5)';
            setTimeout(() => card.remove(), 300);
        });
        
        // 플레이스홀더 다시 추가
        setTimeout(() => {
            if (stackCards.children.length === 0) {
                const placeholder = document.createElement('div');
                placeholder.className = 'stack-placeholder';
                placeholder.textContent = '대기중';
                stackCards.appendChild(placeholder);
            }
        }, 350);
    });
}

/**
 * 플레이어 카드 수 업데이트
 */
function updatePlayerCardCounts(players) {
    if (!Array.isArray(players)) return;
    
    players.forEach(player => {
        // 중앙 더미의 카드 수 업데이트
        const stackCount = document.getElementById(`stack-count-${player.id}`);
        if (stackCount) {
            stackCount.textContent = `🃏 ${player.cardCount || 0}`;
        }
        
        // 플레이어 카드 영역의 카드 수도 업데이트 (호환성)
        const playerCard = document.getElementById(player.id);
        if (playerCard) {
            let cardCountBadge = playerCard.querySelector('.card-count-badge');
            if (!cardCountBadge) {
                cardCountBadge = document.createElement('div');
                cardCountBadge.className = 'card-count-badge';
                cardCountBadge.style.cssText = `
                    position: absolute;
                    top: 0.5rem;
                    left: 0.5rem;
                    background: linear-gradient(135deg, #6366f1, #4f46e5);
                    color: white;
                    padding: 0.25rem 0.5rem;
                    border-radius: 0.375rem;
                    font-size: 0.75rem;
                    font-weight: 600;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                `;
                playerCard.appendChild(cardCountBadge);
            }
            cardCountBadge.innerHTML = `🃏 ${player.cardCount}장`;
        }
    });
}

/**
 * 현재 턴 표시 (중앙 카드 더미에)
 */
function updateTurnIndicator(currentTurn, players) {
    if (!Array.isArray(players)) return;
    
    let myTurnNow = false;
    players.forEach((player, idx) => {
        const playerCard = document.getElementById(player.id);
        const stackContainer = document.getElementById(`stack-${player.id}`);
        if (!stackContainer) return;
        
        let badge = stackContainer.querySelector('.turn-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'turn-badge';
            badge.style.cssText = `
                background: rgba(15, 23, 42, 0.7);
                color: #fff;
                padding: 4px 12px;
                border-radius: 999px;
                font-size: 12px;
                font-weight: 600;
                margin-top: 6px;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            `;
            stackContainer.appendChild(badge);
        }
        
        const stackCards = stackContainer.querySelector('.player-stack-cards');
        if (stackCards) {
            stackCards.style.border = 'none';
            stackCards.style.boxShadow = 'none';
        }
        
        if (playerCard) {
            playerCard.classList.remove('active-turn');
        }
        
        if (idx === currentTurn) {
            const isMine = player.id === mySocketId;
            badge.textContent = isMine ? '내 턴' : '상대 턴';
            badge.style.background = isMine ? '#0ea5e9' : '#f97316';
            badge.style.animation = 'pulse 1s infinite';
            if (stackCards) {
                const color = isMine ? '#0ea5e9' : '#f97316';
                stackCards.style.border = `3px solid ${color}`;
                stackCards.style.boxShadow = `0 0 20px ${isMine ? 'rgba(14,165,233,0.35)' : 'rgba(249,115,22,0.35)'}`;
                stackCards.style.borderRadius = '0.5rem';
            }

            if (playerCard) {
                playerCard.classList.add('active-turn');
            }

            if (isMine) {
                myTurnNow = true;
            }
        } else {
            if (player.id === mySocketId) {
                badge.textContent = '상대 턴';
                badge.style.background = 'rgba(15,23,42,0.7)';
            } else {
                badge.textContent = '';
                badge.style.background = 'transparent';
            }
            badge.style.animation = 'none';
        }
    });
    isMyTurn = myTurnNow;
}

/**
 * 카드 내기
 */
function playCard(cardIndex) {
    if (typeof isMyTurn !== 'undefined' && !isMyTurn) {
        showNotification('당신의 턴이 아닙니다!', 'warning');
        return;
    }
    socket.emit('playCard', cardIndex);
}

/**
 * 할리갈리 버튼 클릭
 */
function halliGalli() {
    const bell = document.getElementById('halliGalliBell');
    if (bell) {
        bell.classList.add('bell-pressed');
        playBellSound();
        setTimeout(() => bell.classList.remove('bell-pressed'), 300);
    }
    socket.emit('halliGalli');
}

/**
 * 벨 소리 재생 (Web Audio API 사용)
 */
function playBellSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
        console.log('Sound playback not available:', error);
    }
}

/**
 * 할리갈리 성공 표시
 */
function showHalliGalliSuccess(data) {
    const notification = document.createElement('div');
    notification.className = 'halli-galli-notification success';
    
    // 중앙 카드와 버림 카드 획득 정보 표시
    const centerInfo = data.centerCardsGained > 0 ? `중앙 ${data.centerCardsGained}장` : '';
    const discardInfo = data.discardedCardsGained > 0 ? `버림 ${data.discardedCardsGained}장` : '';
    const cardInfo = [centerInfo, discardInfo].filter(s => s).join(' + ');
    
    notification.innerHTML = `
        <div class="notification-icon">🎉</div>
        <div class="notification-text">
            <strong>${data.playerName}님이 할리갈리 성공!</strong>
            <div class="notification-score">+${data.scoreGained}점 획득! ${cardInfo ? `(${cardInfo})` : ''}</div>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

/**
 * 할리갈리 실패 표시
 */
function showHalliGalliFailure(data) {
    const notification = document.createElement('div');
    notification.className = 'halli-galli-notification failure';
    notification.innerHTML = `
        <div class="notification-icon">❌</div>
        <div class="notification-text">
            <strong>${data.playerName}님이 할리갈리 실패!</strong>
            <div class="notification-score">카드 1장 버림</div>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
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
        if (window.TDTouch) TDTouch.addFastClick(btn, halliGalli);
        else btn.onclick = halliGalli;
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
    
}

/**
 * 게임 종료 표시
 */
function showGameEnd(data) {
    if (!socket || !socket.id) return;
    
    const winner = data.winner;
    const finalScores = data.finalScores;
    const isWinner = winner.id === socket.id;
    
    // 게임 종료 콘텐츠 생성
    const gameEndContent = document.getElementById('gameEndContent');
    if (!gameEndContent) return;
    
    gameEndContent.innerHTML = `
        <div class="game-end-result ${isWinner ? 'victory' : 'defeat'}">
            <div class="${isWinner ? 'victory-icon' : 'defeat-icon'}">
                ${isWinner ? '🏆' : '😢'}
            </div>
            <div class="game-end-title">
                ${isWinner ? 'VICTORY!' : 'DEFEAT'}
            </div>
            <div class="game-end-subtitle">
                ${isWinner ? '축하합니다! 승리하셨습니다!' : '다음 기회에...'}
            </div>
        </div>
    `;
    
    // 최종 점수 리스트 생성
    const finalScoresList = document.getElementById('finalScoresList');
    if (!finalScoresList) return;
    
    finalScoresList.innerHTML = '';
    
    // 카드 수 순으로 정렬
    const sortedScores = [...finalScores].sort((a, b) => (b.cardCount || 0) - (a.cardCount || 0));
    
    sortedScores.forEach((player, index) => {
        const scoreItem = document.createElement('div');
        scoreItem.className = `score-item ${player.id === winner.id ? 'winner' : ''}`;
        scoreItem.innerHTML = `
            <span class="score-name">${player.name}</span>
            <span class="score-value">${player.cardCount || 0}장 (${player.score}점)</span>
        `;
        finalScoresList.appendChild(scoreItem);
    });
    
    // 모달 표시
    const gameEndModal = new bootstrap.Modal(document.getElementById('gameEndModal'));
    gameEndModal.show();

    // 게임 종료 광고 표시
    if (window.TDAds && TDAds.enabled) {
        TDAds.renderAd('adGameEnd', window.__ADSENSE_GAME_END_SLOT__ || '', 'rectangle');
    }

    // 승리 시 효과음/애니메이션 (선택사항)
    if (isWinner) {
        playVictoryEffect();
    }
}

/**
 * 게임 종료 모달 닫기
 */
function closeGameEndModal() {
    const gameEndModal = bootstrap.Modal.getInstance(document.getElementById('gameEndModal'));
    if (gameEndModal) {
        gameEndModal.hide();
    }
    
    // 게임 보드 숨기고 대기실로 돌아가기
    const gameBoard = document.querySelector('.game-board');
    if (gameBoard) {
        gameBoard.style.display = 'none';
    }
}

/**
 * 승리 효과 (선택사항)
 */
function playVictoryEffect() {
    // 간단한 색종이 효과
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            createConfetti();
        }, i * 30);
    }
}

/**
 * 색종이 조각 생성
 */
function createConfetti() {
    const confetti = document.createElement('div');
    confetti.style.cssText = `
        position: fixed;
        width: 10px;
        height: 10px;
        background: ${['#ff0', '#f0f', '#0ff', '#0f0', '#f00'][Math.floor(Math.random() * 5)]};
        left: ${Math.random() * 100}vw;
        top: -10px;
        opacity: 1;
        pointer-events: none;
        z-index: 9999;
        animation: confetti 3s linear forwards;
    `;
    document.body.appendChild(confetti);
    
    setTimeout(() => {
        confetti.remove();
    }, 3000);
}
