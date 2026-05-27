# Ejecuta Newman (docker) y k6 (docker) y guarda reportes en /reports
Set-StrictMode -Version Latest

$pwdPath = (Get-Location).Path
New-Item -ItemType Directory -Force -Path "$pwdPath\reports" | Out-Null

$composeArgs = @('-f', 'docker-compose.yml', '-f', 'docker-compose.test.yml')

Write-Host 'Ejecutando Newman (docker)...'
docker compose @composeArgs up -d mailhog api sqlserver rabbitmq | Out-Null
docker run --rm -v "$pwdPath\testing\postman:/etc/newman" -v "$pwdPath\reports:/etc/newman/reports" -w /etc/newman postman/newman run SuperBodega-UseCases.postman_collection.json -e SuperBodega.postman_environment.json --reporters cli,json --reporter-json-export reports/newman-report.json

Write-Host 'Ejecutando k6 (docker)...'
$ngrokUrl = (Get-Content "$pwdPath\.env" | Where-Object { $_ -match "^NGROK_URL=(.*)" }) -replace "^NGROK_URL=(.*)", '$1'
docker run --rm -v "$pwdPath\testing\k6:/scripts" -v "$pwdPath\reports:/scripts/reports" -w /scripts -e BASE_URL="https://$ngrokUrl/api" loadimpact/k6 run sync-vs-async-load.js --summary-export reports/k6-summary.json

function Format-Percent([int]$Part, [int]$Total) {
	if ($Total -le 0) { return '0%' }
	return ('{0:N1}%' -f (($Part / [double]$Total) * 100)).Replace(',', '.')
}

function Get-StatusFromCounts([int]$FailedCount) {
	if ($FailedCount -le 0) { return 'APROBADO' }
	return 'CON OBSERVACIONES'
}

function Get-MetricCount($metrics, [string]$name) {
	if (-not $metrics.PSObject.Properties.Name.Contains($name)) { return 0 }
	$metric = $metrics.$name
	if (-not $metric -or -not ($metric.PSObject.Properties.Name -contains 'count')) { return 0 }
	return [int]$metric.count
}

$newman = Get-Content "$pwdPath\reports\newman-report.json" -Raw | ConvertFrom-Json
$k6 = Get-Content "$pwdPath\reports\k6-summary.json" -Raw | ConvertFrom-Json

$newmanRequests = [int]$newman.run.stats.requests.total
$newmanFailedRequests = [int]$newman.run.stats.requests.failed
$newmanTests = [int]$newman.run.stats.tests.total
$newmanFailedTests = [int]$newman.run.stats.tests.failed
$newmanAvgMs = [int]$newman.run.timings.responseAverage
$newmanElapsedSec = [math]::Round(([int64]$newman.run.timings.completed - [int64]$newman.run.timings.started) / 1000, 1)
$newmanFailedResponses = @(
	$newman.run.executions | Where-Object {
		$hasResponse = $_.PSObject.Properties.Name -contains 'response'
		if (-not $hasResponse -or -not $_.response) { return $false }
		$code = $_.response.code
		return ($code -lt 200 -or $code -ge 300)
	}
)
$newmanFailedResponseCount = $newmanFailedResponses.Count
$newmanObservedFailures = $newmanFailedRequests + $newmanFailedTests + $newmanFailedResponseCount
$newmanCompraExecutions = @($newman.run.executions | Where-Object { $_.item -and $_.item.name -like '*Compra*' })
$newmanVentaExecutions = @($newman.run.executions | Where-Object { $_.item -and $_.item.name -like '*Venta*' })
$newmanCompraOk = @($newmanCompraExecutions | Where-Object { $_.response -and $_.response.code -ge 200 -and $_.response.code -lt 300 }).Count
$newmanCompraError = $newmanCompraExecutions.Count - $newmanCompraOk
$newmanVentaOk = @($newmanVentaExecutions | Where-Object { $_.response -and $_.response.code -ge 200 -and $_.response.code -lt 300 }).Count
$newmanVentaError = $newmanVentaExecutions.Count - $newmanVentaOk

$k6HttpReqs = [int]$k6.metrics.http_reqs.count
$k6FailedRate = [double]$k6.metrics.http_req_failed.value
$k6Failed = [int]([math]::Round($k6FailedRate * $k6HttpReqs))
$k6CheckPasses = [int]$k6.metrics.checks.passes
$k6CheckFails = [int]$k6.metrics.checks.fails
$k6Checks = $k6CheckPasses + $k6CheckFails
$k6AvgMs = [math]::Round([double]$k6.metrics.http_req_duration.avg, 2)
$k6SyncTotal = Get-MetricCount $k6.metrics 'sync_requests_total'
$k6SyncOk = Get-MetricCount $k6.metrics 'sync_ok_total'
$k6SyncError = Get-MetricCount $k6.metrics 'sync_error_total'
$k6AsyncTotal = Get-MetricCount $k6.metrics 'async_requests_total'
$k6AsyncOk = Get-MetricCount $k6.metrics 'async_ok_total'
$k6AsyncError = Get-MetricCount $k6.metrics 'async_error_total'

$summary = @"
# Resumen de pruebas

Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm')

## Newman

- Estado general: $((Get-StatusFromCounts $newmanObservedFailures))
- Peticiones ejecutadas: $newmanRequests
- Peticiones fallidas según el reporte: $newmanFailedRequests
- Peticiones con estado no 2xx: $newmanFailedResponseCount
- Tests ejecutados: $newmanTests
- Tests fallidos: $newmanFailedTests
- Tiempo promedio de respuesta: $newmanAvgMs ms
- Duración aproximada de la ejecución: $newmanElapsedSec s

- Flujo sincrono (Compras): $($newmanCompraExecutions.Count) ejecuciones, $newmanCompraOk OK, $newmanCompraError con error
- Flujo asincrono (Ventas): $($newmanVentaExecutions.Count) ejecuciones, $newmanVentaOk OK, $newmanVentaError con error

$(if ($newmanFailedResponseCount -gt 0) {
	"Detalles observados:`n" + (($newmanFailedResponses | ForEach-Object { "- $($_.item.name): HTTP $($_.response.code) $($_.response.status)" }) -join [Environment]::NewLine)
} else {
	'Detalles observados: ninguna petición con estado no 2xx.'
})

## k6

- Estado general: $((Get-StatusFromCounts $k6Failed))
- Peticiones ejecutadas: $k6HttpReqs
- Tasa de peticiones fallidas: $([math]::Round($k6FailedRate * 100, 2))%
- Peticiones fallidas estimadas: $k6Failed
- Checks ejecutados: $k6Checks
- Checks aprobados: $k6CheckPasses
- Checks fallidos: $k6CheckFails
- Tiempo promedio de respuesta: $k6AvgMs ms

- Flujo sincrono (Compras): $k6SyncTotal ejecuciones, $k6SyncOk OK, $k6SyncError con error
- Flujo asincrono (Ventas): $k6AsyncTotal ejecuciones, $k6AsyncOk OK, $k6AsyncError con error

## Interpretación

$(if ($newmanObservedFailures -eq 0 -and $k6Failed -eq 0) { 'Las pruebas funcionaron correctamente y no se detectaron fallos en los casos de uso ni en la carga.' } else { 'Hubo observaciones o fallos en alguna de las pruebas, así que conviene revisar los detalles técnicos de los reportes JSON.' })
"@

$summary | Set-Content -Path "$pwdPath\reports\resumen-pruebas.md" -Encoding UTF8

Write-Host 'Tests finalizados. Reportes en ./reports'