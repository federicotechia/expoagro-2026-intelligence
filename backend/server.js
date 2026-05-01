const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { scrapeAllNews } = require('./scraper');
const supabase = require('./supabaseClient');

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

// Carga el cache desde disco al arrancar (Fallback local)
async function loadCache() {
    // 1. Intentar cargar desde Supabase
    try {
        if (process.env.SUPABASE_URL) {
            const { data, error } = await supabase
                .from('noticias')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ Error cargando desde Supabase:', error.message);
                throw error;
            }

            if (data && data.length > 0) {
                cache.noticias = data;
                cache.lastUpdated = new Date().toISOString();
                console.log(`🌐 Cache cargado desde Supabase: ${data.length} noticias (FRESH)`);

                // Borrar cache local para evitar confusiones
                if (fs.existsSync(CACHE_FILE)) {
                    fs.unlinkSync(CACHE_FILE);
                    console.log('🧹 Cache local eliminado para asegurar sincro con Supabase.');
                }
                return;
            }
        }
    } catch (e) {
        console.warn('⚠️  Supabase no disponible, usando disco:', e.message);
    }

    // 2. Fallback disco
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
            cache.noticias = data.noticias || [];
            cache.lastUpdated = data.lastUpdated || null;
            console.log(
                `📂 Cache cargado desde Disco: ${cache.noticias.length} noticias`
            );
        }
    } catch (e) {
        console.warn('⚠️  No se pudo leer el cache de disco:', e.message);
    }
}

async function saveCache(nuevasNoticias) {
    // 1. Guardar en Supabase (si está configurado)
    try {
        if (process.env.SUPABASE_URL && nuevasNoticias.length > 0) {
            // Upsert usa la URL como clave única
            const { error } = await supabase
                .from('noticias')
                .upsert(nuevasNoticias, { onConflict: 'url' });

            if (error) throw error;
            console.log(`🚀 Sincronizado con Supabase (${nuevasNoticias.length} registros)`);
        }
    } catch (e) {
        console.error('❌ Error guardando en Supabase:', e.message);
    }

    // 2. Guardar en Disco (Persistencia local)
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
        console.warn('⚠️  No se pudo guardar el cache en disco:', e.message);
    }
}

// ─── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * GET /api/noticias
 */
app.get('/api/noticias', async (req, res) => {
    let noticias = [];
    const feria = req.query.feria; // Expoagro o Agroactiva

    // En Vercel (serverless), es mejor consultar directo a Supabase
    try {
        if (process.env.SUPABASE_URL) {
            let query = supabase
                .from('noticias')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (feria && feria !== 'Todas') {
                query = query.eq('evento', feria);
            }

            const { data, error } = await query;

            if (!error && data) {
                noticias = data;
            } else if (error) {
                console.error("Supabase Error:", error.message);
                noticias = [...cache.noticias];
            }
        } else {
            noticias = [...cache.noticias];
        }
    } catch (e) {
        noticias = [...cache.noticias];
    }

    // Filtro manual de cache si Supabase falló o no está configurado
    if (!process.env.SUPABASE_URL && feria && feria !== 'Todas') {
        noticias = noticias.filter(n => n.evento === feria);
    }

    // Filtro de búsqueda
    const buscar = req.query.buscar?.toLowerCase();
    if (buscar) {
        noticias = noticias.filter(
            (n) =>
                n.titulo?.toLowerCase().includes(buscar) ||
                n.descripcion?.toLowerCase().includes(buscar) ||
                n.marca?.toLowerCase().includes(buscar)
        );
    }

    // Paginación y Orden
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 1000;
    const orden = req.query.orden || 'desc';

    noticias.sort((a, b) => {
        const dateA = new Date(a.fecha || 0).getTime();
        const dateB = new Date(b.fecha || 0).getTime();
        return orden === 'desc' ? dateB - dateA : dateA - dateB;
    });

    const total = noticias.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paginated = noticias.slice(start, start + limit);

    res.json({
        ok: true,
        total,
        page,
        totalPages,
        lastUpdated: cache.lastUpdated || new Date().toISOString(),
        isUpdating: cache.isUpdating,
        noticias: paginated,
    });
});


/**
 * PATCH /api/noticias/:id
 * Actualiza una noticia (comentarios, verificado, etc.)
 * Se puede usar la URL codificada como ID.
 */
app.patch('/api/noticias/:id', async (req, res) => {
    const id = decodeURIComponent(req.params.id);
    const updates = req.body;

    // 1. Actualizar en Supabase
    try {
        const { data, error } = await supabase
            .from('noticias')
            .update(updates)
            .eq('url', id)
            .select();

        if (error) throw error;

        // 2. Actualizar en cache local
        const index = cache.noticias.findIndex(n => n.url === id);
        if (index !== -1) {
            cache.noticias[index] = { ...cache.noticias[index], ...updates };
        }

        saveCache([]); // Guardar estado actual en disco

        res.json({ ok: true, data });
    } catch (err) {
        console.error('❌ Error actualizando noticia:', err.message);
        res.status(500).json({ ok: false, mensaje: err.message });
    }
});

/**
 * DELETE /api/noticias/:id
 * Elimina una noticia
 */
app.delete('/api/noticias/:id', async (req, res) => {
    const id = decodeURIComponent(req.params.id);

    try {
        // 1. Eliminar en Supabase
        const { error } = await supabase
            .from('noticias')
            .delete()
            .eq('url', id);

        if (error) throw error;

        // 2. Eliminar en cache local
        cache.noticias = cache.noticias.filter(n => n.url !== id);
        saveCache([]);

        res.json({ ok: true, mensaje: 'Noticia eliminada' });
    } catch (err) {
        console.error('❌ Error eliminando noticia:', err.message);
        res.status(500).json({ ok: false, mensaje: err.message });
    }
});

/**
 * POST /api/noticias/manual
 * Agrega una noticia manualmente
 */
app.post('/api/noticias/manual', async (req, res) => {
    const nueva = {
        ...req.body,
        fuente: 'Manual',
        fecha: new Date().toISOString()
    };

    try {
        // 1. Guardar en Supabase
        const { data, error } = await supabase
            .from('noticias')
            .upsert([nueva], { onConflict: 'url' })
            .select();

        if (error) throw error;

        // 2. Actualizar cache local
        // Evitar duplicados por URL
        const index = cache.noticias.findIndex(n => n.url === nueva.url);
        if (index !== -1) {
            cache.noticias[index] = { ...cache.noticias[index], ...nueva };
        } else {
            cache.noticias.unshift(nueva);
        }

        saveCache([]);

        res.json({ ok: true, data });
    } catch (err) {
        console.error('❌ Error agregando noticia manual:', err.message);
        res.status(500).json({ ok: false, mensaje: err.message });
    }
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
        eventos: [
            {
                nombre: 'ExpoAgro',
                fecha: 'Marzo',
                lugar: 'San Nicolás, Buenos Aires'
            },
            {
                nombre: 'Agroactiva',
                fecha: 'Junio',
                lugar: 'Armstrong, Santa Fe'
            }
        ]
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
        await saveCache(nuevasNoticias);
        console.log(`✅ Cache actualizado: ${unicas.length} noticias.`);
    } catch (err) {
        console.error('❌ Error durante el scraping:', err.message);
    } finally {
        cache.isUpdating = false;
    }
});

/**
 * GET /api/mapa
 * Sirve una página HTML interactiva con el plano de la expo.
 */
app.get('/api/mapa', (req, res) => {
    const feria = req.query.feria || 'Expoagro';
    
    // Dimensiones según la feria
    const dims = {
        'Expoagro': { W: 7415, H: 5241 },
        'Agroactiva': { W: 3401, H: 3836 }
    };
    
    const { W, H } = dims[feria] || dims['Expoagro'];

    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Mapa Interactivo de ${feria}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        body { margin: 0; padding: 0; background: #1a1a1a; color: white; font-family: sans-serif; overflow: hidden; }
        #map { height: 100vh; width: 100vw; background: #1a1a1a; }
        .marker-label-container { text-align: center; }
        .marker-label {
            background: rgba(220, 38, 38, 0.95);
            color: white;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            white-space: nowrap;
            border: 1px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.5);
            display: inline-block;
            transform: translate(-50%, 50%);
        }
        .info-panel {
            position: absolute;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
            background: rgba(0,0,0,0.85);
            padding: 10px 15px;
            border-radius: 8px;
            font-size: 11px;
            border: 1px solid #ea0b17;
            pointer-events: none;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        }
        .fullscreen-btn {
            position: absolute;
            top: 15px;
            right: 15px;
            z-index: 2000;
            background: #dc2626;
            color: white;
            border: 1px solid white;
            padding: 10px 15px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
            box-shadow: 0 4px 8px rgba(0,0,0,0.4);
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
            text-transform: uppercase;
        }
        .fullscreen-btn:hover { background: #b91c1c; transform: scale(1.05); }
        .fullscreen-btn:active { transform: scale(0.95); }

        /* Estilo para Crucianelli */
        .crucianelli-label {
            background: #ea0b17;
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 800;
            white-space: nowrap;
            border: 2px solid white;
            box-shadow: 0 0 15px rgba(234, 11, 23, 0.8);
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
            animation: pulse-crucianelli 2s infinite;
            z-index: 5000;
        }

        @keyframes pulse-crucianelli {
            0% { transform: scale(1); box-shadow: 0 0 15px rgba(234, 11, 23, 0.8); }
            50% { transform: scale(1.1); box-shadow: 0 0 25px rgba(234, 11, 23, 1); }
            100% { transform: scale(1); box-shadow: 0 0 15px rgba(234, 11, 23, 0.8); }
        }

        /* Estilos para cuando está en pantalla completa */
        :fullscreen #map { height: 100vh !important; width: 100vw !important; }
        :-webkit-full-screen #map { height: 100vh !important; width: 100vw !important; }
    </style>
</head>
<body>
    <button class="fullscreen-btn" onclick="toggleFullscreen()">
        <span>⛶</span> Pantalla Completa
    </button>
    <div id="map"></div>
    <div class="info-panel">
        <b style="color: #ea0b17">${feria.toUpperCase()} - NOVEDADES</b><br>
        • Use gestos para zoom<br>
        • Toque un punto para ver detalles
    </div>
    <script>
            function toggleFullscreen() {
                // Informar al padre (React) para que expanda el iframe
                window.parent.postMessage({ type: 'TOGGLE_FULLSCREEN' }, '*');

                // También intentar el Fullscreen nativo (secundario)
                const el = document.documentElement;
                const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
                if (!isFs) {
                    const req = el.requestFullscreen || el.webkitRequestFullscreen;
                    if (req) req.call(el).catch(() => {});
                } else {
                    const exit = document.exitFullscreen || document.webkitExitFullscreen;
                    if (exit) exit.call(document).catch(() => {});
                }
                
                // Forzar re-layout del mapa
                setTimeout(() => { if (window.map) window.map.invalidateSize(); }, 300);
            }

            const W = ${W};
            const H = ${H};
            const FERIA = "${feria}";

            const map = L.map('map', {
                crs: L.CRS.Simple,
                minZoom: -3,
                maxZoom: 2
            });
            window.map = map; // Hacerlo accesible

        const bounds = [[0, 0], [H, W]];
        L.imageOverlay('/api/mapa-image?feria=' + FERIA, bounds).addTo(map);
        map.fitBounds(bounds, { padding: [10, 10], maxZoom: -1 }); // Asegurar que entre completo

        // --- RESALTAR CRUCIANELLI ---
        // Coordenadas aproximadas para Agroactiva si no se encuentran
        let cX = (FERIA === 'Agroactiva') ? 0.6389 : 0.2847;
        let cY = (FERIA === 'Agroactiva') ? 0.7042 : 0.5528;
        let cStand = (FERIA === 'Agroactiva') ? "Lote 228" : "Stand 520";

        const setCrucianelli = (x, y) => {
            const cLat = (1 - y) * H;
            const cLng = x * W;

            const crucianelliIcon = L.divIcon({
                className: 'crucianelli-label-wrapper',
                html: '<div class="crucianelli-label">CRUCIANELLI ' + cStand + '</div>',
                iconSize: [0, 0],
                iconAnchor: [60, 10]
            });

            L.circleMarker([cLat, cLng], {
                radius: 12,
                fillColor: "#ea0b17",
                color: "#fff",
                weight: 3,
                opacity: 1,
                fillOpacity: 1
            }).addTo(map).bindPopup('<b style="color:#ea0b17; font-size:16px;">CRUCIANELLI</b><br>' + cStand + ' - Punto de Referencia');

            L.marker([cLat, cLng], { icon: crucianelliIcon, interactive: false }).addTo(map);
        };

        // ----------------------------------------

        Promise.all([
            fetch('/api/noticias?limit=1000&feria=' + FERIA).then(r => r.json()),
            fetch('/api/map-coords?feria=' + FERIA).then(r => r.json()),
            fetch('/api/ubicaciones').then(r => r.json())
        ]).then(([noticiasRes, coords, dict]) => {
            const noticias = noticiasRes.noticias || [];
            
            // Si estamos en Agroactiva, Crucianelli ya debería estar en coords
            if (FERIA === 'Agroactiva' && coords['CRUCIANELLI']) {
                cX = coords['CRUCIANELLI'].x;
                cY = coords['CRUCIANELLI'].y;
            }
            setCrucianelli(cX, cY);

            const findUbicacion = (marca) => {
                if (!marca) return null;
                const m = marca.toUpperCase();
                
                // Caso Agroactiva: coords tiene marcas directamente
                if (FERIA === 'Agroactiva') {
                    if (coords[m]) return { x: coords[m].x, y: coords[m].y, label: m };
                    const key = Object.keys(coords).find(k => (k.length > 4 && m.includes(k)) || (m.length > 4 && k.includes(m)));
                    return key ? { x: coords[key].x, y: coords[key].y, label: key } : null;
                }

                // Caso Expoagro: usa diccionario de ubicaciones -> lotes -> coords
                if (dict[m]) return { stand: dict[m].ubicacion };
                const key = Object.keys(dict).find(k => (k.length > 3 && m.includes(k)) || (m.length > 3 && k.includes(m)));
                return key ? { stand: dict[key].ubicacion } : null;
            };

            const markers = {};

            noticias.forEach(n => {
                let pos = null;
                let label = n.marca;
                
                // 1. Normalización de marcas para mejorar coincidencia
                let marcaNormalizada = n.marca ? n.marca.toUpperCase() : '';
                if (marcaNormalizada.includes('IFN') || marcaNormalizada.includes('IFC')) marcaNormalizada = 'IFC TECNO';
                if (marcaNormalizada.includes('INGERSOLL')) marcaNormalizada = 'INGERSOLL ARGENTINA';
                if (marcaNormalizada.includes('DEERE')) marcaNormalizada = 'JOHN DEERE';

                // 2. Intentar obtener posición
                const uinfo = findUbicacion(marcaNormalizada);
                
                if (FERIA === 'Agroactiva' && uinfo && uinfo.x) {
                    pos = { x: uinfo.x, y: uinfo.y };
                } else if (uinfo && uinfo.stand) {
                    const match = uinfo.stand.match(/([A-Z]*\\d+[A-Z]*)/);
                    const standId = match ? match[1] : null;
                    if (standId && coords[standId]) {
                        pos = coords[standId];
                    }
                }

                if (pos) {
                    const lat = (1 - pos.y) * H;
                    const lng = pos.x * W;

                    const marker = L.circleMarker([lat, lng], {
                        radius: 8,
                        fillColor: "#ea0b17",
                        color: "#fff",
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.8
                    }).addTo(map);

                    const popupContent = \`
                        <div style="color: black; font-family: sans-serif; min-width: 180px;">
                            <b style="color: #ea0b17; font-size: 15px;">\${n.marca}</b><br>
                            <b style="color: #666;">Ubicación: \${n.ubicacion || 'Detectada'}</b><hr style="border: 0.5px solid #eee;">
                            <p style="margin: 8px 0; font-size: 12px; line-height: 1.4;">\${n.titulo}</p>
                            <a href="\${n.url}" target="_blank" style="display: block; text-align: center; padding: 6px; background: #ea0b17; color: white; text-decoration: none; border-radius: 4px; font-size: 11px;">VER DETALLES</a>
                        </div>
                    \`;
                    
                    marker.bindPopup(popupContent);
                    markers[n.marca] = marker;

                    const labelIcon = L.divIcon({
                        className: 'marker-label-container',
                        html: \`<div class="marker-label">\${n.marca}</div>\`,
                        iconSize: [0, 0],
                        iconAnchor: [0, 0]
                    });

                    L.marker([lat, lng], { icon: labelIcon, interactive: false }).addTo(map);
                }
            });
    

            // Función global para que el padre pueda centrar el mapa
            window.focusStand = (marca) => {
                const marker = markers[marca];
                if (marker) {
                    map.setView(marker.getLatLng(), 1); 
                    marker.openPopup();
                }
            };

            // COORDINATE HELPER (Calibration Mode)
            map.on('click', function(e) {
                const y = 1 - (e.latlng.lat / H);
                const x = e.latlng.lng / W;
                console.log("Click coords: { \\"x\\": " + x.toFixed(4) + ", \\"y\\": " + y.toFixed(4) + " }");
                
                L.popup()
                    .setLatLng(e.latlng)
                    .setContent("<b>X:</b> " + x.toFixed(4) + "<br><b>Y:</b> " + y.toFixed(4))
                    .openOn(map);
            });

        });
    </script>
</body>
</html>
    `);
});

app.get('/api/ubicaciones', (req, res) => {
    const ubicPath = path.join(__dirname, 'ubicaciones.json');
    if (fs.existsSync(ubicPath)) {
        res.sendFile(ubicPath);
    } else {
        res.json({});
    }
});

app.get('/api/mapa-image', (req, res) => {
    const feria = req.query.feria;
    let imgName = 'mapa_exposicion.jpg';
    if (feria === 'Agroactiva') imgName = 'mapa_agroactiva.jpg';

    const imgPath = path.join(__dirname, imgName);
    if (fs.existsSync(imgPath)) {
        res.sendFile(imgPath);
    } else {
        res.status(404).send('Imagen del mapa no encontrada.');
    }
});

app.get('/api/map-coords', (req, res) => {
    const feria = req.query.feria;
    let fileName = 'map_coords.json';
    if (feria === 'Agroactiva') fileName = 'agroactiva_coords.json';

    const coordsPath = path.join(__dirname, fileName);
    if (fs.existsSync(coordsPath)) {
        res.sendFile(coordsPath);
    } else {
        res.json({});
    }
});

loadCache();

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`\n🌾 Exposiciones News API corriendo en http://localhost:${PORT}`);
        console.log(`   GET  /api/noticias  → lista de noticias`);
        console.log(`   GET  /api/status   → estado del cache`);
        console.log(`   POST /api/refresh  → scrapear ahora\n`);

        if (cache.noticias.length === 0) {
            console.log('📡 Cache vacío → iniciando scraping automático...');
            cache.isUpdating = true;
            scrapeAllNews(10)
                .then((noticias) => {
                    cache.noticias = noticias;
                    cache.lastUpdated = new Date().toISOString();
                    saveCache(noticias);
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
