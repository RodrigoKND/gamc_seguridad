# Guía de despliegue

Instrucciones para desplegar GAMC Seguridad en producción usando Vercel.

---

## Plataforma recomendada

**Vercel** es la plataforma de despliegue oficial para este proyecto. La configuración en `vercel.json` incluye:

- Rewrites de API para evitar problemas de CORS en producción.
- Headers de seguridad HTTP (HSTS, X-Frame-Options, etc.).
- Configuración de región para minimizar latencia desde Bolivia.

---

## Variables de entorno en producción

Configurar las siguientes variables en el panel **Settings → Environment Variables** del proyecto en Vercel:

| Variable | Entorno | Descripción |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Production, Preview | URL pública del backend (ej: `https://api.gamc-seguridad.gob.bo`) |
| `NEXT_PUBLIC_WEBSOCKET_URL` | Production, Preview | URL del servidor WebSocket |
| `JWT_SECRET` | Production, Preview | Secreto compartido con el backend — **no exponer en logs** |
| `NEXT_PUBLIC_MAP_TILE_URL` | Production | URL del proveedor de teselas cartográficas de producción |
| `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` | Production | Atribución HTML del proveedor |
| `NEXT_PUBLIC_MAP_DEFAULT_LAT` | Production | `-17.3935` |
| `NEXT_PUBLIC_MAP_DEFAULT_LNG` | Production | `-66.1653` |
| `NEXT_PUBLIC_MAP_DEFAULT_ZOOM` | Production | `13` |

> **Importante**: `JWT_SECRET` debe ser una cadena aleatoria de alta entropía (mínimo 32 caracteres). Usar el mismo valor en el backend y en este frontend.

---

## Selección de región

Para minimizar la latencia desde Cochabamba, Bolivia, seleccionar la región de Vercel más cercana disponible. Al momento de este documento, las opciones más próximas son:

- **GRU1** — São Paulo, Brasil (recomendada)
- **IAD1** — Washington D.C., EE.UU. (alternativa)

Configurar la región en `vercel.json` o en el panel de Vercel → Settings → Functions.

---

## Proceso de despliegue

### Despliegue automático (recomendado)

1. Conectar el repositorio a Vercel desde el panel (Import Git Repository).
2. Seleccionar la rama `main` como rama de producción.
3. Configurar las variables de entorno (ver tabla arriba).
4. Vercel desplegará automáticamente en cada push a `main`.

### Despliegue manual

```bash
# Instalar Vercel CLI
npm install -g vercel

# Autenticarse
vercel login

# Desplegar a producción
vercel --prod
```

---

## Headers de seguridad

El archivo `next.config.js` aplica los siguientes headers en todas las respuestas:

| Header | Valor |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |

---

## Verificación post-despliegue

Después de cada despliegue, verificar:

1. **Login**: acceder a la URL de producción → debe redirigir a `/login`.
2. **Autenticación**: ingresar con credenciales de Super Admin → debe cargar el mapa o dashboard.
3. **Tiempo real**: verificar en DevTools → Network → WS que la conexión WebSocket se establece.
4. **Mapa**: el mapa debe cargar las teselas y mostrar los marcadores de guardias.
5. **SOS**: simular una alerta SOS desde la app móvil → debe aparecer el banner y el marcador.

---

## Rollback

En caso de incidentes críticos en producción, usar el panel de Vercel → Deployments para hacer rollback instantáneo a la versión anterior estable.

```bash
# Con Vercel CLI
vercel rollback
```

---

## Consideraciones de red para producción

- El backend debe tener `CORS_ORIGINS` configurado con el dominio de producción del frontend.
- El servidor de WebSocket debe ser accesible desde los navegadores de los operadores (puede requerir abrir puertos en el firewall corporativo del municipio).
- Si se usa un proxy inverso (Nginx, Cloudflare) frente al backend, verificar que soporte WebSockets (`proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade;`).

---

## Build de producción local (testing)

Para verificar el build antes de desplegar:

```bash
npm run build
npm run start
# → http://localhost:3000
```

El comando `build` ejecuta automáticamente `typecheck` y `lint`. Si alguno falla, el build se detiene.
