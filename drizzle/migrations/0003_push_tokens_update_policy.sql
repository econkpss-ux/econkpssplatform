GRANT UPDATE ON public.push_tokens TO authenticated;

CREATE POLICY push_tokens_update_own
ON public.push_tokens
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
