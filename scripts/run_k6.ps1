# Ejecuta solo k6 (docker) y guarda el resumen en /reports
Set-StrictMode -Version Latest

$pwdPath = (Get-Location).Path
New-Item -ItemType Directory -Force -Path "$pwdPath\reports" | Out-Null

$testBaseUrl = if ($env:TEST_BASE_URL) { $env:TEST_BASE_URL } else { 'http://host.docker.internal:8080/api' }

Write-Host 'Ejecutando k6 (docker)...'
docker run --rm -v "$pwdPath\testing\k6:/scripts" -v "$pwdPath\reports:/scripts/reports" -w /scripts -e BASE_URL="$testBaseUrl" loadimpact/k6 run sync-vs-async-load.js --summary-export reports/k6-summary.json

Write-Host 'k6 finalizado. Resumen en ./reports/k6-summary.json'