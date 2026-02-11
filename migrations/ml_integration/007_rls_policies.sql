-- =====================================================
-- Migration: 007_rls_policies.sql
-- Description: Additional RLS policies and security configurations
-- Dependencies: All ML tables must exist
-- Note: Some policies are already created in table creation scripts,
--       but this file provides a comprehensive review and any additional policies
-- =====================================================

-- =====================================================
-- RLS Policies Review and Verification
-- =====================================================

-- This migration file serves as a comprehensive review of RLS policies.
-- Most policies are created in the table creation scripts (001-003),
-- but this file ensures all policies are properly configured.

-- =====================================================
-- yield_forecasts RLS Policies
-- =====================================================

-- Verify and ensure all policies exist (idempotent)
-- Note: Policies are created in 001_create_yield_forecasts.sql
-- This section is for documentation and verification

-- Expected policies:
-- 1. "Farmers can view their own forecasts" (SELECT)
-- 2. "Farmers can insert their own forecasts" (INSERT)
-- 3. "Farmers can update their own forecasts" (UPDATE - only draft/pending)
-- 4. "Admins can view all forecasts" (SELECT)
-- 5. "Admins can update all forecasts" (UPDATE)
-- 6. "Admins can delete forecasts" (DELETE)

-- =====================================================
-- quality_predictions RLS Policies
-- =====================================================

-- Verify and ensure all policies exist (idempotent)
-- Note: Policies are created in 002_create_quality_predictions.sql

-- Expected policies:
-- 1. "Farmers can view their own predictions" (SELECT)
-- 2. "Farmers can insert their own predictions" (INSERT)
-- 3. "Farmers can update their own predictions" (UPDATE - only draft/pending)
-- 4. "Admins can view all predictions" (SELECT)
-- 5. "Admins can update all predictions" (UPDATE)
-- 6. "Admins can delete predictions" (DELETE)

-- =====================================================
-- ml_recommendations RLS Policies
-- =====================================================

-- Verify and ensure all policies exist (idempotent)
-- Note: Policies are created in 003_create_ml_recommendations.sql

-- Expected policies:
-- 1. "Farmers can view their own recommendations" (SELECT)
-- 2. "Farmers can insert their own recommendations" (INSERT)
-- 3. "Farmers can update their own recommendations" (UPDATE)
-- 4. "Admins can view all recommendations" (SELECT)
-- 5. "Admins can update all recommendations" (UPDATE)
-- 6. "Admins can delete recommendations" (DELETE)

-- =====================================================
-- Additional Security: Function to check admin role
-- =====================================================

-- Create a helper function to check if user is admin (for use in policies)
-- This makes policies more readable and maintainable

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_admin() IS 'Helper function to check if current user is an admin';

-- =====================================================
-- Additional Security: Function to check farmer ownership
-- =====================================================

-- Create a helper function to check if user owns a farmer record
-- This can be used in policies for more complex ownership checks

CREATE OR REPLACE FUNCTION is_farmer_owner(farmer_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN auth.uid() = farmer_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_farmer_owner(UUID) IS 'Helper function to check if current user owns a farmer record';

-- =====================================================
-- Grant necessary permissions
-- =====================================================

-- Ensure the helper functions are accessible
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_farmer_owner(UUID) TO authenticated;

-- =====================================================
-- Optional: Create policy to allow service role full access
-- =====================================================

-- If using Supabase service role for backend operations,
-- you may want to bypass RLS for service role
-- (This is typically handled by Supabase automatically)

-- Note: Service role should have BYPASS RLS privilege set in Supabase dashboard
-- This SQL is for documentation purposes only

-- =====================================================
-- Verification Queries (for manual review)
-- =====================================================

-- Uncomment and run these queries to verify RLS policies are set up correctly:

-- Check all policies on yield_forecasts
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'yield_forecasts';

-- Check all policies on quality_predictions
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'quality_predictions';

-- Check all policies on ml_recommendations
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'ml_recommendations';

-- Check all policies on ml_models
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'ml_models';

-- =====================================================
-- Notes for Manual Review
-- =====================================================

-- 1. Verify that RLS is enabled on all tables:
--    SELECT tablename, rowsecurity FROM pg_tables 
--    WHERE schemaname = 'public' 
--    AND tablename IN ('yield_forecasts', 'quality_predictions', 'ml_recommendations', 'ml_models');

-- 2. Test policies with different user roles:
--    - Test as farmer: Should only see own data
--    - Test as admin: Should see all data
--    - Test as unauthenticated: Should see nothing

-- 3. Verify that service role can bypass RLS (if needed for backend operations)

-- 4. Check that policies allow proper operations:
--    - Farmers can insert their own records
--    - Farmers can update only draft/pending records
--    - Admins can update/delete any records

