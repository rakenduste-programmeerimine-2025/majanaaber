-- Enable real-time on the building_residents and buildings tables
alter publication supabase_realtime add table building_residents;
alter publication supabase_realtime add table buildings;
