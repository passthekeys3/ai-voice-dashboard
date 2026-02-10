-- Prosody Dashboard - Row Level Security Policies
-- Ensures multi-tenant data isolation

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION: Get current user's profile
-- ============================================
CREATE OR REPLACE FUNCTION get_user_profile()
RETURNS profiles AS $$
  SELECT * FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- HELPER FUNCTION: Get current user's agency_id
-- ============================================
CREATE OR REPLACE FUNCTION get_user_agency_id()
RETURNS UUID AS $$
  SELECT agency_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- HELPER FUNCTION: Get current user's client_id
-- ============================================
CREATE OR REPLACE FUNCTION get_user_client_id()
RETURNS UUID AS $$
  SELECT client_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- HELPER FUNCTION: Check if user is agency admin
-- ============================================
CREATE OR REPLACE FUNCTION is_agency_admin()
RETURNS BOOLEAN AS $$
  SELECT role IN ('agency_admin', 'agency_member') 
  FROM profiles 
  WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- AGENCIES POLICIES
-- ============================================
-- Agency admins can view their own agency
CREATE POLICY "Users can view their agency"
  ON agencies FOR SELECT
  USING (id = get_user_agency_id());

-- Agency admins can update their agency
CREATE POLICY "Agency admins can update their agency"
  ON agencies FOR UPDATE
  USING (id = get_user_agency_id() AND is_agency_admin());

-- ============================================
-- CLIENTS POLICIES
-- ============================================
-- Agency users can view all clients in their agency
CREATE POLICY "Agency users can view clients"
  ON clients FOR SELECT
  USING (agency_id = get_user_agency_id());

-- Client users can only view their own client
CREATE POLICY "Client users can view their client"
  ON clients FOR SELECT
  USING (id = get_user_client_id());

-- Agency admins can create clients
CREATE POLICY "Agency admins can create clients"
  ON clients FOR INSERT
  WITH CHECK (agency_id = get_user_agency_id() AND is_agency_admin());

-- Agency admins can update clients
CREATE POLICY "Agency admins can update clients"
  ON clients FOR UPDATE
  USING (agency_id = get_user_agency_id() AND is_agency_admin());

-- Agency admins can delete clients
CREATE POLICY "Agency admins can delete clients"
  ON clients FOR DELETE
  USING (agency_id = get_user_agency_id() AND is_agency_admin());

-- ============================================
-- PROFILES POLICIES
-- ============================================
-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Agency admins can view all profiles in their agency
CREATE POLICY "Agency admins can view agency profiles"
  ON profiles FOR SELECT
  USING (agency_id = get_user_agency_id() AND is_agency_admin());

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- ============================================
-- AGENTS POLICIES
-- ============================================
-- Agency users can view all agents
CREATE POLICY "Agency users can view agents"
  ON agents FOR SELECT
  USING (agency_id = get_user_agency_id());

-- Client users can view agents assigned to them
CREATE POLICY "Client users can view their agents"
  ON agents FOR SELECT
  USING (client_id = get_user_client_id());

-- Agency admins can manage agents
CREATE POLICY "Agency admins can create agents"
  ON agents FOR INSERT
  WITH CHECK (agency_id = get_user_agency_id() AND is_agency_admin());

CREATE POLICY "Agency admins can update agents"
  ON agents FOR UPDATE
  USING (agency_id = get_user_agency_id() AND is_agency_admin());

CREATE POLICY "Agency admins can delete agents"
  ON agents FOR DELETE
  USING (agency_id = get_user_agency_id() AND is_agency_admin());

-- ============================================
-- CALLS POLICIES
-- ============================================
-- Agency users can view all calls
CREATE POLICY "Agency users can view calls"
  ON calls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agents 
      WHERE agents.id = calls.agent_id 
      AND agents.agency_id = get_user_agency_id()
    )
  );

-- Client users can view their calls
CREATE POLICY "Client users can view their calls"
  ON calls FOR SELECT
  USING (client_id = get_user_client_id());

-- Calls are created via webhooks (service role)
-- No insert policy for regular users

-- ============================================
-- USAGE POLICIES
-- ============================================
-- Agency users can view all usage
CREATE POLICY "Agency users can view usage"
  ON usage FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = usage.client_id 
      AND clients.agency_id = get_user_agency_id()
    )
  );

-- Client users can view their usage
CREATE POLICY "Client users can view their usage"
  ON usage FOR SELECT
  USING (client_id = get_user_client_id());
