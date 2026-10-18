CREATE OR REPLACE FUNCTION public.guard_new_profile_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    NEW.approved := false;
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
    NEW.banned_until := NULL;
    NEW.ban_reason := NULL;
    NEW.points := 0;
    NEW.streak := 0;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_new_profile_membership_before_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_new_profile_membership();