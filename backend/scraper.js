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

// Asignador basico
function getCategoriaYMarca(texto) {
  const norm = (texto || '').toLowerCase();

  let categoria = 'Otras';
  for (let cat of CATEGORIAS) {
    // Si "Agricultura de Precisión" norm => "agricultura de precisión", pero la buscaremos simple
    let catLower = cat.toLowerCase();
    if (catLower === 'agricultura de precisión') catLower = 'precisión';

    if (norm.includes(catLower) || (catLower === 'sembradoras' && norm.includes('sembradora')) || (catLower === 'tractores' && norm.includes('tractor'))) {
      categoria = cat;
      break;
    }
  }

  let marca = 'Otra';
  for (let m of MARCAS_CONOCIDAS) {
    if (norm.includes(m.toLowerCase())) {
      marca = m;
      break;
    }
  }

  // Buscar ubicación
  let ubicacion = 'TBD';
  if (marca !== 'Otra') {
    // Buscar en las claves del json alguna que contenga la marca
    const match = Object.keys(ubicacionesExpo).find(k => k.toLowerCase().includes(marca.toLowerCase()));
    if (match) {
      ubicacion = ubicacionesExpo[match];
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
  return hasKeyword;
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

          let textoCompleto = (art.titulo + ' ' + (detail.descripcion || '')).toLowerCase();
          let { categoria, marca, ubicacion } = getCategoriaYMarca(textoCompleto);

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
