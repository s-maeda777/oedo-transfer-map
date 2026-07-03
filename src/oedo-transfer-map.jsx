import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import lines from './data/lines.json';

const COMPANIES = [...new Set(lines.map((l) => l.company))];
const COLOR_BY_LINE_LABEL = Object.fromEntries(lines.map((l) => [l.label, l.color]));
const ALL_KEY = '__all__';
const ALL_STATIONS = lines.flatMap((l) => l.stations);

function boundsOf(stations) {
  const lats = stations.map((s) => s.lat);
  const lons = stations.map((s) => s.lon);
  const pad = 0.02;
  return [
    [Math.min(...lats) - pad, Math.min(...lons) - pad],
    [Math.max(...lats) + pad, Math.max(...lons) + pad],
  ];
}

function TransferCards({ transfers }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {transfers.map((t) => (
        <div
          key={t.station}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            background: '#fff',
            border: '1px solid #e5e5e5',
            borderRadius: 8,
            padding: '6px 10px',
          }}
        >
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 13.5, color: '#222' }}>{t.station}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
              {t.lines.map((lineName) => (
                <span
                  key={lineName}
                  style={{
                    fontSize: 10.5,
                    padding: '1px 7px',
                    borderRadius: 8,
                    color: '#fff',
                    background: COLOR_BY_LINE_LABEL[lineName] || '#888',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {lineName}
                </span>
              ))}
            </div>
          </div>
          <div
            style={{
              flex: '0 0 auto',
              fontSize: 12.5,
              fontWeight: 'bold',
              color: '#fff',
              background: '#ff5722',
              borderRadius: 14,
              padding: '4px 10px',
              whiteSpace: 'nowrap',
            }}
          >
            🚶 {t.walkMin}分
          </div>
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

  const isAllMode = company === ALL_KEY;

  const activeLine = useMemo(
    () => lines.find((l) => l.key === activeKey) || companyLines[0],
    [activeKey, companyLines],
  );

  function selectCompany(c) {
    setCompany(c);
    setSelectedId(null);
    if (c === ALL_KEY) return;
    const first = lines.find((l) => l.company === c);
    setActiveKey(first.key);
  }

  function selectLine(key) {
    setActiveKey(key);
    setSelectedId(null);
  }

  const segmentPaths = activeLine.segments.map((seg) => seg.map((s) => [s.lat, s.lon]));
  if (activeLine.loop && segmentPaths[0]?.length > 0) segmentPaths[0].push(segmentPaths[0][0]);

  const transferStations = activeLine.stations.filter((s) => s.transfers.length > 0);
  const selectedStation = activeLine.stations.find((s) => s.id === selectedId) || null;

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ padding: '10px 16px', background: '#222', color: '#fff', flex: '0 0 auto' }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>東京 沿線マップ</h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.85 }}>
          {isAllMode
            ? `全路線マップ — 収録している${lines.length}路線をすべて同じ地図に重ねて表示しています。`
            : `${activeLine.company} / ${activeLine.label} — 実際の地理座標で表示。丸が大きい駅は他路線への乗換駅です（タップすると下に詳細表示）。`}
        </p>
      </header>

      {/* 会社タブ */}
      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 12px', background: '#f2f2f2', flex: '0 0 auto', borderBottom: '1px solid #ddd' }}>
        <button
          onClick={() => selectCompany(ALL_KEY)}
          style={{
            padding: '6px 12px',
            borderRadius: 16,
            border: '1px solid #ff5722',
            background: isAllMode ? '#ff5722' : '#fff',
            color: isAllMode ? '#fff' : '#ff5722',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 'bold',
          }}
        >
          🗺 全路線マップ
        </button>
        {COMPANIES.map((c) => (
          <button
            key={c}
            onClick={() => selectCompany(c)}
            style={{
              padding: '6px 12px',
              borderRadius: 16,
              border: '1px solid #ccc',
              background: !isAllMode && c === company ? '#222' : '#fff',
              color: !isAllMode && c === company ? '#fff' : '#222',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {c}
          </button>
        ))}
      </nav>

      {/* 路線タブ */}
      {!isAllMode && (
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 12px', background: '#fafafa', flex: '0 0 auto', borderBottom: '1px solid #eee' }}>
          {companyLines.map((l) => (
            <button
              key={l.key}
              onClick={() => selectLine(l.key)}
              style={{
                padding: '5px 10px',
                borderRadius: 4,
                border: `1.5px solid ${l.color}`,
                background: l.key === activeKey ? l.color : '#fff',
                color: l.key === activeKey ? '#fff' : '#333',
                cursor: 'pointer',
                fontSize: 12.5,
                fontWeight: l.key === activeKey ? 'bold' : 'normal',
              }}
            >
              {l.label}
            </button>
          ))}
        </nav>
      )}

      <div style={{ flex: '1 1 auto' }}>
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
                    color: isSelected ? '#ff5722' : '#333',
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
          </MapContainer>
        )}
      </div>

      {/* 選択中の駅 + 乗換駅一覧 */}
      {!isAllMode && (
      <div style={{ flex: '0 0 auto', maxHeight: '26vh', overflowY: 'auto', borderTop: '1px solid #ddd', background: '#fff', padding: '8px 12px' }}>
        {selectedStation && (
          <div style={{ border: '2px solid #ff5722', borderRadius: 10, padding: '10px 12px', marginBottom: 10, background: '#fff7f4' }}>
            <div style={{ fontSize: 15, fontWeight: 'bold', color: '#222', marginBottom: 8 }}>📍 {selectedStation.name}</div>
            {selectedStation.transfers.length > 0 ? (
              <TransferCards transfers={selectedStation.transfers} />
            ) : (
              <div style={{ fontSize: 12.5, color: '#888' }}>乗換なし</div>
            )}
          </div>
        )}

        <button
          onClick={() => setListOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12.5,
            fontWeight: 'bold',
            color: '#333',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <span>{listOpen ? '▾' : '▸'}</span>
          乗換駅一覧（{transferStations.length}駅）
        </button>
        {listOpen &&
          (transferStations.length === 0 ? (
            <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>この路線に乗換駅はありません</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {transferStations.map((st) => (
                <div
                  key={st.id}
                  onClick={() => setSelectedId(st.id)}
                  style={{
                    border: `1px solid ${st.id === selectedId ? '#ff5722' : activeLine.color}`,
                    borderRadius: 6,
                    padding: '6px 10px',
                    minWidth: 230,
                    cursor: 'pointer',
                    background: st.id === selectedId ? '#fff7f4' : '#fff',
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>{st.name}</div>
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
