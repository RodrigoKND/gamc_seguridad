'use client';

import { useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useMap } from 'react-leaflet';

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
}

export function MapSearch() {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleSearch() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}&countrycodes=bo&viewbox=-68.5,-16.5,-64.5,-18.5&bounded=1`,
        { headers: { 'Accept-Language': 'es' } }
      );
      const data: NominatimResult[] = await res.json();
      setResults(data);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function selectResult(r: NominatimResult) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    map.flyTo([lat, lng], 16, { duration: 1.2 });
    setOpen(false);
    setResults([]);
  }

  return (
    <div className="absolute left-3 right-3 top-3 z-[600] sm:left-auto sm:w-72">
      <div className="flex items-center gap-1 rounded-lg border border-neutral-border bg-white/95 px-2 py-1.5 shadow-md backdrop-blur">
        <Search className="h-4 w-4 shrink-0 text-neutral-text-muted" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch();
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder="Buscar calle, plaza, zona… (ej. Plaza 14 de Septiembre)"
          className="flex-1 bg-transparent text-[13px] text-neutral-text placeholder:text-neutral-text-muted focus:outline-none"
        />
        {query && (
          <button type="button" onClick={() => { setQuery(''); setResults([]); setOpen(false); }} className="rounded p-1 hover:bg-neutral-bg">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="rounded bg-brand-gold-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-gold-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Buscar'}
        </button>
      </div>
      {open && results.length > 0 && (
        <ul className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-neutral-border bg-white shadow-lg">
          {results.map((r) => (
            <li key={r.place_id}>
              <button
                type="button"
                onClick={() => selectResult(r)}
                className="w-full px-3 py-2 text-left text-[12.5px] text-neutral-text hover:bg-neutral-bg"
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && results.length === 0 && !loading && query && (
        <div className="mt-1 rounded-lg border border-neutral-border bg-white px-3 py-2 text-xs text-neutral-text-muted shadow">
          Sin resultados. Prueba con otro nombre.
        </div>
      )}
    </div>
  );
}
