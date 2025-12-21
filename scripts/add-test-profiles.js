const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const indianNames = {
  male: [
    { first: 'Arjun', last: 'Patel' },
    { first: 'Rohan', last: 'Sharma' },
    { first: 'Aditya', last: 'Kumar' },
    { first: 'Vikram', last: 'Singh' },
    { first: 'Karan', last: 'Mehta' },
    { first: 'Rahul', last: 'Gupta' },
    { first: 'Siddharth', last: 'Reddy' },
    { first: 'Nikhil', last: 'Kapoor' },
    { first: 'Amit', last: 'Joshi' },
    { first: 'Raj', last: 'Malhotra' }
  ],
  female: [
    { first: 'Priya', last: 'Sharma' },
    { first: 'Ananya', last: 'Patel' },
    { first: 'Diya', last: 'Kumar' },
    { first: 'Kavya', last: 'Singh' },
    { first: 'Isha', last: 'Mehta' },
    { first: 'Neha', last: 'Gupta' },
    { first: 'Riya', last: 'Reddy' },
    { first: 'Simran', last: 'Kapoor' },
    { first: 'Aisha', last: 'Joshi' },
    { first: 'Meera', last: 'Malhotra' }
  ]
};

const cities = [
  { name: 'Wien', lat: 48.2082, lon: 16.3738 },
  { name: 'Graz', lat: 47.0707, lon: 15.4395 },
  { name: 'Linz', lat: 48.3069, lon: 14.2858 },
  { name: 'Salzburg', lat: 47.8095, lon: 13.0550 },
  { name: 'Innsbruck', lat: 47.2692, lon: 11.4041 },
  { name: 'Zürich', lat: 47.3769, lon: 8.5417 },
  { name: 'Genf', lat: 46.2044, lon: 6.1432 },
  { name: 'München', lat: 48.1351, lon: 11.5820 },
  { name: 'Stuttgart', lat: 48.7758, lon: 9.1829 },
  { name: 'Frankfurt', lat: 50.1109, lon: 8.6821 }
];

const interests = [
  ['Sport', 'Reisen', 'Filme'],
  ['Kochen', 'Musik', 'Yoga'],
  ['Lesen', 'Wandern', 'Fotografie'],
  ['Tanzen', 'Kunst', 'Theater'],
  ['Gaming', 'Technologie', 'Startups'],
  ['Fitness', 'Meditation', 'Wellness'],
  ['Mode', 'Shopping', 'Beauty'],
  ['Natur', 'Tiere', 'Umwelt'],
  ['Geschichte', 'Museen', 'Kultur'],
  ['Essen', 'Wein', 'Restaurants']
];

const bios = [
  'Auf der Suche nach jemandem, der das Leben mit mir teilt. Liebe gutes Essen und lange Spaziergänge.',
  'Leidenschaftlicher Reisender und Foodie. Suche jemanden für gemeinsame Abenteuer!',
  'Sportbegeistert und naturverbunden. Lass uns zusammen die Welt erkunden!',
  'Kreativ, spontan und immer für Spaß zu haben. Wer kommt mit?',
  'Familienorientiert und bodenständig. Suche eine ernsthafte Beziehung.',
  'Technik-Fan und Startup-Enthusiast. Lass uns die Zukunft gestalten!',
  'Yoga-Liebhaber und Wellness-Fan. Balance ist alles.',
  'Kulturinteressiert und weltoffen. Liebe Theater, Kunst und Musik.',
  'Fitness ist mein Leben! Suche jemanden der mithalten kann.',
  'Einfach authentisch und ehrlich. Was du siehst ist was du bekommst!'
];

const relationshipTypes = [
  'Langfristige Beziehung',
  'Freundschaft',
  'Casual Dating',
  'Langfristige Beziehung',
  'Langfristige Beziehung'
];

async function createTestProfiles() {
  try {
    console.log('Creating 20 test profiles...');
    
    const hashedPassword = await bcrypt.hash('test123', 10);
    
    for (let i = 0; i < 20; i++) {
      const gender = i % 2 === 0 ? 'male' : 'female';
      const lookingFor = gender === 'male' ? 'female' : 'male';
      const nameIndex = Math.floor(i / 2);
      const name = indianNames[gender][nameIndex];
      const city = cities[i % cities.length];
      const age = 24 + Math.floor(Math.random() * 15); // 24-38 years
      
      // Add small random offset to coordinates (within ~10km)
      const latOffset = (Math.random() - 0.5) * 0.1;
      const lonOffset = (Math.random() - 0.5) * 0.1;
      
      const email = `${name.first.toLowerCase()}.${name.last.toLowerCase()}${i}@test.com`;
      const bio = bios[i % bios.length];
      const userInterests = interests[i % interests.length];
      const relationshipType = relationshipTypes[i % relationshipTypes.length];
      
      // Insert user
      const userResult = await pool.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, age, gender, country, location, bio, looking_for, relationship_type, interests, latitude, longitude, current_latitude, current_longitude, is_premium)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING id`,
        [
          email,
          hashedPassword,
          name.first,
          name.last,
          age,
          gender,
          'AT', // Austria
          city.name,
          bio,
          lookingFor,
          relationshipType,
          JSON.stringify(userInterests),
          city.lat + latOffset,
          city.lon + lonOffset,
          (city.lat + latOffset).toFixed(8),
          (city.lon + lonOffset).toFixed(8),
          false
        ]
      );
      
      const userId = userResult.rows[0].id;
      
      // Insert extended profile
      await pool.query(
        `INSERT INTO profiles (user_id, height, education, occupation, religion, smoking, drinking, children, languages, min_age, max_age, max_distance)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          userId,
          160 + Math.floor(Math.random() * 30), // 160-190 cm
          ['Bachelor', 'Master', 'PhD', 'Ausbildung'][Math.floor(Math.random() * 4)],
          ['IT', 'Marketing', 'Medizin', 'Ingenieur', 'Designer', 'Lehrer'][Math.floor(Math.random() * 6)],
          ['Hindu', 'Sikh', 'Muslim', 'Keine'][Math.floor(Math.random() * 4)],
          ['Nie', 'Gelegentlich', 'Sozial'][Math.floor(Math.random() * 3)],
          ['Nie', 'Gelegentlich', 'Sozial'][Math.floor(Math.random() * 3)],
          ['Keine', 'Möchte welche', 'Habe welche'][Math.floor(Math.random() * 3)],
          JSON.stringify(['Deutsch', 'Englisch', 'Hindi']),
          age - 5,
          age + 5,
          50
        ]
      );
      
      console.log(`✓ Created profile ${i + 1}/20: ${name.first} ${name.last} (${age}, ${gender}, ${city.name})`);
    }
    
    console.log('\n✅ Successfully created 20 test profiles!');
    console.log('Password for all test users: test123');
    
  } catch (error) {
    console.error('Error creating test profiles:', error);
  } finally {
    await pool.end();
  }
}

createTestProfiles();
