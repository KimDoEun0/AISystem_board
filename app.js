import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, remove, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ==========================================
// 1. API 및 Firebase 설정
// ==========================================
// 공공데이터포털 일반 인증키 (Encoding)
const SERVICE_KEY = '8df9681b1748b09a3badc6afff5e72bf6fba7f96507b697945782d3dcf7c4041';

// Firebase 프로젝트 키 설정
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

// 애플리케이션 상태 관리
let currentAreaCode = '1'; // 기본 지역: 서울 (1)
let tourList = [];
let favorites = {};
let currentViewMode = 'all'; // 'all' (검색) 또는 'fav' (찜 보관함)

// DOM 요소 참조
const areaSelect = document.getElementById('areaSelect');
const gridContainer = document.getElementById('gridContainer');
const loading = document.getElementById('loading');
const btnAll = document.getElementById('btnAll');
const btnFav = document.getElementById('btnFav');
const favCount = document.getElementById('favCount');
const filterBox = document.getElementById('filterBox');

// ==========================================
// 2. Firebase 실시간 데이터 연동
// ==========================================
const favoritesRef = ref(db, 'favorites');
onValue(favoritesRef, (snapshot) => {
  favorites = snapshot.val() || {};
  favCount.innerText = Object.keys(favorites).length;
  render();
});

// ==========================================
// 3. 한국관광공사 TourAPI 4.0 (areaBasedList2) 호출
// ==========================================
async function fetchTourData(areaCode) {
  showLoading(true);
  
  // AllOrigins CORS 우회 프록시 적용
  const targetUrl = `https://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${SERVICE_KEY}&numOfRows=20&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&areaCode=${areaCode}&arrange=O`; const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

  try {
    const res = await fetch(proxyUrl);
    const json = await res.json();
    const items = json.response?.body?.items?.item || [];
    tourList = Array.isArray(items) ? items : [items];
  } catch (err) {
    console.error("API 호출 에러:", err);
    tourList = [];
  } finally {
    showLoading(false);
    render();
  }
}

// ==========================================
// 4. 화면 UI 렌더링
// ==========================================
function render() {
  gridContainer.innerHTML = '';

  const displayList = currentViewMode === 'fav' 
    ? Object.values(favorites) 
    : tourList;

  if (displayList.length === 0) {
    gridContainer.innerHTML = `<div class="loading" style="grid-column: 1/-1;">${
      currentViewMode === 'fav' ? '찜한 관광지가 없습니다.' : '검색 결과가 없습니다.'
    }</div>`;
    return;
  }

  displayList.forEach(item => {
    const isFav = !!favorites[item.contentid];
    const imageUrl = item.firstimage || item.firstimage2 || 'https://via.placeholder.com/300x200?text=No+Image';

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-img-wrapper">
        <img class="card-img" src="${imageUrl}" alt="${item.title || ''}">
        <button class="fav-btn">${isFav ? '❤️' : '🤍'}</button>
      </div>
      <div class="card-body">
        <h3 class="card-title">${item.title || '명칭 없음'}</h3>
        <p class="card-addr">📍 ${item.addr1 || '주소 정보 없음'}</p>
      </div>
    `;

    // 찜하기/취소 버튼 클릭 이벤트
    const favBtn = card.querySelector('.fav-btn');
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(item);
    });

    gridContainer.appendChild(card);
  });
}

// ==========================================
// 5. Firebase 찜 저장 / 삭제 토글 기능
// ==========================================
function toggleFavorite(item) {
  const contentId = item.contentid;
  if (favorites[contentId]) {
    remove(ref(db, `favorites/${contentId}`)); } else { set(ref(db, `favorites/${contentId}`), {
      contentid: item.contentid,
      title: item.title || '명칭 없음',
      addr1: item.addr1 || '주소 정보 없음',
      firstimage: item.firstimage || item.firstimage2 || ''
    });
  }
}

function showLoading(isShowing) {
  if (isShowing) loading.classList.remove('hidden');
  else loading.classList.add('hidden');
}

// ==========================================
// 6. 이벤트 리스너 설정 및 초기 실행
// ==========================================
areaSelect.addEventListener('change', (e) => {
  currentAreaCode = e.target.value;
  fetchTourData(currentAreaCode);
});

btnAll.addEventListener('click', () => {
  currentViewMode = 'all';
  btnAll.classList.add('active');
  btnFav.classList.remove('active');
  filterBox.classList.remove('hidden');
  render();
});

btnFav.addEventListener('click', () => {
  currentViewMode = 'fav';
  btnFav.classList.add('active');
  btnAll.classList.remove('active');
  filterBox.classList.add('hidden');
  render();
});

// 앱 시작 시 서울 데이터 기본 불러오기
fetchTourData(currentAreaCode);
