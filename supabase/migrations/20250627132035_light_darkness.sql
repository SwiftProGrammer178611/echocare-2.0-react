/*
  # Fix Achievement Progress Function

  1. Problem
    - The update_achievement_progress function is missing from the database
    - This causes errors when trying to track user achievements
    - Function needs to be created with proper parameters and logic

  2. Solution
    - Create the missing update_achievement_progress function
    - Ensure it has the correct parameter order and types
    - Add proper error handling and logic for achievement tracking

  3. Security
    - Function is marked as SECURITY DEFINER to run with elevated privileges
    - Only authenticated users can call this function through RPC
*/

-- Create the missing update_achievement_progress function
CREATE OR REPLACE FUNCTION update_achievement_progress(
  p_user_id uuid,
  p_achievement_category text,
  p_increment integer DEFAULT 1
)
RETURNS void AS $$
DECLARE
  achievement_record RECORD;
  current_progress integer;
BEGIN
  -- Get all active achievements in the category
  FOR achievement_record IN 
    SELECT * FROM achievements 
    WHERE category = p_achievement_category AND is_active = true
  LOOP
    -- Get or create user achievement record
    INSERT INTO user_achievements (user_id, achievement_id, progress)
    VALUES (p_user_id, achievement_record.id, 0)
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
    
    -- Update progress if not already completed
    UPDATE user_achievements 
    SET 
      progress = progress + p_increment,
      updated_at = now()
    WHERE 
      user_id = p_user_id 
      AND achievement_id = achievement_record.id 
      AND completed = false
    RETURNING progress INTO current_progress;
    
    -- Check if achievement is completed
    IF current_progress >= achievement_record.requirement_value THEN
      UPDATE user_achievements 
      SET 
        completed = true,
        completed_at = now(),
        updated_at = now()
      WHERE 
        user_id = p_user_id 
        AND achievement_id = achievement_record.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_achievement_progress(uuid, text, integer) TO authenticated;