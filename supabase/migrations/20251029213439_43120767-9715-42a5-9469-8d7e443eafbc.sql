-- Add user_id column to consumers table to link with auth.users
ALTER TABLE public.consumers 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_consumers_user_id ON public.consumers(user_id);

-- Allow authenticated users to view their own consumer data
CREATE POLICY "Users can view own consumer data"
ON public.consumers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow authenticated users to update their own consumer data
CREATE POLICY "Users can update own consumer data"
ON public.consumers
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);