const { useState, useEffect } = React;

// ===== [수정 1] Firebase 설정 =====
const firebaseConfig = {
  apiKey: "AIzaSyAcpMxtDgfZknnaF6UcHJD6PFoQj1iskYc",
  authDomain: "aisystem-myproject.firebaseapp.com",
  databaseURL: "https://aisystem-myproject-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "aisystem-myproject",
  storageBucket: "aisystem-myproject.firebasestorage.app",
  messagingSenderId: "932636835234",
  appId: "1:932636835234:web:64c457e9cb49050db806fb"
};

// ===== [수정 2] Tour API 디코딩 키 =====
const TOUR_API_KEY = "8df9681b1748b09a3badc6afff5e72bf6fba7f96507b697945782d3dcf7c4041";

// ===== [수정 3] 엔드포인트 =====
const ENDPOINT = "https://apis.data.go.kr/B551011/KorService2/areaBasedList2";

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

// Firebase 초기화
firebase.initializeApp(firebaseConfig);
const stateRef = firebase.database().ref("appState");

// 공공데이터 조회
async function fetchTourList(areaCode) {
  const params = new URLSearchParams({
    serviceKey: TOUR_API_KEY,
    numOfRows: "20",
    pageNo: "1",
    MobileOS: "ETC",
    MobileApp: "TourCardBook",
    _type: "json",
    arrange: "Q",
    areaCode: areaCode
  });

  const response = await fetch(`${ENDPOINT}?${params.toString()}`);
  if (!response.ok) throw new Error(`HTTP 오류: ${response.status}`);

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
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

// 컴포넌트 1: 지역 선택
function AreaSelect({ value, onChange }) {
  return (
    <section className="controls">
      <label htmlFor="areaSelect">지역 선택</label>
      <select
        id="areaSelect"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">-- 지역을 선택하세요 --</option>
        {AREAS.map((area) => (
          <option key={area.code} value={area.code}>{area.name}</option>
        ))}
      </select>
    </section>
  );
}

// 컴포넌트 2: 관광지 카드
function TourCard({ item }) {
  const imageUrl = (item.firstimage || item.firstimage2 || "").replace("http://", "https://");

  return (
    <article className="card">
      {imageUrl ? (
        <img src={imageUrl} alt={item.title} loading="lazy" />
      ) : (
        <div className="no-image">이미지 없음</div>
      )}
      <div className="body">
        <h3>{item.title}</h3>
        <p>{item.addr1 || "주소 정보 없음"}</p>
      </div>
    </article>
  );
}

// 메인 컴포넌트
function App() {
  const [areaCode, setAreaCode] = useState("");
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");
  const [isError, setIsError] = useState(false);

  async function loadArea(code) {
    const area = AREAS.find((a) => a.code === code);
    setIsError(false);
    setStatus(`${area.name} 관광지를 불러오는 중...`);

    try {
      const list = await fetchTourList(code);
      setItems(list);
      setStatus(list.length > 0 ? `${area.name} 관광지 ${list.length}곳` : "조회된 관광지가 없습니다.");
    } catch (error) {
      console.error(error);
      setItems([]);
      setIsError(true);
      setStatus(`불러오기 실패: ${error.message}`);
    }
  }

  async function saveArea(code) {
    const area = AREAS.find((a) => a.code === code);
    try {
      await stateRef.set({
        areaCode: area.code,
        areaName: area.name,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Firebase 저장 실패:", error);
    }
  }

  // 처음 로딩: 저장된 지역이 있으면 표시, 없으면 목록 숨김
  useEffect(() => {
    async function init() {
      try {
        const snapshot = await stateRef.get();
        if (snapshot.exists()) {
          const saved = snapshot.val();
          setAreaCode(saved.areaCode);
          await loadArea(saved.areaCode);
        } else {
          setStatus("지역을 선택하세요.");
        }
      } catch (error) {
        console.error("Firebase 읽기 실패:", error);
        setIsError(true);
        setStatus("저장된 정보를 불러오지 못했습니다.");
      }
    }
    init();
  }, []);

  async function handleChange(code) {
    setAreaCode(code);
    if (!code) {
      setItems([]);
      setStatus("");
      return;
    }
    await saveArea(code);
    await loadArea(code);
  }

  return (
    <>
      <header>
        <h1>지역별 여행지 카드북 (React)</h1>
        <p>지역을 선택하면 관광지 목록을 보여줍니다.</p>
      </header>
      <main>
        <AreaSelect value={areaCode} onChange={handleChange} />
        <p className={isError ? "status error" : "status"}>{status}</p>
        {items.length > 0 && (
          <section className="card-list">
            {items.map((item) => (
              <TourCard key={item.contentid} item={item} />
            ))}
          </section>
        )}
      </main>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
