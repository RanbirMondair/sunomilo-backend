require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { Vonage } = require('@vonage/server-sdk');

const app = express();
// Railway nutzt meist Port 8080, daher nehmen wir process.env.PORT
const port = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());

const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET
});

// TEST-ROUTE
app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ message: 'SunoMilo API läuft!', db_time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ error: 'DB Verbindung fehlgeschlagen' });
  }
});

// 1. SMS SENDEN & IN DB SPEICHERN
app.post('/send-sms', async (req, res) => {
    const { to, text } = req.body;
    const codeMatch = text.match(/\d+/);
    const code = codeMatch ? codeMatch[0] : null;

    try {
        await vonage.sms.send({ to, from: "Sunomilo", text });
        await pool.query(
            'INSERT INTO users (phone, verification_code, name, email, password_hash) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (phone) DO UPDATE SET verification_code = $2',
            [to, code, 'TestUser', `${to}@temp.com`, 'placeholder']
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. NEU: LOGIN ROUTE (Damit der HTML-Fehler verschwindet)
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length > 0) {
            res.json({ success: true, token: 'fake-jwt-token', user: result.rows[0] });
        } else {
            res.status(401).json({ error: 'User nicht gefunden' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. NEU: REGISTER ROUTE
app.post('/api/auth/register', async (req, res) => {
    const { name, email, phone } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO users (name, email, phone, password_hash) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, email, phone, 'hashed_password']
        );
        res.json({ success: true, token: 'fake-jwt-token', user: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});
