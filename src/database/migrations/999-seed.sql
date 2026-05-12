-- Seed data for Artivo MVP

-- Admin user
INSERT INTO users (id, email, phone, full_name, role) VALUES
(gen_random_uuid(), 'admin@artivo.com', '+2348012345678', 'Admin User', 'customer');

-- Job types (common artisan services)
INSERT INTO job_types (id, name, description, typical_rate) VALUES
(gen_random_uuid(), 'Plumbing', 'Pipe installation, repairs, and maintenance', 15000),
(gen_random_uuid(), 'Electrical Work', 'Wiring, installations, and electrical repairs', 20000),
(gen_random_uuid(), 'Carpentry', 'Furniture making, repairs, and woodwork', 18000),
(gen_random_uuid(), 'Painting', 'Interior and exterior painting services', 12000),
(gen_random_uuid(), 'Welding', 'Metal fabrication and welding services', 25000),
(gen_random_uuid(), 'Masonry', 'Bricklaying, tiling, and concrete work', 16000),
(gen_random_uuid(), 'Roofing', 'Roof installation and repairs', 30000),
(gen_random_uuid(), 'HVAC', 'Air conditioning installation and repairs', 22000),
(gen_random_uuid(), 'Landscaping', 'Garden design and maintenance', 10000),
(gen_random_uuid(), 'Cleaning', 'Home and office cleaning services', 8000),
(gen_random_uuid(), 'Tailoring', 'Clothing alterations and custom sewing', 5000),
(gen_random_uuid(), 'Hairdressing', 'Hair cutting, styling, and treatments', 7000),
(gen_random_uuid(), 'Nail Technician', 'Manicure, pedicure, and nail art', 6000),
(gen_random_uuid(), 'Mechanic', 'Vehicle repairs and maintenance', 20000),
(gen_random_uuid(), 'Generator Repair', 'Generator servicing and repairs', 15000),
(gen_random_uuid(), 'Phone Repair', 'Mobile phone and tablet repairs', 8000),
(gen_random_uuid(), 'Catering', 'Event catering and food preparation', 25000),
(gen_random_uuid(), 'Photography', 'Event and portrait photography', 30000),
(gen_random_uuid(), 'Makeup Artist', 'Professional makeup services', 12000),
(gen_random_uuid(), 'Security Guard', 'Security and surveillance services', 10000);

-- Sample workers (store IDs in temp table for reference)
CREATE TEMP TABLE temp_workers (email VARCHAR, user_id UUID);

INSERT INTO users (id, email, phone, full_name, role)
SELECT gen_random_uuid(), email, phone, full_name, role
FROM (VALUES
    ('chidi.okafor@example.com', '+2348023456789', 'Chidi Okafor', 'worker'),
    ('amina.bello@example.com', '+2348034567890', 'Amina Bello', 'worker'),
    ('tunde.adeyemi@example.com', '+2348045678901', 'Tunde Adeyemi', 'worker'),
    ('ngozi.eze@example.com', '+2348056789012', 'Ngozi Eze', 'worker'),
    ('yusuf.mohammed@example.com', '+2348067890123', 'Yusuf Mohammed', 'worker'),
    ('blessing.okoro@example.com', '+2348078901234', 'Blessing Okoro', 'worker'),
    ('emeka.nwankwo@example.com', '+2348089012345', 'Emeka Nwankwo', 'worker'),
    ('fatima.abubakar@example.com', '+2348090123456', 'Fatima Abubakar', 'worker'),
    ('segun.williams@example.com', '+2348001234567', 'Segun Williams', 'worker'),
    ('chioma.obi@example.com', '+2348012345679', 'Chioma Obi', 'worker')
) AS t(email, phone, full_name, role)
RETURNING id, email;

-- Store worker IDs
INSERT INTO temp_workers (email, user_id)
SELECT email, id FROM users WHERE role = 'worker';

-- Worker profiles
INSERT INTO worker_profiles (user_id, display_name, photo_url, bio, skills, location, share_slug)
SELECT 
    tw.user_id,
    t.display_name,
    t.photo_url,
    t.bio,
    t.skills,
    t.location,
    t.share_slug
FROM (VALUES
    ('chidi.okafor@example.com', 'Chidi the Plumber', 'https://i.pravatar.cc/150?img=12', 'Expert plumber with 8 years experience. Specializing in pipe installations and leak repairs.', ARRAY['plumbing', 'pipe fitting', 'leak repair'], 'Lagos', 'chidi-plumber'),
    ('amina.bello@example.com', 'Amina Electrical', 'https://i.pravatar.cc/150?img=5', 'Licensed electrician. Fast, reliable, and affordable electrical services.', ARRAY['electrical', 'wiring', 'installations'], 'Abuja', 'amina-electrical'),
    ('tunde.adeyemi@example.com', 'Tunde Carpentry', 'https://i.pravatar.cc/150?img=33', 'Master carpenter. Custom furniture and woodwork specialist.', ARRAY['carpentry', 'furniture', 'woodwork'], 'Ibadan', 'tunde-carpentry'),
    ('ngozi.eze@example.com', 'Ngozi Nails', 'https://i.pravatar.cc/150?img=9', 'Professional nail technician. Manicure, pedicure, and nail art expert.', ARRAY['nail tech', 'manicure', 'pedicure', 'nail art'], 'Lagos', 'ngozi-nails'),
    ('yusuf.mohammed@example.com', 'Yusuf AC Tech', 'https://i.pravatar.cc/150?img=51', 'HVAC specialist. Air conditioning installation and repairs.', ARRAY['hvac', 'air conditioning', 'cooling'], 'Kano', 'yusuf-ac'),
    ('blessing.okoro@example.com', 'Blessing Painter', 'https://i.pravatar.cc/150?img=20', 'Professional painter. Interior and exterior painting services.', ARRAY['painting', 'interior design', 'decoration'], 'Port Harcourt', 'blessing-painter'),
    ('emeka.nwankwo@example.com', 'Emeka Welder', 'https://i.pravatar.cc/150?img=14', 'Certified welder. Metal fabrication and welding services.', ARRAY['welding', 'metal work', 'fabrication'], 'Enugu', 'emeka-welder'),
    ('fatima.abubakar@example.com', 'Fatima Tailor', 'https://i.pravatar.cc/150?img=27', 'Expert tailor. Custom clothing and alterations.', ARRAY['tailoring', 'sewing', 'alterations'], 'Kaduna', 'fatima-tailor'),
    ('segun.williams@example.com', 'Segun Mechanic', 'https://i.pravatar.cc/150?img=68', 'Auto mechanic with 10 years experience. All vehicle repairs.', ARRAY['mechanic', 'auto repair', 'maintenance'], 'Lagos', 'segun-mechanic'),
    ('chioma.obi@example.com', 'Chioma Makeup', 'https://i.pravatar.cc/150?img=23', 'Professional makeup artist. Bridal and event makeup specialist.', ARRAY['makeup', 'beauty', 'bridal'], 'Lagos', 'chioma-makeup')
) AS t(email, display_name, photo_url, bio, skills, location, share_slug)
JOIN temp_workers tw ON tw.email = t.email;

-- Reputation scores for workers
INSERT INTO reputation_scores (user_id, credit_score, completion_rate, total_jobs, average_rating)
SELECT 
    tw.user_id,
    t.credit_score,
    t.completion_rate,
    t.total_jobs,
    t.average_rating
FROM (VALUES
    ('chidi.okafor@example.com', 85.5, 95.0, 42, 4.7),
    ('amina.bello@example.com', 78.0, 88.0, 28, 4.5),
    ('tunde.adeyemi@example.com', 92.0, 98.0, 56, 4.9),
    ('ngozi.eze@example.com', 88.5, 92.0, 67, 4.8),
    ('yusuf.mohammed@example.com', 81.0, 90.0, 35, 4.6),
    ('blessing.okoro@example.com', 75.5, 85.0, 23, 4.3),
    ('emeka.nwankwo@example.com', 89.0, 94.0, 41, 4.7),
    ('fatima.abubakar@example.com', 83.5, 91.0, 52, 4.6),
    ('segun.williams@example.com', 90.5, 96.0, 61, 4.8),
    ('chioma.obi@example.com', 86.0, 93.0, 48, 4.7)
) AS t(email, credit_score, completion_rate, total_jobs, average_rating)
JOIN temp_workers tw ON tw.email = t.email;

-- Sample customers
INSERT INTO users (id, email, phone, full_name, role) VALUES
(gen_random_uuid(), 'john.customer@example.com', '+2348098765432', 'John Customer', 'customer'),
(gen_random_uuid(), 'mary.client@example.com', '+2348087654321', 'Mary Client', 'customer');
