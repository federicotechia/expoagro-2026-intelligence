import React, { useState, useEffect } from 'react';
import './index.css';

const API_BASE = '/api';

export default function App() {
  const [noticias, setNoticias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [orden, setOrden] = useState('desc'); // 'desc' | 'asc'

  // States para filtros
  const [filtroMarca, setFiltroMarca] = useState('Todas');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [isScraping, setIsScraping] = useState(false);
  const [currentTab, setCurrentTab] = useState('noticias'); // 'noticias' | 'mapa'

  // Modal para carga manual
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualData, setManualData] = useState({
    titulo: '',
    descripcion: '',
    url: '',
    marca: '',
    categoria: 'Siembre',
    ubicacion: ''
  });

  const fetchNews = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/noticias?limit=1000&orden=${orden}`);
      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
      const data = await res.json();

      setNoticias(data.noticias || []);
      setIsScraping(!!data.isUpdating);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, [orden]);

  const handleRefresh = async () => {
    try {
      const res = await fetch(`${API_BASE}/refresh`, { method: 'POST' });
      const data = await res.json();
      alert(data.mensaje || 'Actualizando...');
      setIsScraping(true);
      setTimeout(() => fetchNews(), 5000);
    } catch (err) {
      alert('Error contactando al servidor para buscar nuevas noticias');
    }
  };

  const updateNoticia = async (url, updates) => {
    try {
      const res = await fetch(`${API_BASE}/noticias/${encodeURIComponent(url)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Error al actualizar');

      // Actualizar localmente
      setNoticias(prev => prev.map(n => n.url === url ? { ...n, ...updates } : n));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    try {
      // Usar el titulo como parte de la URL si no hay URL
      const dataToSubmit = { ...manualData };
      if (!dataToSubmit.url) {
        dataToSubmit.url = `https://manual-entry/${Date.now()}`;
      }

      const res = await fetch(`${API_BASE}/noticias/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSubmit)
      });
      if (!res.ok) throw new Error('Error al guardar');

      alert('Noticia agregada con éxito');
      setShowManualModal(false);
      setManualData({ titulo: '', descripcion: '', url: '', marca: '', categoria: 'Sembradoras', ubicacion: '' });
      fetchNews();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDownloadCSV = () => {
    if (filteredNoticias.length === 0) {
      alert('No hay datos para exportar.');
      return;
    }

    const headers = ['Nombre de la Empresa (Marca)', 'Ubicación del Stand', 'Resumen de Novedad', 'Categoría', 'Verificado', 'Comentarios', 'URL'];
    const rows = filteredNoticias.map(n => [
      `"${n.marca || 'Desconocida'}"`,
      `"${n.ubicacion || 'TBD'}"`,
      `"${(n.descripcion || n.titulo || '').replace(/"/g, '""')}"`,
      `"${n.categoria || 'Otra'}"`,
      `"${n.verificado ? 'SÍ' : 'NO'}"`,
      `"${(n.comentarios || '').replace(/"/g, '""')}"`,
      `"${n.url}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(',') + "\n"
      + rows.map(e => e.join(',')).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Marketing_Intelligence_ExpoAgro_2026.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && noticias.length === 0) {
    return (
      <div className="loading-wrapper">
        <div className="spinner"></div>
        <h2>Sincronizando Sistemas...</h2>
        <p style={{ color: 'var(--text-muted)' }}>Conectando con ExpoAgro 2026</p>
      </div>
    );
  }

  if (error && noticias.length === 0) {
    return (
      <div className="error-wrapper">
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <h2>Error de Conexión</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>{error}</p>
        <button className="btn-primary" onClick={() => window.location.reload()}>Intentar de nuevo</button>
      </div>
    );
  }

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
          <div className="header-actions">
            <button className="btn-add-novedad" onClick={() => setShowManualModal(true)}>
              + Novedad Manual
            </button>
            <div className="header-status">
              <div className={`status-dot ${isScraping ? 'scraping' : ''}`}></div>
              <span>{isScraping ? 'Sincronizando...' : 'Online'}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="tabs-nav">
        <button className={`tab-btn ${currentTab === 'noticias' ? 'active' : ''}`} onClick={() => setCurrentTab('noticias')}>
          📰 Noticias & Reportes
        </button>
        <button className={`tab-btn ${currentTab === 'mapa' ? 'active' : ''}`} onClick={() => setCurrentTab('mapa')}>
          🗺️ Mapa de Expositores
        </button>
      </div>

      <section className="hero">
        <h2>Marketing <span>Intelligence</span></h2>
        <p>Herramienta diseñada para el equipo de Marketing de Producto en ExpoAgro 2026.</p>

        <div className="search-container" style={{ flexWrap: 'wrap', gap: '15px' }}>
          <input
            type="text"
            className="search-input"
            style={{ minWidth: '200px' }}
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select className="search-input" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={{ width: 'auto' }}>
            {categoriasDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select className="search-input" value={filtroMarca} onChange={e => setFiltroMarca(e.target.value)} style={{ width: 'auto' }}>
            {marcasDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <select className="search-input" value={orden} onChange={e => setOrden(e.target.value)} style={{ width: 'auto' }}>
            <option value="desc">Más Recientes</option>
            <option value="asc">Más Antiguos</option>
          </select>

          <button className="btn-primary" onClick={handleRefresh}>Refrescar Scraper</button>
          <button className="btn-primary" style={{ backgroundColor: '#6c757d' }} onClick={handleDownloadCSV}>⬇ CSV</button>
        </div>
      </section>

      {currentTab === 'noticias' ? (
        <main className="main-content">
          <h3 className="section-title">
            Últimos Reportes <span style={{ color: 'var(--crucianelli-red)', fontSize: '1rem' }}>({filteredNoticias.length})</span>
          </h3>

          <div className="news-grid">
            {filteredNoticias.map((n, idx) => (
              <article key={idx} className={`news-card ${n.verificado ? 'card-verified' : ''}`}>
                <div className="card-image-wrapper">
                  {n.imagen ? <img src={n.imagen} alt={n.titulo} className="card-image" /> : <div className="card-placeholder">🚜</div>}
                  {n.fuente && <div className="card-source-badge">{n.fuente}</div>}
                  {n.verificado && <div className="verified-badge">✅ VERIFICADO</div>}
                </div>

                <div className="card-content">
                  <div className="card-header-info">
                    <span className="card-date">{new Date(n.fecha).toLocaleDateString() || 'Marzo 2026'}</span>
                    <span className="card-tag">{n.categoria || 'Otra'}</span>
                  </div>

                  <h4 className="card-title">{n.titulo}</h4>
                  <p className="card-desc">{n.descripcion}</p>

                  <div className="marketing-actions">
                    <div className="marketing-fields-row">
                      <div className="field-group">
                        <label>Marca:</label>
                        <input
                          type="text"
                          defaultValue={n.marca || 'Otra'}
                          onBlur={(e) => updateNoticia(n.url, { marca: e.target.value })}
                          className="mini-input"
                        />
                      </div>
                      <div className="field-group">
                        <label>Stand:</label>
                        <input
                          type="text"
                          defaultValue={n.ubicacion || 'TBD'}
                          onBlur={(e) => updateNoticia(n.url, { ubicacion: e.target.value })}
                          className="mini-input"
                        />
                      </div>
                    </div>

                    <div className="comment-section">
                      <textarea
                        id={`comment-${idx}`}
                        placeholder="Comentarios de marketing..."
                        defaultValue={n.comentarios || ''}
                        className="comment-box"
                      />
                      <button
                        className="btn-save-comment"
                        onClick={() => {
                          const val = document.getElementById(`comment-${idx}`).value;
                          updateNoticia(n.url, { comentarios: val });
                        }}
                      >
                        Guardar Nota
                      </button>
                    </div>

                    <div className="card-footer-buttons">
                      <button
                        className={`btn-verify ${n.verificado ? 'active' : ''}`}
                        onClick={() => updateNoticia(n.url, { verificado: !n.verificado })}
                      >
                        {n.verificado ? '✅ Verificado' : '🔍 Verificar en Stand'}
                      </button>

                      <a href={n.url} target="_blank" rel="noopener noreferrer" className="btn-source">
                        🔗 Ver Fuente
                      </a>

                      <button
                        className="btn-delete"
                        style={{ border: 'none', background: 'transparent', color: '#ff4444', fontSize: '11px', cursor: 'pointer', padding: '0 5px' }}
                        onClick={async () => {
                          if (window.confirm('¿Eliminar esta novedad?')) {
                            try {
                              const res = await fetch(`${API_BASE}/noticias/${encodeURIComponent(n.url)}`, { method: 'DELETE' });
                              if (res.ok) fetchNews();
                            } catch (err) {
                              alert('Error al borrar');
                            }
                          }
                        }}
                      >
                        🗑️ Borrar
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </main>
      ) : (
        <main className="main-content">
          <h3 className="section-title">Plano de Expositores e Inteligencia</h3>
          <div className="map-view-container">
            <div className="map-sidebar">
              <h4>🎯 Stands con Novedades</h4>
              <div className="map-stands-list">
                {['Sector Oeste (Ingreso y 100-300)', 'Sector Centro-Oeste (400-600)', 'Sector Centro-Este (700-900)', 'Sector Este (1000-1500)', 'Espacios Especiales / Carpas']
                  .map(sec => {
                    const standsEnSector = [...new Set(filteredNoticias.filter(n => n.marca && n.marca !== 'Otra' && getSector(n.ubicacion) === sec).map(n => JSON.stringify({ marca: n.marca, ubicacion: n.ubicacion })))]
                      .map(s => JSON.parse(s))
                      .sort((a, b) => a.marca.localeCompare(b.marca));
                    if (standsEnSector.length === 0) return null;
                    return (
                      <div key={sec} className="sector-group">
                        <h5>📍 {sec}</h5>
                        {standsEnSector.map((stand, i) => (
                          <div
                            key={i}
                            className="stand-item"
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                              const iframe = document.getElementById('map-iframe');
                              if (iframe && iframe.contentWindow.focusStand) {
                                iframe.contentWindow.focusStand(stand.marca);
                              }
                            }}
                          >
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
                id="map-iframe"
                src={`${API_BASE}/mapa?t=${Date.now()}`}
                title="Plano ExpoAgro 2026"
                width="100%"
                height="800px"
                style={{ border: 'none', borderRadius: '8px' }}
                allowFullScreen
                allow="fullscreen"
              />
            </div>
          </div>
        </main>
      )}

      {/* Modal Manual */}
      {showManualModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Agregar Novedad Manualmente</h3>
            <form onSubmit={handleManualSubmit}>
              <input required placeholder="Título del lanzamiento" value={manualData.titulo} onChange={e => setManualData({ ...manualData, titulo: e.target.value })} className="search-input" />
              <textarea required placeholder="Descripción técnica / Resumen" value={manualData.descripcion} onChange={e => setManualData({ ...manualData, descripcion: e.target.value })} className="search-input" style={{ height: '100px' }} />
              <input placeholder="Marca / Empresa" value={manualData.marca} onChange={e => setManualData({ ...manualData, marca: e.target.value })} className="search-input" />
              <input placeholder="Ubicación (Stand)" value={manualData.ubicacion} onChange={e => setManualData({ ...manualData, ubicacion: e.target.value })} className="search-input" />
              <input placeholder="URL de referencia (opcional)" value={manualData.url} onChange={e => setManualData({ ...manualData, url: e.target.value })} className="search-input" />
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" className="btn-primary">Guardar</button>
                <button type="button" className="btn-primary" style={{ backgroundColor: '#6c757d' }} onClick={() => setShowManualModal(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <p className="footer-text">Diseñado para <span>Crucianelli</span> · Marketing Intelligence Tool</p>
      </footer>
    </div>
  );
}
