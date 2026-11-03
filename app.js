import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 📌 1. Firebase 설정 (싱가포르 리전 databaseURL 적용 완료)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY", 
  authDomain: "aisystem-myproject.firebaseapp.com",
  databaseURL: "https://aisystem-myproject-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "aisystem-myproject",
  storageBucket: "aisystem-myproject.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 📌 2. 공공데이터 API 설정
// ⚠️ 주의: 400 에러가 계속 난다면 공공데이터포털의 "Encoding 인증키"를 넣어보세요!
const API_KEY = "발급받은_인증키_입력"; 
const API_URL = "https://apis.data.go.kr/B551011/KorService1/areaBasedList1";

const selectEl = document.getElementById('areaCodeSelect');
const searchBtn = document.getElementById('searchBtn');
const tourGrid = document.getElementById('tourGrid');
const statusMsg = document.getElementById('statusMsg');

// 페이지 로드 시 Firebase 상태 확인
window.addEventListener('DOMContentLoaded', loadInitialData);

// [지침 1] 초기 로딩 시 Firebase에 저장된 지역 정보 확인
async function loadInitialData() {
  const dbRef = ref(db);
  try {
    const snapshot = await get(child(dbRef, 'userLastSelection'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      statusMsg.innerText = `마지막으로 저장된 지역(${data.areaName})의 정보입니다.`;
      selectEl.value = data.areaCode;
      renderItems(data.items);
    } else {
      statusMsg.innerText = "저장된 지역 정보가 없습니다. 지역을 선택해주세요.";
      tourGrid.innerHTML = "";
    }
  } catch (error) {
    console.error("Firebase 읽기 에러:", error);
    statusMsg.innerText = "초기 Firebase 데이터를 불러오는데 실패했습니다.";
    tourGrid.innerHTML = "";
  }
}

// [지침 2] 지역 선택 및 조회 버튼 클릭 시 동작
searchBtn.addEventListener('click', async () => {
  const areaCode = selectEl.value;
  const areaName = selectEl.options[selectEl.selectedIndex].text;

  if (!areaCode) {
    alert("지역을 선택해주세요.");
    return;
  }

  statusMsg.innerText = "관광 정보를 불러오는 중...";

  try {
    // 1. 공공데이터 API 호출
    const items = await fetchTourData(areaCode);
    
    // 2. 화면 표출
    renderItems(items);

    // 3. Firebase 저장
    await saveToFirebase(areaCode, areaName, items);

    statusMsg.innerText = `현재 표출 중인 지역: ${areaName} (Firebase 저장 완료)`;
  } catch (error) {
    console.error("최종 에러 발생:", error);
    statusMsg.innerText = `오류 발생: ${error.message}`;
  }
});

// 공공데이터 API Fetch 함수 (CORS 및 인증키 처리 강화)
async function fetchTourData(areaCode) {
  // 인증키에 포함된 % 문자가 중복 인코딩되지 않도록 encodeURI 처리
  const cleanKey = encodeURIComponent(decodeURIComponent(API_KEY));
  
  const requestUrl = `${API_URL}?serviceKey=${cleanKey}&numOfRows=12&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&listYN=Y&arrange=A&areaCode=${areaCode}`;

  console.log("요청 URL:", requestUrl);

  const response = await fetch(requestUrl);
  
  if (!response.ok) {
    throw new Error(`API 응답 실패 (상태 코드: ${response.status})`);
  }

  const textData = await response.text();
  
  // 응답 데이터가 JSON이 아닌 경우 (공공데이터 오류 XML 메시지 등)
  let data;
  try {
    data = JSON.parse(textData);
  } catch (e) {
    console.error("API 응답 내용(XML/TEXT):", textData);
    throw new Error("API에서 올바른 JSON 데이터를 반환하지 않았습니다. (콘솔 확인)");
  }

  const rawItems = data.response?.body?.items?.item || [];
  
  return rawItems.map(item => ({
    title: item.title,
    addr1: item.addr1 || '주소 정보 없음',
    image: item.firstimage || item.firstimage2 || 'https://via.placeholder.com/300x200?text=No+Image'
  }));
}

// 화면 렌더링 함수
function renderItems(items) {
  tourGrid.innerHTML = "";

  if (!items || items.length === 0) {
    tourGrid.innerHTML = "<p>조회된 관광지 정보가 없습니다.</p>";
    return;
  }

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img src="${item.image}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
      <div class="card-body">
        <h3 class="card-title">${item.title}</h3>
        <p class="card-text">${item.addr1}</p>
      </div>
    `;
    tourGrid.appendChild(card);
  });
}

// Firebase 데이터 저장 함수
async function saveToFirebase(areaCode, areaName, items) {
  await set(ref(db, 'userLastSelection'), {
    areaCode: areaCode,
    areaName: areaName,
    items: items,
    updatedAt: new Date().toISOString()
  });
}
