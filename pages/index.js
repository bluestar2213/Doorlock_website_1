import { useEffect, useRef, useState, useCallback } from 'react';
import Head from 'next/head';

const CORRECT_PASSWORD = "1234";
const REFRESH_INTERVAL = 5000;

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
function getDialDisplayText(dial) { return String(dial).split('').join(' '); }

function createPlaceholderImage() {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 900; canvas.height = 560;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f0f0f0'; ctx.fillRect(0, 0, 900, 560);
  ctx.fillStyle = '#999'; ctx.font = '700 48px Arial';
  ctx.textAlign = 'center'; ctx.fillText('No Image', 450, 280);
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
    location: 'door lock', photo, isCorrect: isCorrectDial(dial)
  });
  return [
    make(new Date(2026,4,1,8,42,0),  '1234', createCameraImage('sample','#0f766e','#d9f2ee')),
    make(new Date(2026,4,2,19,12,0), '1200', createCameraImage('sample','#a74f16','#fff2e6')),
    make(new Date(2026,4,3,7,55,0),  '1234', createCameraImage('sample','#4c6f9f','#eef3ff')),
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
  const [deviceStatus, setDeviceStatus]       = useState({ camera: false, time: false, display: false });
  const filterRef = useRef(null);

  const loadRecords = useCallback(async () => {
    try {
      const res = await fetch('/api/event');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const loaded = (data.events || []).map(item => ({
        id:       item.id || createId(),
        time:     item.timestamp ? parseTimestamp(item.timestamp).toISOString() : new Date().toISOString(),
        dial:     item.input || '',
        location: 'door lock',
        photo:    item.imageUrl || createPlaceholderImage(),
        isCorrect: item.result === 'SUCCESS',
      }));

      // ★ 실제 데이터가 있을 때만 연결됨으로 표시
      if (loaded.length > 0) {
        setRecords(loaded);
        setDeviceStatus({ camera: true, time: true, display: true });
      } else {
        setRecords(createSampleRecords());
        setDeviceStatus({ camera: false, time: false, display: false });
      }

    } catch {
      setDeviceStatus({ camera: false, time: false, display: false });
      setRecords(prev => prev.length > 0 ? prev : createSampleRecords());
    }
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
      alert('Failed to update lock status.');
      return false;
    }
  };

  useEffect(() => {
    loadRecords();
    loadLockStatus();
    const id = setInterval(() => { loadRecords(); loadLockStatus(); }, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [loadRecords, loadLockStatus]);

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
      time: formatDate(r.time) + ' ' + formatTime(r.time),
      password: getDialDisplayText(r.dial),
      result: isCorrectDial(r.dial) ? "success" : "fail",
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
        <title>Smart Door Lock Monitor</title>
        <link rel="stylesheet" href="/style.css" />
      </Head>

      <header className="topbar">
        <div className="brand-group">
          <img className="brand-logo" src="/498268_302696_304.png" alt="logo" />
          <div className="brand-copy">
            <p className="eyebrow">Smart Door Lock Monitor</p>
            <h1>Door Lock Records</h1>
          </div>
        </div>
        <div className="device-status-list">
          {[
            { key: 'camera',  label: 'Camera' },
            { key: 'time',    label: 'Time Device' },
            { key: 'display', label: 'Display Device' },
          ].map(function(item) {
            return (
              <div key={item.key} className={"device-status" + (deviceStatus[item.key] ? '' : ' is-disconnected')}>
                <span className="status-dot" />
                <span>{item.label} {deviceStatus[item.key] ? 'Connected' : 'Disconnected'}</span>
              </div>
            );
          })}
        </div>
      </header>

      <main className="dashboard">

        <section className="calendar-panel">
          <article className="calendar-card">
            <div className="calendar-header">
              <button className="icon-button" type="button"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>
                {'<'}
              </button>
              <h2>{calendarMonth.getFullYear()} / {calendarMonth.getMonth() + 1}</h2>
              <button className="icon-button" type="button"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>
                {'>'}
              </button>
            </div>
            <div className="calendar-weekdays">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(function(d) { return <span key={d}>{d}</span>; })}
            </div>
            <div className="calendar-grid">{renderCalendar()}</div>
          </article>

          <article className="daily-card">
            <div className="section-title">
              <div>
                <p className="eyebrow">Selected Date</p>
                <h2>{formatDate(selectedDateKey)}</h2>
              </div>
              <span>{dayRecords.length} records</span>
            </div>
            <div className="daily-list">
              {dayRecords.length === 0
                ? <p className="empty-message">No records for this date</p>
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
          <button className="primary-button" type="button" onClick={downloadJson}>Export JSON</button>
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
                    {recordFilter === 'recent'  ? 'Recent 7 days' :
                     recordFilter === 'wrong'   ? 'Wrong input' : 'Correct input'}
                  </span>
                </button>
                {filterMenuOpen && (
                  <div className="log-filter-menu" role="listbox">
                    {[
                      { key: 'recent',  label: 'Recent 7 days' },
                      { key: 'wrong',   label: 'Wrong input' },
                      { key: 'correct', label: 'Correct input' },
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
              <span>{filteredRecords.length} shown</span>
            </div>

            <div className="log-list">
              {filteredRecords.length === 0
                ? <p className="empty-message">No records</p>
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
                        <img src={record.photo} alt="door lock camera" />
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
                alt="door lock camera photo"
              />
            </div>
            <div className="detail-info">
              <p className="eyebrow">Selected Record</p>
              <h2>
                {selectedRecord
                  ? (isCorrectDial(selectedRecord.dial) ? 'Correct Input' : 'Wrong Input')
                  : 'Select a record'}
              </h2>
              <dl>
                <div>
                  <dt>Time</dt>
                  <dd>{selectedRecord ? formatDate(selectedRecord.time) + ' ' + formatTime(selectedRecord.time) : '-'}</dd>
                </div>
                <div>
                  <dt>Input</dt>
                  <dd>{selectedRecord ? getDialDisplayText(selectedRecord.dial) : '-'}</dd>
                </div>
              </dl>
            </div>
          </section>
        </section>

        <section className="lock-panel">
          <div className="section-title">
            <h2>Display Input Lock</h2>
            <span>{isLocked ? 'Locked' : 'Unlocked'}</span>
          </div>
          <div className="lock-control">
            <div>
              <p className="lock-title">Touch Input Control</p>
              <p className="lock-description">Block touch input on the display during remote demo.</p>
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
              ? 'Touch input is currently blocked.'
              : 'Touch input is currently allowed.'}
          </p>
        </section>

        {showLockModal && (
          <div
            className="modal-backdrop"
            onClick={function(e) { if (e.target === e.currentTarget) setShowLockModal(false); }}
          >
            <section className="warning-modal" role="dialog">
              <p className="eyebrow">Remote Control</p>
              <h2>Lock display input?</h2>
              <p>Touch input on the door lock display will be blocked while locked.</p>
              <div className="modal-actions">
                <button className="ghost-button" type="button" onClick={() => setShowLockModal(false)}>Cancel</button>
                <button className="danger-button" type="button"
                  onClick={function() { sendLockStatus(true); setShowLockModal(false); }}>Lock</button>
              </div>
            </section>
          </div>
        )}

      </main>
    </div>
  );
}