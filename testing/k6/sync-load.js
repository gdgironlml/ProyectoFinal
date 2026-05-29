import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

export const options = {
  scenarios: {
    sync: { executor: 'constant-vus', exec: 'syncScenario', vus: 5, duration: '8s' }
  }
};

const BASE = __ENV.BASE_URL || 'http://host.docker.internal:8080/api';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

const syncRequests = new Counter('sync_requests_total');
const syncOk = new Counter('sync_ok_total');
const syncError = new Counter('sync_error_total');

export function syncScenario() {
  const payload = JSON.stringify({
    ClienteId: 1,
    ProveedorId: 2,
    Detalles: [{ ProductoId: 2, Cantidad: 5, Precio: 100.0, PrecioCompra: 80.0 }]
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
