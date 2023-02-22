const socket = io();
const nickForm = document.getElementById("nickForm");
const nick = document.querySelector("nick");


function handleNickFormSubmit(event){
    // 기본 이벤트 막는 처리
    event.preventDefault();
    const input = nickForm.querySelector("input");
    socket.emit("change name", input.value);
    input.value='';
}
nickForm.addEventListener("submit", handleNickFormSubmit);

socket.on('change name', (msg)=>{
    const li = document.createElement('li');
    li.innerText = msg;
    document.getElementById('nick').appendChild(li);
})

socket.on('name change successful',(msg) => {
    console.log("결과:" + msg);
    document.getElementById('nick')
    .querySelector("li").textContent=msg;
})