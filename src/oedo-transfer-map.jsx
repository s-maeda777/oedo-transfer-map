import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import lines from './data/lines.json';

const COMPANIES = [...new Set(lines.map((l) => l.company))];

function boundsOf(stations) {
  const lats = stations.map((s) => s.lat);
  const lons = stations.map((s) => s.lon);
  const pad = 0.02;
  return [
    [Math.min(...lats) - pad, Math.min(...lons) - pad],
    [Math.max(...lats) + pad, Math.max(...lons) + pad],
  ];
}

export default function OedoTransferMap() {
  const [company, setCompany] = useState(COMPANIES[0]);
  const companyLines = useMemo(() => lines.filter((l) => l.company === company), [company]);
  const [activeKey, setActiveKey] = useState(companyLines[0].key);

  const activeLine = useMemo(
    () => lines.find((l) => l.key === activeKey) || companyLines[0],
    [activeKey, companyLines],
  );

  function selectCompany(c) {
    setCompany(c);
    const first = lines.find((l) => l.company === c);
    setActiveKey(first.key);
  }

  const segmentPaths = activeLine.segments.map((seg) => seg.map((s) => [s.lat, s.lon]));
  if (activeLine.loop && segmentPaths[0]?.length > 0) segmentPaths[0].push(segmentPaths[0][0]);

  const transferStations = activeLine.stations.filter((s) => s.transfers.length > 0);

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ padding: '10px 16px', background: '#222', color: '#fff', flex: '0 0 auto' }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>東京 沿線マップ</h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.85 }}>
          {activeLine.company} / {activeLine.label} — 実際の地理座標で表示。丸が大きい駅は他路線への乗換駅です。
        </p>
      </header>

      {/* 会社タブ */}
      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 12px', background: '#f2f2f2', flex: '0 0 auto', borderBottom: '1px solid #ddd' }}>
        {COMPANIES.map((c) => (
          <button
            key={c}
            onClick={() => selectCompany(c)}
            style={{
              padding: '6px 12px',
              borderRadius: 16,
              border: '1px solid #ccc',
              background: c === company ? '#222' : '#fff',
              color: c === company ? '#fff' : '#222',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {c}
          </button>
        ))}
      </nav>

      {/* 路線タブ */}
      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 12px', background: '#fafafa', flex: '0 0 auto', borderBottom: '1px solid #eee' }}>
        {companyLines.map((l) => (
          <button
            key={l.key}
            onClick={() => setActiveKey(l.key)}
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

      <div style={{ flex: '1 1 auto' }}>
        <MapContainer key={activeKey} bounds={boundsOf(activeLine.stations)} style={{ width: '100%', height: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {segmentPaths.map((path, i) => (
            <Polyline key={i} positions={path} pathOptions={{ color: activeLine.color, weight: 5, opacity: 0.9 }} />
          ))}

          {activeLine.stations.map((st) => {
            const isTransfer = st.transfers.length > 0;
            return (
              <CircleMarker
                key={st.id}
                center={[st.lat, st.lon]}
                radius={isTransfer ? 8 : 5}
                pathOptions={{
                  color: '#333',
                  weight: 1.5,
                  fillColor: isTransfer ? '#ffffff' : activeLine.color,
                  fillOpacity: 1,
                }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  {st.name}
                </Tooltip>
                <Popup>
                  <strong>{st.name}</strong>
                  <br />
                  {isTransfer ? (
                    <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                      {st.transfers.map((t) => (
                        <li key={t.line}>
                          {t.line}（徒歩約{t.walkMin}分）
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span>乗換なし</span>
                  )}
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* 乗換駅一覧 */}
      <div style={{ flex: '0 0 auto', maxHeight: '22vh', overflowY: 'auto', borderTop: '1px solid #ddd', background: '#fff', padding: '8px 12px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 'bold', marginBottom: 6, color: '#333' }}>
          乗換駅一覧（{transferStations.length}駅）
        </div>
        {transferStations.length === 0 ? (
          <div style={{ fontSize: 12, color: '#888' }}>この路線に乗換駅はありません</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {transferStations.map((st) => (
              <div
                key={st.id}
                style={{ border: `1px solid ${activeLine.color}`, borderRadius: 6, padding: '6px 10px', minWidth: 170 }}
              >
                <div style={{ fontWeight: 'bold', fontSize: 13 }}>{st.name}</div>
                {st.transfers.map((t) => (
                  <div key={t.line} style={{ fontSize: 11.5, color: '#555' }}>
                    → {t.line}（徒歩約{t.walkMin}分）
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
