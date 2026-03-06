const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { scrapeAllNews } = require('./scraper');

const app = express();
const PORT = 3001;
const CACHE_FILE = path.join(__dirname, 'noticias_cache.json');

app.use(cors());
app.use(express.json());

// ─── Cache en memoria ──────────────────────────────────────────────────────────
let cache = {
    noticias: [],
    lastUpdated: null,
    isUpdating: false,
};

// Carga el cache desde disco al arrancar
function loadCacheFromDisk() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
            cache.noticias = data.noticias || [];
            cache.lastUpdated = data.lastUpdated || null;
            console.log(
                `📂 Cache cargado: ${cache.noticias.length} noticias (${cache.lastUpdated})`
            );
        }
    } catch (e) {
        console.warn('⚠️  No se pudo leer el cache:', e.message);
    }
}

function saveCacheToDisk() {
    try {
        fs.writeFileSync(
            CACHE_FILE,
            JSON.stringify(
                { noticias: cache.noticias, lastUpdated: cache.lastUpdated },
                null,
                2
            )
        );
    } catch (e) {
        console.warn('⚠️  No se pudo guardar el cache:', e.message);
    }
}

// ─── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * GET /api/noticias
 * Devuelve las noticias cacheadas de ExpoAgro 2026.
 * Query params:
 *   - buscar: texto libre para filtrar por título o descripción
 *   - page: número de página (default 1)
 *   - limit: ítems por página (default 20)
 */
app.get('/api/noticias', (req, res) => {
    let noticias = [...cache.noticias];

    // Filtro de búsqueda
    const buscar = req.query.buscar?.toLowerCase();
    if (buscar) {
        noticias = noticias.filter(
            (n) =>
                n.titulo?.toLowerCase().includes(buscar) ||
                n.descripcion?.toLowerCase().includes(buscar)
        );
    }

    // Paginación
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const total = noticias.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paginated = noticias.slice(start, start + limit);

    res.json({
        ok: true,
        total,
        page,
        totalPages,
        lastUpdated: cache.lastUpdated,
        isUpdating: cache.isUpdating,
        noticias: paginated,
    });
});

/**
 * GET /api/status
 * Estado del servidor y del scraper
 */
app.get('/api/status', (req, res) => {
    res.json({
        ok: true,
        totalNoticias: cache.noticias.length,
        lastUpdated: cache.lastUpdated,
        isUpdating: cache.isUpdating,
        evento: 'ExpoAgro 2026',
        fecha: '10-13 de Marzo de 2026',
        lugar: 'San Nicolás, Buenos Aires, Argentina',
    });
});

/**
 * POST /api/refresh
 * Dispara un nuevo scraping en background y actualiza el cache.
 */
app.post('/api/refresh', async (req, res) => {
    if (cache.isUpdating) {
        return res.json({
            ok: false,
            mensaje: 'Ya hay un scraping en progreso, aguardá unos minutos.',
        });
    }

    res.json({
        ok: true,
        mensaje: 'Scraping iniciado. Las noticias se actualizarán en unos minutos.',
    });

    // Ejecutar scraping en background
    cache.isUpdating = true;
    try {
        const nuevasNoticias = await scrapeAllNews(10);

        // Fusionar sin duplicados usando la URL como identificador único
        const fusionadas = [...nuevasNoticias, ...cache.noticias];
        const unicas = Array.from(new Map(fusionadas.map(n => [n.url, n])).values());

        cache.noticias = unicas;
        cache.lastUpdated = new Date().toISOString();
        saveCacheToDisk();
        console.log(`✅ Cache actualizado: ${unicas.length} noticias. (Eran ${cache.noticias.length} antes, agregamos nuevas no duplicadas)`);
    } catch (err) {
        console.error('❌ Error durante el scraping:', err.message);
    } finally {
        cache.isUpdating = false;
    }
});

/**
 * GET /api/mapa
 * Sirve el PDF del plano de la expo.
 */
app.get('/api/mapa', (req, res) => {
    const mapaPath = path.join(__dirname, '..', 'infoextra', 'EXPOAGRO-2026-Plano-Expositores-2026-01-30-CON-final (1).pdf');
    if (fs.existsSync(mapaPath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.sendFile(mapaPath);
    } else {
        res.status(404).send('Mapa no encontrado en el servidor.');
    }
});

// ─── Start ──────────────────────────────────────────────────────────────────────
loadCacheFromDisk();

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`\n🌾 ExpoAgro 2026 News API corriendo en http://localhost:${PORT}`);
        console.log(`   GET  /api/noticias  → lista de noticias`);
        console.log(`   GET  /api/status   → estado del cache`);
        console.log(`   POST /api/refresh  → scrapear ahora\n`);

        // Auto-scraping inicial si el cache está vacío
        if (cache.noticias.length === 0) {
            console.log('📡 Cache vacío → iniciando scraping automático...');
            cache.isUpdating = true;
            scrapeAllNews(10)
                .then((noticias) => {
                    cache.noticias = noticias;
                    cache.lastUpdated = new Date().toISOString();
                    saveCacheToDisk();
                    console.log(`✅ ${noticias.length} noticias cargadas`);
                })
                .catch((err) => console.error('❌ Error scraping inicial:', err.message))
                .finally(() => {
                    cache.isUpdating = false;
                });
        }
    });
}

module.exports = app;
