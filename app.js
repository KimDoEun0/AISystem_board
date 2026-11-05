import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ===== [수정 1] Firebase 설정: 콘솔 > 프로젝트 설정 > 일반에서 복사 =====
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const TOUR_API_KEY = "YOUR_DECODING_KEY";

// ===== [수정 2] Tour API 디코딩 키 =====
const TOUR_API_KEY = "8df9681b1748b09a3badc6afff5e72bf6fba7f96507b697945782d3dcf7c4041";

// ===== [수정 3] 엔드포인트 (물음표 왼쪽, 버전 2, https) =====
const ENDPOINT = "https://apis.data.go.kr/B551011/KorService2/areaBasedList2";

// Tour API 지역코드
const AREAS = [
  { code: "1", name: "서울" },
  { code: "2", name: "인천" },
  { code: "3", name: "대전" },
  { code: "4", name: "대구" },
  { code: "5", name: "광주" },
  { code: "6", name: "부산" },
  { code: "7", name: "울산" },
  { code: "8", name: "세종특별자치시" },
  { code: "31", name: "경기도" },
  { code: "32", name: "강원" },
  { code: "33", name: "충청북도" },
  { code: "34", name: "충청남도" },
  { code: "35", name: "경상북도" },
  { code: "36", name: "경상남도" },
  { code: "37", name: "전북" },
  { code: "38", name: "전라남도" },
  { code: "39", name: "제주도" }
];

// Firebase 초기화 (votes와 겹치지 않게 appState 노드 사용)
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const stateRef = ref(db, "appState");

const areaSelect = document.getElementById("areaSelect");
const cardList = document.getElementById("cardList");
const statusEl = document.getElementById("status");

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function renderOptions() {
  AREAS.forEach((area) => {
    const option = document.createElement("option");
    option.value = area.code;
    option.textContent = area.name;
    areaSelect.appendChild(option);
  });
}

// 공공데이터 조회
async function fetchTourList(areaCode) {
  const params = new URLSearchParams({
    serviceKey: TOUR_API_KEY,
    numOfRows: "20",
    pageNo: "1",
    MobileOS: "ETC",
    MobileApp: "TourCardBook",
    _type: "json",
    arrange: "Q",          // 대표이미지가 있는 항목, 수정일순
    areaCode: areaCode
  });

  const response = await fetch(`${ENDPOINT}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`HTTP 오류: ${response.status}`);
  }

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // 키 오류 등은 XML로 오는 경우가 있음
    throw new Error("JSON이 아닌 응답: " + text.slice(0, 200));
  }

  const header = data?.response?.header;
  if (header && header.resultCode !== "0000") {
    throw new Error(`API 오류: ${header.resultCode} ${header.resultMsg}`);
  }

  const items = data?.response?.body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

// 카드 목록 시각화
function renderCards(items) {
  cardList.innerHTML = "";

  if (items.length === 0) {
    cardList.classList.add("hidden");
    setStatus("조회된 관광지가 없습니다.");
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "card";

    const imageUrl = (item.firstimage || item.firstimage2 || "").replace("http://", "https://");
    if (imageUrl) {
      const img = document.createElement("img");
      img.src = imageUrl;
      img.alt = item.title;
      img.loading = "lazy";
      card.appendChild(img);
    } else {
      const noImage = document.createElement("div");
      noImage.className = "no-image";
      noImage.textContent = "이미지 없음";
      card.appendChild(noImage);
    }

    const body = document.createElement("div");
    body.className = "body";

    const title = document.createElement("h3");
    title.textContent = item.title;

    const addr = document.createElement("p");
    addr.textContent = item.addr1 || "주소 정보 없음";

    body.appendChild(title);
    body.appendChild(addr);
    card.appendChild(body);
    cardList.appendChild(card);
  });

  cardList.classList.remove("hidden");
}

// 지역 조회 + 화면 표시
async function loadArea(areaCode) {
  const area = AREAS.find((a) => a.code === areaCode);
  setStatus(`${area.name} 관광지를 불러오는 중...`);

  try {
    const items = await fetchTourList(areaCode);
    renderCards(items);
    if (items.length > 0) {
      setStatus(`${area.name} 관광지 ${items.length}곳`);
    }
  } catch (error) {
    console.error(error);
    cardList.classList.add("hidden");
    setStatus(`불러오기 실패: ${error.message}`, true);
  }
}

// 선택한 지역을 Firebase에 저장 (추가가 아니라 덮어쓰기 = 업데이트)
async function saveArea(areaCode) {
  const area = AREAS.find((a) => a.code === areaCode);
  try {
    await set(stateRef, {
      areaCode: area.code,
      areaName: area.name,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Firebase 저장 실패:", error);
  }
}

// 사용자가 지역을 선택했을 때
areaSelect.addEventListener("change", async (event) => {
  const areaCode = event.target.value;

  if (!areaCode) {
    cardList.innerHTML = "";
    cardList.classList.add("hidden");
    setStatus("");
    return;
  }

  await saveArea(areaCode);
  await loadArea(areaCode);
});

// 처음 로딩할 때: 저장된 지역이 있으면 표시, 없으면 목록 숨김
async function init() {
  renderOptions();

  try {
    const snapshot = await get(stateRef);
    if (snapshot.exists()) {
      const saved = snapshot.val();
      areaSelect.value = saved.areaCode;
      await loadArea(saved.areaCode);
    } else {
      cardList.classList.add("hidden");
      setStatus("지역을 선택하세요.");
    }
  } catch (error) {
    console.error("Firebase 읽기 실패:", error);
    setStatus("저장된 정보를 불러오지 못했습니다.", true);
  }
}

init();
