const socket = io();
const nickForm = document.getElementById("nickForm");
const nick = document.querySelector("nick");
const createForm = document.getElementById("createForm");
const connectStatus = document.getElementById("connectStatus");
const lobby = document.getElementById("lobby");
const gameroom = document.getElementById("gameroom");
const rooms = document.getElementById("rooms");
const refreshRoom = document.getElementById("refreshRoom");

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
    socket.emit("createRoom", input.value);
    input.value='';
}
function handleRefreshRoom(event){
    event.preventDefault();
    socket.emit("roomList");
}
// function end

// event start
nickForm.addEventListener("submit", handleNickFormSubmit);
createForm.addEventListener("submit", handleCreateFormSubmit);
refreshRoom.addEventListener("submit", handleRefreshRoom);
// event end

// recv socket start
// default 이름

socket.on('connecting', (msg)=>{
    const li = document.createElement('li');
    li.innerText = msg;
    document.getElementById('nick').appendChild(li);
    connectStatus.textContent = `연결 성공`;
})

socket.on('name change successful',(msg) => {
    document.getElementById('nick')
    .querySelector("li").textContent=msg;
})

// roomList
socket.on('roomList',(roomList) => {
    rooms.innerHTML = "";
    let lis = "";    
    roomList.forEach(function(room) {
        lis += `<li>룸 이름 :  ${room.name}</li>`;        
        console.log(room);
    });
    rooms.innerHTML = lis;
})

// 방 생성 결과 반환
socket.on('createResult',(data) => {
    if(data.success){
        console.log("test2");
        lobby.remove();       
        const ul = document.createElement('ul');
        const li = document.createElement('li');
        li.innerText=data.roomname;
        ul.appendChild(li);
        gameroom.appendChild(ul);
    } else {
                connectStatus.textContent = `에러: ${data.message}`;
    }
})
// 방 생성 실패
socket.on('createRoomError',(msg) =>{
    alert(msg);
})
// socket end

