const { chromium } = require('playwright');

const BASE_URLS = [
  'https://maquinac.com/seccion/exposiciones/',
  'https://maquinac.com/?s=expoagro', // Buscar en todo el sitio
  'https://maquinac.com/' // Pagina principal para agarrar las de "último momento"
];

// Palabras clave para identificar noticias de ExpoAgro 2026
const KEYWORDS_EXPOAGRO = [
  'expoagro',
  'expo agro',
];

const EXCLUSIONES_ANIOS = ['2025', '2024', '2023', '2022', '2021', '2020'];

const CATEGORIAS = [
  'Sembradoras',
  'Tractores',
  'Pulverizadoras',
  'Agricultura de Precisión',
  'Incorporadoras'
];

const MARCAS_CONOCIDAS = [
  'Crucianelli', 'Erca', 'Pierobon', 'Agrometal', 'BTI Agri',
  'John Deere', 'Case IH', 'New Holland', 'Pauny', 'Valtra',
  'Massey Ferguson', 'Pla', 'Metalfor', 'Jacto', 'Caimán',
  'Plantium', 'Abelardo Cuffia', 'Agrofly', 'VAF'
];

const fs = require('fs');
const path = require('path');

let ubicacionesExpo = {};
try {
  const jsonPath = path.join(__dirname, 'ubicaciones.json');
  if (fs.existsSync(jsonPath)) {
    ubicacionesExpo = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  }
} catch (err) {
  console.log('No se pudo cargar ubicaciones.json');
}

const CATEGORIA_MAP = {
  'sembradora': 'Sembradoras',
  'tractor': 'Tractores',
  'pulverizadora': 'Pulverizadoras',
  'precisión': 'Agricultura de Precisión',
  'precisíon': 'Agricultura de Precisión',
  'agtech': 'Agricultura de Precisión',
  'software': 'Agricultura de Precisión',
  'tecnología': 'Agricultura de Precisión',
  'fertilizadora': 'Incorporadoras',
  'incorporadora': 'Incorporadoras',
  'aplicadora': 'Incorporadoras'
};

function getCategoriaYMarca(titulo, descripcion) {
  const titleNorm = (titulo || '').toLowerCase();
  const descNorm = (descripcion || '').toLowerCase();
  const fullNorm = titleNorm + ' ' + descNorm;

  let marca = 'Otra';
  let ubicacion = 'TBD';
  let rawRubros = '';

  const sortedBrands = Object.keys(ubicacionesExpo).sort((a, b) => b.length - a.length);

  // Función auxiliar para buscar palabra completa
  const hasBrand = (text, brand) => {
    // Escapar caracteres especiales y buscar límites de palabra
    const escapedBrand = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedBrand}\\b`, 'i');
    return regex.test(text);
  };

  // 1. Buscar primero en el TÍTULO (más preciso)
  for (let b of sortedBrands) {
    if (hasBrand(titleNorm, b)) {
      marca = b;
      ubicacion = ubicacionesExpo[b].ubicacion || 'TBD';
      rawRubros = (ubicacionesExpo[b].rubros || '').toLowerCase();
      break;
    }
  }

  // 2. Si no se halló en título, buscar en DESCRIPCIÓN
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

  // 3. Fallback a MARCAS_CONOCIDAS manual
  if (marca === 'Otra') {
    for (let m of MARCAS_CONOCIDAS) {
      if (hasBrand(fullNorm, m)) {
        marca = m;
        break;
      }
    }
  }

  // 4. Mapeo de Categoría
  let categoria = 'Otras';
  for (let [kw, cat] of Object.entries(CATEGORIA_MAP)) {
    if (rawRubros.includes(kw)) {
      categoria = cat;
      break;
    }
  }

  if (categoria === 'Otras') {
    for (let [kw, cat] of Object.entries(CATEGORIA_MAP)) {
      if (fullNorm.includes(kw)) {
        categoria = cat;
        break;
      }
    }
  }

  return { categoria, marca, ubicacion };
}

// Filtrar noticias que sean de ExpoAgro 2026
function isExpoAgro2026(article) {
  const titleLower = article.titulo.toLowerCase();
  const urlLower = article.url.toLowerCase();

  const hasKeyword = KEYWORDS_EXPOAGRO.some(
    (kw) => titleLower.includes(kw) || urlLower.includes(kw)
  );

  if (!hasKeyword) return false;

  // Si dice 2026 explícitamente, es muy probable que sea correcta
  const mention2026 = titleLower.includes('2026') || urlLower.includes('2026');

  // Si menciona un año viejo y NO menciona 2026, la descartamos
  const mentionOldYear = EXCLUSIONES_ANIOS.some(yr => titleLower.includes(yr) || urlLower.includes(yr));

  if (mentionOldYear && !mention2026) {
    return false;
  }

  // Si no menciona ningún año pero tiene la keyword, la dejamos pasar (puede ser una noticia actual sin año en el título)
  return true;
}

async function scrapeArticleDetail(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Fecha: buscar en meta, time o texto visible
    let fecha = null;

    // Intento 1: time element
    const timeEl = await page.$('time');
    if (timeEl) {
      fecha =
        (await timeEl.getAttribute('datetime')) ||
        (await timeEl.textContent());
    }

    // Intento 2: meta article:published_time
    if (!fecha) {
      const metaDate = await page.getAttribute(
        'meta[property="article:published_time"]',
        'content'
      );
      if (metaDate) fecha = metaDate;
    }

    // Intento 3: clases de Avada/Fusion
    if (!fecha) {
      const fusionDate = await page.$('.fusion-date');
      if (fusionDate) fecha = await fusionDate.textContent();
    }

    if (!fecha) {
      const postDate = await page.$('.post-date, .entry-date, .published');
      if (postDate) fecha = await postDate.textContent();
    }

    // Imagen destacada
    let imagen = null;
    const ogImage = await page.getAttribute(
      'meta[property="og:image"]',
      'content'
    );
    if (ogImage) imagen = ogImage;

    // Descripción / bajada
    let descripcion = null;
    const ogDesc = await page.getAttribute(
      'meta[property="og:description"]',
      'content'
    );
    if (ogDesc) descripcion = ogDesc;

    if (!descripcion) {
      const metaDesc = await page.getAttribute(
        'meta[name="description"]',
        'content'
      );
      if (metaDesc) descripcion = metaDesc;
    }

    return {
      fecha: fecha ? fecha.trim() : null,
      imagen,
      descripcion: descripcion ? descripcion.trim() : null,
    };
  } catch (err) {
    console.warn(`⚠️  Error scrapando detalle de ${url}: ${err.message}`);
    return { fecha: null, imagen: null, descripcion: null };
  }
}

async function scrapeListPage(page, url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  const articles = await page.evaluate(() => {
    const items = [];

    // Selectores de WordPress/Avada
    const cards = document.querySelectorAll(
      '.fusion-post-grid-column, .post, article'
    );

    cards.forEach((card) => {
      const titleEl =
        card.querySelector('.fusion-post-title a') ||
        card.querySelector('h2 a, h3 a');

      if (!titleEl) return;

      const titulo = titleEl.textContent.trim();
      const linkUrl = titleEl.href;

      // Imagen thumbnail de la lista
      const imgEl = card.querySelector('img');
      const imageThumb = imgEl ? imgEl.src : null;

      items.push({ titulo, url: linkUrl, imagethumb: imageThumb });
    });

    return items;
  });

  // Buscar siguiente página
  const nextPageUrl = await page.evaluate(() => {
    // También buscar paginadores típicos de busqueda en Avada
    const nextEl = document.querySelector(
      'a.pagination-next, a.next.page-numbers, .pagination a[aria-label="Next"]'
    );
    return nextEl ? nextEl.href : null;
  });

  return { articles, nextPageUrl };
}

async function scrapeAllNews(maxPages = 3) {
  console.log('🚀 Iniciando scraper de ExpoAgro 2026...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const listPage = await context.newPage();
  const detailPage = await context.newPage();

  const allArticles = [];

  try {
    for (let startUrl of BASE_URLS) {
      let currentUrl = startUrl;
      let pageNum = 1;

      console.log(`\n🔎 Explorando fuente: ${startUrl}`);

      // Recorrer páginas de la sección
      while (currentUrl && pageNum <= maxPages) {
        console.log(`📄 Scrapeando página ${pageNum}: ${currentUrl}`);
        const { articles, nextPageUrl } = await scrapeListPage(
          listPage,
          currentUrl
        );

        console.log(`   Encontrados ${articles.length} artículos`);

        // Filtrar solo ExpoAgro 2026 antes de visitar detalles
        const filtered = articles.filter(isExpoAgro2026);
        console.log(
          `   ✅ ${filtered.length} corresponden a ExpoAgro 2026`
        );

        // Obtener detalles de cada artículo filtrado
        for (const art of filtered) {
          // Evitar duplicados en memoria durante el mismo ciclo
          if (allArticles.some(a => a.url === art.url)) {
            console.log(`   ⏭️ Ya procesado: ${art.titulo}`);
            continue;
          }

          console.log(`   🔍 Detalle: ${art.titulo}`);
          const detail = await scrapeArticleDetail(detailPage, art.url);

          let { categoria, marca, ubicacion } = getCategoriaYMarca(art.titulo, detail.descripcion);

          allArticles.push({
            ...art,
            ...detail,
            fuente: 'Maquinac',
            categoria,
            marca,
            ubicacion
          });

          // Pausa cortés entre requests
          await new Promise((r) => setTimeout(r, 800));
        }

        currentUrl = nextPageUrl;
        pageNum++;

        if (nextPageUrl) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n✅ Scraping completo: ${allArticles.length} noticias de ExpoAgro 2026`);
  return allArticles;
}

module.exports = { scrapeAllNews };
