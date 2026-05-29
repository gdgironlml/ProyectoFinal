import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

export const options = {
  scenarios: {
    async: { executor: 'constant-vus', exec: 'asyncScenario', vus: 5, duration: '8s' }
  }
};

const BASE = __ENV.BASE_URL || 'http://host.docker.internal:8080/api';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

const asyncRequests = new Counter('async_requests_total');
const asyncOk = new Counter('async_ok_total');
const asyncError = new Counter('async_error_total');

export function asyncScenario() {
  const uniqueEmail = `k6-vu${__VU}-iter${__ITER}@example.com`;
  const resolverPayload = JSON.stringify({
    Nombre: `K6 VU ${__VU}`,
    Email: uniqueEmail,
    Telefono: `555${__VU}${__ITER}`
  });

  const resolverRes = http.post(`${BASE}/Clientes/resolver`, resolverPayload, { headers: JSON_HEADERS });
  const resolverOk = check(resolverRes, { 'resolver status 201 or 200': (r) => r.status === 201 || r.status === 200 });
  let clienteId = 1;
  if (resolverOk) {
    const resolverBody = resolverRes.json();
    clienteId = resolverBody.id || 1;
  }

  const addItemPayload = JSON.stringify({
    ProductoId: 2,
    Cantidad: 1
  });
  const addItemRes = http.post(`${BASE}/Carritos/${clienteId}/items`, addItemPayload, { headers: JSON_HEADERS });
  const addItemOk = check(addItemRes, { 'add item status 200': (r) => r.status === 200 });

  const checkoutRes = http.post(`${BASE}/Carritos/${clienteId}/checkout/async`, null, { headers: JSON_HEADERS });
  const ok = check(checkoutRes, { 'status 202': (r) => r.status === 202 });

  asyncRequests.add(1);
  if (resolverOk && addItemOk && ok) {
    asyncOk.add(1);
  } else {
    asyncError.add(1);
  }

  sleep(1);
}
