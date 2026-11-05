# Guía de pruebas manuales — Ventas y Pagos

El backend real todavía no expone `/products`, `/sales` ni `/payments`, así que esta carpeta trae una
**API simulada** (solo para desarrollo, estado en memoria) con el contrato que asume el frontend
(ver `src/app/features/sales/README.md`).

## Cómo levantarlo

Necesitás dos terminales dentro de `Frontend/`:

```bash
pnpm mock-api
```

```bash
pnpm start
```

> La app apunta a `http://localhost:3000` (`src/environments/environment.development.ts`). Si tenés el
> API Gateway real en ese puerto, apagalo o cambiá el puerto con `PORT=3001 pnpm mock-api` y ajustá `apiUrl`.

Para volver a empezar con los datos de ejemplo: abrí <http://localhost:3000/__mock/reset>.
Para ver el estado interno (productos, ventas, pagos): <http://localhost:3000/__mock/state>.

## Productos de ejemplo

| Producto | SKU | Stock | Notas |
| --- | --- | --- | --- |
| Yerba Mate 1kg | `YER-001` | 25 u | Caso normal |
| Café Grano Especial 1kg | `CAF-ESP-01` | 4 u | Pocas unidades, sirve para probar límites |
| Filtro Hidráulico 50M | `IND-FILT-09` | 8 u | |
| Válvula Esférica Bronce 1/2 | `VAL-BRN-88` | 3 u | |
| Harina a granel | `GRA-HAR-01` | 50,5 kg | Admite decimales |
| Cable por metro | `ELE-CAB-02` | 100 m | Admite decimales |
| Caja Embalaje #4 | `ALM-CAJ-04` | 0 | Agotado: botón deshabilitado |
| Producto pausado | `PAU-001` | 10 u | No debe aparecer en el POS |

## Qué probar

Abrí <http://localhost:4200/sales>.

### 1. POS y búsqueda (TES-59)
- Aparecen 7 productos (el pausado no). La caja agotada se ve deshabilitada con "Sin stock".
- Escribí `caf` → filtra por nombre. Escribí `VAL-BRN-88` y apretá **Enter** → agrega la válvula sin hacer clic (simula un lector de códigos).
- Escribí algo que no existe y Enter → avisa que no se encontró.
- Al agregar un producto, el stock de su tarjeta baja (queda "restante").

### 2. Carrito (TES-58 y TES-60)
- Con el café (4 u): hacé clic 5 veces → a la quinta avisa "máximo 4" y la tarjeta pasa a "Sin stock".
- Botones **+** y **−**, escribir la cantidad a mano, **eliminar** y **Vaciar**: el total cambia al instante.
- Con la harina podés poner `1.5` (kg). Con la yerba, `1.5` se rechaza ("solo cantidades enteras").
- **Recargá la página (F5):** el carrito se mantiene.
- Con el carrito vacío, "Cobrar" está deshabilitado.

### 3. Checkout (TES-61)
- Con productos en el carrito, tocá **Cobrar**. Ves el resumen y el total.
- Nombre y email son **obligatorios**. Tocá "Confirmar y pagar" con los campos vacíos, con solo espacios en el nombre o con un email inválido (`abc`): no avanza y marca qué falta.
- Si abrís <http://localhost:4200/sales/checkout> con el carrito vacío, no hay formulario: muestra "No hay productos en el carrito" con un botón para volver al POS.

### 4. Stock insuficiente / ventas concurrentes (TES-64)
1. Agregá 4 cafés y andá al checkout.
2. En otra pestaña abrí <http://localhost:3000/__mock/stock/p-cafe?value=1> (simula que otro cajero vendió).
3. Volvé y tocá **Confirmar y pagar** → aparece "Stock insuficiente" con "pediste 4, disponible 1" y **no** se crea la venta.
4. **Ajustar al stock disponible** deja el carrito en 1 u; **Revisar carrito** te lleva al POS.

### 5. Pago con Mercado Pago (TES-62)
- **Confirmar y pagar** crea la venta y el pago, y te redirige a Mercado Pago. Como la preferencia es de
  mentira, Mercado Pago muestra una página de error: **es lo esperado**. En la terminal de `mock-api` ves
  la venta, las `backUrls` y los datos del cliente que se enviaron.
- Para volver a la app copiá el id de la venta de <http://localhost:3000/__mock/state> y seguí con el paso 6.
- El total que muestra el sistema lo calcula la API: el frontend nunca lo envía.

### 6. Resultado del pago (TES-63)
Reemplazá `<ID>` por el id de la venta:

| Quiero ver | Hacé |
| --- | --- |
| **Pendiente** (la URL dice "success", pero el backend todavía no confirmó) | <http://localhost:4200/sales/payment/success?external_reference=ID> |
| **Aprobado**: con esa pantalla abierta, abrí <http://localhost:3000/__mock/pay/ID> | En unos 3 s pasa a "Pago aprobado" y el carrito se vacía |
| **Rechazado** | <http://localhost:3000/__mock/pay/ID?result=rejected> y recargá la pantalla: el carrito se conserva y ofrece "Reintentar" |
| **No se pudo verificar** | Apagá `pnpm mock-api` y abrí cualquier URL de retorno: tras varios intentos avisa que no pudo verificar |

Lo importante: la pantalla **no confía en el texto de la URL**, solo en lo que dice el backend.

### 7. Rutas (TES-65)
- Con DevTools → Network abierto, entrá a `/dashboard` y después a `/sales`: el código de ventas se
  descarga recién al entrar a `/sales` (lazy loading).

## Tests automáticos

```bash
pnpm test --watch=false
```

Hay 66 tests; el único que falla es `app.spec.ts` (espera un `<h1>` "Hello, frontend" que la app nunca tuvo y no
tiene relación con este trabajo).
