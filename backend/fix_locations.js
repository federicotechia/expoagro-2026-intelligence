
const supabase = require('./supabaseClient');
const fs = require('fs');
const path = require('path');

async function fixAgroactivaLocations() {
    console.log('🔧 Iniciando corrección de ubicaciones para Agroactiva...');
    
    // Cargar mapeo
    const agroPath = path.join(__dirname, 'agroactiva_brands_to_lots.json');
    if (!fs.existsSync(agroPath)) {
        console.error('❌ No se encontró el archivo de mapeo.');
        return;
    }
    const mapping = JSON.parse(fs.readFileSync(agroPath, 'utf8'));

    // Obtener noticias de Agroactiva
    const { data: noticias, error } = await supabase
        .from('noticias')
        .select('url, marca, ubicacion')
        .eq('evento', 'Agroactiva');

    if (error) {
        console.error('❌ Error obteniendo noticias:', error.message);
        return;
    }

    console.log(`📊 Encontradas ${noticias.length} noticias de Agroactiva.`);

    let fixedCount = 0;
    for (const n of noticias) {
        const brand = n.marca?.toUpperCase();
        const newUbic = mapping[brand] || n.ubicacion || 'TBD';
        
        if (newUbic !== n.ubicacion && newUbic !== 'TBD') {
            const { error: updateError } = await supabase
                .from('noticias')
                .update({ ubicacion: newUbic })
                .eq('url', n.url);
            
            if (!updateError) {
                fixedCount++;
                console.log(`✅ [${n.marca}] -> ${newUbic}`);
            } else {
                console.error(`❌ Error actualizando ${n.marca}:`, updateError.message);
            }
        }
    }

    console.log(`\n🎉 Proceso completado. Se actualizaron ${fixedCount} noticias.`);
    process.exit(0);
}

fixAgroactivaLocations();
