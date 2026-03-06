const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️  Supabase URL o Key no configurados en .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
