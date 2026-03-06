import React, { useState, useEffect } from 'react';
import './index.css';

const API_BASE = '/api';

export default function App() {
  const [noticias, setNoticias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // States para filtros
  const [filtroMarca, setFiltroMarca] = useState('Todas');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [isScraping, setIsScraping] = useState(false);
  const [currentTab, setCurrentTab] = useState('noticias'); // 'noticias' | 'mapa'

  useEffect(() => {
    let mounted = true;

    const fetchNews = async () => {
      try {
        const res = await fetch(`${API_BASE}/noticias?limit=1000`);
        if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
        const data = await res.json();

        if (mounted) {
          setNoticias(data.noticias || []);
          setIsScraping(!!data.isUpdating);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    fetchNews();

    return () => {
      mounted = false;
    };
  }, []);

  const handleRefresh = async () => {
    try {
      const res = await fetch(`${API_BASE}/refresh`, { method: 'POST' });
      const data = await res.json();
      alert(data.mensaje || 'Actualizando...');
      setIsScraping(true);
      setTimeout(() => window.location.reload(), 3000);
    } catch (err) {
      alert('Error contactando al servidor para buscar nuevas noticias');
    }
  };

  const handleDownloadCSV = () => {
    if (filteredNoticias.length === 0) {
      alert('No hay datos para exportar.');
      return;
    }

    const headers = ['Nombre de la Empresa (Marca)', 'Ubicación del Stand', 'Resumen de Novedad', 'Categoría', 'URL'];
    const rows = filteredNoticias.map(n => [
      `"${n.marca || 'Desconocida'}"`,
      `"${n.ubicacion || 'TBD'}"`,
      `"${(n.descripcion || n.titulo || '').replace(/"/g, '""')}"`,
      `"${n.categoria || 'Otra'}"`,
      `"${n.url}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(',') + "\n"
      + rows.map(e => e.join(',')).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Inteligencia_ExpoAgro_2026.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="loading-wrapper">
        <div className="spinner"></div>
        <h2>Sincronizando Sistemas...</h2>
        <p style={{ color: 'var(--text-muted)' }}>Conectando con ExpoAgro 2026</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-wrapper">
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <h2>Error de Conexión</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>{error}</p>
        <button className="btn-primary" onClick={handleRefresh}>Intentar de nuevo</button>
      </div>
    );
  }

  // Obtenemos marcas y categorias dinamicas para el select
  const categoriasDisponibles = ['Todas', ...new Set(noticias.map(n => n.categoria || 'Otras'))].filter(Boolean);
  const marcasDisponibles = ['Todas', ...new Set(noticias.map(n => n.marca || 'Otra'))].filter(Boolean);

  const filteredNoticias = noticias.filter(n => {
    const textMatch = (n.titulo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (n.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase());

    const catMatch = filtroCategoria === 'Todas' || (n.categoria || 'Otras') === filtroCategoria;
    const marcaMatch = filtroMarca === 'Todas' || (n.marca || 'Otra') === filtroMarca;

    return textMatch && catMatch && marcaMatch;
  });

  const getSector = (ub) => {
    if (!ub || ub === 'TBD') return 'Otros / Por Confirmar';
    const numMatch = ub.match(/(\d+)/);
    if (!numMatch) return 'Espacios Especiales / Carpas';
    const n = parseInt(numMatch[1]);
    if (n < 400) return 'Sector Oeste (Ingreso y 100-300)';
    if (n < 700) return 'Sector Centro-Oeste (400-600)';
    if (n < 1000) return 'Sector Centro-Este (700-900)';
    if (n >= 1000) return 'Sector Este (1000-1500)';
    return 'Otros';
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-icon">CX</div>
            <div className="brand-text">
              <h1>Crucianelli</h1>
              <span>ExpoAgro Intelligence</span>
            </div>
          </div>
          <div className="header-status">
            <div className={`status-dot ${isScraping ? 'scraping' : ''}`}></div>
            <span>{isScraping ? 'Scraping en curso...' : 'Sistema Online'}</span>
          </div>
        </div>
      </header>

      <div className="tabs-nav">
        <button
          className={`tab-btn ${currentTab === 'noticias' ? 'active' : ''}`}
          onClick={() => setCurrentTab('noticias')}
        >
          📰 Noticias & Reportes
        </button>
        <button
          className={`tab-btn ${currentTab === 'mapa' ? 'active' : ''}`}
          onClick={() => setCurrentTab('mapa')}
        >
          🗺️ Mapa de Expositores
        </button>
      </div>

      <section className="hero">
        <h2>Lanzamientos <span>ExpoAgro 2026</span></h2>
        <p>Monitor en tiempo real de ingeniería agricola, maquinaria y tecnología para la siembra directa.</p>

        <div className="search-container" style={{ flexWrap: 'wrap', gap: '15px' }}>
          <input
            type="text"
            className="search-input"
            style={{ minWidth: '250px' }}
            placeholder="Buscar por texto libre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            className="search-input"
            value={filtroCategoria}
            onChange={e => setFiltroCategoria(e.target.value)}
            style={{ flex: 'initial', width: 'auto' }}
          >
            {categoriasDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            className="search-input"
            value={filtroMarca}
            onChange={e => setFiltroMarca(e.target.value)}
            style={{ flex: 'initial', width: 'auto' }}
          >
            {marcasDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <button className="btn-primary" onClick={handleRefresh}>Refrescar Web</button>
          <button className="btn-primary" style={{ backgroundColor: '#28a745' }} onClick={handleDownloadCSV}>⬇ CSV</button>
        </div>
      </section>

      {
        currentTab === 'noticias' ? (
          <main className="main-content">
            <h3 className="section-title">
              Últimos Reportes <span style={{ color: 'var(--crucianelli-red)', fontSize: '1rem' }}>({filteredNoticias.length})</span>
            </h3>

            {filteredNoticias.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No se encontraron reportes que coincidan con la búsqueda o filtros actuales.
              </div>
            ) : (
              <div className="news-grid">
                {filteredNoticias.map((n, idx) => (
                  <article key={idx} className="news-card">
                    <div className="card-image-wrapper">
                      {n.imagen ? (
                        <img src={n.imagen} alt={n.titulo} className="card-image" />
                      ) : (
                        <div className="card-placeholder">🚜</div>
                      )}
                      {n.fuente && <div className="card-source-badge">{n.fuente}</div>}
                    </div>

                    <div className="card-content">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span className="card-date">{n.fecha || 'Marzo 2026'}</span>
                        <span style={{ fontSize: '0.75rem', backgroundColor: '#333', padding: '2px 8px', borderRadius: '12px' }}>
                          {n.categoria || 'Otra'} | {n.marca || 'Otra'}
                        </span>
                      </div>
                      <h4 className="card-title">{n.titulo}</h4>
                      <p className="card-desc">{n.descripcion}</p>

                      <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <a href={n.url} target="_blank" rel="noopener noreferrer" className="read-more-link">
                          Leer Completo <span style={{ color: 'var(--crucianelli-red)' }}>»</span>
                        </a>
                        <span style={{ fontSize: '0.8rem', color: '#888' }}>Stand: {n.ubicacion || 'TBD'}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </main>
        ) : (
          <main className="main-content">
            <h3 className="section-title">Plano de Expositores e Inteligencia</h3>

            <div className="map-view-container">
              <div className="map-sidebar">
                <h4>🎯 Stands con Novedades</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Empresas que presentan lanzamientos según nuestros reportes:
                </p>
                <div className="map-stands-list">
                  {['Sector Oeste (Ingreso y 100-300)', 'Sector Centro-Oeste (400-600)', 'Sector Centro-Este (700-900)', 'Sector Este (1000-1500)', 'Espacios Especiales / Carpas']
                    .map(sec => {
                      const standsEnSector = [...new Set(filteredNoticias.filter(n => n.marca && n.marca !== 'Otra' && getSector(n.ubicacion) === sec).map(n => JSON.stringify({ marca: n.marca, ubicacion: n.ubicacion })))]
                        .map(s => JSON.parse(s))
                        .sort((a, b) => a.marca.localeCompare(b.marca));

                      if (standsEnSector.length === 0) return null;

                      return (
                        <div key={sec} className="sector-group" style={{ marginBottom: '20px' }}>
                          <h5 style={{ color: 'var(--crucianelli-red)', fontSize: '0.9rem', borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '10px' }}>
                            📍 {sec}
                          </h5>
                          {standsEnSector.map((stand, i) => (
                            <div key={i} className="stand-item">
                              <span className="stand-brand">{stand.marca}</span>
                              <span className="stand-loc">{stand.ubicacion}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })
                  }
                </div>
              </div>

              <div className="map-embed">
                <iframe
                  src={`${API_BASE}/mapa`}
                  title="Plano ExpoAgro 2026"
                  width="100%"
                  height="800px"
                  style={{ border: 'none', borderRadius: '8px' }}
                />
              </div>
            </div>
          </main>
        )
      }

      <footer className="app-footer">
        <p className="footer-text">
          Diseñado para <span>Crucianelli</span> · Inteligencia de Mercado ExpoAgro 2026
        </p>
      </footer>
    </div >
  );
}
