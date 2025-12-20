-- Insert test users for discovery/swiping
INSERT INTO users (email, phone, password_hash, first_name, last_name, age, gender, country, location, bio) VALUES
('anna.mueller@test.com', '+436601111111', '$2b$10$abcdefghijklmnopqrstuvwxyz123456789', 'Anna', 'Müller', 25, 'Weiblich', 'AT', 'Wien, Österreich', 'Liebe Reisen, gutes Essen und lange Spaziergänge. Auf der Suche nach jemandem Besonderem! ✨'),
('max.schmidt@test.com', '+436602222222', '$2b$10$abcdefghijklmnopqrstuvwxyz123456789', 'Max', 'Schmidt', 28, 'Männlich', 'AT', 'Graz, Österreich', 'Sportbegeistert, naturverbunden und immer für ein Abenteuer zu haben! 🏔️'),
('lisa.wagner@test.com', '+436603333333', '$2b$10$abcdefghijklmnopqrstuvwxyz123456789', 'Lisa', 'Wagner', 23, 'Weiblich', 'AT', 'Salzburg, Österreich', 'Kunstliebhaberin, Kaffee-Junkie und Katzenmensch. Suche nach echten Verbindungen! ☕🎨'),
('thomas.bauer@test.com', '+436604444444', '$2b$10$abcdefghijklmnopqrstuvwxyz123456789', 'Thomas', 'Bauer', 30, 'Männlich', 'AT', 'Innsbruck, Österreich', 'Berge, Skifahren und gute Musik. Let''s have some fun! 🎿🎵'),
('sarah.koch@test.com', '+436605555555', '$2b$10$abcdefghijklmnopqrstuvwxyz123456789', 'Sarah', 'Koch', 26, 'Weiblich', 'AT', 'Linz, Österreich', 'Yoga-Lehrerin, Foodie und Weltenbummlerin. Namaste! 🧘‍♀️🌍'),
('michael.weber@test.com', '+436606666666', '$2b$10$abcdefghijklmnopqrstuvwxyz123456789', 'Michael', 'Weber', 29, 'Männlich', 'AT', 'Wien, Österreich', 'Tech-Enthusiast, Gamer und Hobby-Koch. Auf der Suche nach meiner Player 2! 🎮👨‍🍳'),
('julia.fischer@test.com', '+436607777777', '$2b$10$abcdefghijklmnopqrstuvwxyz123456789', 'Julia', 'Fischer', 24, 'Weiblich', 'AT', 'Klagenfurt, Österreich', 'Tänzerin, Musikliebhaberin und Sonnenanbeterin. Lass uns tanzen! 💃🌞'),
('david.hoffmann@test.com', '+436608888888', '$2b$10$abcdefghijklmnopqrstuvwxyz123456789', 'David', 'Hoffmann', 27, 'Männlich', 'AT', 'Wien, Österreich', 'Fotograf, Abenteurer und Hundeliebhaber. Immer auf der Suche nach dem perfekten Shot! 📸🐕'),
('emma.schneider@test.com', '+436609999999', '$2b$10$abcdefghijklmnopqrstuvwxyz123456789', 'Emma', 'Schneider', 22, 'Weiblich', 'AT', 'Graz, Österreich', 'Studentin, Bücherwurm und Kaffee-Liebhaberin. Suche nach intellektuellen Gesprächen! 📚☕'),
('lukas.mayer@test.com', '+436601010101', '$2b$10$abcdefghijklmnopqrstuvwxyz123456789', 'Lukas', 'Mayer', 31, 'Männlich', 'AT', 'Salzburg, Österreich', 'Unternehmer, Fitness-Fan und Genießer. Work hard, play harder! 💪🍷')
ON CONFLICT (email) DO NOTHING;
