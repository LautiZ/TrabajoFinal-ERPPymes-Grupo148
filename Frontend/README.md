# Frontend — ERP para PyMEs

Aplicación cliente construida en Angular 22 utilizando arquitectura modular por features y carga bajo demanda (lazy loading).

## Estructura de carpetas

```text
src/app/
├── core/                  # Servicios singleton, guards, interceptors HTTP y modelos globales
├── shared/                # Componentes, pipes y directivas reutilizables en múltiples módulos
└── features/              # Módulos de negocio independientes (Lazy Loaded)
    ├── auth/              # Login, registro y manejo de sesión
    ├── inventory/         # Catálogo de productos y movimientos de stock
    ├── sales/             # Punto de venta (POS), carrito y pagos
    ├── dashboard/         # Métricas financieras y analítica
    └── not-found/         # Página de error 404

## Sesión y almacenamiento del token (JWT)

**Decisión de equipo:** el JWT **no** se guarda en cookies. Se almacena en `sessionStorage` a través
de `TokenStorageService` (`core/services/token-storage.service.ts`), que es el único lugar del código
que lee o escribe el token.

| Propiedad                     | `sessionStorage` (elegido)        |
| ----------------------------- | --------------------------------- |
| Sobrevive al F5               | Sí                                |
| Se borra al cerrar la pestaña | Sí                                |
| Se comparte entre pestañas    | No (cada pestaña tiene su sesión) |
| Se envía solo en cada request | No: lo agrega el `authInterceptor` solo hacia el Gateway |

El access token es de vida corta y no hay refresh token: al vencer, el usuario vuelve a iniciar sesión.

### Riesgos

- **XSS:** al ser accesible desde JavaScript, un script inyectado podría leer el token. Es el
  principal riesgo de no usar cookies `HttpOnly`.
- **Sin revocación local:** el cierre de sesión revoca la sesión en el servidor (el `jti` del token
  identifica la sesión), pero un token ya robado sirve hasta que venza.

### Mitigaciones

- Token de vida corta y sesión revocable en el servidor.
- El token nunca se envía a orígenes distintos del Gateway.
- Un token vencido se descarta y no se envía.
- Reducir la superficie de XSS: ver las medidas de endurecimiento (CSP, reglas de lint) más abajo.
```

## Endurecimiento anti-XSS (TES-70)

Como el token está accesible desde JavaScript, se reduce la superficie de XSS con estas medidas:

### Content-Security-Policy

Definida en `src/index.html` (`<meta http-equiv="Content-Security-Policy">`, para desarrollo y
cualquier hosting estático) y en `nginx/security-headers.conf` (cabecera HTTP, para producción).
Las dos deben mantenerse iguales; la cabecera además agrega `frame-ancestors 'none'`, que no
funciona en `<meta>`.

| Directiva                 | Valor                                         | Por qué                                                       |
| ------------------------- | --------------------------------------------- | ------------------------------------------------------------- |
| `default-src`             | `'self'`                                      | Todo lo no listado solo se carga del propio origen.           |
| `script-src`              | `'self'`                                      | **Sin** `'unsafe-inline'` ni `'unsafe-eval'`.                 |
| `style-src`               | `'self' 'unsafe-inline' fonts.googleapis.com` | Angular inyecta los estilos de cada componente; solo estilos. |
| `font-src`                | `'self' fonts.gstatic.com`                    | Tipografías de Google Fonts.                                  |
| `connect-src`             | `'self' http://localhost:3000`                | El propio origen y el API Gateway.                            |
| `img-src`                 | `'self' data:`                                |                                                               |
| `object-src`, `frame-src` | `'none'`                                      | No se usan plugins ni iframes.                                |
| `base-uri`, `form-action` | `'self'`                                      |                                                               |

- **Si cambia la URL del Gateway**, actualizar `connect-src` en `index.html` y en `nginx/security-headers.conf`.
- **Mercado Pago** no figura en la CSP porque el pago es una redirección de página. Si se embebe el
  Brick/SDK, habría que sumar sus orígenes (ver el comentario en `security-headers.conf`).
- **Build de producción:** `inlineCritical` está desactivado en `angular.json`. Con esa optimización
  Angular agrega un `<script>` en línea que activa la hoja de estilos, y una CSP estricta lo bloquearía
  dejando la app sin estilos.

### Cabeceras de seguridad (nginx)

`nginx/default.conf` y `nginx/security-headers.conf` son la base para el Dockerfile del frontend
(TES-66): `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`frame-ancestors 'none'` (y `X-Frame-Options: DENY`), `Permissions-Policy` y fallback de SPA a
`index.html`. No se probaron contra una instancia real de nginx: validar con `nginx -t` al armar la imagen.

### Reglas de lint

`pnpm lint` falla si el código (o una plantilla) usa `innerHTML` / `outerHTML`, `insertAdjacentHTML`,
`[innerHTML]` o `bypassSecurityTrust*`. Si hay un caso realmente necesario, justificarlo en el código:

```ts
// eslint-disable-next-line no-restricted-syntax -- motivo concreto acá
```

### Dependencias

- Las versiones quedan fijadas por el lockfile (`pnpm-lock.yaml`): instalar siempre con
  `pnpm install --frozen-lockfile` (también en CI y en la imagen Docker).
- No se cargan scripts de terceros; lo único externo son las hojas de estilo y tipografías de Google Fonts.
