# Control de acceso (RBAC)

GAMC Seguridad implementa un modelo de control de acceso basado en roles (Role-Based Access Control) con tres roles de usuario web.

---

## Roles

| Rol | Descripción |
|---|---|
| `super_admin` | Máximo nivel de acceso. Gestiona usuarios web y tiene control total sobre todas las funciones operativas. |
| `admin` | Acceso operativo completo. Puede gestionar guardias, patrullajes y ver el dashboard, pero no puede crear usuarios web. |
| `operador_monitoreo` | Rol de monitoreo en tiempo real. Opera el mapa y gestiona incidentes, sin acceso al dashboard ejecutivo ni gestión de credenciales. |

---

## Acceso a módulos

| Módulo | Ruta | `super_admin` | `admin` | `operador_monitoreo` |
|---|---|:---:|:---:|:---:|
| Dashboard | `/dashboard` | ✓ | ✓ | — |
| Mapa | `/mapas` | ✓ | ✓ | ✓ |
| Guardias | `/guardias` | ✓ | ✓ | ✓ |
| Hechos | `/hechos` | ✓ | ✓ | ✓ |
| Reportes | `/reportes` | ✓ | ✓ | ✓ |
| Credenciales | `/credenciales` | ✓ | — | — |

El middleware `src/middleware.ts` aplica esta tabla en el servidor. Un usuario que intenta acceder a una ruta no permitida es redirigido a su módulo de inicio por defecto.

---

## Permisos de escritura por recurso

La función `canWrite(rol, recurso)` en `src/lib/permissions.ts` implementa la siguiente matriz:

| Recurso | `super_admin` | `admin` | `operador_monitoreo` |
|---|:---:|:---:|:---:|
| `guardias` (crear / editar) | ✓ | ✓ | — |
| `usuarios` (crear usuarios web) | ✓ | — | — |
| `hechos:estado` (cambiar estado) | — | — | ✓ |
| `hechos:clasificar` (asignar EPI) | ✓ | ✓ | ✓ |
| `patrullaje` (asignar / cancelar) | ✓ | — | ✓ |
| `rutas_establecidas` (crear / editar plantillas) | ✓ | ✓ | ✓ |
| `puntos_fijos` (crear / editar) | ✓ | — | ✓ |
| `programacion_rutas` (crear / editar) | ✓ | — | ✓ |

---

## Implementación técnica

### Middleware de rutas (servidor)

`src/middleware.ts` intercepta todas las peticiones entrantes:

```ts
// Pseudocódigo del middleware
const { rol } = await verifySession(request)

const rutasPermitidas = ROUTES_BY_ROLE[rol]
if (!rutasPermitidas.includes(pathname)) {
  return redirect('/ruta-por-defecto-del-rol')
}
```

### Función `canWrite`

```ts
import { canWrite } from '@/lib/permissions'

// Dentro de un Server Action o Server Component
const session = await getSession()

if (!canWrite(session.rol, 'guardias')) {
  throw new Error('Sin permisos para esta operación')
}
```

### Ocultamiento de controles en la UI

Los botones y acciones que el usuario no puede ejecutar se ocultan o deshabilitan en el cliente usando el mismo `canWrite`:

```tsx
// Dentro de un Server Component que recibe el rol
{canWrite(rol, 'patrullaje') && (
  <Button onClick={handleAsignarRuta}>Asignar ruta</Button>
)}
```

---

## Consideraciones de seguridad

- La verificación de permisos ocurre **en el servidor** (middleware y Server Actions). El ocultamiento en la UI es solo UX, no seguridad.
- El backend `gamc-api` también verifica el rol en cada endpoint. Un usuario no puede saltarse los permisos manipulando el cliente.
- El token JWT incluye el `rol` del usuario y está firmado con `JWT_SECRET`. No es modificable sin invalidar la firma.
- Las cookies de sesión son `httpOnly` — no accesibles desde JavaScript del navegador.
