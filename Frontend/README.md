# Frontend — ERP para PyMEs

Aplicación cliente construida en Angular 22 utilizando arquitectura modular por features y carga bajo demanda (lazy loading).

## Estructura de carpetas

```text
src/app/
├── core/                  # Servicios singleton, guards, interceptors HTTP y modelos globales
├── shared/                # Componentes, pipes y directivas reutilizables en múltiples módulos
└── features/              # Módulos de negocio independientes (Lazy Loaded)
    ├── auth/              # Login, registro y manejo de sesión
    ├── inventory/         # Catálogo de productos y movimientos de stock
    ├── sales/             # Punto de venta (POS), carrito y pagos
    ├── dashboard/         # Métricas financieras y analítica
    └── not-found/         # Página de error 404