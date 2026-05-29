# Ejecuta k6 para el flujo asíncrono y guarda el resumen en /reports
Set-StrictMode -Version Latest

$pwdPath = (Get-Location).Path
New-Item -ItemType Directory -Force -Path "$pwdPath\reports" | Out-Null

$composeArgs = @('-f', 'docker-compose.yml', '-f', 'docker-compose.test.yml')
$testBaseUrl = if ($env:TEST_BASE_URL) { $env:TEST_BASE_URL } else { 'http://host.docker.internal:8080/api' }

Write-Host 'Ejecutando k6 asíncrono (docker)...'
docker compose @composeArgs up -d mailhog api sqlserver rabbitmq | Out-Null
docker run --rm -v "$pwdPath\testing\k6:/scripts" -v "$pwdPath\reports:/scripts/reports" -w /scripts -e BASE_URL="$testBaseUrl" loadimpact/k6 run async-load.js --summary-export reports/k6-async-summary.json

Write-Host 'k6 asíncrono finalizado. Resumen en ./reports/k6-async-summary.json'
