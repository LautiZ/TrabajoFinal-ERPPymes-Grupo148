# Base de datos

Scripts de PostgreSQL 13+ para el ERP para PyMEs. El sistema sigue el enfoque de **una base de datos por servicio** (*database-per-service*): cada microservicio es dueño de su propia base y no existen claves foráneas entre servicios. Las referencias entre servicios son lógicas y están documentadas en el encabezado de cada script.

| Servicio | DDL | Datos de prueba (DML) | Tablas |
|---|---|---|---|
| Auth | `auth.sql` | `seeds/seed-auth.sql` | `users` |
| ERP | `erp.sql` | `seeds/seed-erp.sql` | `categories`, `products`, `stock_movements`, `sales`, `sale_items`, `sale_history` |
| Payments | `payments.sql` | `seeds/seed-payments.sql` | `payments` |

## Ejecución local

```bash
createdb auth && createdb erp && createdb payments

psql -d auth     -f auth.sql     -f seeds/seed-auth.sql
psql -d erp      -f erp.sql      -f seeds/seed-erp.sql
psql -d payments -f payments.sql -f seeds/seed-payments.sql
```

Los datos de prueba usan UUID fijos para que las referencias lógicas (`sales.user_id`, `payments.sale_id`) coincidan entre bases.

## Consideraciones

- Todas las fechas son `timestamptz` (se almacenan en UTC).
- Las claves primarias se generan por defecto con `gen_random_uuid()`.
- El valor por defecto de `updated_at` solo aplica al insertar; la aplicación lo actualiza en cada modificación (`@updatedAt` de Prisma).
- Las reglas de negocio que se validan mediante restricciones están descritas en [`docs/reglas-de-negocio.md`](../docs/reglas-de-negocio.md).
