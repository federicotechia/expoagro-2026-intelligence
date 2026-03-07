const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const queries = ['Apache', 'Bernardin', 'Syra', 'Amazone', 'Ascanelli', 'Therra', 'Pierobon', 'Montecor'];
    for (const q of queries) {
        console.log(`\n--- Query: ${q} ---`);
        const { data } = await supabase.from('noticias').select('titulo, marca, ubicacion').ilike('titulo', `%${q}%`);
        if (data) {
            data.forEach(n => console.log(`Title: ${n.titulo} -> Brand: ${n.marca} | Stand: ${n.ubicacion}`));
        }
    }
}
check();
