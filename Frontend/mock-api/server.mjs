// API simulada para probar el módulo de Ventas y Pagos sin backend real.
// Solo para desarrollo local: no usa base de datos, el estado vive en memoria.
//
//   node mock-api/server.mjs        (o: pnpm mock-api)
//
// Implementa el contrato asumido por el frontend (ver src/app/features/sales/README.md).
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 3000);

const seedProducts = () => [
  { id: 'p-yerba', name: 'Yerba Mate 1kg', sku: 'YER-001', price: '4500.00', stock: '25.000', unit: 'Unit', active: true, deleted: false },
  { id: 'p-cafe', name: 'Café Grano Especial 1kg', sku: 'CAF-ESP-01', price: '12500.00', stock: '4.000', unit: 'Unit', active: true, deleted: false },
  { id: 'p-filtro', name: 'Filtro Hidráulico 50M', sku: 'IND-FILT-09', price: '8300.50', stock: '8.000', unit: 'Unit', active: true, deleted: false },
  { id: 'p-valvula', name: 'Válvula Esférica Bronce 1/2', sku: 'VAL-BRN-88', price: '6200.00', stock: '3.000', unit: 'Unit', active: true, deleted: false },
  { id: 'p-harina', name: 'Harina a granel', sku: 'GRA-HAR-01', price: '900.00', stock: '50.500', unit: 'Kg', active: true, deleted: false },
  { id: 'p-cable', name: 'Cable por metro', sku: 'ELE-CAB-02', price: '1200.00', stock: '100.000', unit: 'Meter', active: true, deleted: false },
  { id: 'p-caja', name: 'Caja Embalaje #4 (agotado)', sku: 'ALM-CAJ-04', price: '350.00', stock: '0.000', unit: 'Unit', active: true, deleted: false },
  { id: 'p-pausado', name: 'Producto pausado', sku: 'PAU-001', price: '100.00', stock: '10.000', unit: 'Unit', active: false, deleted: false },
];

let products = seedProducts();
let sales = new Map();
let payments = new Map(); // saleId -> payment

const money = (value) => (Math.round(value * 100) / 100).toFixed(2);
const log = (...args) => console.log(new Date().toLocaleTimeString(), ...args);

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(body === undefined ? '' : JSON.stringify(body, null, 2));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function publicProduct(p) {
  return { id: p.id, name: p.name, sku: p.sku, price: p.price, stock: p.stock, unit: p.unit, active: p.active, deleted: p.deleted };
}

function listProducts(url) {
  const search = (url.searchParams.get('search') ?? '').trim().toLowerCase();
  const onlyActive = url.searchParams.get('active') === 'true';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const limit = Math.max(1, Number(url.searchParams.get('limit') ?? 24));
  const filtered = products.filter(
    (p) =>
      !p.deleted &&
      (!onlyActive || p.active) &&
      (!search || p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search)),
  );
  const data = filtered.slice((page - 1) * limit, page * limit).map(publicProduct);
  return { data, meta: { total: filtered.length, page, limit, totalPages: Math.max(1, Math.ceil(filtered.length / limit)) } };
}

function createSale(body) {
  const items = Array.isArray(body?.items) ? body.items : null;
  if (!items || items.length === 0) {
    return [400, { statusCode: 400, message: 'La venta debe tener al menos un ítem.' }];
  }
  if ('total' in body) {
    return [400, { statusCode: 400, message: 'El total no se acepta desde el cliente (RN-06).' }];
  }

  const conflicts = [];
  const lines = [];
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    const quantity = Number(item.quantity);
    if (!product || product.deleted || !Number.isFinite(quantity) || quantity <= 0) {
      return [400, { statusCode: 400, message: `Ítem inválido: ${item.productId}` }];
    }
    const available = product.active ? Number(product.stock) : 0;
    if (quantity > available) {
      conflicts.push({ productId: product.id, name: product.name, requested: quantity, available });
    }
    lines.push({ product, quantity });
  }
  if (conflicts.length > 0) {
    return [409, { statusCode: 409, code: 'INSUFFICIENT_STOCK', message: 'Stock insuficiente', items: conflicts }];
  }

  // Descuenta el stock (movimiento Outcome) y registra la venta en estado Ordered.
  let total = 0;
  for (const { product, quantity } of lines) {
    product.stock = (Number(product.stock) - quantity).toFixed(3);
    total += Number(product.price) * quantity; // el precio se congela en la venta (RN-07)
  }
  const sale = { id: randomUUID(), total: money(total), currentState: 'Ordered', createdAt: new Date().toISOString() };
  sales.set(sale.id, sale);
  return [201, sale];
}

function createPayment(body) {
  const sale = sales.get(body?.saleId);
  if (!sale) return [404, { statusCode: 404, message: 'La venta no existe (RN-13).' }];
  if (!body.backUrls?.success || !body.backUrls?.failure || !body.backUrls?.pending) {
    return [400, { statusCode: 400, message: 'Faltan las backUrls.' }];
  }
  const payment = { id: randomUUID(), saleId: sale.id, paymentState: 'Pending', amount: sale.total };
  payments.set(sale.id, payment);
  log('pago creado para la venta', sale.id, 'backUrls:', body.backUrls, 'payer:', body.payer ?? '(sin datos)');
  return [
    201,
    {
      paymentId: payment.id,
      // Dominio de Mercado Pago (el frontend solo redirige a esos dominios). La preferencia no existe: abre una página de error.
      initPoint: `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=MOCK-${sale.id}`,
    },
  ];
}

// Simula el webhook de Mercado Pago (RN-15).
function settle(saleId, result) {
  const sale = sales.get(saleId);
  const payment = payments.get(saleId);
  if (!sale || !payment) return [404, { message: 'Venta o pago inexistente. Creá el pago desde el checkout primero.' }];
  if (result === 'rejected') {
    payment.paymentState = 'Rejected';
  } else {
    payment.paymentState = 'Paid';
    sale.currentState = 'Paid';
  }
  log(`webhook simulado: venta ${saleId} -> ${payment.paymentState}`);
  return [200, { sale, payment }];
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method ?? 'GET';
  log(method, path + url.search);

  if (method === 'OPTIONS') return send(res, 204);

  let match;
  try {
    // ---- Controles de prueba (aceptan GET para usarlos desde la barra del navegador) ----
    if ((match = path.match(/^\/__mock\/pay\/([^/]+)$/))) {
      const [status, body] = settle(decodeURIComponent(match[1]), url.searchParams.get('result') ?? 'paid');
      return send(res, status, body);
    }
    if ((match = path.match(/^\/__mock\/stock\/([^/]+)$/))) {
      const product = products.find((p) => p.id === decodeURIComponent(match[1]));
      const value = Number(url.searchParams.get('value'));
      if (!product || !Number.isFinite(value) || value < 0) {
        return send(res, 400, { message: 'Usá /__mock/stock/<productId>?value=<número>' });
      }
      product.stock = value.toFixed(3);
      return send(res, 200, publicProduct(product));
    }
    if (path === '/__mock/reset') {
      products = seedProducts();
      sales = new Map();
      payments = new Map();
      return send(res, 200, { message: 'Estado reiniciado.' });
    }
    if (path === '/__mock/state') {
      return send(res, 200, { products: products.map(publicProduct), sales: [...sales.values()], payments: [...payments.values()] });
    }

    // ---- Contrato asumido con el backend ----
    if (method === 'GET' && path === '/products') return send(res, 200, listProducts(url));
    if (method === 'GET' && (match = path.match(/^\/products\/([^/]+)$/))) {
      const product = products.find((p) => p.id === decodeURIComponent(match[1]) && !p.deleted);
      return product ? send(res, 200, publicProduct(product)) : send(res, 404, { message: 'Producto inexistente.' });
    }
    if (method === 'POST' && path === '/sales') {
      const body = await readBody(req);
      if (body === null) return send(res, 400, { message: 'JSON inválido.' });
      const [status, payload] = createSale(body);
      return send(res, status, payload);
    }
    if (method === 'GET' && (match = path.match(/^\/sales\/([^/]+)$/))) {
      const sale = sales.get(decodeURIComponent(match[1]));
      return sale ? send(res, 200, sale) : send(res, 404, { message: 'Venta inexistente.' });
    }
    if (method === 'POST' && path === '/payments') {
      const body = await readBody(req);
      if (body === null) return send(res, 400, { message: 'JSON inválido.' });
      const [status, payload] = createPayment(body);
      return send(res, status, payload);
    }
    if (method === 'GET' && (match = path.match(/^\/payments\/sale\/([^/]+)$/))) {
      const payment = payments.get(decodeURIComponent(match[1]));
      return payment ? send(res, 200, payment) : send(res, 404, { message: 'Todavía no hay pago para esta venta.' });
    }

    return send(res, 404, { message: `Ruta no implementada en la API simulada: ${method} ${path}` });
  } catch (error) {
    console.error(error);
    return send(res, 500, { message: 'Error interno de la API simulada.' });
  }
});

server.listen(PORT, () => {
  console.log(`API simulada escuchando en http://localhost:${PORT}`);
  console.log('Estado actual:    http://localhost:%d/__mock/state', PORT);
  console.log('Reiniciar datos:  http://localhost:%d/__mock/reset', PORT);
});
