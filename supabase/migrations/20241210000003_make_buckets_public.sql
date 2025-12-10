-- Make storage buckets public so getPublicUrl works
-- The RLS policies on the bucket still control who can upload/delete

UPDATE storage.buckets
SET public = true
WHERE id IN ('notice-attachments', 'message-attachments');
