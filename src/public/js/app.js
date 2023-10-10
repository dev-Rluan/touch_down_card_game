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
const roomId = document.getElementById("roomId");



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
    user.push({nickname : msg.nickname});
    nick.textContent = msg.nickname;

    rooms.innerHTML = "";
    let lis = "";    
    debugger;
    const roomList = msg.roomList;
    if(isEmptyArr(roomList)){
        rooms.innerHTML = `<li>현재 생성된 방이 없습니다.</li>`;
        return;
    }
    roomList.forEach(room => {
        console.log('here');
        lis += `<li><span style='margin-right: 5px'>${room.users.length}/${room.maxUserCnt} | </span>룸 이름 :  ${room.name} <button style='float:right' onclick="joinRoom('${room.id}')">방입장</button></li>    `;
        console.log(room);
        
      });
    rooms.innerHTML = lis;

    connectStatus.textContent = `연결 성공`;
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
        rooms.innerHTML = `<li>현재 생성된 방이 없습니다.</li>`;
        return;
    }
    console.log('GGGG: ');
   

    
    roomList.forEach(room => {
        console.log('here');
        lis += `<li><span style='margin-right: 5px'>${room.users.length}/${room.maxUserCnt} | </span>룸 이름 :  ${room.name} <button style='float:right' onclick="joinRoom('${room.id}')">방입장</button></li>    `;
        console.log(room);
        
        });
        
    
    rooms.innerHTML = lis;
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
        headCount.textContent = users.length ;
        let userListHtml = '';
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
// 방 입장 성공
socket.on('successJoinRoom', (roomInfo) =>{
    console.log('방입장 성공');
    lobby.style.display = 'none';
    gameroom.style.display = 'block';
    roomname.innerText=roomInfo.name;
    console.log("roomInfo : " + roomInfo);
    roomId.value = roomInfo.id;

        const users = roomInfo.users;
        maxUserCnt = roomInfo.maxUserCnt;
        headCount.textContent = users.length + " / " + maxUserCnt;
        let userListHtml = '';
        users.forEach(user => {
            const userItem = document.createElement('li');
            userItem.textContent = user.name;
            
            userListHtml  += 
            `<div id="${user.id}">
                <div class="row">
                    <div class="col"><span>user : ${user.name}</span></div>
                    <div class="col"><span>status : ${user.readyStatus}</span></div>
                </div>
            </div>`;
            
            // const userItem = document.createElement('li');
            // userItem.textContent =user.name;
            console.log('user : ' + user.id);

            // headCount.appendChild(userItem);
        });
        userList.innerHTML=userListHtml;
})

socket.on('joinUser', (users, maxUserCnt)=>{

    console.log('joinUser list : ' + users);        
    headCount.textContent = users.length + " / " + maxUserCnt;
    
    let userListHtml = '';
    users.forEach(user => {
        const userItem = document.createElement('li');
        userItem.textContent = user.name;
        
        userListHtml  += 
        `<div id="${user.id}">
            <div class="row">
                <div class="col"><span>user : ${user.name}</span></div>
                <div class="col"><span>status : ${user.readyStatus}</span></div>
            </div>
        </div>`;
        
        // const userItem = document.createElement('li');
        // userItem.textContent =user.name;
        console.log('user : ' + user.id);

        // headCount.appendChild(userItem);
    });
    // userListHtml  += `<div class="row"><div class="col"><span>user : ${userInfo.name}</span></div>
    // <div class="col"><span>status : ${userInfo.readyStatus}</span></div></div>`;
    userList.innerHTML=userListHtml;

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

socket.on('leaveUser', (users)=>{
    headCount.textContent = users.length + " / " + maxUserCnt;
    
    let userListHtml = '';
    users.forEach(user => {
        const userItem = document.createElement('li');
        userItem.textContent = user.name;
        
        userListHtml  += 
        `<div id="${user.id}">
            <div class="row">
                <div class="col"><span>user : ${user.name}</span></div>
                <div class="col"><span>status : ${user.readyStatus}</span></div>
            </div>
        </div>`;
        
        // const userItem = document.createElement('li');
        // userItem.textContent =user.name;
        console.log('user : ' + user.id);

        // headCount.appendChild(userItem);
    });
    // userListHtml  += `<div class="row"><div class="col"><span>user : ${userInfo.name}</span></div>
    // <div class="col"><span>status : ${userInfo.readyStatus}</span></div></div>`;
    userList.innerHTML=userListHtml;

   
})
// socket end

