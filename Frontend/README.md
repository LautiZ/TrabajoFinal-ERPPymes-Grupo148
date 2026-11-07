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
