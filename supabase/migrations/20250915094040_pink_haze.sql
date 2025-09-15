/*
  # Fix RLS policies for subscriptions table

  1. Security Updates
    - Add policy for super admin to manage all subscriptions using auth.jwt()
    - Ensure trainers can view their own subscriptions using existing policy
  
  2. Changes
    - Use correct auth.jwt() function instead of jwt()
    - Allow super admin full access to subscriptions table
    - Maintain existing trainer access policies
*/

-- Remove any existing conflicting policies first
DROP POLICY IF EXISTS "Super admin can manage all subscriptions" ON subscriptions;

-- Add policy for super admin to manage all subscriptions
CREATE POLICY "Super admin can manage all subscriptions"
  ON subscriptions
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'email'::text) = 'guthierresc@hotmail.com'::text
  )
  WITH CHECK (
    (auth.jwt() ->> 'email'::text) = 'guthierresc@hotmail.com'::text
  );

-- Ensure the existing trainer policy exists (create if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'subscriptions' 
    AND policyname = 'Trainers can view own subscriptions'
  ) THEN
    CREATE POLICY "Trainers can view own subscriptions"
      ON subscriptions
      FOR SELECT
      TO authenticated
      USING (personal_trainer_id IN ( 
        SELECT personal_trainers.id
        FROM personal_trainers
        WHERE (personal_trainers.auth_user_id = auth.uid())
      ));
  END IF;
END $$;