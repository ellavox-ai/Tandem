-- Dev seed data — loaded automatically by `supabase db reset`

INSERT INTO users (id, email, display_name, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'sean@ellavox.com', 'Sean', 'admin')
ON CONFLICT (id) DO NOTHING;
