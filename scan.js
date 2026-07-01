import { sessions } from './generate';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Missing token' });
    }

    const session = sessions.get(token);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    session.status = 'scanned';
    return res.status(200).json({ success: true, status: 'scanned' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
