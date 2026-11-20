# Módulo de Ventas y Pagos (Frontend)

Punto de venta: catálogo + carrito, checkout con formulario reactivo y cobro con Mercado Pago.
Se carga con lazy loading bajo `/sales` (`sales.routes.ts`).

## Rutas

| Ruta                     | Pantalla                                                                  |
| ------------------------ | ------------------------------------------------------------------------- |
| `/sales`                 | POS: búsqueda de productos + carrito                                      |
| `/sales/checkout`        | Resumen de la orden y confirmación                                        |
| `/sales/payment/:result` | Retorno de Mercado Pago (`success`, `failure`, `pending`)                 |
| `/payments/:result`      | Redirige a `/sales/payment/:result` (URLs de retorno que arma el backend) |

## Flujo de cobro

1. **Checkout** refresca el stock del carrito (`StockCheckService.verify`). Si algo ya no alcanza, muestra el diálogo de conflicto y no crea nada.
2. `POST /sales` con `{ items: [{ productId, quantity }] }`. El total **no se envía**: lo calcula el backend (RN-06).
3. `POST /payments` con `{ saleId }` (el Gateway rechaza cualquier otro campo) → `Payment { id, saleId, amount, state, checkoutUrl, createdAt }`. El monto, el pagador y las URLs de retorno los resuelve el backend a partir de la venta.
4. Redirección al `checkoutUrl` (solo dominios https de Mercado Pago). Si ya no se puede cobrar, llega `409 SALE_NOT_PAYABLE` y el checkout arma una venta nueva en el reintento.
5. Mercado Pago vuelve a `/payments/:result?external_reference=<saleId>` (que redirige a `/sales/payment/:result`). La pantalla **no confía en la URL**: consulta `GET /sales/:id` y `GET /payments/sale/:saleId`, hace polling corto mientras esté pendiente y, solo al confirmarse el pago, vacía el carrito.

## Contrato con el backend (Gateway, prefijo `/api`)

Alineado con los controllers del Gateway y los DTOs de `Backend/libs/contracts`:

- `GET /products?page&limit&search&active=true` → `{ data: Product[], meta }` (decimales pueden llegar como string).
- `GET /products/:id` → `Product`.
- `POST /sales` con `{ items: [{ productId, quantity }] }` → `SaleView` (`id`, `total`, `currentState`…).
- `GET /sales/:id` → `SaleView` (`currentState`: `Ordered | Paid | Dispatched | Cancelled`).
- `POST /payments` con `{ saleId }` → `Payment` (`state`: `Pending | Paid | Rejected | Refunded`; `checkoutUrl` es `null` si el intento ya se cerró).
  Errores: `404` venta inexistente, `409 SALE_NOT_PAYABLE`, `409` pago en curso, `502` Mercado Pago rechazó, `503` servicio ocupado, `504` demora.
- `GET /payments/sale/:saleId` → último `Payment` de la venta; `404` si todavía no existe.
- Stock insuficiente: `409` con `{ code: 'INSUFFICIENT_STOCK', items: [{ productId, name, requested, available }] }`.

## Pendientes de integración

- **Guards:** `SALES_GUARDS` exige sesión (`authGuard`). El módulo no restringe por rol.
- **Catálogo:** `CatalogService` es un adaptador de solo lectura propio de Ventas; reemplazarlo por `InventoryService` cuando el módulo de Inventario lo exponga (TES-52).
- **Roles:** todos los roles pueden crear pagos (RN-16.3), incluido `Employee`.
- **Retorno de Mercado Pago:** el backend arma las URLs con `FRONTEND_URL`; debe coincidir con el origen donde se sirve el front (`http://localhost:4200` con `ng serve`, `:8080` con Docker).
