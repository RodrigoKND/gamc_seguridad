// L.divIcon() (Leaflet) recibe `html` y lo asigna como innerHTML crudo —
// cualquier valor de datos (ej. la foto de un guardia) que se interpole
// ahí primero debe pasar por acá. Compartido por PatrolLayer.tsx y
// AssignRouteWizard.tsx (dos lugares distintos que dibujan un pin con la
// foto del guardia) para no duplicar esta lógica de sanitización.
//
// Solo se aceptan URLs http(s) (descarta `javascript:`/`data:`/etc.), y
// cualquier carácter que pudiera cerrar el atributo `style="..."` (comillas,
// `<`/`>`) o el `url('...')` de CSS que lo envuelve se percent-encodea en
// vez de HTML-escaparse: un HTML-escape como `&#39;` se decodifica de
// vuelta a `'` antes de llegar al parser de CSS (mismo string, dos parsers
// distintos) y no evita el escape del `url('...')` — el percent-encoding
// en cambio queda inerte para ambos, ya que solo el navegador lo decodifica
// al ir a buscar el recurso.
export function safePhotoUrl(url: string | undefined): string | null {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return url.replace(/['"<>&]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
}
