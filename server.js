require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// WICHTIG: Hier nutzen wir das installierte @vonage/server-sdk
const { Vonage } = require('@vonage/server-sdk'); 

// Andere Bibliotheken aus deiner package.json (vorbereitet)
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3000;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- SUPABASE SETUP (Optional, falls du es schon nutzt) ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
// Nur initialisieren, wenn Variablen da sind, um Crash zu vermeiden
const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;


// --- VONAGE (SMS) FIX & SETUP ---
// Hier wird der Private Key repariert
let vonagePrivateKey = process.env.VONAGE_PRIVATE_KEY;

if (!vonagePrivateKey) {
    console.warn("⚠️ WARNUNG: VONAGE_PRIVATE_KEY fehlt in den Environment Variables.");
} else {
    // Railway speichert Newlines oft als "\n" Text. Wir wandeln das zurück.
    if (vonagePrivateKey.includes('\\n')) {
        vonagePrivateKey = vonagePrivateKey.replace(/\\n/g, '\n');
        console.log("✅ Vonage Private Key Formatierung repariert.");
    }
}

// Vonage Client Initialisierung
let vonage;
try {
    if (process.env.VONAGE_APPLICATION_ID && vonagePrivateKey) {
        vonage = new Vonage({
            applicationId: process.env.VONAGE_APPLICATION_ID,
            privateKey: vonagePrivateKey
        });
        console.log("✅ Vonage Client erfolgreich initialisiert.");
    }
} catch (error) {
    console.error("❌ Fehler beim Initialisieren von Vonage:", error.message);
}


// --- ROUTEN ---

// 1. Health Check (Damit Railway sieht, dass der Server läuft)
app.get('/', (req, res) => {
  res.send('Sunomilo Backend läuft! 🚀');
});

// 2. Test-Route zum Senden einer SMS
app.post('/send-sms', async (req, res) => {
    const { to, text } = req.body;

    if (!vonage) {
        return res.status(500).json({ error: "Vonage wurde nicht korrekt initialisiert." });
    }

    try {
        const from = "Sunomilo"; // Oder deine Brand-Nummer
        // Senden via Vonage Messages API (Sandbox oder Live)
        // Hinweis: Je nach API-Freischaltung nutzt man sendSms oder messages.send
        // Hier der Standardweg für SDK v3 SMS:
        await vonage.sms.send({ to, from, text })
            .then(resp => {
                console.log('Nachricht gesendet:', resp.messages);
                res.json({ success: true, messages: resp.messages });
            })
            .catch(err => {
                console.error('Vonage API Fehler:', err);
                res.status(500).json({ error: err.message });
            });
    } catch (error) {
        console.error("Server Fehler beim SMS Senden:", error);
        res.status(500).json({ error: error.message });
    }
});

// ... dein ganzer Code von vorhin ...

// --- TEST-BLOCK: SMS DIREKT BEIM START SENDEN ---
// (Diesen Block kannst du später wieder löschen)
if (vonage) {
  const testNummer = "436603174740"; // Deine Nummer
  const testText = "Hallo! Der Server funktioniert und sendet SMS.";

  console.log("📨 Versuche Test-SMS beim Server-Start zu senden...");
  
  vonage.sms.send({ to: testNummer, from: "Sunomilo", text: testText })
      .then(resp => {
        // Vonage antwortet immer, auch bei Fehlern (z.B. Guthaben leer)
        const status = resp.messages[0].status;
        if (status === "0") {
          console.log("✅ SMS ERFOLGREICH VERSENDET!");
        } else {
          console.log(`❌ SMS FEHLGESCHLAGEN. Vonage Status: ${status}`);
          console.log("Fehler-Details:", resp.messages[0]['error-text']);
        }
      })
      .catch(err => {
        console.error("❌ NETZWERK/API FEHLER:", err);
      });
}
// --- ENDE TEST-BLOCK ---

// app.listen(...) kommt hier drunter

// --- SERVER STARTEN ---
app.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});
