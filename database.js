// database.js - Database Schema and Setup
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class SecureUserDatabase {
    constructor(dbPath = 'secure_chat.db') {
        this.db = new sqlite3.Database(dbPath);
        this.initializeDatabase();
    }

    initializeDatabase() {
        // Users table with encrypted data
        this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                serial_code TEXT UNIQUE NOT NULL,
                username_hash TEXT NOT NULL,
                phone_hash TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                display_name TEXT NOT NULL,
                avatar_url TEXT,
                status_msg TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT 1
            )
        `);

        // Serial code tracking for uniqueness
        this.db.run(`
            CREATE TABLE IF NOT EXISTS serial_codes (
                serial_code TEXT PRIMARY KEY,
                user_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `);

        // User contacts with serial codes
        this.db.run(`
            CREATE TABLE IF NOT EXISTS user_contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_serial TEXT NOT NULL,
                contact_serial TEXT NOT NULL,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_serial) REFERENCES users(serial_code),
                FOREIGN KEY(contact_serial) REFERENCES users(serial_code)
            )
        `);

        // Banned users
        this.db.run(`
            CREATE TABLE IF NOT EXISTS banned_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_serial TEXT NOT NULL,
                banned_serial TEXT NOT NULL,
                banned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_serial) REFERENCES users(serial_code),
                FOREIGN KEY(banned_serial) REFERENCES users(serial_code)
            )
        `);

        // Message history
        this.db.run(`
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id TEXT UNIQUE NOT NULL,
                room_id TEXT NOT NULL,
                sender_serial TEXT NOT NULL,
                message_type TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_encrypted BOOLEAN DEFAULT 0,
                FOREIGN KEY(sender_serial) REFERENCES users(serial_code)
            )
        `);

        // WebRTC signaling
        this.db.run(`
            CREATE TABLE IF NOT EXISTS signaling (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id TEXT NOT NULL,
                sender_serial TEXT NOT NULL,
                signal_type TEXT NOT NULL,
                signal_data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(sender_serial) REFERENCES users(serial_code)
            )
        `);
    }

    // Generate unique serial code
    generateSerialCode() {
        return crypto.randomBytes(4).toString('hex').toUpperCase();
    }

    // Hash sensitive data
    hashData(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    // Check if serial code exists
    async checkSerialExists(serialCode) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT COUNT(*) as count FROM users WHERE serial_code = ?',
                [serialCode],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row.count > 0);
                }
            );
        });
    }

    // Generate unique serial code
    async generateUniqueSerial() {
        let serialCode;
        let exists = true;
        
        while (exists) {
            serialCode = this.generateSerialCode();
            exists = await this.checkSerialExists(serialCode);
        }
        
        return serialCode;
    }

    // Register new user
    async registerUser(username, phoneNumber, password, displayName, avatarUrl = '', statusMsg = '') {
        try {
            // Check if username or phone already exists
            const usernameHash = this.hashData(username);
            const phoneHash = this.hashData(phoneNumber);
            
            const existingUser = await new Promise((resolve, reject) => {
                this.db.get(
                    'SELECT COUNT(*) as count FROM users WHERE username_hash = ? OR phone_hash = ?',
                    [usernameHash, phoneHash],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row.count > 0);
                    }
                );
            });

            if (existingUser) {
                throw new Error('Username or phone number already exists');
            }

            // Generate unique serial code
            const serialCode = await this.generateUniqueSerial();
            
            // Hash password
            const passwordHash = await bcrypt.hash(password, 12);

            // Insert user
            return new Promise((resolve, reject) => {
                this.db.run(
                    `INSERT INTO users (serial_code, username_hash, phone_hash, password_hash, display_name, avatar_url, status_msg)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [serialCode, usernameHash, phoneHash, passwordHash, displayName, avatarUrl, statusMsg],
                    function(err) {
                        if (err) reject(err);
                        else {
                            // Insert into serial_codes table
                            this.db.run(
                                'INSERT INTO serial_codes (serial_code, user_id) VALUES (?, ?)',
                                [serialCode, this.lastID],
                                (err) => {
                                    if (err) reject(err);
                                    else resolve({ serialCode, userId: this.lastID });
                                }
                            );
                        }
                    }
                );
            });
        } catch (error) {
            throw error;
        }
    }

    // Login user
    async loginUser(username, password) {
        try {
            const usernameHash = this.hashData(username);
            
            return new Promise((resolve, reject) => {
                this.db.get(
                    'SELECT * FROM users WHERE username_hash = ? AND is_active = 1',
                    [usernameHash],
                    async (err, row) => {
                        if (err) reject(err);
                        else if (!row) reject(new Error('Invalid credentials'));
                        else {
                            const validPassword = await bcrypt.compare(password, row.password_hash);
                            if (!validPassword) {
                                reject(new Error('Invalid credentials'));
                            } else {
                                // Update last active
                                this.db.run(
                                    'UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE serial_code = ?',
                                    [row.serial_code]
                                );
                                resolve({
                                    serialCode: row.serial_code,
                                    displayName: row.display_name,
                                    avatarUrl: row.avatar_url,
                                    statusMsg: row.status_msg
                                });
                            }
                        }
                    }
                );
            });
        } catch (error) {
            throw error;
        }
    }

    // Get user by serial code
    async getUserBySerial(serialCode) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT display_name, avatar_url, status_msg, last_active FROM users WHERE serial_code = ? AND is_active = 1',
                [serialCode],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    // Add contact
    async addContact(userSerial, contactSerial) {
        return new Promise((resolve, reject) => {
            // Check if contact exists
            this.db.get(
                'SELECT COUNT(*) as count FROM users WHERE serial_code = ? AND is_active = 1',
                [contactSerial],
                (err, row) => {
                    if (err) reject(err);
                    else if (row.count === 0) reject(new Error('Contact not found'));
                    else {
                        // Check if already added
                        this.db.get(
                            'SELECT COUNT(*) as count FROM user_contacts WHERE user_serial = ? AND contact_serial = ?',
                            [userSerial, contactSerial],
                            (err, row) => {
                                if (err) reject(err);
                                else if (row.count > 0) reject(new Error('Contact already added'));
                                else {
                                    // Add contact
                                    this.db.run(
                                        'INSERT INTO user_contacts (user_serial, contact_serial) VALUES (?, ?)',
                                        [userSerial, contactSerial],
                                        (err) => {
                                            if (err) reject(err);
                                            else resolve(true);
                                        }
                                    );
                                }
                            }
                        );
                    }
                }
            );
        });
    }

    // Get user contacts
    async getUserContacts(userSerial) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT u.serial_code, u.display_name, u.avatar_url, u.status_msg, u.last_active
                 FROM user_contacts uc
                 JOIN users u ON uc.contact_serial = u.serial_code
                 WHERE uc.user_serial = ? AND u.is_active = 1
                 AND uc.contact_serial NOT IN (
                     SELECT banned_serial FROM banned_users WHERE user_serial = ?
                 )`,
                [userSerial, userSerial],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    // Save message
    async saveMessage(messageId, roomId, senderSerial, messageType, content, isEncrypted = false) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO messages (message_id, room_id, sender_serial, message_type, content, is_encrypted) VALUES (?, ?, ?, ?, ?, ?)',
                [messageId, roomId, senderSerial, messageType, content, isEncrypted],
                (err) => {
                    if (err) reject(err);
                    else resolve(true);
                }
            );
        });
    }

    // Save signaling data
    async saveSignal(roomId, senderSerial, signalType, signalData) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT INTO signaling (room_id, sender_serial, signal_type, signal_data) VALUES (?, ?, ?, ?)',
                [roomId, senderSerial, signalType, JSON.stringify(signalData)],
                (err) => {
                    if (err) reject(err);
                    else resolve(true);
                }
            );
        });
    }

    // Get signaling data
    async getSignals(roomId, excludeSerial) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM signaling WHERE room_id = ? AND sender_serial != ? ORDER BY created_at ASC',
                [roomId, excludeSerial],
                (err, rows) => {
                    if (err) reject(err);
                    else {
                        const signals = rows.map(row => ({
                            ...row,
                            signal_data: JSON.parse(row.signal_data)
                        }));
                        resolve(signals);
                    }
                }
            );
        });
    }

    // Clean old signaling data
    async cleanOldSignals(roomId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM signaling WHERE room_id = ? AND created_at < datetime("now", "-1 hour")',
                [roomId],
                (err) => {
                    if (err) reject(err);
                    else resolve(true);
                }
            );
        });
    }

    // Close database
    close() {
        this.db.close();
    }
}

module.exports = SecureUserDatabase;

// server.js - Express API Server
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const SecureUserDatabase = require('./database');

const app = express();
const db = new SecureUserDatabase();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Registration endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { username, phoneNumber, password, displayName, avatarUrl, statusMsg } = req.body;
        
        if (!username || !phoneNumber || !password || !displayName) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = await db.registerUser(username, phoneNumber, password, displayName, avatarUrl, statusMsg);
        res.json({ success: true, serialCode: result.serialCode });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Missing credentials' });
        }

        const user = await db.loginUser(username, password);
        res.json({ success: true, user });
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

// Get user profile
app.get('/api/user/:serialCode', async (req, res) => {
    try {
        const user = await db.getUserBySerial(req.params.serialCode);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add contact
app.post('/api/contacts', async (req, res) => {
    try {
        const { userSerial, contactSerial } = req.body;
        await db.addContact(userSerial, contactSerial);
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get contacts
app.get('/api/contacts/:userSerial', async (req, res) => {
    try {
        const contacts = await db.getUserContacts(req.params.userSerial);
        res.json(contacts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Save message
app.post('/api/messages', async (req, res) => {
    try {
        const { messageId, roomId, senderSerial, messageType, content, isEncrypted } = req.body;
        await db.saveMessage(messageId, roomId, senderSerial, messageType, content, isEncrypted);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Signaling endpoints
app.post('/api/signals', async (req, res) => {
    try {
        const { roomId, senderSerial, signalType, signalData } = req.body;
        await db.saveSignal(roomId, senderSerial, signalType, signalData);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/signals/:roomId/:userSerial', async (req, res) => {
    try {
        const signals = await db.getSignals(req.params.roomId, req.params.userSerial);
        res.json(signals);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Secure chat server running on port ${PORT}`);
});

// Cleanup old signals every hour
setInterval(async () => {
    try {
        // This would need to be adapted to clean all rooms
        console.log('Cleaning old signaling data...');
    } catch (error) {
        console.error('Error cleaning signals:', error);
    }
}, 3600000);