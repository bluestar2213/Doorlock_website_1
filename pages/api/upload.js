import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name:  process.env.CLOUDINARY_CLOUD_NAME,
  api_key:     process.env.CLOUDINARY_API_KEY,
  api_secret:  process.env.CLOUDINARY_API_SECRET,
});

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 요청 바디 수집
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    // multipart에서 timestamp 파싱
    const bodyStr = buffer.toString('binary');
    const tsMatch = bodyStr.match(/name="timestamp"\r\n\r\n([^\r\n]+)/);
    const timestamp = tsMatch ? tsMatch[1].trim() : Date.now().toString();
    const publicId = 'doorlock/CAPTURE_' + timestamp;

    // JPEG 데이터 추출
    const jpegStart = buffer.indexOf(Buffer.from([0xFF, 0xD8]));
    const jpegEnd   = buffer.lastIndexOf(Buffer.from([0xFF, 0xD9]));

    if (jpegStart === -1 || jpegEnd === -1) {
      return res.status(400).json({ error: 'No valid JPEG found' });
    }

    const jpegBuffer = buffer.slice(jpegStart, jpegEnd + 2);

    // Cloudinary 업로드
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { public_id: publicId, resource_type: 'image', overwrite: true },
        (error, result) => { if (error) reject(error); else resolve(result); }
      );
      stream.end(jpegBuffer);
    });

    console.log('[UPLOAD] Cloudinary URL:', result.secure_url);
    return res.status(200).json({ ok: true, url: result.secure_url, publicId });

  } catch (err) {
    console.error('[UPLOAD] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}