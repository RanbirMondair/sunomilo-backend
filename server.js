require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { Vonage } = require('@vonage/server-sdk');

const app = express();
const port = process.env.PORT || 8080; 

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`📡 ${req.method} Anfrage an: ${req.url}`);
  next();
});

const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET
});

// --- 1. TEST-ROUTE ---
app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ message: 'SunoMilo API läuft!', status: 'Datenbank verbunden' });
  } catch (err) {
    res.status(500).json({ error: 'DB Verbindung fehlgeschlagen' });
  }
});

// --- 2. SMS SENDEN & VERIFIZIERUNG ---
app.post('/send-sms', async (req, res) => {
    const { to, text } = req.body;
    const codeMatch = text.match(/\d+/);
    const code = codeMatch ? codeMatch[0] : null;

    try {
        await vonage.sms.send({ to, from: "Sunomilo", text });

        // Wir lassen 'verification_code' weg, falls die Spalte fehlt, 
        // und nutzen 'password_hash' als temporären Speicher für den Code
        await pool.query(
            `INSERT INTO users (phone, name, first_name, last_name, email, password_hash) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             ON CONFLICT (phone) DO UPDATE SET password_hash = $6`,
            [to, 'NewUser', 'New', 'User', `${to}@temp.com`, code]
        );

        res.json({ success: true, message: 'Code gesendet' });
    } catch (error) {
        console.error("SMS/DB Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- 3. DISCOVERY ---
app.get('/api/discovery', async (req, res) => {
  try {
    const query = `
      SELECT u.id, u.first_name, u.name, u.phone, 
             json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL) as images
      FROM users u
      LEFT JOIN profile_images pi ON u.id = pi.user_id
      GROUP BY u.id
      ORDER BY u.id DESC
      LIMIT 50;
    `;
    const result = await pool.query(query);
    res.json(result.rows); 
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden" });
  }
});

// --- 4. AUTH-ROUTEN ---
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length > 0) {
            res.json({ success: true, token: 'session-token', user: result.rows[0] });
        } else {
            res.status(401).json({ error: 'User nicht gefunden' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/register', async (req, res) => {
    const { name, email, phone } = req.body;
    try {
        // WICHTIG: Wir lassen die 'id' weg! Die Datenbank vergibt sie automatisch (SERIAL).
        // Das verhindert den "duplicate key" Fehler.
        const result = await pool.query(
            `INSERT INTO users (name, first_name, last_name, email, phone, password_hash) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING *`,
            [name, name, 'User', email, phone, 'hashed_password']
        );
        res.json({ success: true, token: 'reg-token', user: result.rows[0] });
    } catch (error) {
        console.error("Register Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
  console.log(`🚀 Server aktiv auf Port ${port}`);
});
