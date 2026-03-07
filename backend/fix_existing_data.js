const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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

const MARCAS_CONOCIDAS = [
    'Crucianelli', 'Erca', 'Pierobon', 'Agrometal', 'BTI Agri',
    'John Deere', 'Case IH', 'New Holland', 'Pauny', 'Valtra',
    'Massey Ferguson', 'Pla', 'Metalfor', 'Jacto', 'Caimán',
    'Plantium', 'Abelardo Cuffia', 'Agrofly', 'VAF'
];

function normalizeText(text) {
    if (!text) return '';
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function getBetterInfo(titulo, desc) {
    const titleNorm = normalizeText(titulo);
    const descNorm = normalizeText(desc);
    const fullNorm = titleNorm + ' ' + descNorm;

    let marca = 'Otra';
    let ubicacion = 'TBD';
    let rawRubros = '';

    const sortedBrands = Object.keys(ubicacionesExpo).sort((a, b) => b.length - a.length);

    const hasBrand = (textNormalized, brandCore) => {
        const normalizedBrand = normalizeText(brandCore);
        if (!normalizedBrand || normalizedBrand.length < 3) return false;

        const escapedBrand = normalizedBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedBrand}\\b`, 'i');
        return regex.test(textNormalized);
    };

    // 1. Título con marcas del PDF
    for (let b of sortedBrands) {
        if (hasBrand(titleNorm, b)) {
            marca = b;
            ubicacion = ubicacionesExpo[b].ubicacion || 'TBD';
            rawRubros = (ubicacionesExpo[b].rubros || '').toLowerCase();
            break;
        }
    }

    // 2. Descripción con marcas del PDF
    if (marca === 'Otra') {
        for (let b of sortedBrands) {
            if (hasBrand(descNorm, b)) {
                marca = b;
                ubicacion = ubicacionesExpo[b].ubicacion || 'TBD';
                rawRubros = (ubicacionesExpo[b].rubros || '').toLowerCase();
                break;
            }
        }
    }

    // 3. Fallback a MARCAS_CONOCIDAS
    if (marca === 'Otra') {
        for (let m of MARCAS_CONOCIDAS) {
            if (hasBrand(fullNorm, m)) {
                marca = m;
                break;
            }
        }
    }

    let categoria = 'Otras';
    const normRubros = normalizeText(rawRubros);
    for (let [kw, cat] of Object.entries(CATEGORIA_MAP)) {
        if (normRubros.includes(normalizeText(kw))) {
            categoria = cat;
            break;
        }
    }

    if (categoria === 'Otras') {
        for (let [kw, cat] of Object.entries(CATEGORIA_MAP)) {
            if (fullNorm.includes(normalizeText(kw))) {
                categoria = cat;
                break;
            }
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
        const { marca, ubicacion, categoria } = getBetterInfo(n.titulo, n.descripcion);

        console.log(`[${n.titulo.substring(0, 40)}] -> Result: ${marca} (${ubicacion})`);

        const { error: updateError } = await supabase
            .from('noticias')
            .update({ marca, ubicacion, categoria })
            .eq('id', n.id);

        if (updateError) {
            console.error(`Error actualizando ${n.id}:`, updateError.message);
        }
    }

    console.log('✅ Base de datos optimizada.');
}

fixExistingNews();
