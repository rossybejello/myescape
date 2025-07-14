-- Users table with serial codes
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    serial_code VARCHAR(12) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    password_hash TEXT NOT NULL,
    avatar_url TEXT,
    status VARCHAR(20) DEFAULT 'Online',
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts/Friends table
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    user_serial VARCHAR(12) REFERENCES users(serial_code),
    contact_serial VARCHAR(12) REFERENCES users(serial_code),
    is_blocked BOOLEAN DEFAULT FALSE,
    is_muted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat rooms
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    room_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200),
    created_by VARCHAR(12) REFERENCES users(serial_code),
    is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message history
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(100) UNIQUE NOT NULL,
    room_id VARCHAR(100) REFERENCES rooms(room_id),
    from_serial VARCHAR(12) REFERENCES users(serial_code),
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text',
    sequence_number INTEGER,
    is_encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WebRTC signaling
CREATE TABLE IF NOT EXISTS signals (
    id SERIAL PRIMARY KEY,
    room_id VARCHAR(100),
    from_serial VARCHAR(12),
    signal_type VARCHAR(20),
    signal_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    reporter_serial VARCHAR(12) REFERENCES users(serial_code),
    reported_serial VARCHAR(12) REFERENCES users(serial_code),
    message_id VARCHAR(100),
    reason VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_serial VARCHAR(12) REFERENCES users(serial_code),
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
