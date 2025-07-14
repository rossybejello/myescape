import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { room, afterSeq = 0 } = req.query;

    try {
      const { rows } = await sql`
        SELECT m.message_id, m.from_serial, m.content, m.message_type, 
               m.sequence_number, m.created_at, u.username, u.avatar_url
        FROM messages m
        JOIN users u ON m.from_serial = u.serial_code
        WHERE m.room_id = ${room} AND m.sequence_number > ${afterSeq}
        ORDER BY m.sequence_number ASC
        LIMIT 100
      `;

      res.json(rows.map(row => ({
        id: row.message_id,
        from: row.from_serial,
        username: row.username,
        avatar: row.avatar_url,
        content: row.content,
        type: row.message_type,
        seq: row.sequence_number,
        timestamp: row.created_at
      })));
    } catch (error) {
      console.error('History error:', error);
      res.status(500).json({ error: 'Failed to get history' });
    }
  } else if (req.method === 'POST') {
    const { room, messageId, from, content, type = 'text', seq } = req.body;

    try {
      await sql`
        INSERT INTO messages (message_id, room_id, from_serial, content, message_type, sequence_number)
        VALUES (${messageId}, ${room}, ${from}, ${content}, ${type}, ${seq})
      `;

      res.json({ success: true });
    } catch (error) {
      console.error('Save message error:', error);
      res.status(500).json({ error: 'Failed to save message' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
