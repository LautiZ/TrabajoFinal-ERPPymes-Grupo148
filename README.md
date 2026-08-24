# ERP para PyMEs — Trabajo Final (Grupo 148)

Plataforma web integral (ERP) orientada a la gestión empresarial de pequeños comercios y PyMEs. Centraliza la administración de inventario, la operatoria de punto de venta (POS) y la analítica financiera, con procesamiento en tiempo real.

## Problema

La fragmentación operativa en pequeños comercios y PyMEs genera cuellos de botella en la gestión diaria: la falta de un sistema unificado para inventario, ventas concurrentes y comprobantes fiscales produce inconsistencias de stock, pérdida de tiempo en tareas manuales y poca visibilidad financiera.

## Stack tecnológico

**Backend** — arquitectura de microservicios con [NestJS](https://docs.nestjs.com/):

- `ERP Microservice` — núcleo del sistema e inventario.
- `Auth Microservice` — autenticación, autorización y usuarios (Google OAuth + JWT).
- `Payments Microservice` — procesamiento de pagos (SDK de Mercado Pago).
- `Invoice Microservice` — facturación electrónica (Afip SDK).

Comunicación interna entre microservicios vía TCP, expuestos externamente a través de un API Gateway. Persistencia con **PostgreSQL** + **Prisma** ORM.

**Frontend** — [Angular](https://angular.dev/overview), con módulos independientes (Core/Auth, Inventario, Ventas y Pagos, Facturación) y lazy loading.

## Equipo

- Lautaro Zullo
- Lucas Gragera
- Galo Coria Maiorano

**Profesor**: Sebastian Bruselario

## Documentación

La documentación completa del proyecto (problema, solución propuesta, arquitectura de backend y frontend) está disponible en [`docs/TrabajoFinal_Documentacion_Grupo148.pdf`](./docs/TrabajoFinal_Documentacion_Grupo148.pdf).
