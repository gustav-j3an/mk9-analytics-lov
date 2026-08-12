CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Freelancers
DROP POLICY IF EXISTS "Allow authenticated full access to mk9_freelancers" ON public.mk9_freelancers;
CREATE POLICY "Admins and supervisors manage freelancers" ON public.mk9_freelancers
FOR ALL TO authenticated
USING (mk9_private.is_mk9_admin() OR mk9_private.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role))
WITH CHECK (mk9_private.is_mk9_admin() OR mk9_private.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role));

DROP POLICY IF EXISTS "Allow authenticated full access to mk9_freelancer_dailies" ON public.mk9_freelancer_dailies;
CREATE POLICY "Admins and supervisors manage freelancer dailies" ON public.mk9_freelancer_dailies
FOR ALL TO authenticated
USING (mk9_private.is_mk9_admin() OR mk9_private.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role))
WITH CHECK (mk9_private.is_mk9_admin() OR mk9_private.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role));

DROP POLICY IF EXISTS "Allow authenticated full access to mk9_freelancer_daily_items" ON public.mk9_freelancer_daily_items;
CREATE POLICY "Admins and supervisors manage freelancer daily items" ON public.mk9_freelancer_daily_items
FOR ALL TO authenticated
USING (mk9_private.is_mk9_admin() OR mk9_private.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role))
WITH CHECK (mk9_private.is_mk9_admin() OR mk9_private.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role));

-- Promoter presence
DROP POLICY IF EXISTS "Allow authenticated users to read presence" ON public.mk9_promoter_presence;
DROP POLICY IF EXISTS "Allow authenticated users to insert presence" ON public.mk9_promoter_presence;
DROP POLICY IF EXISTS "Allow authenticated users to update presence" ON public.mk9_promoter_presence;
CREATE POLICY "Admins and supervisors read presence" ON public.mk9_promoter_presence
FOR SELECT TO authenticated
USING (mk9_private.is_mk9_admin() OR mk9_private.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role));
CREATE POLICY "Admins and supervisors insert presence" ON public.mk9_promoter_presence
FOR INSERT TO authenticated
WITH CHECK (mk9_private.is_mk9_admin() OR mk9_private.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role));
CREATE POLICY "Admins and supervisors update presence" ON public.mk9_promoter_presence
FOR UPDATE TO authenticated
USING (mk9_private.is_mk9_admin() OR mk9_private.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role))
WITH CHECK (mk9_private.is_mk9_admin() OR mk9_private.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role));

-- Presence teams
DROP POLICY IF EXISTS "Allow authenticated management on presence teams" ON public.mk9_presence_teams;
CREATE POLICY "Admins and supervisors read presence teams" ON public.mk9_presence_teams
FOR SELECT TO authenticated
USING (mk9_private.is_mk9_admin() OR mk9_private.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role));
CREATE POLICY "Admins manage presence teams" ON public.mk9_presence_teams
FOR ALL TO authenticated
USING (mk9_private.is_mk9_admin())
WITH CHECK (mk9_private.is_mk9_admin());

-- Supervisors
DROP POLICY IF EXISTS "Supervisors are manageable by authenticated users" ON public.mk9_supervisors;
CREATE POLICY "Admins and supervisors read supervisors" ON public.mk9_supervisors
FOR SELECT TO authenticated
USING (mk9_private.is_mk9_admin() OR mk9_private.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role));
CREATE POLICY "Admins manage supervisors" ON public.mk9_supervisors
FOR ALL TO authenticated
USING (mk9_private.is_mk9_admin())
WITH CHECK (mk9_private.is_mk9_admin());

-- Checklist snapshots: allow supervisors to read
CREATE POLICY "Supervisors read checklist snapshots" ON public.mk9_checklist_import_store_snapshots
FOR SELECT TO authenticated
USING (mk9_private.is_mk9_admin() OR mk9_private.has_mk9_role(auth.uid(), 'SUPERVISOR'::mk9_role));