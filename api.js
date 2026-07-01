import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

// In-memory storage (will be cleared on serverless function cold start)
// For production, use Redis or database
const sessions = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Generate unique token
    const token = uuidv4();
    const sessionData = {
      token,
      status: 'waiting', // waiting, scanned, confirmed, rejected
      createdAt: Date.now(),
      imei: null,
      cookies: null,
      qrImage: null
    };

    // Generate QR code
    const qrData = `zalo://qr?token=${token}`;
    const qrImage = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'L',
      margin: 2,
      width: 400,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    sessionData.qrImage = qrImage;
    sessions.set(token, sessionData);

    // Clean up old sessions (older than 5 minutes)
    const now = Date.now();
    for (const [key, value] of sessions.entries()) {
      if (now - value.createdAt > 300000) {
        sessions.delete(key);
      }
    }

    return res.status(200).json({
      success: true,
      session_token: token,
      qr_image: qrImage.split(',')[1], // Remove data:image/png;base64,
      code: token,
      message: 'QR đã được tạo thành công'
    });
  } catch (error) {
    console.error('Generate QR error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Không thể tạo QR'
    });
  }
}

// Export sessions for other API routes
export { sessions };
