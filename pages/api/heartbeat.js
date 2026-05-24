let deviceStatus = {};

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { deviceId, status, ip } = req.body;
    deviceStatus[deviceId] = { status, ip, lastSeen: new Date().toISOString() };
    console.log(`[HEARTBEAT] ${deviceId} is ${status} @ ${ip}`);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    const deviceId = req.query.deviceId || 'ESP32-DOORLOCK-01';
    const info = deviceStatus[deviceId];
    if (!info) return res.status(200).json({ status: 'offline', lastSeen: null });
    const isOnline = (Date.now() - new Date(info.lastSeen).getTime()) < 60000;
    return res.status(200).json({
      status: isOnline ? 'online' : 'offline',
      ip: info.ip,
      lastSeen: info.lastSeen
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}