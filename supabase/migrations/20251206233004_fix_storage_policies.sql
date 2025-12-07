-- Drop existing policies if any
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow all uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "carmenta_files_all_access" ON storage.objects;

-- Create new all-access policy for carmenta-files bucket
CREATE POLICY "carmenta_files_all_access"
ON storage.objects
FOR ALL
USING (bucket_id = 'carmenta-files')
WITH CHECK (bucket_id = 'carmenta-files');
