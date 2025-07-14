import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { reporter, reported, messageId, reason } = req.body;

  if (!reporter || !reason) {
    return res.status(400).json({ error: 'Reporter and reason required' });
  }

  try {
    await sql`
      INSERT INTO reports (reporter_serial, reported_serial, message_id, reason)
      VALUES (${reporter}, ${reported || null}, ${messageId || null}, ${reason})
    `;

    res.json({ success: true, message: 'Report submitted successfully' });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
}
