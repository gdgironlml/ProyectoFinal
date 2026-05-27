# Presentacion: arranca docker, espera servicios y lanza los tests
Set-StrictMode -Version Latest

# Carga variables de .env si existe
if (Test-Path .env) {
  Get-Content .env | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#')) {
      $parts = $line -split('=',2)
      if ($parts.Length -eq 2) {
        $name = $parts[0].Trim()
        $value = $parts[1].Trim().Trim('"')
        $env:$name = $value
      }
    }
  }
}

# Levanta los contenedores
Write-Host "Arrancando servicios Docker..."
docker compose up -d

# Función para esperar estado healthy
function Wait-Healthy($containerName, $timeoutSec) {
  $end = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $end) {
    try {
      $status = docker inspect -f '{{.State.Health.Status}}' $containerName 2>$null
    } catch {
      $status = $null
    }
    if ($status -eq 'healthy') {
      Write-Host "$containerName está healthy"
      return $true
    }
    Start-Sleep -Seconds 2
  }
  Write-Warning "$containerName no alcanzó 'healthy' en $timeoutSec segundos"
  return $false
}

# Espera SQL Server y RabbitMQ (si existen)
Wait-Healthy sql_server_bodega 120 | Out-Null
Wait-Healthy rabbitmq_bodega 60 | Out-Null

# Espera que el API esté en ejecución
$apiEnd = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $apiEnd) {
  $state = docker inspect -f '{{.State.Status}}' superbodega_api 2>$null
  if ($state -eq 'running') { Write-Host 'API container running'; break }
  Start-Sleep -Seconds 2
}

# Ejecuta los tests (script separado)
Write-Host 'Ejecutando tests (Newman + k6)'
& "$PSScriptRoot\run_tests.ps1"