import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import lines from './data/lines.json';

const COMPANIES = [...new Set(lines.map((l) => l.company))];
const COLOR_BY_LINE_LABEL = Object.fromEntries(lines.map((l) => [l.label, l.color]));
const ALL_KEY = '__all__';
const ALL_STATIONS = lines.flatMap((l) => l.stations);
const ACCENT = '#ff5722';

// 全路線をまたいだ乗換ハブを集計する。駅名が同じもの・別名だが乗換対象(徒歩圏)として
// 検出されているものをUnion-Findでまとめ、1つの物理的なハブとして扱う。
function buildAllTransferHubs() {
  const parent = new Map();
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const l of lines) {
    for (const st of l.stations) {
      if (!parent.has(st.name)) parent.set(st.name, st.name);
    }
  }
  for (const l of lines) {
    for (const st of l.stations) {
      for (const t of st.transfers) {
        if (!parent.has(t.station)) parent.set(t.station, t.station);
        union(st.name, t.station);
      }
    }
  }

  const clusters = new Map();
  for (const l of lines) {
    for (const st of l.stations) {
      const root = find(st.name);
      if (!clusters.has(root)) clusters.set(root, { names: new Set(), lines: new Set(), lat: st.lat, lon: st.lon });
      const c = clusters.get(root);
      c.names.add(st.name);
      c.lines.add(l.label);
    }
  }

  return [...clusters.values()]
    .filter((c) => c.lines.size > 1)
    .map((c) => ({ id: [...c.names].join('/'), names: [...c.names], lines: [...c.lines], lat: c.lat, lon: c.lon }))
    .sort((a, b) => b.lines.length - a.lines.length);
}
const ALL_TRANSFER_HUBS = buildAllTransferHubs();

// 検索用: 駅名でまとめたインデックス(同名駅はどの路線にあるか一覧を持たせる)
function buildSearchIndex() {
  const byName = new Map();
  for (const l of lines) {
    for (const st of l.stations) {
      if (!byName.has(st.name)) byName.set(st.name, { name: st.name, lat: st.lat, lon: st.lon, entries: [] });
      byName.get(st.name).entries.push({ lineKey: l.key, company: l.company, label: l.label, stationId: st.id });
    }
  }
  return [...byName.values()];
}
const SEARCH_INDEX = buildSearchIndex();

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lon], Math.max(map.getZoom(), 15), { duration: 0.5 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.lat, target?.lon, target?.nonce]);
  return null;
}

function boundsOf(stations) {
  const lats = stations.map((s) => s.lat);
  const lons = stations.map((s) => s.lon);
  const pad = 0.02;
  return [
    [Math.min(...lats) - pad, Math.min(...lons) - pad],
    [Math.max(...lats) + pad, Math.max(...lons) + pad],
  ];
}

function LineBadge({ name }) {
  return (
    <span
      className="line-badge"
      style={{ background: COLOR_BY_LINE_LABEL[name] || '#888' }}
    >
      {name}
    </span>
  );
}

function TransferCards({ transfers }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {transfers.map((t) => (
        <div key={t.station} className="mini-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: '#1c1c22' }}>{t.station}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {t.lines.map((lineName) => (
                <LineBadge key={lineName} name={lineName} />
              ))}
            </div>
          </div>
          <div className="walk-badge">🚶 {t.walkMin}分</div>
        </div>
      ))}
    </div>
  );
}

export default function OedoTransferMap() {
  const [company, setCompany] = useState(COMPANIES[0]);
  const companyLines = useMemo(() => lines.filter((l) => l.company === company), [company]);
  const [activeKey, setActiveKey] = useState(companyLines[0]?.key);
  const [selectedId, setSelectedId] = useState(null);
  const [listOpen, setListOpen] = useState(false);
  const [allListOpen, setAllListOpen] = useState(false);
  const [selectedHubId, setSelectedHubId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [flyTarget, setFlyTarget] = useState(null);

  const isAllMode = company === ALL_KEY;

  const searchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];
    return SEARCH_INDEX.filter((s) => s.name.includes(q)).slice(0, 8);
  }, [searchQuery]);

  function selectSearchResult(result) {
    const entry = result.entries[0];
    setCompany(entry.company);
    setActiveKey(entry.lineKey);
    setSelectedId(entry.stationId);
    setSelectedHubId(null);
    setFlyTarget({ lat: result.lat, lon: result.lon, nonce: Date.now() });
    setSearchQuery('');
  }

  const activeLine = useMemo(
    () => lines.find((l) => l.key === activeKey) || companyLines[0],
    [activeKey, companyLines],
  );

  function selectCompany(c) {
    setCompany(c);
    setSelectedId(null);
    setSelectedHubId(null);
    if (c === ALL_KEY) return;
    const first = lines.find((l) => l.company === c);
    setActiveKey(first.key);
  }

  const selectedHub = ALL_TRANSFER_HUBS.find((h) => h.id === selectedHubId) || null;

  function selectLine(key) {
    setActiveKey(key);
    setSelectedId(null);
  }

  const segmentPaths = activeLine.segments.map((seg) => seg.map((s) => [s.lat, s.lon]));
  if (activeLine.loop && segmentPaths[0]?.length > 0) segmentPaths[0].push(segmentPaths[0][0]);

  const transferStations = activeLine.stations.filter((s) => s.transfers.length > 0);
  const selectedStation = activeLine.stations.find((s) => s.id === selectedId) || null;

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Hiragino Sans', 'Yu Gothic', system-ui, sans-serif", background: '#eef0f3' }}>
      <style>{`
        * { box-sizing: border-box; }
        .scroll-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .hscroll-row {
          display: flex;
          gap: 8px;
          flex-wrap: nowrap;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .hscroll-row::-webkit-scrollbar { display: none; }
        .chip {
          flex: 0 0 auto;
          white-space: nowrap;
          cursor: pointer;
          transition: transform .12s ease, box-shadow .12s ease, filter .12s ease;
        }
        .chip:hover { filter: brightness(1.06); }
        .chip:active { transform: scale(0.97); }
        .search-input {
          transition: box-shadow .15s ease;
        }
        .search-input:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(255,87,34,0.30), 0 2px 6px rgba(0,0,0,0.15);
        }
        .search-result {
          transition: background .12s ease;
          cursor: pointer;
        }
        .search-result:hover { background: #fff2ec; }
        .mini-card, .hub-card {
          background: #fff;
          border-radius: 10px;
          box-shadow: 0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.08);
          border: 1px solid #eceef1;
          transition: box-shadow .15s ease, transform .15s ease;
          cursor: default;
          padding: 8px 10px;
        }
        .hub-card { cursor: pointer; }
        .hub-card:hover { box-shadow: 0 4px 12px rgba(16,24,40,0.12); transform: translateY(-1px); }
        .line-badge {
          font-size: 10.5px;
          padding: 2px 8px;
          border-radius: 20px;
          color: #fff;
          white-space: nowrap;
          font-weight: 600;
          letter-spacing: 0.01em;
        }
        .walk-badge {
          flex: 0 0 auto;
          font-size: 12px;
          font-weight: 700;
          color: #fff;
          background: linear-gradient(135deg, #ff7043, #ff5722);
          border-radius: 16px;
          padding: 5px 11px;
          white-space: nowrap;
          box-shadow: 0 1px 3px rgba(255,87,34,0.4);
        }
        .collapse-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          font-weight: 700;
          color: #444;
          background: none;
          border: none;
          padding: 4px 0;
          cursor: pointer;
        }
        .collapse-toggle:hover { color: #111; }
      `}</style>

      <header style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #14141a, #202028)', color: '#fff', flex: '0 0 auto', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', position: 'relative', zIndex: 1100, display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 title="Tokyo Transfer Map" style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: '0.02em', whiteSpace: 'nowrap', flex: '0 0 auto' }}>TTM</h1>

        <div style={{ position: 'relative', flex: '1 1 auto', maxWidth: 320 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, opacity: 0.5, pointerEvents: 'none' }}>🔍</span>
          <input
            className="search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="駅名で検索"
            style={{
              width: '100%',
              padding: '7px 10px 7px 30px',
              borderRadius: 999,
              border: 'none',
              fontSize: 13,
              background: 'rgba(255,255,255,0.95)',
              color: '#111',
            }}
          />
          {searchResults.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                width: '100%',
                maxWidth: 320,
                background: '#fff',
                borderRadius: 12,
                marginTop: 6,
                maxHeight: 280,
                overflowY: 'auto',
                boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
              }}
            >
              {searchResults.map((r) => (
                <div key={r.name} className="search-result" onClick={() => selectSearchResult(r)} style={{ padding: '8px 12px' }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: '#1c1c22' }}>{r.name}</div>
                  <div style={{ fontSize: 10.5, color: '#8a8a92', marginTop: 1 }}>
                    {[...new Set(r.entries.map((e) => e.label))].join(' / ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* 会社タブ */}
      <nav className="hscroll-row" style={{ padding: '10px 12px', background: '#fff', flex: '0 0 auto', borderBottom: '1px solid #e8e9ec' }}>
        <button
          className="chip"
          onClick={() => selectCompany(ALL_KEY)}
          style={{
            padding: '7px 14px',
            borderRadius: 999,
            border: 'none',
            background: isAllMode ? `linear-gradient(135deg, #ff7043, ${ACCENT})` : '#fff1ea',
            color: isAllMode ? '#fff' : ACCENT,
            fontSize: 13,
            fontWeight: 800,
            boxShadow: isAllMode ? '0 2px 6px rgba(255,87,34,0.4)' : 'none',
          }}
        >
          🗺 全路線マップ
        </button>
        {COMPANIES.map((c) => (
          <button
            key={c}
            className="chip"
            onClick={() => selectCompany(c)}
            style={{
              padding: '7px 14px',
              borderRadius: 999,
              border: '1px solid #e2e3e7',
              background: !isAllMode && c === company ? '#1c1c22' : '#f7f7f9',
              color: !isAllMode && c === company ? '#fff' : '#333',
              fontSize: 13,
              fontWeight: !isAllMode && c === company ? 700 : 500,
            }}
          >
            {c}
          </button>
        ))}
      </nav>

      {/* 路線タブ */}
      {!isAllMode && (
        <nav className="hscroll-row" style={{ padding: '8px 12px', background: '#fafafb', flex: '0 0 auto', borderBottom: '1px solid #eceef1' }}>
          {companyLines.map((l) => (
            <button
              key={l.key}
              className="chip"
              onClick={() => selectLine(l.key)}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                border: `1.5px solid ${l.color}`,
                background: l.key === activeKey ? l.color : '#fff',
                color: l.key === activeKey ? '#fff' : '#333',
                fontSize: 12.5,
                fontWeight: l.key === activeKey ? 700 : 500,
              }}
            >
              {l.label}
            </button>
          ))}
        </nav>
      )}

      <div style={{ flex: '1 1 auto', minHeight: 0 }}>
        {isAllMode ? (
          <MapContainer key={ALL_KEY} bounds={boundsOf(ALL_STATIONS)} style={{ width: '100%', height: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            {lines.map((l) =>
              l.segments.map((seg, i) => {
                const path = seg.map((s) => [s.lat, s.lon]);
                if (l.loop && path.length > 0) path.push(path[0]);
                return <Polyline key={`${l.key}-${i}`} positions={path} pathOptions={{ color: l.color, weight: 2.5, opacity: 0.8 }} />;
              }),
            )}
            {ALL_TRANSFER_HUBS.map((hub) => {
              const isSelected = hub.id === selectedHubId;
              return (
                <CircleMarker
                  key={hub.id}
                  center={[hub.lat, hub.lon]}
                  radius={isSelected ? 8 : 4 + Math.min(hub.lines.length, 8) * 0.4}
                  pathOptions={{
                    color: isSelected ? ACCENT : '#333',
                    weight: isSelected ? 3 : 1,
                    fillColor: '#ffffff',
                    fillOpacity: 1,
                  }}
                  eventHandlers={{ click: () => setSelectedHubId(hub.id) }}
                >
                  <Tooltip direction="top" offset={[0, -6]}>
                    {hub.names.join(' / ')}（{hub.lines.length}路線）
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>
        ) : (
          <MapContainer key={activeKey} bounds={boundsOf(activeLine.stations)} style={{ width: '100%', height: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />

            {segmentPaths.map((path, i) => (
              <Polyline key={`halo-${i}`} positions={path} pathOptions={{ color: '#ffffff', weight: 8, opacity: 0.9 }} />
            ))}
            {segmentPaths.map((path, i) => (
              <Polyline key={i} positions={path} pathOptions={{ color: activeLine.color, weight: 5, opacity: 0.95 }} />
            ))}

            {activeLine.stations.map((st) => {
              const isTransfer = st.transfers.length > 0;
              const isSelected = st.id === selectedId;
              return (
                <CircleMarker
                  key={st.id}
                  center={[st.lat, st.lon]}
                  radius={isTransfer ? 9 : 5}
                  pathOptions={{
                    color: isSelected ? ACCENT : '#333',
                    weight: isSelected ? 3 : 1.5,
                    fillColor: isTransfer ? '#ffffff' : activeLine.color,
                    fillOpacity: 1,
                  }}
                  eventHandlers={{ click: () => setSelectedId(st.id) }}
                >
                  <Tooltip direction="top" offset={[0, -6]}>
                    {st.name}
                  </Tooltip>
                </CircleMarker>
              );
            })}
            <FlyTo target={flyTarget} />
          </MapContainer>
        )}
      </div>

      {/* 全路線モード: 選択中ハブ + 乗換ハブ駅一覧 */}
      {isAllMode && (
        <div style={{ flex: '0 0 auto', maxHeight: '34vh', overflowY: 'auto', borderTop: '1px solid #e2e3e7', background: '#f5f6f8', padding: '12px 14px', borderRadius: '16px 16px 0 0', boxShadow: '0 -2px 10px rgba(0,0,0,0.06)' }}>
          {selectedHub ? (
            <div className="mini-card" style={{ borderLeft: `4px solid ${ACCENT}`, marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1c1c22', marginBottom: 8 }}>
                📍 {selectedHub.names.join(' / ')}
                <span style={{ fontWeight: 500, fontSize: 12, color: '#8a8a92' }}> （{selectedHub.lines.length}路線）</span>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {selectedHub.lines.map((lineName) => (
                  <LineBadge key={lineName} name={lineName} />
                ))}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: '#8a8a92', marginBottom: 10 }}>
              地図上の白い丸（乗換ハブ駅、{ALL_TRANSFER_HUBS.length}駅）をタップすると、乗り入れ路線がここに表示されます。
            </div>
          )}

          <button className="collapse-toggle" onClick={() => setAllListOpen((v) => !v)}>
            <span>{allListOpen ? '▾' : '▸'}</span>
            全ハブ駅一覧（乗り入れ路線数が多い順）
          </button>
          {allListOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {ALL_TRANSFER_HUBS.map((hub) => (
                <div
                  key={hub.id}
                  className="hub-card"
                  onClick={() => setSelectedHubId(hub.id)}
                  style={{
                    borderColor: hub.id === selectedHubId ? ACCENT : '#eceef1',
                    background: hub.id === selectedHubId ? '#fff7f4' : '#fff',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4, color: '#1c1c22' }}>
                    {hub.names.join(' / ')}
                    <span style={{ fontWeight: 500, fontSize: 11, color: '#8a8a92' }}> （{hub.lines.length}路線）</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {hub.lines.map((lineName) => (
                      <LineBadge key={lineName} name={lineName} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 選択中の駅 + 乗換駅一覧 */}
      {!isAllMode && (
        <div style={{ flex: '0 0 auto', maxHeight: '28vh', overflowY: 'auto', borderTop: '1px solid #e2e3e7', background: '#f5f6f8', padding: '12px 14px', borderRadius: '16px 16px 0 0', boxShadow: '0 -2px 10px rgba(0,0,0,0.06)' }}>
          {selectedStation && (
            <div className="mini-card" style={{ borderLeft: `4px solid ${ACCENT}`, marginBottom: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#1c1c22', marginBottom: 8 }}>📍 {selectedStation.name}</div>
              {selectedStation.transfers.length > 0 ? (
                <TransferCards transfers={selectedStation.transfers} />
              ) : (
                <div style={{ fontSize: 12.5, color: '#8a8a92' }}>乗換なし</div>
              )}
            </div>
          )}

          <button className="collapse-toggle" onClick={() => setListOpen((v) => !v)}>
            <span>{listOpen ? '▾' : '▸'}</span>
            乗換駅一覧（{transferStations.length}駅）
          </button>
          {listOpen &&
            (transferStations.length === 0 ? (
              <div style={{ fontSize: 12, color: '#8a8a92', marginTop: 6 }}>この路線に乗換駅はありません</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {transferStations.map((st) => (
                  <div
                    key={st.id}
                    className="hub-card"
                    onClick={() => setSelectedId(st.id)}
                    style={{
                      borderColor: st.id === selectedId ? ACCENT : '#eceef1',
                      background: st.id === selectedId ? '#fff7f4' : '#fff',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: '#1c1c22' }}>{st.name}</div>
                    <TransferCards transfers={st.transfers} />
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
