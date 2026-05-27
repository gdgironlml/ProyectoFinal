# SuperBodega E-Commerce

Esta carpeta contiene la base para la API E-Commerce de SuperBodega (la tienda virtual).

## Contenido

- **index.html**: Interfaz de usuario para la tienda virtual (catálogo de productos)
- **app.js**: Lógica de negocio para cargar productos y registrar ventas

## ¿Cómo usar esto?

### Opción 1: Como referencia para una nueva API
Cuando desarrolles tu API E-Commerce separada, puedes usar estos archivos como punto de partida:

1. Crea un nuevo proyecto: `SuperBodega.Ecommerce.API` (C# .NET) o el framework que prefieras
2. Implementa los endpoints que ya existen en SuperBodega.API:
   - `GET /Productos` - Listar productos activos
   - `POST /Ventas` - Registrar una venta

### Opción 2: Como cliente web standalone
Puedes servir estos archivos directamente desde tu API E-Commerce:

```bash
# En tu API E-Commerce, sirve estos archivos estáticos
# Asegúrate que apunte al endpoint correcto de SuperBodega.API
```

## Flujo esperado

1. **Cargar productos**: Al abrir la página, se llama a `GET /Productos` de SuperBodega.API
2. **Mostrar catálogo**: Los productos activos se muestran como tarjetas con:
   - Nombre, descripción, precio
   - Stock disponible
   - Selector de cantidad
   - Botón "Vender"
3. **Registrar venta**: Al hacer clic en "Vender":
   - Se construye un objeto de venta con: clienteId, fecha, total, detalles[]
   - Se envía a `POST /Ventas` de SuperBodega.API
   - Se recarga el catálogo

## Configuración

El API base está configurado en **app.js**:

```javascript
const API_BASE = 'http://localhost:5253';
```

Cambia `localhost:5253` si tu SuperBodega.API está en otro puerto o servidor.

## Notas importantes

- Los clientes deben existir en SuperBodega.API (el campo `tiendaClienteId` requiere un ID válido)
- Solo se muestran productos **activos** (Producto.Activo = true)
- Las ventas se registran inmediatamente en SuperBodega.API
- Se reduce automáticamente el stock en el inventario

## Próximos pasos

Cuando crees tu API E-Commerce completa, considera:
- Autenticación de usuarios/clientes
- Carrito de compras mejorado
- Métodos de pago integrados
- Gestión de órdenes de compra
- Historial de compras del cliente
- Reseñas y calificaciones de productos

---

**Última actualización**: Mayo 2026  
**Parte de**: SuperBodega - Sistema de Gestión de Bodega
