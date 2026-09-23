# Requerimientos del Sistema — ERP para PyMEs

> Documento de requerimientos del Trabajo Final (Grupo 148). Complementa el `README.md` (alcance y arquitectura) con el detalle funcional y no funcional.

## 1. Introducción

### 1.1 Problema

La fragmentación operativa en pequeños comercios y PyMEs genera cuellos de botella en su gestión diaria: la falta de un sistema unificado para el control de stock, el registro de ventas y la analítica financiera produce inconsistencias de inventario, pérdida de tiempo en tareas manuales y visibilidad financiera deficiente.

### 1.2 Solución

Plataforma web (ERP) que centraliza inventario, punto de venta (POS) y pagos, con procesamiento en tiempo real, implementada como backend en microservicios (NestJS) y frontend en Angular.

### 1.3 Actores

| Actor    | Descripción                                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------------------------- |
| Owner    | Dueño del sistema. Único usuario con este rol. Acceso irrestricto y único habilitado para asignar o modificar roles. |
| Admin    | Administrador. Accede a toda la aplicación, pero solo puede dar de alta usuarios `Employee`.                         |
| Employee | Usuario operativo. Acceso completo al ERP MS (catálogo, stock y ventas); sin acceso a Auth MS ni Payments MS.        |

> El detalle completo de permisos por rol está en las [reglas de negocio, RN-16 a RN-16.4](./reglas-de-negocio.md#4-usuarios-y-permisos).

## 2. Requerimientos funcionales

### 2.1 Módulo de Autenticación y Usuarios (Auth MS)

| ID      | Requerimiento                                                                                                                                                                           | Criterio de aceptación                                                                                                                                                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF-01   | El sistema debe exponer un registro público de arranque (bootstrap), habilitado únicamente mientras no exista ningún usuario `Owner` en el sistema.                                     | Acepta email, contraseña, nombre y apellido; el email es único y la contraseña se almacena hasheada, nunca en texto plano.                                                                                                                           |
| RF-01.1 | El usuario creado por el registro de arranque debe recibir automáticamente el rol `Owner`.                                                                                              | Ver [reglas de negocio, RN-16.4](./reglas-de-negocio.md#4-usuarios-y-permisos) para el detalle de la condición de carrera.                                                                                                                           |
| RF-01.2 | Una vez que existe un `Owner`, el endpoint de registro público debe quedar deshabilitado de forma permanente.                                                                           | Cualquier intento posterior de registro público es rechazado (sin crear el usuario), incluso si se reintenta el mismo request.                                                                                                                       |
| RF-02   | El sistema debe permitir iniciar sesión con email y contraseña.                                                                                                                         | Ante credenciales válidas, se emite un token JWT; ante credenciales inválidas, se rechaza sin indicar cuál de los dos datos falló.                                                                                                                   |
| RF-03   | El sistema debe restringir el acceso a los demás microservicios a usuarios autenticados.                                                                                                | Toda petición al Gateway hacia ERP o Payments exige un JWT válido.                                                                                                                                                                                   |
| RF-04   | El sistema debe permitir modificar el rol de un usuario ya existente (ascenso o descenso entre `Employee`, `Admin` y `Owner`).                                                          | Un usuario tiene exactamente un rol en todo momento; solo el `Owner` puede modificarlo, y existe un único `Owner` en el sistema. La asignación inicial del rol al crear una cuenta se rige por RF-01.1 y RF-04.1/RF-04.2, no por este requerimiento. |
| RF-04.1 | El sistema debe impedir que un `Admin` cree usuarios con rol `Admin` u `Owner`.                                                                                                         | Un `Admin` solo puede dar de alta usuarios con rol `Employee`; cualquier otro intento se rechaza.                                                                                                                                                    |
| RF-04.2 | El sistema debe permitir que un `Owner` o `Admin` autenticado dé de alta nuevos usuarios — este es el único mecanismo de creación de cuentas una vez completado el bootstrap (RF-01.2). | El `Owner` puede crear un usuario con cualquier rol; el `Admin`, solo con rol `Employee` (RF-04.1). La operación requiere una sesión válida con rol `Owner` o `Admin`.                                                                               |
| RF-05   | El sistema debe permitir desactivar un usuario sin eliminarlo.                                                                                                                          | Un usuario con `active = false` no puede iniciar sesión; sus ventas históricas se conservan.                                                                                                                                                         |

### 2.2 Módulo de Inventario — Catálogo (ERP MS)

| ID    | Requerimiento                                                                                                        | Criterio de aceptación                                                                                        |
| ----- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| RF-06 | El sistema debe permitir crear, editar y dar de baja categorías de productos.                                        | La baja es lógica (`deleted = true`); no se borra el registro físicamente.                                    |
| RF-07 | El sistema debe permitir crear un producto con nombre, SKU, precio, unidad de medida y categoría.                    | El SKU es único; el precio no puede ser negativo.                                                             |
| RF-08 | El sistema debe permitir pausar un producto sin eliminarlo del catálogo.                                             | Un producto con `active = false` no puede agregarse a una venta nueva, pero sigue siendo consultable.         |
| RF-09 | El sistema debe permitir dar de baja lógica a un producto.                                                           | Un producto con `deleted = true` no aparece en ninguna consulta operativa (catálogo, POS, reportes).          |
| RF-10 | El sistema debe soportar productos vendidos por unidad entera o por cantidad fraccionable (peso, longitud, volumen). | El campo `unit` distingue `Unit`, `Kg`, `Meter`, `Liter`; solo las últimas tres aceptan cantidades decimales. |

### 2.3 Módulo de Movimientos de Stock (ERP MS)

| ID    | Requerimiento                                                                                          | Criterio de aceptación                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| RF-11 | El sistema debe registrar todo cambio de stock como un movimiento (`Income`, `Outcome`, `Adjustment`). | El stock actual del producto nunca se edita a mano; siempre es consecuencia de un movimiento. |
| RF-12 | El sistema debe permitir consultar el historial de movimientos de un producto ordenado por fecha.      | La consulta responde en orden cronológico y permite filtrar por producto.                     |
| RF-13 | El sistema debe impedir que el stock de un producto quede negativo.                                    | Una operación que dejaría el stock por debajo de 0 es rechazada.                              |

### 2.4 Módulo de Ventas — POS (ERP MS)

| ID      | Requerimiento                                                                                           | Criterio de aceptación                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| RF-14   | El sistema debe permitir registrar una venta con uno o más ítems de producto y cantidad.                | Cada ítem referencia un producto activo y una cantidad mayor a cero.                                                    |
| RF-15   | El sistema debe calcular el total de la venta en el backend a partir de sus ítems.                      | El total nunca se acepta como dato enviado por el cliente.                                                              |
| RF-16   | El sistema debe congelar el precio unitario de cada ítem al momento de confirmar la venta.              | Si el precio del producto cambia después, las ventas ya cargadas conservan el precio original.                          |
| RF-17   | El sistema debe llevar el estado de una venta a través de un ciclo (`Ordered` → `Paid` → `Dispatched`). | Cada cambio de estado queda registrado con fecha y, si corresponde, el usuario que lo generó.                           |
| RF-17.1 | El sistema debe permitir cancelar una venta únicamente si todavía no fue despachada.                    | Una venta en `Ordered` o `Paid` puede pasar a `Cancelled`; un intento de cancelar una venta en `Dispatched` se rechaza. |
| RF-18   | El sistema debe generar un movimiento de stock `Outcome` al confirmar una venta.                        | El movimiento queda vinculado a la venta que lo originó.                                                                |
| RF-19   | El sistema debe poder revertir el stock descontado si una venta se cancela.                             | Se genera el movimiento de stock inverso correspondiente, sin editar el movimiento original.                            |

### 2.5 Módulo de Pagos (Payments MS)

| ID    | Requerimiento                                                                                                             | Criterio de aceptación                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| RF-20 | El sistema debe iniciar un cobro a través del SDK de Mercado Pago para una venta.                                         | El pago queda asociado a la venta (`sale_id`) y con estado inicial `Pending`. |
| RF-21 | El sistema debe actualizar el estado de un pago (`Paid`/`Rejected`) al recibir la notificación (webhook) de Mercado Pago. | El cambio de estado no requiere intervención manual de un usuario.            |
| RF-22 | El sistema debe reflejar en la venta el resultado del pago.                                                               | Un pago `Paid` habilita el avance de la venta a estado `Paid`.                |

### 2.6 Módulo de Frontend

> Estado: **no iniciado** al 2026-09-22. Requerimientos definidos a nivel de módulo, a detallar en pantallas cuando arranque el desarrollo.

| ID    | Requerimiento                                                                                        |
| ----- | ---------------------------------------------------------------------------------------------------- |
| RF-23 | Módulo Core y Auth: login, manejo de sesión, protección de rutas según rol.                          |
| RF-24 | Módulo de Inventario: listado y gestión de catálogo mediante tablas de stock.                        |
| RF-25 | Módulo de Ventas y Pagos: carrito de compras, carga de venta y cobro mediante formularios reactivos. |

## 3. Requerimientos no funcionales

| ID     | Requerimiento                                                                                                                                                  |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RNF-01 | El backend se estructura en microservicios independientes (Gateway, Auth, ERP, Payments) comunicados internamente por TCP.                                     |
| RNF-02 | Solo el API Gateway debe ser accesible desde el exterior; el resto de los microservicios permanece en una red privada de Docker.                               |
| RNF-03 | La persistencia debe implementarse en PostgreSQL, con Prisma como ORM.                                                                                         |
| RNF-04 | La integridad de datos entre microservicios (que no comparten base de datos ni claves foráneas) debe validarse en la capa de servicio, no en la base de datos. |
| RNF-05 | El procesamiento de ventas y stock debe ser en tiempo real (sin proceso batch para reflejar cambios de stock).                                                 |
| RNF-06 | Las contraseñas de usuario deben almacenarse hasheadas, nunca en texto plano.                                                                                  |
| RNF-07 | El sistema debe ser escalable horizontalmente por microservicio, dado que cada uno corre de forma independiente.                                               |

## 4. Fuera de alcance

Explícitamente excluido del Trabajo Final tras la corrección de la entrega 1:

- Invoice Microservice (facturación electrónica).
- Integración con AFIP SDK / ARCA.
- Módulo de Facturación.
- Login con Google OAuth (se usa exclusivamente usuario/contraseña + JWT).
- Entidad "cliente": el sistema es un ERP con POS de mostrador, no un ecommerce.

## 🔗 Relacionado

- [Reglas de negocio](./reglas-de-negocio.md)
- [Modelo relacional](./modelo-relacional.md)
- `README.md` (raíz del repo) — arquitectura y alcance general.
