import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { room, from, sdp, candidate } = req.body;

    try {
      await sql`
        INSERT INTO signals (room_id, from_serial, signal_type, signal_data)
        VALUES (${room}, ${from}, ${sdp ? 'sdp' : 'candidate'}, ${JSON.stringify(sdp || candidate)})
      `;
      
      res.json({ success: true });
    } catch (error) {
      console.error('Signal error:', error);
      res.status(500).json({ error: 'Failed to store signal' });
    }
  } else if (req.method === 'GET') {
    const { room } = req.query;

    try {
      const { rows } = await sql`
        SELECT from_serial, signal_type, signal_data, created_at
        FROM signals 
        WHERE room_id = ${room}
        ORDER BY created_at ASC
      `;

      // Clean up old signals (older than 1 hour)
      await sql`
        DELETE FROM signals 
        WHERE created_at < NOW() - INTERVAL '1 hour'
      `;

      res.json(rows.map(row => ({
        from: row.from_serial,
        type: row.signal_type,
        data: row.signal_data,
        timestamp: row.created_at
      })));
    } catch (error) {
      console.error('Get signals error:', error);
      res.status(500).json({ error: 'Failed to get signals' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
