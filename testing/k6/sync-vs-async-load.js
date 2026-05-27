import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

export const options = {
  scenarios: {
    sync: { executor: 'constant-vus', exec: 'syncScenario', vus: 5, duration: '20s' },
    async: { executor: 'constant-vus', exec: 'asyncScenario', vus: 5, duration: '20s', startTime: '25s' }
  }
};

const BASE = __ENV.BASE_URL || 'https://refill-blurt-utter.ngrok-free.dev/api';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

const syncRequests = new Counter('sync_requests_total');
const syncOk = new Counter('sync_ok_total');
const syncError = new Counter('sync_error_total');
const asyncRequests = new Counter('async_requests_total');
const asyncOk = new Counter('async_ok_total');
const asyncError = new Counter('async_error_total');

export function syncScenario() {
  const payload = JSON.stringify({
    ClienteId: 1,
    ProveedorId: 1,
    Detalles: [ { ProductoId: 1, Cantidad: 5, Precio: 100.0, PrecioCompra: 80.0 } ]
  });
  const res = http.post(`${BASE}/Compras`, payload, { headers: JSON_HEADERS });
  const ok = check(res, { 'status 201 or 200': (r) => r.status === 201 || r.status === 200 });
  syncRequests.add(1);
  if (ok) {
    syncOk.add(1);
  } else {
    syncError.add(1);
  }
  sleep(1);
}

export function asyncScenario() {
  const payload = JSON.stringify({
    ClienteId: 1,
    Detalles: [ { ProductoId: 1, Cantidad: 1, Precio: 150.0 } ]
  });
  const res = http.post(`${BASE}/Ventas`, payload, { headers: JSON_HEADERS });
  const ok = check(res, { 'status 201 or 200': (r) => r.status === 201 || r.status === 200 });
  asyncRequests.add(1);
  if (ok) {
    asyncOk.add(1);
  } else {
    asyncError.add(1);
  }
  sleep(1);
}
