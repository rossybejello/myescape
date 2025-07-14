import { pool } from './_lib/db.js';
import { makeSerial } from './_lib/serial.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { username, phone, password } = req.body || {};
  if (!username || !phone || !password) return res.status(400).end('Missing fields');

  const hash = bcrypt.hashSync(password, 10);

  for (let i = 0; i < 3; i++) {
    const serial = makeSerial();
    try {
      const { rows } = await pool.query(
        `INSERT INTO users (serial_code, username, phone, password_hash)
         VALUES ($1,$2,$3,$4) RETURNING serial_code`,
        [serial, username, phone, hash]
      );
      return res.status(201).json({ serial: rows[0].serial_code });
    } catch (err) {
      if (err.code === '23505') continue;
      console.error(err); return res.status(500).end();
    }
  }
  res.status(500).end('Could not generate unique serial');
}
