const socket = io();
const nickForm = document.getElementById("nickForm");
const nick = document.getElementById("nick");
const createForm = document.getElementById("createForm");
const connectStatus = document.getElementById("connectStatus");
const lobby = document.getElementById("lobby");
const gameroom = document.getElementById("gameroom");
const rooms = document.getElementById("rooms");
const roomname = document.getElementById("roomname");
const headCount = document.getElementById("headCount");
const headCountList = document.getElementById("headCountList");
const refreshRoom = document.getElementById("refreshRoom");
const userList = document.getElementById("userList");

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
    socket.emit("roomList");
}
function handleCreateRoom(event){

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
    // const li = document.createElement('li');
    // li.innerText = msg;
    // document.getElementById('nick').appendChild(li);
    user.push({nickname : msg});
    nick.textContent = msg;

    connectStatus.textContent = `연결 성공`;
})

socket.on('name change successful',(msg) => {
    nick.textContent = msg;
    // document.getElementById('nick')
    // .querySelector("li").textContent=msg;
})

// roomList
socket.on('roomList', (roomInfos) => {
    // alert(roomInfos);
    console.log(roomInfos);
    console.log(roomInfos.name);
    console.log('룸 리스트 새로고침');
    const roomList = roomInfos;
    console.log(roomList);
    rooms.innerHTML = "";
    let lis = "";    
    
    for (const roomId in roomList) {
        console.log('here');
        if (roomList.hasOwnProperty(roomId)) {
          const room = roomList[roomId];
          lis += `<li>룸 이름 :  ${room.name}</li>`;        
          console.log(room);
        }
      }
    rooms.innerHTML = lis;
})
// 방 생성 성공
socket.on('roomCreated', (roomInfo)=>{
    lobby.style.display = 'none';
    gameroom.style.display = 'block'
    
        console.log(roomInfo);
        console.log(roomInfo.name)
        roomname.innerText=roomInfo.name;

        const users = roomInfo.users;
        headCount.textContent = users.length + " / " + roomInfo.maxUserCnt;
        // headCount.innerHtml = 
        
        console.log( "dd:" + users.length);
        console.log("ff:" + users);
        users.forEach(user => {
            const userItem = document.createElement('li');
            userItem.textContent =user.name;
            console.log('user : ' + user.id);

            // headCountList.appendChild(userItem);
        })
})


// 방 생성 결과 반환
socket.on('createResult',(data) => {
    if(data.success){        
        lobby.style.display = 'block';

        const roomInfo = data.roomInfo;
        console.log(data);
        console.log(roomInfo)
        roomname.innerText=roomInfo.name;

        const users = roomInfo.users;
        headCount.textContent = users.length;
       
        users.forEach(user => {
            const userItem = document.createElement('li');
            userItem.textContent =user.name;
            console.log('user : ' + user.id);

            headCount.appendChild(userItem);
        })

        
    } else {
                connectStatus.textContent = `에러: ${data.message}`;
    }
})
// 방 생성 실패
socket.on('createRoomError',(msg) =>{
    alert(msg);
})
// socket end

