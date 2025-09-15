/*
  # Fix subscriptions RLS policies for super admin access

  1. Security Changes
    - Add policy for super admin to manage all subscriptions
    - Allow super admin to insert, update, and delete subscriptions for any trainer
    - Maintain existing policy for trainers to view their own subscriptions

  2. Changes Made
    - Add "Super admin can manage all subscriptions" policy for INSERT, UPDATE, DELETE operations
    - Keep existing "Trainers can view own subscriptions" policy for SELECT operations
*/

-- Add policy for super admin to manage all subscriptions
CREATE POLICY "Super admin can manage all subscriptions"
  ON subscriptions
  FOR ALL
  TO authenticated
  USING ((jwt() ->> 'email'::text) = 'guthierresc@hotmail.com'::text)
  WITH CHECK ((jwt() ->> 'email'::text) = 'guthierresc@hotmail.com'::text);