import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 1. Firebase 설정 (본인의 Firebase 프로젝트 값으로 변경)
const firebaseConfig = {
  apiKey: "AIzaSyAcpMxtDgfZknnaF6UcHJD6PFoQj1iskYc",
  authDomain: "aisystem-myproject.firebaseapp.com",
  databaseURL: "https://aisystem-myproject-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "aisystem-myproject",
  storageBucket: "aisystem-myproject.firebasestorage.app",
  messagingSenderId: "932636835234",
  appId: "1:932636835234:web:64c457e9cb49050db806fb"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 공공데이터 API 설정 (Decoding 인증키 입력)
const API_KEY = "8df9681b1748b09a3badc6afff5e72bf6fba7f96507b697945782d3dcf7c4041"; 
const API_URL = "http://apis.data.go.kr/B551011/KorService2/areaBasedList2";

const selectEl = document.getElementById('areaCodeSelect');
const searchBtn = document.getElementById('searchBtn');
const tourGrid = document.getElementById('tourGrid');
const statusMsg = document.getElementById('statusMsg');

// 페이지 로드 시 Firebase 상태 확인
window.addEventListener('DOMContentLoaded', loadInitialData);

// [지침 준수 1] 처음 웹페이지 로딩 시 Firebase 데이터 확인 및 표출 처리
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
      // 저장된 정보가 없으면 시각화 목록 뷰 비움
      statusMsg.innerText = "저장된 지역 정보가 없습니다. 지역을 선택해주세요.";
      tourGrid.innerHTML = "";
    }
  } catch (error) {
    console.error("Firebase 읽기 에러:", error);
    statusMsg.innerText = "초기 데이터를 불러오는 중 오류가 발생했습니다.";
    tourGrid.innerHTML = "";
  }
}

// [지침 준수 2] 지역 선택 시 API 호출 → 목록 표출 → Firebase 데이터 업데이트
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
    
    // 2. 하단 화면에 목록 뷰 표출
    renderItems(items);

    // 3. Firebase에 실시간 저장/업데이트
    await saveToFirebase(areaCode, areaName, items);

    statusMsg.innerText = `현재 표출 중인 지역: ${areaName} (Firebase 저장 완료)`;
  } catch (error) {
    console.error("오류 발생:", error);
    statusMsg.innerText = "데이터를 불러오는 중 오류가 발생했습니다.";
  }
});

// 공공데이터 API Fetch 함수
async function fetchTourData(areaCode) {
  const params = new URLSearchParams({
    serviceKey: API_KEY,
    numOfRows: '12',
    pageNo: '1',
    MobileOS: 'ETC',
    MobileApp: 'AppTest',
    _type: 'json',
    listYN: 'Y',
    arrange: 'A',
    areaCode: areaCode
  });

  const response = await fetch(`${API_URL}?${params.toString()}`);
  const data = await response.json();
  
  const rawItems = data.response?.body?.items?.item || [];
  
  return rawItems.map(item => ({
    title: item.title,
    addr1: item.addr1 || '주소 정보 없음',
    image: item.firstimage || item.firstimage2 || 'https://via.placeholder.com/300x200?text=No+Image'
  }));
}

// 목록 뷰 렌더링 함수
function renderItems(items) {
  tourGrid.innerHTML = "";

  if (items.length === 0) {
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

// Firebase 데이터 업데이트 함수
async function saveToFirebase(areaCode, areaName, items) {
  await set(ref(db, 'userLastSelection'), {
    areaCode: areaCode,
    areaName: areaName,
    items: items,
    updatedAt: new Date().toISOString()
  });
}
