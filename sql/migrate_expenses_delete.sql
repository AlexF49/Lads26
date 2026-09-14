-- Lets the Expenses page delete an entry. Previously "expenses" only had insert/select
-- policies, so any delete from the app was silently blocked by RLS.
--
-- Run this directly in the Supabase SQL editor (connects as table owner, bypasses RLS).

create policy "public write delete" on expenses for delete using (true);
