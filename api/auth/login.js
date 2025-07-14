import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { serial, password } = req.body;

  if (!serial || !password) {
    return res.status(400).json({ error: 'Serial and password required' });
  }

  try {
    const { rows } = await sql`
      SELECT serial_code, username, phone, password_hash, avatar_url, status
      FROM users 
      WHERE serial_code = ${serial} AND is_blocked = FALSE
    `;

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const isValidPassword = bcrypt.compareSync(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await sql`
      UPDATE users 
      SET updated_at = NOW() 
      WHERE serial_code = ${serial}
    `;

    res.json({
      success: true,
      user: {
        serial: user.serial_code,
        username: user.username,
        phone: user.phone,
        avatar: user.avatar_url,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}
