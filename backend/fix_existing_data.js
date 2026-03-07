const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Logic copied from scraper.js (simplified for update)
const ubicacionesExpo = JSON.parse(fs.readFileSync(path.join(__dirname, 'ubicaciones.json'), 'utf8'));

const CATEGORIA_MAP = {
    'sembradora': 'Sembradoras',
    'tractor': 'Tractores',
    'pulverizadora': 'Pulverizadoras',
    'precisión': 'Agricultura de Precisión',
    'agtech': 'Agricultura de Precisión',
    'software': 'Agricultura de Precisión',
    'tecnología': 'Agricultura de Precisión',
    'fertilizadora': 'Incorporadoras',
    'incorporadora': 'Incorporadoras',
    'aplicadora': 'Incorporadoras'
};

function getBetterInfo(titulo, desc) {
    const norm = (titulo + ' ' + (desc || '')).toLowerCase();

    let marca = 'Otra';
    let ubicacion = 'TBD';
    let rawRubros = '';

    const sortedBrands = Object.keys(ubicacionesExpo).sort((a, b) => b.length - a.length);

    for (let b of sortedBrands) {
        if (norm.includes(b.toLowerCase())) {
            marca = b;
            ubicacion = ubicacionesExpo[b].ubicacion || 'TBD';
            rawRubros = (ubicacionesExpo[b].rubros || '').toLowerCase();
            break;
        }
    }

    let categoria = 'Otras';
    for (let [kw, cat] of Object.entries(CATEGORIA_MAP)) {
        if (rawRubros.includes(kw) || norm.includes(kw)) {
            categoria = cat;
            break;
        }
    }

    return { marca, ubicacion, categoria };
}

async function fixExistingNews() {
    console.log('🔄 Corrigiendo datos existentes en Supabase...');

    const { data: noticias, error } = await supabase.from('noticias').select('*');
    if (error) {
        console.error('Error fetching news:', error);
        return;
    }

    console.log(`Encontradas ${noticias.length} noticias. Procesando...`);

    for (const n of noticias) {
        // Solo corregir si es "Otra" o "TBD" o si queremos refrescar todo
        const { marca, ubicacion, categoria } = getBetterInfo(n.titulo, n.descripcion);

        if (marca !== n.marca || ubicacion !== n.ubicacion) {
            console.log(`Updating [${n.titulo.substring(0, 30)}...] -> ${marca} (${ubicacion})`);
            await supabase.from('noticias').update({ marca, ubicacion, categoria }).eq('url', n.url);
        }
    }

    console.log('✅ Base de datos optimizada con el nuevo diccionario del PDF.');
}

fixExistingNews();
