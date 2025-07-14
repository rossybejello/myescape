// api/user/profile.js

import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Get user profile by serial code
    const { serial } = req.query;
    if (!serial) return res.status(400).json({ error: 'Serial required' });

    try {
      const { rows } = await sql`
        SELECT serial_code, username, phone, avatar_url, status
        FROM users
        WHERE serial_code = ${serial}
      `;
      if (!rows.length) return res.status(404).json({ error: 'User not found' });
      const user = rows[0];
      res.json({
        serial: user.serial_code,
        username: user.username,
        phone: user.phone,
        avatar: user.avatar_url,
        status: user.status
      });
    } catch (error) {
      console.error('Profile GET error:', error);
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  } else if (req.method === 'POST') {
    // Update user profile
    const { serial, username, phone, avatar, status, password } = req.body || {};
    if (!serial) return res.status(400).json({ error: 'Serial required' });

    try {
      let updateFields = [];
      let values = [];
      let idx = 2;

      if (username) { updateFields.push(`username = $${idx++}`); values.push(username); }
      if (phone)    { updateFields.push(`phone = $${idx++}`);    values.push(phone); }
      if (avatar)   { updateFields.push(`avatar_url = $${idx++}`);values.push(avatar); }
      if (status)   { updateFields.push(`status = $${idx++}`);    values.push(status); }
      if (password) {
        const hash = bcrypt.hashSync(password, 10);
        updateFields.push(`password_hash = $${idx++}`);
        values.push(hash);
      }

      if (!updateFields.length) return res.status(400).json({ error: 'No fields to update' });

      await sql.unsafe(
        `UPDATE users SET ${updateFields.join(', ')}, updated_at = NOW() WHERE serial_code = $1`,
        [serial, ...values]
      );

      res.json({ success: true, message: 'Profile updated' });
    } catch (error) {
      console.error('Profile POST error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
