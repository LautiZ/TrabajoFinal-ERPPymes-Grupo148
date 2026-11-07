# Backend — ERP para PyMEs

Monorepo NestJS con el backend del Trabajo Final. La documentación general del proyecto (problema, arquitectura, requerimientos y modelo de datos) está en el [README de la raíz](../README.md).

## Estructura

Monorepo nativo de Nest CLI, gestionado con pnpm:

| Ruta             | Contenido                                                                                                              | Puerto         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------- |
| `apps/gateway`   | API Gateway: único servicio expuesto al exterior                                                                       | `3000` (HTTP)  |
| `apps/auth`      | Microservicio de autenticación y usuarios                                                                              | `3001` (TCP)   |
| `apps/erp`       | Microservicio de productos, stock y ventas                                                                             | `3002` (TCP)   |
| `apps/payments`  | Microservicio de pagos (Mercado Pago)                                                                                  | `3003` (TCP)   |
| `libs/contracts` | Código compartido entre servicios: variables de entorno, tokens de los clientes TCP, patrones de mensajes y DTOs comunes | —              |

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

Para verificar que el Gateway llega a los tres microservicios:

```bash
curl http://localhost:3000/health
# 200 {"auth":"up","erp":"up","payments":"up"}
# 503 si alguno no responde, con el estado de cada uno
```

`pnpm build` compila solo el proyecto por defecto del monorepo (el Gateway). Para compilar un microservicio:

```bash
pnpm exec nest build auth
pnpm exec nest build erp
pnpm exec nest build payments
```

## Comunicación entre servicios

- **Solo el Gateway habla HTTP.** Auth, ERP y Payments son microservicios TCP puros (`NestFactory.createMicroservice` con `Transport.TCP`): no exponen rutas HTTP.
- **Cada microservicio escucha en `HOST`**, que por defecto es `0.0.0.0`. Nest escucha en `localhost` si no se indica otro host, y dentro de un contenedor eso impide que el Gateway, que corre en otro contenedor, pueda conectarse.
- **Los patrones de mensajes y los tokens de inyección** se definen en `libs/contracts/src/messaging.ts`, para que el Gateway (emisor) y cada microservicio (receptor) usen el mismo contrato.
- **El Gateway registra un cliente TCP por servicio** con `ClientsModule`, a partir de `AUTH_MS_HOST`/`AUTH_MS_PORT`, etc.
- **Las llamadas usan un timeout de 5 segundos y no se reintentan.** El cliente TCP de Nest no reintenta mensajes, y reintentarlos a mano podría duplicar operaciones que no son idempotentes (por ejemplo, crear una venta).

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
- **En Docker, las migraciones las aplica el servicio `migrate`, no cada servicio al arrancar.** Es el stage `migrate` del `Dockerfile`, basado en `deps` porque necesita el CLI de Prisma, que las imágenes de runtime no incluyen. Migrar al arrancar queda descartado: con varias réplicas todas intentarían migrar a la vez, y una migración fallida dejaría al servicio reiniciándose en loop. Detalles:
  - Los tres `prisma.config.ts` leen `DATABASE_URL`, así que el job recibe `AUTH_DATABASE_URL`, `ERP_DATABASE_URL` y `PAYMENTS_DATABASE_URL`, y cada comando recibe su propio valor. Si falta alguna, el job falla antes de tocar la base.
  - El stage `migrate` está antes de `runtime` a propósito. Los servicios se construyen sin `target`, así que Docker usa el último stage del archivo.
  - Corre como root: el CLI de Prisma no arranca si no puede escribir en la carpeta de sus engines, que instaló root. Es un job de corta duración y sin puertos expuestos; las imágenes de los servicios siguen corriendo como `node`.
- **Desde el host**, para correr un servicio localmente, las migraciones se siguen aplicando con `pnpm prisma:migrate:deploy:<servicio>`.

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

### Seed inicial

No hay registro público: solo el `Owner` o un `Admin` dan de alta usuarios, así que el seed es la única forma de crear el primer usuario. Crea el `Owner` y un catálogo de ejemplo (productos con stock alto, bajo y en cero, y unidades fraccionarias).

1. Completar las variables `OWNER_*` en `apps/auth/.env` (ver `apps/auth/.env.example`). `OWNER_PASSWORD` debe tener al menos 12 caracteres; si falta alguna variable, el seed se detiene sin tocar la base.
2. Con las migraciones aplicadas, ejecutar:

```bash
pnpm prisma:seed
```

Comportamiento:

- **Es idempotente.** Si ya existe un `Owner`, no lo modifica (tampoco su contraseña) y reutiliza su id. Los productos que ya existen (por `sku`) se omiten, para no duplicar su stock.
- **El stock entra como movimientos `Income`** (RN-01): cada producto y su movimiento se insertan en una misma transacción. Un producto sin stock no genera movimiento.
- **Respeta la separación entre servicios.** `scripts/seed.ts` ejecuta primero el seed de Auth (`apps/auth/prisma/seed.ts`), obtiene el id del `Owner` y se lo pasa al seed del ERP (`apps/erp/prisma/seed.ts`), que nunca lee el schema `auth`. Cada `.env` se lee por separado con `dotenv.parse`, porque los dos definen `DATABASE_URL`.

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

# tests e2e de un microservicio (<servicio> = auth, erp o payments)
pnpm exec jest --config apps/<servicio>/test/jest-e2e.json
```

Cada servicio tiene su configuración e2e en `apps/<servicio>/test/jest-e2e.json`.

- **Gateway:** prueba `GET /health` por HTTP con el `AppService` reemplazado por un mock, así que no necesita los microservicios.
- **Microservicios:** levantan un servidor TCP real en un puerto de prueba (`4001` a `4003`) y le envían el patrón con un `ClientProxy`. `PrismaService` y el repositorio se reemplazan por mocks, así que no necesitan la base de datos.
