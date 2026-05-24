let eventLog = [];

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { timestamp, input, result, imageFile, deviceId } = req.body;
    const event = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      timestamp, input, result, imageFile, deviceId
    };
    eventLog.unshift(event);
    if (eventLog.length > 100) eventLog.pop();
    console.log('[EVENT]', event);
    return res.status(200).json({ ok: true, received: event });
  }

  if (req.method === 'GET') {
    return res.status(200).json({ events: eventLog });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}