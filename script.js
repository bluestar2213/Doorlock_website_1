// API 설정
const API_BASE_URL = 'https://your-vercel-app.vercel.app/api';
const REFRESH_INTERVAL = 5000; // 5초마다 자동 새로고침

// 샘플 데이터 대신 실제 데이터 사용
const CORRECT_PASSWORD = "1234"; // ESP32-S3 코드와 동일하게

const elements = {
  calendarTitle: document.querySelector("#calendarTitle"),
  calendarGrid: document.querySelector("#calendarGrid"),
  prevMonth: document.querySelector("#prevMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  cameraStatus: document.querySelector("#cameraStatus"),
  timeStatus: document.querySelector("#timeStatus"),
  displayStatus: document.querySelector("#displayStatus"),
  selectedDateTitle: document.querySelector("#selectedDateTitle"),
  selectedDateCount: document.querySelector("#selectedDateCount"),
  dailyList: document.querySelector("#dailyList"),
  visibleCount: document.querySelector("#visibleCount"),
  recordFilter: document.querySelector("#recordFilter"),
  recordFilterToggle: document.querySelector("#recordFilterToggle"),
  recordFilterText: document.querySelector("#recordFilterText"),
  recordFilterMenu: document.querySelector("#recordFilterMenu"),
  exportData: document.querySelector("#exportData"),
  logList: document.querySelector("#logList"),
  detailPhoto: document.querySelector("#detailPhoto"),
  detailTitle: document.querySelector("#detailTitle"),
  detailTime: document.querySelector("#detailTime"),
  detailDial: document.querySelector("#detailDial"),
  displayLockStatus: document.querySelector("#displayLockStatus"),
  displayLockToggle: document.querySelector("#displayLockToggle"),
  displayLockMessage: document.querySelector("#displayLockMessage"),
  displayLockModal: document.querySelector("#displayLockModal"),
  cancelDisplayLock: document.querySelector("#cancelDisplayLock"),
  confirmDisplayLock: document.querySelector("#confirmDisplayLock")
};

let records = [];
let isDisplayInputLocked = false;
let recordFilter = "recent";
let selectedId = null;
let selectedDateKey = getLocalDateKey(new Date());
let calendarMonth = new Date();
calendarMonth.setDate(1);

// 페이지 로드 시 초기화
window.addEventListener('DOMContentLoaded', async () => {
  console.log('Smart Door Lock Monitor Starting...');

  await loadRecordsFromAPI();
  await loadLockStatusFromAPI();

  render();

  // 자동 새로고침
  setInterval(async () => {
    await loadRecordsFromAPI();
    await loadLockStatusFromAPI();
    render();
  }, REFRESH_INTERVAL);

  console.log('System Ready!');
});

// API에서 기록 불러오기
async function loadRecordsFromAPI() {
  try {
    const response = await fetch(`${API_BASE_URL}/upload`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // API 데이터를 내부 형식으로 변환
    records = data.map(item => ({
      id: item.id || createId(),
      time: parseTimestamp(item.timestamp),
      dial: item.password,
      location: "현관 도어락",
      photo: item.image ? `data:image/jpeg;base64,${item.image}` : createPlaceholderImage(),
      isCorrect: item.isCorrect,
      locked: item.locked || false
    }));

    updateDeviceStatuses({
      camera: true,
      time: true,
      display: true
    });

    console.log(`Loaded ${records.length} records from API`);

  } catch (error) {
    console.error('Failed to load records:', error);

    updateDeviceStatuses({
      camera: false,
      time: false,
      display: false
    });

    // 샘플 데이터 표시 (API 실패 시)
    if (records.length === 0) {
      records = createSampleRecords();
      console.log('Using sample data');
    }
  }
}

// 타임스탬프 파싱 (20240518_143022 -> Date)
function parseTimestamp(timestamp) {
  if (!timestamp) return new Date();

  // TIME_형식 처리
  if (timestamp.startsWith('TIME_')) {
    return new Date(); // millis 기반이므로 현재 시간 사용
  }

  // 20240518_143022 형식
  const year = timestamp.substring(0, 4);
  const month = timestamp.substring(4, 6);
  const day = timestamp.substring(6, 8);
  const hour = timestamp.substring(9, 11);
  const minute = timestamp.substring(11, 13);
  const second = timestamp.substring(13, 15);

  return new Date(year, month - 1, day, hour, minute, second);
}

// 입력 잠금 상태 불러오기
async function loadLockStatusFromAPI() {
  try {
    const response = await fetch(`${API_BASE_URL}/lock-status`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    isDisplayInputLocked = data.locked || false;

    console.log(`Lock status: ${isDisplayInputLocked ? 'LOCKED' : 'UNLOCKED'}`);

  } catch (error) {
    console.error('Failed to load lock status:', error);
  }
}

// 입력 잠금 상태 서버로 전송
async function sendLockStatusToAPI(locked) {
  try {
    const response = await fetch(`${API_BASE_URL}/lock-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ locked })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log(`Lock status updated: ${locked ? 'LOCKED' : 'UNLOCKED'}`);
    return true;

  } catch (error) {
    console.error('Failed to update lock status:', error);
    return false;
  }
}

// 플레이스홀더 이미지 생성
function createPlaceholderImage() {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 560;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#f0f0f0";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#999";
  ctx.font = "700 48px Arial";
  ctx.textAlign = "center";
  ctx.fillText("이미지 없음", 450, 280);

  return canvas.toDataURL("image/jpeg", 0.9);
}

// 샘플 데이터 생성 (API 실패 시에만 사용)
function createSampleRecords() {
  return [
    createRecord(createSampleDate(1, 8, 42), "1234", createCameraImage("샘플 데이터", "#0f766e", "#d9f2ee")),
    createRecord(createSampleDate(2, 19, 12), "1200", createCameraImage("샘플 데이터", "#a74f16", "#fff2e6")),
    createRecord(createSampleDate(3, 7, 55), "1234", createCameraImage("샘플 데이터", "#4c6f9f", "#eef3ff"))
  ];
}

function createSampleDate(day, hour, minute) {
  return new Date(2026, 4, day, hour, minute, 0);
}

function createRecord(date, dial, photo) {
  return {
    id: createId(),
    time: date.toISOString(),
    dial,
    location: "현관 도어락",
    photo,
    isCorrect: dial === CORRECT_PASSWORD
  };
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `record-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createCameraImage(label, mainColor, bgColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 560;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#182522";
  ctx.fillRect(0, 0, canvas.width, 78);

  ctx.fillStyle = mainColor;
  ctx.beginPath();
  ctx.arc(450, 235, 88, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 42px Arial";
  ctx.textAlign = "center";
  ctx.fillText(label, 450, 55);

  return canvas.toDataURL("image/jpeg", 0.9);
}

function getSortedRecords() {
  return records.sort((a, b) => new Date(b.time) - new Date(a.time));
}

function render() {
  const sortedRecords = getSortedRecords();
  const visibleRecords = getFilteredRecords(sortedRecords);

  renderCalendar();

  if (!sortedRecords.some((record) => record.id === selectedId)) {
    selectedId = visibleRecords[0]?.id ?? sortedRecords[0]?.id ?? null;
  }

  if (visibleRecords.length > 0 && !visibleRecords.some((record) => record.id === selectedId)) {
    selectedId = visibleRecords[0].id;
  }

  renderDailyList();
  updateListCount(visibleRecords);
  renderList(visibleRecords);
  renderDetail(visibleRecords.find((record) => record.id === selectedId));
  renderRecordFilter();
  renderDisplayLock();
}

function updateDeviceStatuses(statuses) {
  updateDeviceStatus(elements.cameraStatus, "카메라 장치", statuses.camera);
  updateDeviceStatus(elements.timeStatus, "시간 전송 장치", statuses.time);
  updateDeviceStatus(elements.displayStatus, "디스플레이 입력 장치", statuses.display);
}

function updateDeviceStatus(element, label, isConnected) {
  element.classList.toggle("is-disconnected", !isConnected);
  element.querySelector("span:last-child").textContent = `${label} ${isConnected ? "연결됨" : "연결 끊김"}`;
}

function getRecentWeekRecords(sortedRecords) {
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
  return sortedRecords.filter((record) => new Date(record.time) >= startDate);
}

function getFilteredRecords(sortedRecords) {
  if (recordFilter === "wrong") {
    return sortedRecords.filter((record) => !isCorrectDial(record.dial));
  }

  if (recordFilter === "correct") {
    return sortedRecords.filter((record) => isCorrectDial(record.dial));
  }

  return getRecentWeekRecords(sortedRecords);
}

function isCorrectDial(dial) {
  return dial === CORRECT_PASSWORD;
}

function getDialDisplayText(dial) {
  return dial.split("").join(" ");
}

function updateListCount(visibleRecords) {
  elements.visibleCount.textContent = `${visibleRecords.length}개 표시`;
}

function renderRecordFilter() {
  const selectedOption = elements.recordFilterMenu.querySelector(`[data-filter="${recordFilter}"]`);

  elements.recordFilterMenu.querySelectorAll(".log-filter-option").forEach((option) => {
    const isSelected = option === selectedOption;
    option.classList.toggle("is-selected", isSelected);
    option.setAttribute("aria-selected", String(isSelected));
  });

  if (selectedOption) {
    elements.recordFilterText.textContent = selectedOption.textContent;
  }
}

// 달력 렌더링
function renderCalendar() {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();

  elements.calendarTitle.textContent = `${year}년 ${month + 1}월`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = [];

  // 빈 칸
  for (let i = 0; i < firstDay; i++) {
    days.push('<button class="calendar-day is-empty" disabled></button>');
  }

  // 날짜
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateKey = getLocalDateKey(date);
    const dayRecords = records.filter(r => getLocalDateKey(new Date(r.time)) === dateKey);
    const isToday = date.toDateString() === new Date().toDateString();
    const isSelected = dateKey === selectedDateKey;

    const classes = ['calendar-day'];
    if (isToday) classes.push('is-today');
    if (isSelected) classes.push('is-selected');
    if (dayRecords.length > 0) classes.push('has-records');

    days.push(`
      <button class="${classes.join(' ')}" data-date="${dateKey}">
        <span class="day-number">${day}</span>
        ${dayRecords.length > 0 ? `<span class="day-badge">${dayRecords.length}</span>` : ''}
      </button>
    `);
  }

  elements.calendarGrid.innerHTML = days.join('');
}

// 선택된 날짜 기록 렌더링
function renderDailyList() {
  const dayRecords = records.filter(r => getLocalDateKey(new Date(r.time)) === selectedDateKey);

  elements.selectedDateTitle.textContent = `${formatDate(selectedDateKey)} 입력 기록`;
  elements.selectedDateCount.textContent = `${dayRecords.length}개`;

  if (dayRecords.length === 0) {
    elements.dailyList.innerHTML = '<p class="empty-message">이 날짜에는 기록이 없습니다</p>';
    return;
  }

  const sortedDayRecords = dayRecords.sort((a, b) => new Date(b.time) - new Date(a.time));

  elements.dailyList.innerHTML = sortedDayRecords.map(record => {
    const time = formatTime(record.time);
    const statusClass = isCorrectDial(record.dial) ? 'is-correct' : 'is-wrong';

    return `
      <button class="daily-record ${statusClass}" data-id="${record.id}">
        <span class="daily-time">${time}</span>
        <span class="daily-dial">${getDialDisplayText(record.dial)}</span>
      </button>
    `;
  }).join('');
}

// 로그 리스트 렌더링
function renderList(visibleRecords) {
  if (visibleRecords.length === 0) {
    elements.logList.innerHTML = '<p class="empty-message">표시할 기록이 없습니다</p>';
    return;
  }

  elements.logList.innerHTML = '';
  visibleRecords.forEach(record => {
    elements.logList.appendChild(createLogCard(record));
  });
}

function createLogCard(record) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = [
    "log-card",
    record.id === selectedId ? "is-active" : "",
    isCorrectDial(record.dial) ? "" : "is-wrong"
  ].filter(Boolean).join(" ");
  item.dataset.id = record.id;

  const image = document.createElement("img");
  image.src = record.photo;
  image.alt = "도어락 카메라 촬영 사진";

  const meta = document.createElement("span");
  meta.className = "log-meta";

  const time = document.createElement("span");
  time.className = "log-time";
  time.textContent = formatTime(record.time);

  const dial = document.createElement("span");
  dial.className = "log-dial";
  dial.textContent = getDialDisplayText(record.dial);

  meta.append(time, dial);
  item.append(image, meta);
  return item;
}

// 상세 정보 렌더링
function renderDetail(record) {
  if (!record) {
    elements.detailPhoto.src = createPlaceholderImage();
    elements.detailTitle.textContent = "기록을 선택하세요";
    elements.detailTime.textContent = "-";
    elements.detailDial.textContent = "-";
    return;
  }

  elements.detailPhoto.src = record.photo;
  elements.detailTitle.textContent = isCorrectDial(record.dial) ? "✅ 올바른 입력" : "❌ 잘못된 입력";
  elements.detailTime.textContent = `${formatDate(record.time)} ${formatTime(record.time)}`;
  elements.detailDial.textContent = getDialDisplayText(record.dial);
}

function formatDate(value) {
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? parseLocalDateKey(value)
    : new Date(value);

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function getLocalDateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatTime(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

// JSON 다운로드
function downloadJson() {
  const exportRecords = records.map((record) => ({
    time: formatDate(record.time) + ' ' + formatTime(record.time),
    password: getDialDisplayText(record.dial),
    result: isCorrectDial(record.dial) ? '성공' : '실패'
  }));

  const json = JSON.stringify(exportRecords, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `doorlock-records-${getLocalDateKey(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// 입력 잠금 렌더링
function renderDisplayLock() {
  const statusText = isDisplayInputLocked ? "입력 잠금 중" : "입력 허용 중";
  const messageText = isDisplayInputLocked
    ? "현재 도어락 디스플레이 터치 입력이 차단된 상태입니다."
    : "현재 도어락 디스플레이 입력을 받을 수 있습니다.";

  elements.displayLockStatus.textContent = statusText;
  elements.displayLockMessage.textContent = messageText;
  elements.displayLockToggle.classList.toggle("is-on", isDisplayInputLocked);
  elements.displayLockToggle.setAttribute("aria-checked", String(isDisplayInputLocked));
  elements.displayLockToggle.querySelector(".switch-label").textContent = isDisplayInputLocked ? "ON" : "OFF";
}

async function requestDisplayLockChange() {
  if (isDisplayInputLocked) {
    await setDisplayInputLock(false);
    return;
  }
  openDisplayLockModal();
}

async function setDisplayInputLock(isLocked) {
  const success = await sendLockStatusToAPI(isLocked);

  if (success) {
    isDisplayInputLocked = isLocked;
    renderDisplayLock();
  } else {
    alert('입력 잠금 상태 변경에 실패했습니다.');
  }
}

function openDisplayLockModal() {
  elements.displayLockModal.hidden = false;
  elements.confirmDisplayLock.focus();
}

function closeDisplayLockModal() {
  elements.displayLockModal.hidden = true;
  elements.displayLockToggle.focus();
}

function openRecordFilterMenu() {
  elements.recordFilterMenu.hidden = false;
  elements.recordFilterToggle.setAttribute("aria-expanded", "true");
}

function closeRecordFilterMenu() {
  elements.recordFilterMenu.hidden = true;
  elements.recordFilterToggle.setAttribute("aria-expanded", "false");
}

function toggleRecordFilterMenu() {
  if (elements.recordFilterMenu.hidden) {
    openRecordFilterMenu();
  } else {
    closeRecordFilterMenu();
  }
}

function scrollToDetailPhoto() {
  document.querySelector(".detail-panel").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

// 이벤트 리스너
elements.logList.addEventListener("click", (event) => {
  const card = event.target.closest(".log-card");
  if (!card) return;
  selectedId = card.dataset.id;
  render();
  scrollToDetailPhoto();
});

elements.calendarGrid.addEventListener("click", (event) => {
  const day = event.target.closest(".calendar-day");
  if (!day) return;
  selectedDateKey = day.dataset.date;
  const selectedDate = parseLocalDateKey(selectedDateKey);
  calendarMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  render();
});

elements.dailyList.addEventListener("click", (event) => {
  const record = event.target.closest(".daily-record");
  if (!record) return;
  selectedId = record.dataset.id;
  render();
  scrollToDetailPhoto();
});

elements.prevMonth.addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
  render();
});

elements.nextMonth.addEventListener("click", () => {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
  render();
});

elements.recordFilterToggle.addEventListener("click", toggleRecordFilterMenu);

elements.recordFilterMenu.addEventListener("click", (event) => {
  const option = event.target.closest(".log-filter-option");
  if (!option) return;
  recordFilter = option.dataset.filter;
  closeRecordFilterMenu();
  render();
});

elements.exportData.addEventListener("click", downloadJson);

elements.displayLockToggle.addEventListener("click", requestDisplayLockChange);

elements.cancelDisplayLock.addEventListener("click", closeDisplayLockModal);

elements.confirmDisplayLock.addEventListener("click", async () => {
  await setDisplayInputLock(true);
  closeDisplayLockModal();
});

elements.displayLockModal.addEventListener("click", (event) => {
  if (event.target === elements.displayLockModal) {
    closeDisplayLockModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.displayLockModal.hidden) {
    closeDisplayLockModal();
  }
  if (event.key === "Escape" && !elements.recordFilterMenu.hidden) {
    closeRecordFilterMenu();
    elements.recordFilterToggle.focus();
  }
});

document.addEventListener("click", (event) => {
  if (!elements.recordFilter.contains(event.target)) {
    closeRecordFilterMenu();
  }
});