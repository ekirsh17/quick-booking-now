-- Phase 1 & 2: Add comprehensive RLS policies for notify_requests table

-- Allow authenticated consumers to update their own notify requests
CREATE POLICY "Authenticated consumers can update own requests"
ON public.notify_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.consumers 
    WHERE consumers.id = notify_requests.consumer_id 
    AND consumers.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.consumers 
    WHERE consumers.id = notify_requests.consumer_id 
    AND consumers.user_id = auth.uid()
  )
);

-- Allow guest (anonymous) consumers to update notify requests
CREATE POLICY "Guest consumers can update requests"
ON public.notify_requests
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Allow authenticated consumers to view their own notify requests
CREATE POLICY "Authenticated consumers can view own requests"
ON public.notify_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.consumers 
    WHERE consumers.id = notify_requests.consumer_id 
    AND consumers.user_id = auth.uid()
  )
);

-- Allow guest consumers to view notify requests
CREATE POLICY "Guest consumers can view requests"
ON public.notify_requests
FOR SELECT
TO anon
USING (true);

-- Phase 3: Add DELETE policy for future functionality
CREATE POLICY "Authenticated consumers can delete own requests"
ON public.notify_requests
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.consumers 
    WHERE consumers.id = notify_requests.consumer_id 
    AND consumers.user_id = auth.uid()
  )
);

-- Guest consumers can delete their requests
CREATE POLICY "Guest consumers can delete requests"
ON public.notify_requests
FOR DELETE
TO anon
USING (true);