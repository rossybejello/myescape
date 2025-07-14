import { pool } from './_lib/db.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { serial, password } = req.body || {};
  const { rows } = await pool.query(
    `SELECT password_hash, username, phone FROM users WHERE serial_code=$1`,
    [serial]
  );
  if (!rows[0] || !bcrypt.compareSync(password, rows[0].password_hash))
    return res.status(401).end('Bad credentials');

  // Strip hash before returning
  delete rows[0].password_hash;
  res.json(rows[0]);
}
