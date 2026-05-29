# Ejecuta Newman para el flujo síncrono y guarda el reporte en /reports
Set-StrictMode -Version Latest

$pwdPath = (Get-Location).Path
New-Item -ItemType Directory -Force -Path "$pwdPath\reports" | Out-Null

$composeArgs = @('-f', 'docker-compose.yml', '-f', 'docker-compose.test.yml')
$testBaseUrl = if ($env:TEST_BASE_URL) { $env:TEST_BASE_URL } else { 'http://host.docker.internal:8080/api' }

Write-Host 'Ejecutando Newman síncrono (docker)...'
docker compose @composeArgs up -d mailhog api sqlserver rabbitmq | Out-Null
docker run --rm -v "$pwdPath\testing\postman:/etc/newman" -v "$pwdPath\reports:/etc/newman/reports" -w /etc/newman postman/newman run SuperBodega-UseCases-sync.postman_collection.json -e SuperBodega.postman_environment.json --env-var "base_url=$testBaseUrl" --reporters cli,json --reporter-json-export reports/newman-sync-report.json

Write-Host 'Newman síncrono finalizado. Reporte en ./reports/newman-sync-report.json'
