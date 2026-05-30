# SuperBodega - Infraestructura Docker

## Requisitos Previos
- Docker Desktop instalado
- Docker Compose v3.8 o superior

## Estructura

El proyecto cumple con todos los requisitos de infraestructura:

✅ **APIs con .NET Core MVC** - SuperBodega.API (net10.0)
✅ **Sistema de Colas** - RabbitMQ con MassTransit
✅ **Base de Datos en Docker** - SQL Server 2022 con volumen persistente
✅ **RabbitMQ en Docker** - Contenedor con volumen persistente
✅ **API en Contenedor** - Dockerfile multi-stage para .NET Core

## Levantando la Infraestructura

### 1. Construir y ejecutar todos los servicios

```bash
docker-compose up --build
```

Este comando:
- Construye la imagen de la API desde el Dockerfile
- Levanta SQL Server con volumen `sql_data`
- Levanta RabbitMQ con volumen `rabbit_data`
- Configura la red `bodega-network` para que todos los servicios se comuniquen

### 2. Servicios Disponibles

**SQL Server**
- Host: `sqlserver` (dentro de Docker) o `localhost` (desde host)
- Puerto: 1433
- Usuario: `sa`
- Contraseña: la definida en `MSSQL_SA_PASSWORD`
- Base de datos: `SuperBodegaDB`

**RabbitMQ**
- Host: `rabbitmq` (dentro de Docker) o `localhost` (desde host)
- Puerto AMQP: 5672
- Puerto Management: 15672
- Usuario: la definida en `RABBITMQ_DEFAULT_USER`
- Contraseña: la definida en `RABBITMQ_DEFAULT_PASS`
- Management UI: http://localhost:15672

**API**
- URL: http://localhost:8080
- Swagger: http://localhost:8080/swagger

### 3. Detener los Servicios

```bash
docker-compose down
```

Para eliminar también los volúmenes (datos persistentes):

```bash
docker-compose down -v
```

## Configuración de Variables de Entorno

Las variables de entorno se configuran automáticamente en `docker-compose.yml`:

- `ASPNETCORE_ENVIRONMENT=Production`
- `ConnectionStrings__DefaultConnection` - Cadena de conexión SQL Server
- `RabbitMQ__Host` - Host de RabbitMQ
- `RabbitMQ__Username` - Usuario RabbitMQ
- `RabbitMQ__Password` - Contraseña RabbitMQ

## Desarrollo Local

Si deseas desarrollar en modo local sin Docker:

1. Asegúrate de tener SQL Server 2022 y RabbitMQ ejecutándose localmente
2. Ejecuta `dotnet run` en la carpeta SuperBodega.API
3. Las variables de entorno usarán los valores por defecto (localhost)

## Volúmenes Persistentes

- `sql_data` - Almacena datos de SQL Server
- `rabbit_data` - Almacena datos y configuración de RabbitMQ

Los volúmenes persisten incluso después de ejecutar `docker-compose down` (solo se eliminan con `docker-compose down -v`).

## Health Checks

Ambos servicios tienen health checks configurados:
- SQL Server: Verifica conexión cada 10 segundos
- RabbitMQ: Verifica diagnostics cada 10 segundos
- API: Se inicia solo cuando sus dependencias están saludables

## Troubleshooting

### La API no se conecta a RabbitMQ
- Verifica que estés usando `rabbitmq` como host (no `localhost`)
- Los contenedores usan la red `bodega-network` para comunicarse

### Publicación sin ngrok
- La API queda expuesta por el puerto `8080` del contenedor
- Si publicas en una VM o servidor, puedes mapear `8080` a un puerto público o usar un proxy inverso

### Puertos ya ocupados
Si los puertos están ocupados, edita `docker-compose.yml`:
```yaml
ports:
  - "8080:80"  # Cambiar primer número a uno disponible
```

### Ver logs
```bash
# Todos los servicios
docker-compose logs

# Solo la API
docker-compose logs api

# Seguir logs en tiempo real
docker-compose logs -f
```
