import { useEffect, useRef, useState, useCallback } from 'react';
import Head from 'next/head';

const CORRECT_PASSWORD = "1234";
const REFRESH_INTERVAL = 2000;

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `record-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getLocalDateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value) {
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? parseLocalDateKey(value) : new Date(value);
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function formatTime(value) {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(new Date(value));
}

function parseTimestamp(timestamp) {
  if (!timestamp) return new Date();
  if (timestamp.startsWith('TIME_')) return new Date();
  const year   = timestamp.substring(0, 4);
  const month  = timestamp.substring(4, 6);
  const day    = timestamp.substring(6, 8);
  const hour   = timestamp.substring(9, 11);
  const minute = timestamp.substring(11, 13);
  const second = timestamp.substring(13, 15);
  return new Date(year, month - 1, day, hour, minute, second);
}

function isCorrectDial(dial) { return dial === CORRECT_PASSWORD; }

function getDialDisplayText(dial) {
  if (isCorrectDial(dial)) return '올바른 입력';
  return String(dial).split('').join(' ');
}

function createPlaceholderImage() {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 900; canvas.height = 560;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f0f0f0'; ctx.fillRect(0, 0, 900, 560);
  ctx.fillStyle = '#999'; ctx.font = '700 48px Arial';
  ctx.textAlign = 'center'; ctx.fillText('이미지 없음', 450, 280);
  return canvas.toDataURL('image/jpeg', 0.9);
}

function createCameraImage(label, mainColor, bgColor) {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 900; canvas.height = 560;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bgColor; ctx.fillRect(0, 0, 900, 560);
  ctx.fillStyle = '#182522'; ctx.fillRect(0, 0, 900, 78);
  ctx.fillStyle = mainColor;
  ctx.beginPath(); ctx.arc(450, 235, 88, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '700 42px Arial';
  ctx.textAlign = 'center'; ctx.fillText(label, 450, 55);
  return canvas.toDataURL('image/jpeg', 0.9);
}

function createSampleRecords() {
  const make = (date, dial, photo) => ({
    id: createId(), time: date.toISOString(), dial,
    location: '현관 도어락', photo, isCorrect: isCorrectDial(dial)
  });
  return [
    make(new Date(2026,4,1,8,42,0),  '1234', createCameraImage('샘플','#0f766e','#d9f2ee')),
    make(new Date(2026,4,2,19,12,0), '1200', createCameraImage('샘플','#a74f16','#fff2e6')),
    make(new Date(2026,4,3,7,55,0),  '1234', createCameraImage('샘플','#4c6f9f','#eef3ff')),
  ];
}

export default function Home() {
  const [records, setRecords]                 = useState([]);
  const [isLocked, setIsLocked]               = useState(false);
  const [recordFilter, setRecordFilter]       = useState('recent');
  const [selectedId, setSelectedId]           = useState(null);
  const [selectedDateKey, setSelectedDateKey] = useState(getLocalDateKey(new Date()));
  const [calendarMonth, setCalendarMonth]     = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [filterMenuOpen, setFilterMenuOpen]   = useState(false);
  const [showLockModal, setShowLockModal]     = useState(false);
  const [deviceOnline, setDeviceOnline]       = useState(false);
  const [lastSeen, setLastSeen]               = useState(null);
  const filterRef = useRef(null);

  // ★ 서버+로컬 머지: 서버가 적은 데이터를 보내도 기존 데이터 유지
  const mergeRecords = useCallback((serverEvents) => {
    const loaded = serverEvents.map(item => ({
      id:       item.id || createId(),
      time:     item.timestamp ? parseTimestamp(item.timestamp).toISOString() : new Date().toISOString(),
      dial:     item.input || '',
      location: '현관 도어락',
      photo:    item.imageUrl || createPlaceholderImage(),
      isCorrect: item.result === 'SUCCESS',
    }));

    setRecords(prev => {
      if (loaded.length === 0) return prev.length > 0 ? prev : createSampleRecords();

      // 서버 데이터와 로컬 데이터를 id 기준으로 머지
      // 서버에 없는 로컬 데이터도 유지
      const serverIds = new Set(loaded.map(r => r.id));
      const localOnly = prev.filter(r => !serverIds.has(r.id));
      const merged = [...loaded, ...localOnly];

      // 시간순 정렬 후 최대 200개 유지
      merged.sort((a, b) => new Date(b.time) - new Date(a.time));
      return merged.slice(0, 200);
    });
  }, []);

  const loadRecords = useCallback(async () => {
    try {
      const res = await fetch('/api/event');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      mergeRecords(data.events || []);
      if ((data.events || []).length > 0) {
        setDeviceOnline(true);
      }
    } catch {
      // 오류 시 기존 데이터 유지
    }
  }, [mergeRecords]);

  const loadHeartbeat = useCallback(async () => {
    try {
      const res = await fetch('/api/heartbeat?deviceId=ESP32-DOORLOCK-01');
      if (!res.ok) return;
      const data = await res.json();
      setDeviceOnline(data.status === 'online');
      setLastSeen(data.lastSeen);
    } catch {}
  }, []);

  const loadLockStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/lock-status');
      if (!res.ok) return;
      const data = await res.json();
      setIsLocked(data.locked || false);
    } catch {}
  }, []);

  const sendLockStatus = async (locked) => {
    try {
      const res = await fetch('/api/lock-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked }),
      });
      if (!res.ok) throw new Error();
      setIsLocked(locked);
      return true;
    } catch {
      alert('잠금 상태 변경에 실패했습니다.');
      return false;
    }
  };

  useEffect(() => {
    loadRecords();
    loadHeartbeat();
    loadLockStatus();
    const id = setInterval(() => {
      loadRecords();
      loadHeartbeat();
      loadLockStatus();
    }, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [loadRecords, loadHeartbeat, loadLockStatus]);

  useEffect(() => {
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterMenuOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { setShowLockModal(false); setFilterMenuOpen(false); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const sortedRecords = [...records].sort((a, b) => new Date(b.time) - new Date(a.time));

  const filteredRecords = (() => {
    if (recordFilter === 'wrong')   return sortedRecords.filter(r => !isCorrectDial(r.dial));
    if (recordFilter === 'correct') return sortedRecords.filter(r =>  isCorrectDial(r.dial));
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    return sortedRecords.filter(r => new Date(r.time) >= start);
  })();

  const effectiveSelectedId = (() => {
    if (selectedId && filteredRecords.some(r => r.id === selectedId)) return selectedId;
    return filteredRecords[0]?.id ?? sortedRecords[0]?.id ?? null;
  })();

  const selectedRecord = filteredRecords.find(r => r.id === effectiveSelectedId);
  const dayRecords = records
    .filter(r => getLocalDateKey(new Date(r.time)) === selectedDateKey)
    .sort((a, b) => new Date(b.time) - new Date(a.time));

  const downloadJson = () => {
    const data = records.map(r => ({
      시간: formatDate(r.time) + ' ' + formatTime(r.time),
      입력: isCorrectDial(r.dial) ? '올바른 입력' : r.dial.split('').join(' '),
      결과: isCorrectDial(r.dial) ? '성공' : '실패',
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'doorlock-records-' + getLocalDateKey(new Date()) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderCalendar = () => {
    const year        = calendarMonth.getFullYear();
    const month       = calendarMonth.getMonth();
    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push(<button key={"e" + i} className="calendar-day is-empty" disabled />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date    = new Date(year, month, day);
      const dateKey = getLocalDateKey(date);
      const dayRecs = records.filter(r => getLocalDateKey(new Date(r.time)) === dateKey);
      const isToday    = date.toDateString() === new Date().toDateString();
      const isSelected = dateKey === selectedDateKey;

      const classes = ['calendar-day',
        isToday    ? 'is-today'    : '',
        isSelected ? 'is-selected' : '',
        dayRecs.length > 0 ? 'has-records' : '',
      ].filter(Boolean).join(' ');

      cells.push(
        <button
          key={dateKey}
          className={classes}
          onClick={() => {
            setSelectedDateKey(dateKey);
            setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
          }}
        >
          <span className="day-number">{day}</span>
          {dayRecs.length > 0 && <span className="day-badge">{dayRecs.length}</span>}
        </button>
      );
    }
    return cells;
  };

  const scrollToDetail = () => {
    document.querySelector('.detail-panel') &&
    document.querySelector('.detail-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div>
      <Head>
        <title>스마트 도어락 기록 확인</title>
        <link rel="stylesheet" href="/style.css" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/earlyaccess/jejugothic.css" />
      </Head>

      <header className="topbar">
        <div className="brand-group">
          <img className="brand-logo" src="/498268_302696_304.png" alt="로고" />
          <div className="brand-copy">
            <p className="eyebrow">Smart Door Lock Monitor</p>
            <h1>도어락 기록 확인</h1>
          </div>
        </div>

        {/* ★ 단일 장치 연결 상태 */}
        <div className="device-status-list">
          <div className={`device-status${deviceOnline ? '' : ' is-disconnected'}`}>
            <span className="status-dot" />
            <span>도어락 {deviceOnline ? '연결됨' : '연결 끊김'}</span>
          </div>
          {lastSeen && (
            <div className="last-seen">
              마지막 연결: {new Date(lastSeen).toLocaleString('ko-KR')}
            </div>
          )}
        </div>
      </header>

      <main className="dashboard">

        <section className="calendar-panel">
          <article className="calendar-card">
            <div className="calendar-header">
              <button className="icon-button" type="button"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>
                {'‹'}
              </button>
              <h2>{calendarMonth.getFullYear()}년 {calendarMonth.getMonth() + 1}월</h2>
              <button className="icon-button" type="button"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>
                {'›'}
              </button>
            </div>
            <div className="calendar-weekdays">
              {['일','월','화','수','목','금','토'].map(function(d) { return <span key={d}>{d}</span>; })}
            </div>
            <div className="calendar-grid">{renderCalendar()}</div>
          </article>

          <article className="daily-card">
            <div className="section-title">
              <div>
                <p className="eyebrow">Selected Date</p>
                <h2>{formatDate(selectedDateKey)} 입력 기록</h2>
              </div>
              <span>{dayRecords.length}개</span>
            </div>
            <div className="daily-list">
              {dayRecords.length === 0
                ? <p className="empty-message">이 날짜에는 기록이 없습니다</p>
                : dayRecords.map(function(record) {
                    return (
                      <button
                        key={record.id}
                        className={"daily-record " + (isCorrectDial(record.dial) ? 'is-correct' : 'is-wrong')}
                        onClick={() => { setSelectedId(record.id); scrollToDetail(); }}
                      >
                        <span className="daily-time">{formatTime(record.time)}</span>
                        <span className="daily-dial">{getDialDisplayText(record.dial)}</span>
                      </button>
                    );
                  })
              }
            </div>
          </article>
        </section>

        <section className="control-panel">
          <button className="primary-button" type="button" onClick={downloadJson}>JSON 내보내기</button>
        </section>

        <section className="content-grid">
          <aside className="log-panel">
            <div className="section-title">
              <div className="log-filter" ref={filterRef}>
                <button
                  className="log-filter-toggle" type="button"
                  aria-expanded={String(filterMenuOpen)}
                  onClick={() => setFilterMenuOpen(function(o) { return !o; })}
                >
                  <span>
                    {recordFilter === 'recent'  ? '최근 7일 기록' :
                     recordFilter === 'wrong'   ? '틀린 입력 기록' : '올바른 입력 기록'}
                  </span>
                </button>
                {filterMenuOpen && (
                  <div className="log-filter-menu" role="listbox">
                    {[
                      { key: 'recent',  label: '최근 7일 기록' },
                      { key: 'wrong',   label: '틀린 입력 기록' },
                      { key: 'correct', label: '올바른 입력 기록' },
                    ].map(function(item) {
                      return (
                        <button
                          key={item.key}
                          className={"log-filter-option" + (recordFilter === item.key ? ' is-selected' : '')}
                          type="button"
                          onClick={() => { setRecordFilter(item.key); setFilterMenuOpen(false); }}
                        >{item.label}</button>
                      );
                    })}
                  </div>
                )}
              </div>
              <span>{filteredRecords.length}개 표시</span>
            </div>

            <div className="log-list">
              {filteredRecords.length === 0
                ? <p className="empty-message">표시할 기록이 없습니다</p>
                : filteredRecords.map(function(record) {
                    return (
                      <button
                        key={record.id}
                        className={['log-card',
                          record.id === effectiveSelectedId ? 'is-active' : '',
                          isCorrectDial(record.dial) ? '' : 'is-wrong',
                        ].filter(Boolean).join(' ')}
                        type="button"
                        onClick={() => { setSelectedId(record.id); scrollToDetail(); }}
                      >
                        <img src={record.photo} alt="도어락 카메라 사진" />
                        <span className="log-meta">
                          <span className="log-time">{formatTime(record.time)}</span>
                          <span className="log-dial">{getDialDisplayText(record.dial)}</span>
                        </span>
                      </button>
                    );
                  })
              }
            </div>
          </aside>

          <section className="detail-panel">
            <div className="detail-photo-wrap">
              <img
                src={selectedRecord ? selectedRecord.photo : createPlaceholderImage()}
                alt="도어락 카메라 사진"
              />
            </div>
            <div className="detail-info">
              <p className="eyebrow">Selected Record</p>
              <h2>
                {selectedRecord
                  ? (isCorrectDial(selectedRecord.dial) ? '✅ 올바른 입력' : '❌ 잘못된 입력')
                  : '기록을 선택하세요'}
              </h2>
              <dl>
                <div>
                  <dt>촬영 시간</dt>
                  <dd>{selectedRecord ? formatDate(selectedRecord.time) + ' ' + formatTime(selectedRecord.time) : '-'}</dd>
                </div>
                <div>
                  <dt>입력 번호</dt>
                  <dd>{selectedRecord ? getDialDisplayText(selectedRecord.dial) : '-'}</dd>
                </div>
              </dl>
            </div>
          </section>
        </section>

        <section className="lock-panel">
          <div className="section-title">
            <h2>디스플레이 입력 잠금</h2>
            <span>{isLocked ? '입력 잠금 중' : '입력 허용 중'}</span>
          </div>
          <div className="lock-control">
            <div>
              <p className="lock-title">터치 입력 제어</p>
              <p className="lock-description">원격 시연 시 디스플레이의 터치 입력을 차단하는 상태로 전환합니다.</p>
            </div>
            <button
              className={"lock-switch" + (isLocked ? ' is-on' : '')}
              type="button" role="switch"
              onClick={() => { if (isLocked) sendLockStatus(false); else setShowLockModal(true); }}
            >
              <span className="switch-track"><span className="switch-thumb" /></span>
              <span className="switch-label">{isLocked ? 'ON' : 'OFF'}</span>
            </button>
          </div>
          <p className="lock-note">
            {isLocked
              ? '현재 도어락 디스플레이 터치 입력이 차단된 상태입니다.'
              : '현재 도어락 디스플레이 입력을 받을 수 있습니다.'}
          </p>
        </section>

        {showLockModal && (
          <div
            className="modal-backdrop"
            onClick={function(e) { if (e.target === e.currentTarget) setShowLockModal(false); }}
          >
            <section className="warning-modal" role="dialog">
              <p className="eyebrow">Remote Control</p>
              <h2>디스플레이 입력을 잠글까요?</h2>
              <p>잠금 중에는 도어락 디스플레이의 터치 입력이 차단됩니다. 시연 장치 상태를 확인한 뒤 실행하세요.</p>
              <div className="modal-actions">
                <button className="ghost-button" type="button" onClick={() => setShowLockModal(false)}>취소</button>
                <button className="danger-button" type="button"
                  onClick={function() { sendLockStatus(true); setShowLockModal(false); }}>입력 잠금</button>
              </div>
            </section>
          </div>
        )}

      </main>
    </div>
  );
}