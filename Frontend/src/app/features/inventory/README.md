# Módulo de Inventario (Frontend)

Gestión y consulta del catálogo de productos: tabla de stock dinámica, alta/edición, baja,
ajuste manual de stock e indicadores de stock bajo. Se carga con lazy loading bajo `/inventory`
(`inventory.routes.ts`).

## Rutas

| Ruta                  | Pantalla                              | Acceso                           |
| --------------------- | ------------------------------------- | -------------------------------- |
| `/inventory`          | Tabla de productos + resumen de stock | Con sesión                       |
| `/inventory/new`      | Alta de producto                      | Roles de `INVENTORY_WRITE_ROLES` |
| `/inventory/:id/edit` | Edición de producto                   | Roles de `INVENTORY_WRITE_ROLES` |

La tabla guarda página, tamaño, búsqueda, orden y filtros en los query params
(`?page=2&search=caf&sortBy=price&sortOrder=desc&categoryId=…&stockStatus=low`), así que la vista
se puede compartir o recargar. Los valores por defecto no aparecen en la URL.

## Reglas de negocio que respeta la UI

- **RN-01:** el stock no se edita directamente. En edición el campo stock (y la unidad) están
  bloqueados; el stock cambia con un **ajuste de stock** (ingreso/egreso con motivo). En el alta
  solo se indica el stock inicial.
- **RN-02:** un egreso no puede superar el stock actual (se valida en el diálogo; el backend
  vuelve a validar).
- **RN-05:** solo `Kg`, `Meter` y `Liter` admiten cantidades decimales; `Unit` es entera.
- **Baja lógica:** eliminar marca el producto como eliminado (`DELETE /products/:id`).

## Contrato asumido con el backend

El ERP MS todavía no expone estos endpoints (TES-1), así que las formas siguientes **son
supuestos** a validar con backend. Los decimales de PostgreSQL pueden llegar como string; el
servicio los normaliza a `number`.

- `GET /products?page&limit&search&sortBy&sortOrder&categoryId&stockStatus&lowStockThreshold`
  → `{ data: Product[], meta: { total, page, limit, totalPages } }`
  - `sortBy`: `name | sku | category | price | stock`.
  - `stockStatus=low`: productos con `0 < stock <= lowStockThreshold`; `stockStatus=out`:
    `stock <= 0`. Son conjuntos **disjuntos** (el resumen calcula "normal" como el resto).
  - Devuelve también productos pausados; los eliminados no.
  - Cada producto incluye `category: { id, name }`.
- `GET /products/:id` · `POST /products` · `PATCH /products/:id` · `DELETE /products/:id`.
- `POST /products/:id/stock-movements` con `{ type: 'Income' | 'Outcome', quantity > 0, reason }`.
  Rechaza dejar el stock en negativo.
- `GET /categories` → `Category[]` (también se acepta una respuesta paginada).
- Un `409` al crear/editar se interpreta como **SKU duplicado**.
- Los errores de validación del backend se muestran con el `message` que devuelven.

## Decisiones y pendientes

- **Umbral de "stock bajo":** el producto no tiene un mínimo propio en el modelo de datos, así que
  el umbral es una preferencia por navegador (por defecto 10, editable en la cabecera de la tabla).
- **Roles:** `INVENTORY_WRITE_ROLES` incluye `OWNER`, `ADMIN`, `EMPLOYEE` y `VENDEDOR` (el nombre
  que hoy usa el guard de rutas para el empleado). Ajustar cuando TES-49 defina los roles finales.
- **Catálogo de Ventas:** el POS usa su propio `CatalogService`; puede migrarse a `InventoryService`.
- **Stock inicial en el alta:** se envía en `POST /products`; depende de que el backend lo registre
  como movimiento (RN-01).
