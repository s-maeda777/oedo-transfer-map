# 東京 沿線マップ

東京都内の鉄道路線（都営地下鉄・東京メトロ・JR東日本・東急・小田急・京王・西武・東武・京成・京浜急行 ほか、モノレール・都電を含む全72路線）を、実際の地理座標で OpenStreetMap 上に表示するReactアプリ。

- 会社タブ → 路線タブで切り替え表示
- 駅データは [OpenStreetMap](https://www.openstreetmap.org/copyright) (Overpass API) から取得した実座標
- 乗換駅は駅名・近接座標から自動検出して強調表示

## 開発

```bash
npm install
npm run dev
```

## 技術構成

- Vite + React
- react-leaflet + Leaflet（OpenStreetMapタイル）
- 駅・路線データ: `src/data/lines.json`（Overpass APIから生成、`src/oedo-transfer-map.jsx` が読み込んで描画）
