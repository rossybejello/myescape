import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { serial } = req.query;

    try {
      const { rows } = await sql`
        SELECT u.serial_code, u.username, u.avatar_url, u.status, 
               c.is_blocked, c.is_muted
        FROM contacts c
        JOIN users u ON c.contact_serial = u.serial_code
        WHERE c.user_serial = ${serial}
        ORDER BY u.username ASC
      `;

      res.json(rows.map(row => ({
        serial: row.serial_code,
        username: row.username,
        avatar: row.avatar_url,
        status: row.status,
        isBlocked: row.is_blocked,
        isMuted: row.is_muted
      })));
    } catch (error) {
      console.error('Get contacts error:', error);
      res.status(500).json({ error: 'Failed to get contacts' });
    }
  } else if (req.method === 'POST') {
    const { userSerial, contactSerial } = req.body;

    try {
      // Check if contact exists
      const { rows: userRows } = await sql`
        SELECT 1 FROM users WHERE serial_code = ${contactSerial}
      `;

      if (userRows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Add contact
      await sql`
        INSERT INTO contacts (user_serial, contact_serial)
        VALUES (${userSerial}, ${contactSerial})
        ON CONFLICT (user_serial, contact_serial) DO NOTHING
      `;

      res.json({ success: true });
    } catch (error) {
      console.error('Add contact error:', error);
      res.status(500).json({ error: 'Failed to add contact' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
