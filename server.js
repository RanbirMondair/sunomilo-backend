require('dotenv').config(); // Falls du .env lokal nutzt
const { Vonage } = require('@vonage/server-client');

// --- START DES FIXES ---

// 1. Key laden
let privateKey = process.env.VONAGE_PRIVATE_KEY;

// 2. Prüfen und Reparieren (Das ist der wichtige Teil!)
if (!privateKey) {
  console.error("ACHTUNG: Kein Private Key in den Umgebungsvariablen gefunden!");
} else {
  // Ersetzt das wörtliche "\n" durch echte Zeilenumbrüche, falls Railway das verhauen hat
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }
}

// 3. Client erstellen
const vonage = new Vonage({
  applicationId: process.env.VONAGE_APPLICATION_ID,
  privateKey: privateKey
});

// --- ENDE DES FIXES ---


// ... Hier drunter kommt dein restlicher Code (z.B. app.post(...) oder deine SMS Funktion)
