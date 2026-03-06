const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;

if (!url || !key) {
    console.error(
        '❌ SUPABASE_URL and SUPABASE_KEY must be set in .env before starting the bot.'
    );
    process.exit(1);
}

const supabase = createClient(url, key);

module.exports = supabase;
