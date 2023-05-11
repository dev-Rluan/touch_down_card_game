
// 기본 트럼프 카드팩
// 형식은 {num, emblem, status}
// num : 1 = 1~13까지
// emblem = [s(스페이드), d(다이아), c(클로버), h(하트)]
// status = [u(UP: 위(숫자)), d(DOWN : 아래(뒷면))] 
function setTrumpCardPack(){
   
    return [   
        {id : 0, num : 1, emblem: "s", status : "u"},
        {id : 1, num : 2, emblem: "s", status : "u"},
        {id : 2, num : 3, emblem: "s", status : "u"},
        {id : 3, num : 4, emblem: "s", status : "u"},
        {id : 4, num : 5, emblem: "s", status : "u"},
        {id : 5, num : 6, emblem: "s", status : "u"},
        {id : 6, num : 7, emblem: "s", status : "u"},
        {id : 7, num : 8, emblem: "s", status : "u"},
        {id : 8, num : 9, emblem: "s", status : "u"},
        {id : 9, num : 10, emblem: "s", status : "u"},
        {id : 10, num : 11, emblem: "s", status : "u"},
        {id : 11, num : 12, emblem: "s", status : "u"},
        {id : 12, num : 13, emblem: "s", status : "u"},
    
        {id : 13, num : 1, emblem: "d", status : "u"},
        {id : 14, num : 2, emblem: "d", status : "u"},
        {id : 15, num : 3, emblem: "d", status : "u"},
        {id : 16, num : 4, emblem: "d", status : "u"},
        {id : 17, num : 5, emblem: "d", status : "u"},
        {id : 18, num : 6, emblem: "d", status : "u"},
        {id : 19, num : 7, emblem: "d", status : "u"},
        {id : 20, num : 8, emblem: "d", status : "u"},
        {id : 21, num : 9, emblem: "d", status : "u"},
        {id : 22, num : 10, emblem: "d", status : "u"},
        {id : 23, num : 11, emblem: "d", status : "u"},
        {id : 24, num : 12, emblem: "d", status : "u"},
        {id : 25, num : 13, emblem: "d", status : "u"},
     
        {id : 26, num : 1, emblem: "c", status : "u"},
        {id : 27, num : 2, emblem: "c", status : "u"},
        {id : 28, num : 3, emblem: "c", status : "u"},
        {id : 29, num : 4, emblem: "c", status : "u"},
        {id : 30, num : 5, emblem: "c", status : "u"},
        {id : 31, num : 6, emblem: "c", status : "u"},
        {id : 32, num : 7, emblem: "c", status : "u"},
        {id : 33, num : 8, emblem: "c", status : "u"},
        {id : 34, num : 9, emblem: "c", status : "u"},
        {id : 35, num : 10, emblem: "c", status : "u"},
        {id : 36, num : 11, emblem: "c", status : "u"},
        {id : 37, num : 12, emblem: "c", status : "u"},
        {id : 38, num : 13, emblem: "c", status : "u"},
     
        {id : 39, num : 1, emblem: "h", status : "u"},
        {id : 40, num : 2, emblem: "h", status : "u"},
        {id : 41, num : 3, emblem: "h", status : "u"},
        {id : 42, num : 4, emblem: "h", status : "u"},
        {id : 43, num : 5, emblem: "h", status : "u"},
        {id : 44, num : 6, emblem: "h", status : "u"},
        {id : 45, num : 7, emblem: "h", status : "u"},
        {id : 46, num : 8, emblem: "h", status : "u"},
        {id : 47, num : 9, emblem: "h", status : "u"},
        {id : 48, num : 10, emblem: "h", status : "u"},
        {id : 49, num : 11, emblem: "h", status : "u"},
        {id : 50, num : 12, emblem: "h", status : "u"},
        {id : 51, num : 13, emblem: "h", status : "u"},
        
    ];
}
// 할리갈리 카드팩
function setTouchDownCardPack(){
    
    return  [   
        {id : 0, count : 1, emblem: "s", status : "u"},
        {id : 1, count : 1, emblem: "s", status : "u"},
        {id : 2, count : 1, emblem: "s", status : "u"},
        {id : 3, count : 1, emblem: "s", status : "u"},
        {id : 4, count : 1, emblem: "s", status : "u"},
        {id : 5, count : 2, emblem: "s", status : "u"},
        {id : 6, count : 2, emblem: "s", status : "u"},
        {id : 7, count : 2, emblem: "s", status : "u"},
        {id : 8, count : 3, emblem: "s", status : "u"},
        {id : 9, count : 3, emblem: "s", status : "u"},
        {id : 10, count : 3, emblem: "s", status : "u"},
        {id : 11, count : 4, emblem: "s", status : "u"},
        {id : 12, count : 4, emblem: "s", status : "u"},
        {id : 13, count : 5, emblem: "s", status : "u"},
    
        {id : 14, count : 1, emblem: "d", status : "u"},
        {id : 15, count : 1, emblem: "d", status : "u"},
        {id : 16, count : 1, emblem: "d", status : "u"},
        {id : 17, count : 1, emblem: "d", status : "u"},
        {id : 18, count : 1, emblem: "d", status : "u"},
        {id : 19, count : 2, emblem: "d", status : "u"},
        {id : 20, count : 2, emblem: "d", status : "u"},
        {id : 21, count : 2, emblem: "d", status : "u"},
        {id : 22, count : 3, emblem: "d", status : "u"},
        {id : 23, count : 3, emblem: "d", status : "u"},
        {id : 24, count : 3, emblem: "d", status : "u"},
        {id : 25, count : 4, emblem: "d", status : "u"},
        {id : 26, count : 4, emblem: "d", status : "u"},
        {id : 27, count : 5, emblem: "d", status : "u"},
     
        {id : 28, count : 1, emblem: "c", status : "u"},
        {id : 29, count : 1, emblem: "c", status : "u"},
        {id : 30, count : 1, emblem: "c", status : "u"},
        {id : 31, count : 1, emblem: "c", status : "u"},
        {id : 32, count : 1, emblem: "c", status : "u"},
        {id : 33, count : 1, emblem: "c", status : "u"},
        {id : 34, count : 2, emblem: "c", status : "u"},
        {id : 35, count : 2, emblem: "c", status : "u"},
        {id : 36, count : 3, emblem: "c", status : "u"},
        {id : 37, count : 3, emblem: "c", status : "u"},
        {id : 38, count : 3, emblem: "c", status : "u"},
        {id : 39, count : 4, emblem: "c", status : "u"},
        {id : 40, count : 4, emblem: "c", status : "u"},
        {id : 41, count : 5, emblem: "c", status : "u"},
     
        {id : 42, count : 1, emblem: "h", status : "u"},
        {id : 43, count : 1, emblem: "h", status : "u"},
        {id : 44, count : 1, emblem: "h", status : "u"},
        {id : 45, count : 1, emblem: "h", status : "u"},
        {id : 46, count : 1, emblem: "h", status : "u"},
        {id : 47, count : 2, emblem: "h", status : "u"},
        {id : 48, count : 2, emblem: "h", status : "u"},
        {id : 49, count : 2, emblem: "h", status : "u"},
        {id : 50, count : 3, emblem: "h", status : "u"},
        {id : 51, count : 3, emblem: "h", status : "u"},
        {id : 52, count : 3, emblem: "h", status : "u"},
        {id : 53, count : 4, emblem: "h", status : "u"},
        {id : 54, count : 4, emblem: "h", status : "u"},
        {id : 55, count : 5, emblem: "h", status : "u"},
        
    ];
    
}

function pullCard(cardPack, id ){
    let card = cardPack.find(item => item.id = id);

    cardPack.splice()
    
    return card;
}

function getCardByNum(cardPack, num){
    return cardPack[num];
}

function cardSuffle(cardPack){
    
    console.log("cardSuffle");
    return shuffleArray(cardPack);
}

function divideSuffleCardTd(cardPack, headCnt){
    console.log("divideSuffleCardTd in");
    if(headCnt < 2 || headCnt > 4){
        return;
    }
    cardSuffle();    
    let resultCards = [];
    console.log(headCnt);
    let cardCnt = cardPack.length/headCnt;
    for(let j = 1; j <= headCnt; j++){
        console.log("cardCnt : " + cardCnt);
        let cardList = [];
        for(let i =cardCnt*(j-1); i < cardCnt*j; i++ ){

            console.log("for count i =  " + i + " :  j = " + j);
            let card = getCardByNum(i);
            // console.log("card num: " , card);
            cardList.push(card);
        }
        if(headCnt==3 && j==3){
            let card = getCardByNum(cardCnt*j);
            console.log("card num: " + card);
            cardList.push(card);
        }
        resultCards.push(cardList);
    }
    
    return resultCards;
}


function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
} 

function checkCardSumTd(cardList){
    let sum =0;
    for(let i = 0; i < cardList.length; i++){
        sum += cardList[i].count;
    }
    return sum;
}
  

