const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

const profiles = [
  {
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    phone_number: '+43 660 1234567',
    password: '123',
    age: 28,
    gender: 'female',
    location: 'Wien, Österreich',
    bio: 'Liebe das Leben in Wien! 🎨 Kunstliebhaberin, Yoga-Enthusiastin und immer auf der Suche nach neuen Abenteuern. Lass uns zusammen die Stadt erkunden!',
    interests: ['Kunst', 'Yoga', 'Reisen', 'Fotografie'],
    looking_for: 'male',
    min_age: 25,
    max_age: 35,
    relationship_type: 'Langfristige Beziehung',
    max_distance: 50,
    photo_url: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663030198521/hyUuGHVDryHyUngV.png'
  },
  {
    name: 'Raj Patel',
    email: 'raj.patel@example.com',
    phone_number: '+43 660 2345678',
    password: '123',
    age: 31,
    gender: 'male',
    location: 'Graz, Österreich',
    bio: 'Software Engineer aus Graz 💻 Liebe gutes Essen, Wandern in den Bergen und spontane Roadtrips. Auf der Suche nach jemandem Besonderem!',
    interests: ['Gaming', 'Wandern', 'Kochen', 'Reisen'],
    looking_for: 'female',
    min_age: 25,
    max_age: 35,
    relationship_type: 'Langfristige Beziehung',
    max_distance: 100,
    photo_url: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663030198521/yyJCglSGxflbWDEu.png'
  },
  {
    name: 'Ananya Reddy',
    email: 'ananya.reddy@example.com',
    phone_number: '+43 660 3456789',
    password: '123',
    age: 26,
    gender: 'female',
    location: 'Salzburg, Österreich',
    bio: 'Musikliebhaberin und Tänzerin 💃 Arbeite als Marketingmanagerin. Liebe Live-Musik, gutes Essen und tiefe Gespräche bei einem Glas Wein!',
    interests: ['Musik', 'Tanzen', 'Lesen', 'Kunst'],
    looking_for: 'male',
    min_age: 24,
    max_age: 32,
    relationship_type: 'Langfristige Beziehung',
    max_distance: 75,
    photo_url: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663030198521/sRFILvmMRSFKmKiJ.png'
  },
  {
    name: 'Arjun Singh',
    email: 'arjun.singh@example.com',
    phone_number: '+43 660 4567890',
    password: '123',
    age: 29,
    gender: 'male',
    location: 'Innsbruck, Österreich',
    bio: 'Bergliebhaber und Skifahrer ⛷️ Arbeite als Architekt. Suche jemanden der meine Leidenschaft für die Berge und Outdoor-Abenteuer teilt!',
    interests: ['Sport', 'Wandern', 'Fotografie', 'Reisen'],
    looking_for: 'female',
    min_age: 24,
    max_age: 32,
    relationship_type: 'Langfristige Beziehung',
    max_distance: 50,
    photo_url: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663030198521/cdtzFTvhIAWEaKzl.png'
  },
  {
    name: 'Meera Kapoor',
    email: 'meera.kapoor@example.com',
    phone_number: '+43 660 5678901',
    password: '123',
    age: 32,
    gender: 'female',
    location: 'Wien, Österreich',
    bio: 'Ärztin mit Herz ❤️ Liebe Yoga, gesundes Kochen und Reisen. Suche jemanden mit dem ich die schönen Momente des Lebens teilen kann!',
    interests: ['Yoga', 'Kochen', 'Reisen', 'Lesen'],
    looking_for: 'male',
    min_age: 28,
    max_age: 38,
    relationship_type: 'Langfristige Beziehung',
    max_distance: 50,
    photo_url: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663030198521/nLmKjhEYxgquLkKM.png'
  },
  {
    name: 'Vikram Mehta',
    email: 'vikram.mehta@example.com',
    phone_number: '+43 660 6789012',
    password: '123',
    age: 33,
    gender: 'male',
    location: 'Linz, Österreich',
    bio: 'Unternehmer und Foodie 🍜 Liebe es neue Restaurants zu entdecken und zu reisen. Suche eine Partnerin für gemeinsame Abenteuer!',
    interests: ['Kochen', 'Reisen', 'Musik', 'Sport'],
    looking_for: 'female',
    min_age: 27,
    max_age: 36,
    relationship_type: 'Langfristige Beziehung',
    max_distance: 100,
    photo_url: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663030198521/DnQWZbKDleKbtXBs.png'
  },
  {
    name: 'Sanya Gupta',
    email: 'sanya.gupta@example.com',
    phone_number: '+43 660 7890123',
    password: '123',
    age: 27,
    gender: 'female',
    location: 'Wien, Österreich',
    bio: 'Fashion Designer und Kreativkopf 👗 Liebe Kunst, Mode und gute Gespräche. Auf der Suche nach jemandem der meine Leidenschaft teilt!',
    interests: ['Kunst', 'Fotografie', 'Reisen', 'Musik'],
    looking_for: 'male',
    min_age: 25,
    max_age: 34,
    relationship_type: 'Langfristige Beziehung',
    max_distance: 50,
    photo_url: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663030198521/QtZTzQJzGNZHNBvG.png'
  },
  {
    name: 'Rohan Kumar',
    email: 'rohan.kumar@example.com',
    phone_number: '+43 660 8901234',
    password: '123',
    age: 30,
    gender: 'male',
    location: 'Graz, Österreich',
    bio: 'Fitnesstrainer und Sportfanatiker 💪 Liebe einen aktiven Lifestyle, gesundes Essen und Outdoor-Aktivitäten. Let\'s get fit together!',
    interests: ['Sport', 'Kochen', 'Wandern', 'Reisen'],
    looking_for: 'female',
    min_age: 24,
    max_age: 33,
    relationship_type: 'Langfristige Beziehung',
    max_distance: 75,
    photo_url: 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663030198521/UXILrblDMVweObyH.png'
  }
];

router.post('/seed', async (req, res) => {
  const pool = req.app.locals.pool;
  
  try {
    const created = [];
    const errors = [];

    for (const profile of profiles) {
      try {
        // Check if user already exists
        const existingUser = await pool.query(
          'SELECT id FROM users WHERE email = $1',
          [profile.email]
        );

        if (existingUser.rows.length > 0) {
          errors.push({ email: profile.email, error: 'User already exists' });
          continue;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(profile.password, 10);

        // Split name into first_name and last_name
        const nameParts = profile.name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || nameParts[0];

        // Insert user
        const result = await pool.query(
          `INSERT INTO users (
            name, first_name, last_name, email, phone, password_hash, age, gender, location, bio,
            interests, looking_for, min_age, max_age, relationship_type, max_distance,
            profile_image_url, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
          RETURNING id, name, email`,
          [
            profile.name,
            firstName,
            lastName,
            profile.email,
            profile.phone_number,
            hashedPassword,
            profile.age,
            profile.gender,
            profile.location,
            profile.bio,
            profile.interests,
            profile.looking_for,
            profile.min_age,
            profile.max_age,
            profile.relationship_type,
            profile.max_distance,
            profile.photo_url
          ]
        );

        created.push(result.rows[0]);
      } catch (err) {
        errors.push({ email: profile.email, error: err.message });
      }
    }

    res.json({
      success: true,
      created: created.length,
      errors: errors.length,
      profiles: created,
      errorDetails: errors
    });
  } catch (error) {
    console.error('Error seeding profiles:', error);
    res.status(500).json({ error: 'Failed to seed profiles', details: error.message });
  }
});

module.exports = router;
