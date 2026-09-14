function loadLeafletCss() {
  if (!document.querySelector('link[data-leaflet-css]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    l.integrity = 'sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H';
    l.crossOrigin = 'anonymous';
    l.setAttribute('data-leaflet-css', '1');
    document.head.appendChild(l);
  }
  if (!window.L && !document.querySelector('script[data-leaflet-js]')) {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.integrity = 'sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH';
    s.crossOrigin = 'anonymous';
    s.setAttribute('data-leaflet-js', '1');
    document.head.appendChild(s);
  }
}

function CochabambaMap(props) {
  const ref = React.useRef(null);
  const mapRef = React.useRef(null);
  const layerRef = React.useRef(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    loadLeafletCss();
    let cancelled = false;
    function init() {
      if (cancelled) return;
      if (!window.L) { setTimeout(init, 150); return; }
      if (!mapRef.current && ref.current) {
        const map = window.L.map(ref.current, { zoomControl: true, attributionControl: true }).setView([-17.3935, -66.1653], 13);
        window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors', maxZoom: 18
        }).addTo(map);
        mapRef.current = map;
        setReady(true);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    if (layerRef.current) { layerRef.current.remove(); }
    const group = window.L.layerGroup().addTo(map);
    layerRef.current = group;

    if (props.patrolView === 'vivo') {
      (props.markers || []).forEach((m) => {
        const color = m.color || '#22C55E';
        const icon = window.L.divIcon({
          className: '',
          html: '<div style="width:26px;height:26px;border-radius:50%;background:' + color + ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:sans-serif">' + m.label + '</div>',
          iconSize: [26, 26], iconAnchor: [13, 13]
        });
        const mk = window.L.marker([m.lat, m.lng], { icon }).addTo(group);
        mk.on('click', () => { if (props.onSelectGuard) props.onSelectGuard(m.idx); });
      });
      if (props.showPerimeter && props.markers && props.markers.length > 2) {
        const pts = props.markers.map((m) => [m.lat, m.lng]);
        window.L.polygon(pts, { color: '#1D4ED8', weight: 2, dashArray: '6,6', fillColor: '#1D4ED8', fillOpacity: 0.06 }).addTo(group);
      }
    } else if (props.patrolView === 'calor') {
      (props.riskPoints || []).forEach((p) => {
        window.L.circle([p.lat, p.lng], { radius: p.radius || 350, color: p.color, fillColor: p.color, fillOpacity: 0.35, weight: 1 }).addTo(group);
      });
    }
  }, [ready, props.patrolView, props.markers, props.riskPoints, props.showPerimeter]);

  return React.createElement('div', { ref, style: { width: '100%', height: '100%', minHeight: '460px' } });
}

module.exports = { CochabambaMap };
