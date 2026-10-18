# Getting Started

Guía paso a paso para configurar el entorno de desarrollo de GAMC Seguridad.

---

## Requisitos del sistema

| Requisito | Versión mínima | Notas |
|---|---|---|
| Node.js | 20.x LTS | Recomendado: 22.x LTS |
| npm | 10.x | No mezclar con `pnpm` o `yarn` |
| Git | 2.x | — |
| Backend gamc-api | — | Debe estar en ejecución antes de iniciar el frontend |

---

## 1. Clonar el repositorio

```bash
git clone <url-del-repositorio> gamc_seguridad
cd gamc_seguridad
```

---

## 2. Instalar dependencias

```bash
npm install
```

El archivo `package-lock.json` está versionado. No ejecutar `npm install --legacy-peer-deps` ni eliminar el lockfile sin coordinación con el equipo.

---

## 3. Configurar variables de entorno

```bash
cp .env.example .env.local
```

Abrir `.env.local` y completar los valores. Las variables requeridas son:

```bash
# URL del backend REST (gamc-api)
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

# URL del servidor WebSocket (generalmente el mismo que la API)
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:4000

# Secreto JWT — debe coincidir exactamente con el del backend
JWT_SECRET=<secreto-compartido-con-gamc-api>
```

Las variables opcionales del mapa tienen valores predeterminados apuntando a Cochabamba con OpenStreetMap como proveedor de teselas. Solo es necesario sobreescribirlas si se usa un proveedor de mapas alternativo o se desea centrar el mapa en una ubicación diferente.

```bash
# Proveedor de teselas (opcional)
NEXT_PUBLIC_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
NEXT_PUBLIC_MAP_TILE_ATTRIBUTION=&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>

# Centro y zoom del mapa (opcional)
NEXT_PUBLIC_MAP_DEFAULT_LAT=-17.3935
NEXT_PUBLIC_MAP_DEFAULT_LNG=-66.1653
NEXT_PUBLIC_MAP_DEFAULT_ZOOM=13
```

---

## 4. Iniciar el servidor de desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`.

> **Importante**: el backend (`gamc-api`) debe estar corriendo y accesible desde `NEXT_PUBLIC_API_BASE_URL` antes de abrir la aplicación. Sin él, la pantalla de login no podrá autenticar.

---

## 5. Verificar la instalación

1. Abrir `http://localhost:3000` en el navegador.
2. Debe redirigir automáticamente a `/login`.
3. Ingresar con las credenciales del Super Admin creadas durante el setup del backend.
4. El dashboard o el mapa deben cargar sin errores en la consola del navegador.

---

## Verificación de tipos y linting

Antes de hacer un commit, es recomendable ejecutar:

```bash
npm run typecheck   # Verifica que no haya errores de TypeScript
npm run lint        # Verifica convenciones de código con ESLint
```

Ambos comandos también se ejecutan en el pipeline de CI antes de cada deploy.

---

## Solución de problemas frecuentes

### La pantalla de login muestra "Error de red"

- Verificar que `NEXT_PUBLIC_API_BASE_URL` apunta al backend correcto y que este está corriendo.
- Si el backend usa HTTPS con certificado autofirmado en desarrollo, configurar `NODE_TLS_REJECT_UNAUTHORIZED=0` (solo en desarrollo).

### Los eventos en tiempo real no llegan

- Verificar que `NEXT_PUBLIC_WEBSOCKET_URL` es accesible desde el navegador (no desde el servidor Next.js).
- Revisar que el backend tenga `CORS_ORIGINS` configurado con `http://localhost:3000`.
- Abrir las DevTools del navegador → pestaña Network → filtrar por WS y verificar que la conexión se establece.

### El mapa no carga las teselas

- Verificar conectividad a internet (en desarrollo usa OpenStreetMap por defecto).
- Si se usa un proveedor de mapas privado, asegurarse de que `NEXT_PUBLIC_MAP_TILE_URL` y la clave de API sean correctos.

### Error `JWT_SECRET` no definido

- Asegurarse de que `.env.local` existe y contiene `JWT_SECRET`.
- En producción (Vercel), configurar la variable en el panel de Environment Variables del proyecto.
