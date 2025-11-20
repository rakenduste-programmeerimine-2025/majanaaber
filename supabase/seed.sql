-- Seed file to create test users and data after database reset

-- Create test users in auth.users
-- Note: These are development-only users with simple passwords
-- Password for all users: password123

-- User 1: Building Manager
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud,
  confirmation_token,
  recovery_token,
  email_change_token_current,
  email_change_token_new,
  email_change
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'manager@test.com',
  '$2a$06$ozTEg4IawObrJCjXBz.o/udeVQ3ujNETRD5gJOnyZA/sXzPT5Hb9K',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"first_name":"John","last_name":"Manager","role":"building_owner"}',
  now(),
  now(),
  'authenticated',
  'authenticated',
  '',
  '',
  '',
  '',
  ''
);

-- User 2: Resident 1
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud,
  confirmation_token,
  recovery_token,
  email_change_token_current,
  email_change_token_new,
  email_change
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'resident1@test.com',
  '$2a$06$ozTEg4IawObrJCjXBz.o/udeVQ3ujNETRD5gJOnyZA/sXzPT5Hb9K',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"first_name":"Alice","last_name":"Smith","role":"resident"}',
  now(),
  now(),
  'authenticated',
  'authenticated',
  '',
  '',
  '',
  '',
  ''
);

-- User 3: Resident 2
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud,
  confirmation_token,
  recovery_token,
  email_change_token_current,
  email_change_token_new,
  email_change
) VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'resident2@test.com',
  '$2a$06$ozTEg4IawObrJCjXBz.o/udeVQ3ujNETRD5gJOnyZA/sXzPT5Hb9K',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"first_name":"Bob","last_name":"Johnson","role":"resident"}',
  now(),
  now(),
  'authenticated',
  'authenticated',
  '',
  '',
  '',
  '',
  ''
);

-- Create profiles for test users
INSERT INTO profiles (id, first_name, last_name, phone_number, role)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'John', 'Manager', '+3725551001', 'building_owner'),
  ('00000000-0000-0000-0000-000000000002', 'Alice', 'Smith', '+3725551002', 'resident'),
  ('00000000-0000-0000-0000-000000000003', 'Bob', 'Johnson', '+3725551003', 'resident')
ON CONFLICT (id) DO NOTHING;

-- Create a test building
INSERT INTO buildings (id, street_name, house_number, city, county, postal_code, full_address, manager_id)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'Test Street',
  '123',
  'Tallinn',
  'Harju',
  '10001',
  'Test Street 123, Tallinn, 10001',
  '00000000-0000-0000-0000-000000000001'
);

-- Add residents to the building
INSERT INTO building_residents (building_id, profile_id, apartment_number, is_approved)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '101', true),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', '102', true);
