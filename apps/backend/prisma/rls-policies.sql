-- RLS Policies for Camp BJJ
-- Run after initial migration
-- These policies implement defense-in-depth authorization alongside NestJS guards

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE athlete_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE professor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE division_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE weigh_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardian_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE stored_files ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's auth_user_id from JWT
-- This assumes the JWT is set via `SET LOCAL request.jwt.claims = '...'` by middleware
-- or via `SET ROLE` with a role that has the JWT claims
CREATE OR REPLACE FUNCTION current_auth_user_id() RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('request.jwt.claims.sub', true);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_role() RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('request.jwt.claims.role', true);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users table: users can only see their own profile
CREATE POLICY users_select_own ON users
  FOR SELECT USING (auth_user_id = current_auth_user_id());

CREATE POLICY users_update_own ON users
  FOR UPDATE USING (auth_user_id = current_auth_user_id())
  WITH CHECK (auth_user_id = current_auth_user_id());

-- Athlete profiles: users can only see/update their own profile
CREATE POLICY athlete_profiles_select_own ON athlete_profiles
  FOR SELECT USING (user_id IN (SELECT id FROM users WHERE auth_user_id = current_auth_user_id()));

CREATE POLICY athlete_profiles_update_own ON athlete_profiles
  FOR UPDATE USING (user_id IN (SELECT id FROM users WHERE auth_user_id = current_auth_user_id()))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_user_id = current_auth_user_id()));

-- Professor assignments: professors can see their own assignments
-- Organizers/admins can see all assignments for their competitions
CREATE POLICY professor_assignments_select ON professor_assignments
  FOR SELECT USING (
    professor_id IN (SELECT id FROM users WHERE auth_user_id = current_auth_user_id())
    OR EXISTS (
      SELECT 1 FROM competitions c
      WHERE c.id = professor_assignments.competition_id
      AND c.id IN (
        SELECT competition_id FROM professor_assignments pa
        JOIN users u ON u.id = pa.professor_id
        WHERE u.auth_user_id = current_auth_user_id() AND pa.is_active
      )
    )
    OR current_user_role() IN ('ORGANIZER', 'ADMIN')
  );

-- Competitions: public read for published competitions
-- Organizers/admins can read/write their competitions
CREATE POLICY competitions_select_public ON competitions
  FOR SELECT USING (
    status = 'PUBLISHED'
    OR id IN (
      SELECT competition_id FROM professor_assignments pa
      JOIN users u ON u.id = pa.professor_id
      WHERE u.auth_user_id = current_auth_user_id() AND pa.is_active
    )
    OR current_user_role() IN ('ORGANIZER', 'ADMIN')
  );

CREATE POLICY competitions_insert_organizer ON competitions
  FOR INSERT WITH CHECK (current_user_role() IN ('ORGANIZER', 'ADMIN'));

CREATE POLICY competitions_update_organizer ON competitions
  FOR UPDATE USING (
    id IN (
      SELECT competition_id FROM professor_assignments pa
      JOIN users u ON u.id = pa.professor_id
      WHERE u.auth_user_id = current_auth_user_id() AND pa.is_active
    )
    OR current_user_role() IN ('ORGANIZER', 'ADMIN')
  )
  WITH CHECK (
    id IN (
      SELECT competition_id FROM professor_assignments pa
      JOIN users u ON u.id = pa.professor_id
      WHERE u.auth_user_id = current_auth_user_id() AND pa.is_active
    )
    OR current_user_role() IN ('ORGANIZER', 'ADMIN')
  );

-- Division types: public read (standard catalog)
CREATE POLICY division_types_select_public ON division_types
  FOR SELECT USING (is_standard = true);

-- Event divisions: public read for active divisions in published competitions
CREATE POLICY event_divisions_select_public ON event_divisions
  FOR SELECT USING (
    is_active = true
    AND competition_id IN (SELECT id FROM competitions WHERE status = 'PUBLISHED')
  );

CREATE POLICY event_divisions_manage_organizer ON event_divisions
  FOR ALL USING (
    competition_id IN (
      SELECT competition_id FROM professor_assignments pa
      JOIN users u ON u.id = pa.professor_id
      WHERE u.auth_user_id = current_auth_user_id() AND pa.is_active
    )
    OR current_user_role() IN ('ORGANIZER', 'ADMIN')
  );

-- Categories: public read for active categories in published competitions
CREATE POLICY categories_select_public ON categories
  FOR SELECT USING (
    is_active = true
    AND competition_id IN (SELECT id FROM competitions WHERE status = 'PUBLISHED')
  );

CREATE POLICY categories_manage_organizer ON categories
  FOR ALL USING (
    competition_id IN (
      SELECT competition_id FROM professor_assignments pa
      JOIN users u ON u.id = pa.professor_id
      WHERE u.auth_user_id = current_auth_user_id() AND pa.is_active
    )
    OR current_user_role() IN ('ORGANIZER', 'ADMIN')
  );

-- Registrations: athletes can see their own registrations
-- Professors can see registrations in their assigned competitions
-- Organizers/admins can see all registrations in their competitions
CREATE POLICY registrations_select ON registrations
  FOR SELECT USING (
    athlete_id IN (SELECT id FROM users WHERE auth_user_id = current_auth_user_id())
    OR competition_id IN (
      SELECT competition_id FROM professor_assignments pa
      JOIN users u ON u.id = pa.professor_id
      WHERE u.auth_user_id = current_auth_user_id() AND pa.is_active
    )
    OR current_user_role() IN ('ORGANIZER', 'ADMIN')
  );

CREATE POLICY registrations_insert_athlete ON registrations
  FOR INSERT WITH CHECK (
    athlete_id IN (SELECT id FROM users WHERE auth_user_id = current_auth_user_id())
  );

CREATE POLICY registrations_update ON registrations
  FOR UPDATE USING (
    -- Athletes can cancel their own registrations
    (athlete_id IN (SELECT id FROM users WHERE auth_user_id = current_auth_user_id()) AND status IN ('NEEDS_REVIEW', 'CONFIRMED'))
    -- Professors can approve/reject in their competitions
    OR (competition_id IN (
      SELECT competition_id FROM professor_assignments pa
      JOIN users u ON u.id = pa.professor_id
      WHERE u.auth_user_id = current_auth_user_id() AND pa.is_active
    ))
    -- Organizers/admins can do exception resolutions
    OR current_user_role() IN ('ORGANIZER', 'ADMIN')
  )
  WITH CHECK (
    (athlete_id IN (SELECT id FROM users WHERE auth_user_id = current_auth_user_id()) AND status IN ('NEEDS_REVIEW', 'CONFIRMED'))
    OR (competition_id IN (
      SELECT competition_id FROM professor_assignments pa
      JOIN users u ON u.id = pa.professor_id
      WHERE u.auth_user_id = current_auth_user_id() AND pa.is_active
    ))
    OR current_user_role() IN ('ORGANIZER', 'ADMIN')
  );

-- Weigh-ins: professors can create weigh-ins in their competitions
-- Athletes can read their own weigh-ins
CREATE POLICY weigh_ins_select ON weigh_ins
  FOR SELECT USING (
    registration_id IN (
      SELECT id FROM registrations WHERE athlete_id IN (SELECT id FROM users WHERE auth_user_id = current_auth_user_id())
    )
    OR registration_id IN (
      SELECT id FROM registrations WHERE competition_id IN (
        SELECT competition_id FROM professor_assignments pa
        JOIN users u ON u.id = pa.professor_id
        WHERE u.auth_user_id = current_auth_user_id() AND pa.is_active
      )
    )
    OR current_user_role() IN ('ORGANIZER', 'ADMIN')
  );

CREATE POLICY weigh_ins_insert_professor ON weigh_ins
  FOR INSERT WITH CHECK (
    registration_id IN (
      SELECT id FROM registrations WHERE competition_id IN (
        SELECT competition_id FROM professor_assignments pa
        JOIN users u ON u.id = pa.professor_id
        WHERE u.auth_user_id = current_auth_user_id() AND pa.is_active
      )
    )
  );

-- Registration events: read access follows registration access
CREATE POLICY registration_events_select ON registration_events
  FOR SELECT USING (
    registration_id IN (
      SELECT id FROM registrations WHERE athlete_id IN (SELECT id FROM users WHERE auth_user_id = current_auth_user_id())
    )
    OR competition_id IN (
      SELECT competition_id FROM professor_assignments pa
      JOIN users u ON u.id = pa.professor_id
      WHERE u.auth_user_id = current_auth_user_id() AND pa.is_active
    )
    OR current_user_role() IN ('ORGANIZER', 'ADMIN')
  );

-- Guardian consents: athletes/guardians can see their own
-- Professors/organizers can see for their competitions
CREATE POLICY guardian_consents_select ON guardian_consents
  FOR SELECT USING (
    athlete_id IN (SELECT id FROM users WHERE auth_user_id = current_auth_user_id())
    OR competition_id IN (
      SELECT competition_id FROM professor_assignments pa
      JOIN users u ON u.id = pa.professor_id
      WHERE u.auth_user_id = current_auth_user_id() AND pa.is_active
    )
    OR current_user_role() IN ('ORGANIZER', 'ADMIN')
  );

CREATE POLICY guardian_consents_insert ON guardian_consents
  FOR INSERT WITH CHECK (
    athlete_id IN (SELECT id FROM users WHERE auth_user_id = current_auth_user_id())
  );

-- Stored files: access follows registration/competition access
CREATE POLICY stored_files_select ON stored_files
  FOR SELECT USING (
    (registration_id IS NOT NULL AND registration_id IN (
      SELECT id FROM registrations WHERE athlete_id IN (SELECT id FROM users WHERE auth_user_id = current_auth_user_id())
    ))
    OR (competition_id IS NOT NULL AND competition_id IN (
      SELECT competition_id FROM professor_assignments pa
      JOIN users u ON u.id = pa.professor_id
      WHERE u.auth_user_id = current_auth_user_id() AND pa.is_active
    ))
    OR current_user_role() IN ('ORGANIZER', 'ADMIN')
  );

CREATE POLICY stored_files_insert ON stored_files
  FOR INSERT WITH CHECK (
    uploaded_by IN (SELECT id FROM users WHERE auth_user_id = current_auth_user_id())
  );

-- Grant necessary permissions to authenticated role
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT, UPDATE ON registrations, weigh_ins, guardian_consents, stored_files TO authenticated;
GRANT INSERT, UPDATE ON competitions, event_divisions, categories TO authenticated;