# Ejecuta k6 para el flujo síncrono y guarda el resumen en /reports
Set-StrictMode -Version Latest

$pwdPath = (Get-Location).Path
New-Item -ItemType Directory -Force -Path "$pwdPath\reports" | Out-Null

$composeArgs = @('-f', 'docker-compose.yml', '-f', 'docker-compose.test.yml')
$testBaseUrl = if ($env:TEST_BASE_URL) { $env:TEST_BASE_URL } else { 'http://host.docker.internal:8080/api' }

Write-Host 'Ejecutando k6 síncrono (docker)...'
docker compose @composeArgs up -d mailhog api sqlserver rabbitmq | Out-Null
docker run --rm -v "$pwdPath\testing\k6:/scripts" -v "$pwdPath\reports:/scripts/reports" -w /scripts -e BASE_URL="$testBaseUrl" loadimpact/k6 run sync-load.js --summary-export reports/k6-sync-summary.json

Write-Host 'k6 síncrono finalizado. Resumen en ./reports/k6-sync-summary.json'
