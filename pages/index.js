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
    make(new Date(2026,4,1,8,42,0),  '1234', createCameraImage('샘플 데이터','#0f766e','#d9f2ee')),
    make(new Date(2026,4,2,19,12,0), '1200', createCameraImage('샘플 데이터','#a74f16','#fff2e6')),
    make(new Date(2026,4,3,7,55,0),  '1234', createCameraImage('샘플 데이터','#4c6f9f','#eef3ff')),
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
        location: '현관 도어락',
        photo:    item.imageFile || createPlaceholderImage(),
        isCorrect: item.result === 'SUCCESS',
      }));
      setRecords(loaded.length > 0 ? loaded : createSampleRecords());
      setDeviceStatus({ camera: true, time: true, display: true });
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
      alert('입력 잠금 상태 변경에 실패했습니다.');
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
      time: `${formatDate(r.time)} ${formatTime(r.time)}`,
      password: getDialDisplayText(r.dial),
      result: isCorrectDial(r.dial) ? '성공' : '실패',
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL