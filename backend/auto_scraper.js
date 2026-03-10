const { scrapeAllNews } = require('./scraper');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAutomation() {
    console.log('🤖 Iniciando Scraper Automático...');

    try {
        // 1. Ejecutar el scraping
        const noticias = await scrapeAllNews(2); // Escaneamos las primeras 2 páginas para ser rápidos

        if (!noticias || noticias.length === 0) {
            console.log('⚠️ No se encontraron noticias nuevas.');
            return;
        }

        console.log(`✅ Se obtuvieron ${noticias.length} noticias. Preparando subida a Supabase...`);

        // 2. Subir a Supabase (Upsert basado en la URL para evitar duplicados)
        // Supabase usará la columna 'url' como clave única si está configurada así, 
        // o simplemente insertará y nosotros manejamos la lógica.

        for (const noticia of noticias) {
            const { data, error } = await supabase
                .from('noticias')
                .upsert({
                    titulo: noticia.titulo,
                    url: noticia.url,
                    descripcion: noticia.descripcion,
                    imagen: noticia.imagen,
                    imagethumb: noticia.imagethumb,
                    fecha: noticia.fecha,
                    fuente: noticia.fuente,
                    categoria: noticia.categoria,
                    marca: noticia.marca,
                    ubicacion: noticia.ubicacion
                }, { onConflict: 'url' });

            if (error) {
                console.error(`❌ Error subiendo "${noticia.titulo}":`, error.message);
            } else {
                console.log(`✨ Noticia procesada: ${noticia.titulo}`);
            }
        }

        console.log('🚀 Automatización completada con éxito.');
    } catch (err) {
        console.error('💥 Error crítico en la automatización:', err);
        process.exit(1);
    }
}

runAutomation();
