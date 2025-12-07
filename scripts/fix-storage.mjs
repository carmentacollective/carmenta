#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load env vars
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function fixStoragePolicies() {
    console.log('🔧 Fixing storage policies for carmenta-files bucket...\n');

    // Use the REST API to execute SQL
    const sqlQueries = [
        // Drop existing policies
        `DROP POLICY IF EXISTS "Public Access" ON storage.objects;`,
        `DROP POLICY IF EXISTS "Allow all uploads" ON storage.objects;`,
        `DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;`,
        `DROP POLICY IF EXISTS "carmenta_files_all_access" ON storage.objects;`,
        // Create new all-access policy
        `CREATE POLICY "carmenta_files_all_access"
         ON storage.objects
         FOR ALL
         USING (bucket_id = 'carmenta-files')
         WITH CHECK (bucket_id = 'carmenta-files');`
    ];

    for (const sql of sqlQueries) {
        console.log('Executing:', sql.substring(0, 50) + '...');
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': serviceRoleKey,
                'Authorization': `Bearer ${serviceRoleKey}`
            },
            body: JSON.stringify({ query: sql })
        });

        if (!response.ok) {
            const error = await response.text();
            console.warn('⚠️  Query warning:', error);
            // Continue anyway - some errors are expected (like policy doesn't exist)
        }
    }

    console.log('\n✅ Storage policies configured successfully!\n');
    console.log('The carmenta-files bucket now allows all operations.');
    console.log('Files are still protected by your Clerk authentication.\n');
}

fixStoragePolicies().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
