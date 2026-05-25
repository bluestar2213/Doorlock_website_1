let eventLog = [];

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-HTTP-Method-Override');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const override = req.headers['x-http-method-override'];

    // PATCH 대용 (X-HTTP-Method-Override: PATCH)
    if (override === 'PATCH') {
      const { timestamp, imageUrl } = req.body;
      const event = eventLog.find(e => e.timestamp === timestamp);
      if (event) {
        event.imageUrl = imageUrl;
        console.log('[EVENT] imageUrl updated:', timestamp, imageUrl);
        return res.status(200).json({ ok: true });
      }
      return res.status(404).json({ error: 'Event not found' });
    }

    // 일반 POST: 이벤트 등록
    const { timestamp, input, result, imageFile, imageUrl, deviceId } = req.body;
    const event = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      timestamp, input, result,
      imageFile,
      imageUrl: imageUrl || null,
      deviceId
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