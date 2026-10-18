CREATE OR REPLACE FUNCTION public.guard_profile_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user = 'authenticated' AND NOT public.is_admin(auth.uid()) AND (
    NEW.approved IS DISTINCT FROM OLD.approved OR
    NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
    NEW.approved_by IS DISTINCT FROM OLD.approved_by OR
    NEW.banned_until IS DISTINCT FROM OLD.banned_until OR
    NEW.ban_reason IS DISTINCT FROM OLD.ban_reason OR
    NEW.points IS DISTINCT FROM OLD.points OR
    NEW.streak IS DISTINCT FROM OLD.streak OR
    NEW.must_change_password IS DISTINCT FROM OLD.must_change_password
  ) THEN
    RAISE EXCEPTION 'Protected profile fields may only be changed by administrators';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_profile_membership_before_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_membership();