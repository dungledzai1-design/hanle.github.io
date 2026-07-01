import { sessions } from './generate';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }

  const session = sessions.get(token);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Simulate QR scanning flow for demo
  const elapsed = (Date.now() - session.createdAt) / 1000;

  if (session.status === 'waiting') {
    if (elapsed > 3) { // After 3 seconds, simulate scanned
      session.status = 'scanned';
    }
  } else if (session.status === 'scanned') {
    if (elapsed > 6) { // After 6 seconds, simulate confirmed
      session.status = 'confirmed';
      // Generate mock data
      session.imei = `IMEI_${Date.now()}`;
      session.cookies = {
        'zpw_sek': `sek_${Math.random().toString(36).substring(2, 15)}`,
        'zpw_skl': `skl_${Math.random().toString(36).substring(2, 15)}`,
        'zpw_sks': `sks_${Math.random().toString(36).substring(2, 15)}`,
        'session_id': `zalo_${Math.random().toString(36).substring(2, 20)}`
      };
    }
  }

  const response = {
    status: session.status,
    token: token
  };

  if (session.status === 'confirmed') {
    response.imei = session.imei;
    response.cookies = session.cookies;
    response.data = {
      imei: session.imei,
      cookies: session.cookies
    };
  }

  return res.status(200).json(response);
}
