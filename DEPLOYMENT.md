# Deployment - SuperBodega

Este documento describe donde esta publicado el sistema y como actualizarlo.

## Endpoints Publicos

- API base: http://20.245.127.124/api
- Swagger: http://20.245.127.124/index.html

## Frontends (Netlify)

Completar URLs finales al publicar:

- SuperBodega.Web: PENDIENTE_URL
- SuperBodega.Ecommerce: PENDIENTE_URL
- SuperBodega.EcommerceSincrona: PENDIENTE_URL

## Como consumen API los frontends

Cada frontend usa `API_BASE = '/api'` y un archivo `_redirects` con esta regla:

```txt
/api/*  http://20.245.127.124/api/:splat  200
```

Esto evita problemas de CORS y mixed content en Netlify.

## Infraestructura de Backend (Azure VM)

- Host: Azure VM Ubuntu
- Orquestacion: Docker Compose
- Servicios:
  - `superbodega_api` (publico en puerto 80)
  - `sql_server_bodega` (solo localhost)
  - `rabbitmq_bodega` (solo localhost)

## Actualizacion Rapida

Desde la maquina local:

```powershell
scp -i "$env:USERPROFILE\.ssh\id_ed25519" -r . azureuser@20.245.127.124:~/proyecto-superbodega
```

En la VM:

```bash
cd ~/proyecto-superbodega
docker-compose up -d --build
docker-compose ps
```

## Verificacion

En VM:

```bash
curl -I http://localhost
```

Desde navegador:

- http://20.245.127.124/index.html

## Seguridad Aplicada

- SQL Server publicado solo en `127.0.0.1:1433`
- RabbitMQ publicado solo en `127.0.0.1:5672` y `127.0.0.1:15672`
- API publica en `0.0.0.0:80`

## Pendientes Recomendados

- Migrar API a HTTPS con certificado
- Completar URLs de Netlify en este documento
- Agregar pipeline CI/CD para despliegue automatizado
