# Reglas de Negocio — ERP para PyMEs

> Reglas que gobiernan el comportamiento del sistema, independientemente de la tecnología con la que se implementen. Son la razón detrás de varias restricciones del [modelo relacional](./modelo-relacional.md) — cada regla indica, cuando corresponde, en qué constraint del esquema queda reflejada.

## 1. Catálogo e inventario

**RN-01 — El stock nunca se edita directamente.**
El stock de un producto es siempre el resultado acumulado de sus movimientos (`Income`, `Outcome`, `Adjustment`). El campo `products.stock` es una copia de lectura rápida que debe actualizarse en la misma transacción que crea el movimiento; la fuente de verdad es la tabla de movimientos.

**RN-02 — El stock no puede ser negativo.**
Ninguna operación (venta, ajuste) puede dejar el stock de un producto por debajo de cero. _(`chk_products_stock_non_negative`)_

**RN-03 — El signo de la cantidad depende del tipo de movimiento.**
`Income` y `Outcome` son siempre cantidades positivas. Solo `Adjustment` puede ser negativo, porque representa una corrección manual (por ejemplo, una merma o un conteo físico que corrige el sistema). _(`chk_stock_movements_quantity_sign`)_

**RN-04 — Pausado no es lo mismo que eliminado.**
`active = false` significa que el producto está pausado para la venta pero sigue existiendo en el catálogo (por ejemplo, temporalmente sin stock del proveedor). `deleted = true` es una baja lógica: el producto no debe volver a aparecer en ninguna operación nueva. Un producto pausado puede reactivarse; uno eliminado, no.

**RN-05 — Las cantidades decimales solo aplican a unidades fraccionables.**
Un producto con unidad `Unit` debe manejarse en cantidades enteras. Solo `Kg`, `Meter` y `Liter` admiten cantidades decimales. Esta validación es de negocio (no está expresada como constraint de base de datos) y debe verificarse en el servicio.

## 2. Ventas (POS)

**RN-06 — El total de una venta lo calcula el backend, nunca el cliente.**
`sales.total` se recalcula en el servidor a partir de la suma de `sale_items` en el momento de la operación. Ningún endpoint debe aceptar un total enviado desde el frontend.

**RN-07 — El precio de venta queda congelado (snapshot).**
`sale_items.unit_price` guarda el precio del producto al momento exacto de la venta. Si más adelante cambia `products.price`, las ventas ya registradas no se ven afectadas — es una foto histórica, no una referencia viva.

**RN-08 — Toda venta y todo ítem de venta requieren cantidades y montos positivos.**
Un ítem con cantidad ≤ 0 o precio negativo es inválido, igual que una venta con total negativo. _(`chk_sale_items_quantity_positive`, `chk_sale_items_price_non_negative`, `chk_sales_total_non_negative`)_

**RN-09 — El estado de una venta se mueve en una progresión controlada.**
Una venta pasa por los estados `Ordered` → `Paid` → `Dispatched`. Cada transición debe quedar registrada en el historial (`sale_history`) con la fecha y, si corresponde, el usuario que la generó.

**RN-09.1 — Una venta solo puede cancelarse antes de ser despachada.**
`Cancelled` es alcanzable únicamente desde `Ordered` o `Paid`. Una vez que la venta llega a `Dispatched`, queda firme: el sistema debe rechazar cualquier intento de cancelarla. Esta regla es la que delimita hasta cuándo aplica la reversión de stock de RN-11 — después de `Dispatched` no hay cancelación que revertir.

**RN-10 — Un cambio de estado generado por el sistema no tiene usuario asociado.**
Cuando el cambio de estado de una venta lo dispara un proceso automático (por ejemplo, el webhook de confirmación de pago de Mercado Pago) y no una acción humana, el campo `user_id` del historial queda nulo. Esto permite distinguir en auditoría "lo hizo un empleado" de "lo hizo el sistema".

**RN-11 — Cancelar una venta revierte el stock, sin editar el movimiento original.**
Al cancelar una venta que ya generó un movimiento de stock (`Outcome`) — es decir, una venta en `Ordered` o `Paid`, ver RN-09.1 — el sistema debe generar el movimiento inverso correspondiente en vez de modificar o borrar el movimiento original. Se preserva la trazabilidad completa de qué pasó y cuándo.

**RN-12 — No existe entidad "cliente".**
El sistema es un ERP con punto de venta de mostrador, no un ecommerce. El usuario asociado a una venta (`sales.user_id`) es siempre el empleado que la cargó, nunca un comprador externo.

## 3. Pagos

**RN-13 — Un pago siempre se origina desde una venta existente.**
`payments.sale_id` referencia lógicamente una venta del ERP MS; no puede existir un pago sin una venta asociada.

**RN-14 — El monto de un pago debe ser positivo.**
Un pago con `amount <= 0` es inválido.

**RN-15 — El estado de un pago lo confirma Mercado Pago, no el usuario.**
El pasaje de `Pending` a `Paid` o `Rejected` depende de la notificación (webhook) de Mercado Pago, no de una acción manual dentro del sistema.

## 4. Usuarios y permisos

**RN-16 — Cada usuario tiene exactamente un rol, y los roles son jerárquicos.**
Los roles son `Owner`, `Admin` y `Employee`, mutuamente excluyentes: un usuario tiene uno y solo uno en todo momento. Cada nivel incluye los permisos del nivel inferior y suma los propios.

| Operación                                                        | Owner | Admin | Employee |
| ---------------------------------------------------------------- | ----- | ----- | -------- |
| Modificar el rol de un usuario ya existente (ascender/descender) | Sí    | No    | No       |
| Crear una cuenta nueva con rol `Admin`                           | Sí    | No    | No       |
| Crear una cuenta nueva con rol `Employee`                        | Sí    | Sí    | No       |
| Acceder al ERP MS (productos, stock y ventas)                    | Sí    | Sí    | Sí       |
| Acceder al Payments MS                                           | Sí    | Sí    | No       |

**RN-16.1 — Existe un único usuario con rol `Owner`.**
El sistema no admite dos usuarios con rol `Owner` de forma simultánea. El `Owner` accede sin restricciones a toda la aplicación y es el único que puede **modificar el rol de un usuario ya existente** — por ejemplo, ascender a un `Employee` a `Admin`, o remover a un `Admin` de ese rol. Esto es distinto de crear una cuenta nueva (RN-16.2), que es una acción separada.

**RN-16.2 — Un `Admin` no puede crear usuarios de su mismo rol.**
El `Admin` accede a todas las rutas de la aplicación y puede dar de alta cuentas nuevas con rol `Employee`, pero no puede crear un `Admin` ni un `Owner`, ni modificar el rol de un usuario ya existente. Crear un nuevo `Admin` o cambiar el rol de alguien ya registrado es potestad exclusiva del `Owner` (RN-16.1). El objetivo es impedir la escalada horizontal de privilegios: ningún administrador puede multiplicar su propio nivel de acceso sin pasar por el dueño del sistema.

**RN-16.3 — El `Employee` solo accede al ERP MS, pero sin restricciones dentro de él.**
Un usuario con rol `Employee` no tiene acceso al Auth MS (gestión de usuarios) ni al Payments MS. Dentro del ERP MS accede libremente a todas sus funciones: CRUD de productos (creación, modificación, cambio de estado), movimientos de stock y carga de ventas — es quien opera el punto de venta día a día (coherente con RN-12 y RF-14: `sales.user_id` es el empleado que cargó la venta).

**RN-16.4 — El primer usuario registrado en el sistema es el `Owner`, y el registro público es solo de arranque (bootstrap).**
Al momento del registro inicial no existe ningún usuario que pueda dar de alta a nadie (RN-16.1/RN-16.2), así que el sistema resuelve el arranque de forma automática: el primer registro recibe el rol `Owner` sin intervención manual. Una vez que ese `Owner` existe, el endpoint de registro público queda **deshabilitado permanentemente**: no hay auto-registro de `Employee` ni de ningún otro rol. De ahí en adelante, toda alta de usuario nueva es una acción autenticada de un `Owner` (cualquier rol) o de un `Admin` (solo `Employee`, RN-16.2).

**RN-17 — Un usuario desactivado conserva su historial.**
Desactivar un usuario (`active = false`) le impide iniciar sesión, pero sus ventas y movimientos pasados no se reasignan ni se eliminan.

## 5. Integridad entre microservicios

**RN-18 — No hay claves foráneas entre bases de datos distintas.**
Cada microservicio (Auth, ERP, Payments) tiene su propia base de datos. Las referencias cruzadas (`sale_history.user_id` → Auth, `payments.sale_id` → ERP) son lógicas, no constraints de base de datos. La consistencia se garantiza validando en el servicio que el ID referenciado existe antes de aceptar la operación, no por integridad referencial de PostgreSQL.

## 🔗 Relacionado

- [Requerimientos del sistema](./requerimientos.md)
- [Modelo relacional](./modelo-relacional.md)
