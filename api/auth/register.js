import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

function generateSerial() {
  const chars = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, phone, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    // Generate unique serial code
    let serial, attempts = 0;
    do {
      serial = generateSerial();
      attempts++;
      if (attempts > 10) {
        return res.status(500).json({ error: 'Could not generate unique serial' });
      }
    } while (await sql`SELECT 1 FROM users WHERE serial_code = ${serial}`.then(r => r.rows.length > 0));

    // Insert user
    await sql`
      INSERT INTO users (serial_code, username, phone, password_hash)
      VALUES (${serial}, ${username}, ${phone || ''}, ${hashedPassword})
    `;

    res.status(201).json({ 
      success: true, 
      serial,
      message: 'User registered successfully' 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
}
