import { sessions } from './generate';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, imei, cookies } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Missing token' });
    }

    const session = sessions.get(token);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    session.status = 'confirmed';
    session.imei = imei || `IMEI_${Date.now()}`;
    session.cookies = cookies || {
      'zpw_sek': `sek_${Math.random().toString(36).substring(2, 15)}`,
      'zpw_skl': `skl_${Math.random().toString(36).substring(2, 15)}`,
      'zpw_sks': `sks_${Math.random().toString(36).substring(2, 15)}`
    };

    return res.status(200).json({ success: true, status: 'confirmed' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
