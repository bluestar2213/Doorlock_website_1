let lockState = { locked: false };

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { locked } = req.body;
    lockState.locked = locked;
    console.log(`[LOCK] ${locked ? 'LOCKED' : 'UNLOCKED'}`);
    return res.status(200).json({ ok: true, locked: lockState.locked });
  }

  if (req.method === 'GET') {
    return res.status(200).json({ locked: lockState.locked });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}