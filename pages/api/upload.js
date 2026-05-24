import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name:  process.env.CLOUDINARY_CLOUD_NAME,
  api_key:     process.env.CLOUDINARY_API_KEY,
  api_secret:  process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { timestamp, filename, image } = req.body;

    if (!image) return res.status(400).json({ error: 'No image data' });

    const publicId = 'doorlock/CAPTURE_' + timestamp;

    // base64 데이터 URI로 변환
    const dataUri = 'data:image/jpeg;base64,' + image;

    // Cloudinary 업로드
    const result = await cloudinary.uploader.upload(dataUri, {
      public_id:     publicId,
      resource_type: 'image',
      overwrite:     true,
    });

    console.log('[UPLOAD] Cloudinary URL:', result.secure_url);

    // event.js의 해당 이벤트에 imageUrl 업데이트
    return res.status(200).json({
      ok:       true,
      url:      result.secure_url,
      publicId: publicId,
      filename: filename,
    });

  } catch (err) {
    console.error('[UPLOAD] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}