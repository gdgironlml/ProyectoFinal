# Testing artifacts

Files generated:

- testing/postman/SuperBodega-UseCases.postman_collection.json
- testing/postman/SuperBodega.postman_environment.json
- testing/k6/sync-vs-async-load.js

The Postman collection covers the core use cases with GET, POST, PUT and DELETE flows for clientes, proveedores, productos, compras and ventas.

Quick run instructions:

1. Install tools (if needed):

   - Newman: `npm install -g newman`
   - k6: https://k6.io/docs/getting-started/installation/

2. Run only Postman/Newman:

   .\scripts\run_postman.ps1

3. Run only k6 load tests:

   .\scripts\run_k6.ps1

4. Run both and generate the combined summary:

   .\scripts\run_tests.ps1

5. Run Postman collection manually with environment:

   newman run testing/postman/SuperBodega-UseCases.postman_collection.json -e testing/postman/SuperBodega.postman_environment.json

   If you want to override the API target, set `TEST_BASE_URL` before running `scripts/run_tests.ps1`.

   The environment also stores the temporary IDs used by the CRUD flow (`clienteId`, `proveedorId`, `productoId`, `compraId`, `ventaId`).

6. Run k6 load script manually (optionally set BASE_URL env):

   BASE_URL=http://localhost:8080/api k6 run testing/k6/sync-vs-async-load.js
