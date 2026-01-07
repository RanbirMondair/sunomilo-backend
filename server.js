require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { Vonage } = require('@vonage/server-sdk');

const app = express();
// Railway nutzt Port 8080 oder den aus der Umgebungsvariable
const port = process.env.PORT || 8080; 

// Datenbank-Verbindung mit SSL für Railway
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());

// Logging für eingehende Anfragen (hilft bei der Fehlersuche im Railway Log)
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
    res.json({ 
      message: 'SunoMilo API läuft!', 
      db_time: result.rows[0].now,
      status: 'Datenbank verbunden' 
    });
  } catch (err) {
    console.error("DB Error:", err.message);
    res.status(500).json({ error: 'DB Verbindung fehlgeschlagen' });
  }
});

// --- 2. SMS SENDEN & VERIFIZIERUNG ---
app.post('/send-sms', async (req, res) => {
    const { to, text } = req.body;
    const codeMatch = text.match(/\d+/);
    const code = codeMatch ? codeMatch[0] : null;

    try {
        // SMS via Vonage senden
        await vonage.sms.send({ to, from: "Sunomilo", text });

        // WICHTIG: first_name und last_name hinzugefügt, damit die DB den User akzeptiert
        await pool.query(
            `INSERT INTO users (phone, verification_code, name, first_name, last_name, email, password_hash) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             ON CONFLICT (phone) DO UPDATE SET verification_code = $2`,
            [to, code, 'NewUser', 'New', 'User', `${to}@temp.com`, 'placeholder']
        );

        res.json({ success: true, message: 'Code gesendet' });
    } catch (error) {
        console.error("SMS/DB Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- 3. OPTIMIERTE DISCOVERY (Bilder laden) ---
app.get('/api/discovery', async (req, res) => {
  try {
    // Holt User und deren Bilder-Array. Sortiert nach ID absteigend (neueste zuerst).
    const query = `
      SELECT u.id, u.first_name, u.name, u.phone, 
             json_agg(pi.image_url) as images
      FROM users u
      LEFT JOIN profile_images pi ON u.id = pi.user_id
      GROUP BY u.id
      ORDER BY u.id DESC
      LIMIT 50;
    `;
    
    const result = await pool.query(query);
    res.json(result.rows); 
  } catch (err) {
    console.error("Discovery Error:", err.message);
    res.status(500).json({ error: "Profile konnten nicht geladen werden" });
  }
});

// --- 4. AUTH-ROUTEN ---
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length > 0) {
            res.json({ success: true, token: 'session-token-active', user: result.rows[0] });
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
        // WICHTIG: Auch hier first_name und last_name hinzugefügt
        const result = await pool.query(
            `INSERT INTO users (name, first_name, last_name, email, phone, password_hash) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING *`,
            [name, name, 'User', email, phone, 'hashed_password']
        );
        res.json({ success: true, token: 'registration-token-active', user: result.rows[0] });
    } catch (error) {
        console.error("Register Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
  console.log(`🚀 SunoMilo Backend aktiv auf Port ${port}`);
});
