# Módulo de Ventas y Pagos (Frontend)

Punto de venta: catálogo + carrito, checkout con formulario reactivo y cobro con Mercado Pago.
Se carga con lazy loading bajo `/sales` (`sales.routes.ts`).

## Rutas

| Ruta                     | Pantalla                                                  |
| ------------------------ | --------------------------------------------------------- |
| `/sales`                 | POS: búsqueda de productos + carrito                      |
| `/sales/checkout`        | Datos del cobro y confirmación                            |
| `/sales/payment/:result` | Retorno de Mercado Pago (`success`, `failure`, `pending`) |

## Flujo de cobro

1. **Checkout** refresca el stock del carrito (`StockCheckService.verify`). Si algo ya no alcanza, muestra el diálogo de conflicto y no crea nada.
2. `POST /sales` con `{ items: [{ productId, quantity }] }`. El total **no se envía**: lo calcula el backend (RN-06).
3. `POST /payments` con `{ saleId, backUrls, payer: { name, email } }` → `{ initPoint }`. El monto lo resuelve el backend a partir de la venta.
4. Redirección al `initPoint` (solo dominios de Mercado Pago).
5. Mercado Pago vuelve a `/sales/payment/:result?external_reference=<saleId>`. La pantalla **no confía en la URL**: consulta `GET /sales/:id` y `GET /payments/sale/:saleId`, hace polling corto mientras esté pendiente y, solo al confirmarse el pago, vacía el carrito.

## Contrato asumido con el backend

Los microservicios del Gateway todavía son un scaffold, así que estos endpoints y formas **son supuestos** a validar con backend (TES-25, TES-28, TES-29):

- `GET /products?page&limit&search&active=true` → `{ data: Product[], meta }` (decimales pueden llegar como string).
- `GET /products/:id` → `Product`.
- `POST /sales` → `{ id, total, currentState }`.
- `GET /sales/:id` → `{ id, total, currentState }` (`Ordered | Paid | Dispatched | Cancelled`).
- `POST /payments` → `{ initPoint }` (también se acepta `init_point`).
- `GET /payments/sale/:saleId` → `{ id, saleId, paymentState, amount }`; `404` si todavía no existe.
- Stock insuficiente: `409` (o `422`) con `{ code: 'INSUFFICIENT_STOCK', items: [{ productId, requested, available }] }`. Si llega el código sin `items`, se re-consulta el stock real.

## Pendientes de integración

- **Guards:** `SALES_GUARDS` en `sales.routes.ts` está vacío; sumar el guard de auth/roles cuando exista (TES-49).
- **Catálogo:** `CatalogService` es un adaptador de solo lectura propio de Ventas; reemplazarlo por `InventoryService` cuando el módulo de Inventario lo exponga (TES-52).
- **Roles:** según las reglas de negocio, un `Employee` no accede al Payments MS; el cobro con Mercado Pago requeriría `Owner`/`Admin`.
