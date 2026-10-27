# Backend — ERP para PyMEs

Monorepo NestJS con el backend del Trabajo Final. La documentación general del proyecto (problema, arquitectura, requerimientos y modelo de datos) está en el [README de la raíz](../README.md).

## Estructura

Monorepo nativo de Nest CLI, gestionado con pnpm:

| Ruta             | Contenido                                                                                       | Puerto |
| ---------------- | ----------------------------------------------------------------------------------------------- | ------ |
| `apps/gateway`   | API Gateway: único servicio expuesto al exterior                                                | `3000` |
| `apps/auth`      | Microservicio de autenticación y usuarios                                                       | `3001` |
| `apps/erp`       | Microservicio de productos, stock y ventas                                                      | `3002` |
| `apps/payments`  | Microservicio de pagos (Mercado Pago)                                                           | `3003` |
| `libs/contracts` | Código compartido entre servicios: carga y validación de variables de entorno y DTOs comunes    | —      |

## Requisitos

- Node.js 24
- pnpm 10
- Docker (para PostgreSQL y para levantar el sistema completo)

## Instalación

```bash
pnpm install
pnpm prisma:generate
```

`prisma:generate` es necesario después de clonar el repositorio: los clientes de Prisma no se versionan (ver [Base de datos](#base-de-datos-prisma)).

## Variables de entorno

Cada servicio tiene su propio `.env` en `apps/<servicio>/.env`, que no se versiona. Para crearlo, copiar el `apps/<servicio>/.env.example` correspondiente y completar los valores.

- Cada servicio carga solo su propio archivo (`loadAppEnv()` de `libs/contracts`), así ningún proceso ve las credenciales de los demás.
- Las variables se validan con Joi al arrancar (`validateEnvs()` de `libs/contracts`). Si falta una variable requerida, el servicio no arranca y muestra `Config validation error`.
- Al correr con Docker, `docker-compose.yml` reemplaza los hosts (`localhost` por el nombre de cada servicio) y arma `DATABASE_URL` a partir del `.env` de la raíz del repositorio.

## Ejecución

Todos los comandos se ejecutan desde `Backend/`.

```bash
# modo desarrollo con recarga (sin argumento levanta el Gateway)
pnpm start:dev
pnpm start:dev auth
pnpm start:dev erp
pnpm start:dev payments
```

Para levantar el sistema completo (PostgreSQL y los cuatro servicios en una red privada de Docker), seguir los pasos de [Levantar el entorno](../README.md#levantar-el-entorno) del README de la raíz.

## Base de datos (Prisma)

Los tres servicios comparten una única base de datos PostgreSQL, pero cada uno es dueño de su propio schema de PostgreSQL y nunca accede a los de los demás:

| Servicio   | Schema de PostgreSQL | Archivos de Prisma                                        | Cliente generado                     |
| ---------- | -------------------- | --------------------------------------------------------- | ------------------------------------ |
| `auth`     | `auth`               | `apps/auth/prisma.config.ts`, `apps/auth/prisma/`         | `apps/auth/src/generated/prisma`     |
| `erp`      | `erp`                | `apps/erp/prisma.config.ts`, `apps/erp/prisma/`           | `apps/erp/src/generated/prisma`      |
| `payments` | `payments`           | `apps/payments/prisma.config.ts`, `apps/payments/prisma/` | `apps/payments/src/generated/prisma` |

Convenciones:

- **`?schema=<servicio>` es obligatorio en la `DATABASE_URL` de cada servicio** (por ejemplo, `...?schema=auth`). Prisma guarda la tabla de historial de migraciones (`_prisma_migrations`) en ese schema, así que cada servicio mantiene su propio historial. Sin ese parámetro, todos los servicios compartirían `public._prisma_migrations` y `migrate dev` interpretaría las migraciones de los otros servicios como divergencias y ofrecería resetear la base.
- **No hay claves foráneas entre servicios.** Las referencias a datos de otro servicio (`userId` en ERP, `saleId` en Payments) son columnas UUID simples; su integridad se valida mediante mensajes TCP, no en la base de datos.
- **Cada modelo y enum declara `@@schema("<servicio>")`**, en coincidencia con la lista `schemas` de su datasource.
- **Los clientes generados no se versionan** (están en el `.gitignore` y excluidos de ESLint). Ejecutar `pnpm prisma:generate` después de clonar el repositorio o de modificar un schema. Se generan con `importFileExtension = ""` para que el build con webpack de Nest pueda resolver sus imports internos.
- Las restricciones que Prisma no puede expresar (por ejemplo, `CHECK`) se agregan a mano en el SQL de la migración, creada con `migrate dev --create-only`.
- **Cada servicio tiene su propio `PrismaService`** (`src/prisma/`), que extiende el cliente generado desde su schema y se inyecta solo en los repositorios. No se comparte en `libs/` para preservar la independencia entre servicios. Al iniciar ejecuta `SELECT 1`: con `@prisma/adapter-pg`, `$connect()` no abre conexiones, así que sin esa consulta el servicio arrancaría aunque la base no esté disponible.
- **`.pnpmfile.cjs` quita `prisma` y `typescript` de las peer dependencies de `@prisma/client`.** Son peers opcionales, pero pnpm los vincula porque ambos son devDependencies del proyecto, y ese vínculo queda en el lockfile: sin el hook, `pnpm install --prod` instala el CLI de Prisma (y Studio, PGlite, TypeScript, etc.) en las imágenes de producción. El cliente no los necesita en runtime. Si se modifica este archivo hay que regenerar el lockfile con `pnpm install`.
- **Las imágenes Docker instalan Prisma solo si el servicio lo usa.** El build arg `USES_PRISMA` (por defecto `true`) se define por servicio en `docker-compose.yml`; el Gateway lo pone en `false` y su imagen no incluye `@prisma/client` ni `@prisma/adapter-pg`.

Scripts (reemplazar `<servicio>` por `auth`, `erp` o `payments`):

```bash
# generar los tres clientes
pnpm prisma:generate

# por servicio
pnpm prisma:generate:<servicio>
pnpm prisma:migrate:dev:<servicio>
pnpm prisma:migrate:deploy:<servicio>
pnpm prisma:studio:<servicio>
```

## Calidad de código

```bash
pnpm lint            # ESLint con reglas estrictas (aplica --fix)
pnpm exec tsc --noEmit
```

TypeScript corre en modo `strict`, y reglas como `no-explicit-any` y `no-floating-promises` están como error. Los archivos `*.spec.ts` tienen un override para los tipos `any` intencionales de Jest.

## Tests

```bash
pnpm test            # tests unitarios
pnpm test:cov        # cobertura
pnpm test:e2e        # tests e2e del Gateway
```

Cada servicio tiene su configuración e2e en `apps/<servicio>/test/jest-e2e.json`.
