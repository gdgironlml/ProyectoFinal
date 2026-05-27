# Testing artifacts

Files generated:

- testing/postman/SuperBodega-UseCases.postman_collection.json
- testing/postman/SuperBodega.postman_environment.json
- testing/k6/sync-vs-async-load.js

Quick run instructions:

1. Install tools (if needed):

   - Newman: `npm install -g newman`
   - k6: https://k6.io/docs/getting-started/installation/

2. Run Postman collection with environment:

   newman run testing/postman/SuperBodega-UseCases.postman_collection.json -e testing/postman/SuperBodega.postman_environment.json

3. Run k6 load script (optionally set BASE_URL env):

   BASE_URL=http://localhost:8080/api k6 run testing/k6/sync-vs-async-load.js
