using MassTransit;
using Microsoft.EntityFrameworkCore;
using SuperBodega.API.Data;
using SuperBodega.API.Messages;
using SuperBodega.API.Models;

namespace SuperBodega.API.Services;

// Error cuando el stock no alcanza.
public class StockInsuficienteException : Exception
{
    public StockInsuficienteException(string message) : base(message)
    {
    }
}

// Logica central de compras, ventas e inventario.
public class InventarioService
{
    private readonly BodegaContext _db;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly ILogger<InventarioService> _logger;
    private const string EstadoRegistrada = "Registrada";
    private const string EstadoDespachada = "Despachada";
    private const string EstadoEntregada = "Entregada";
    private const string EstadoAnulada = "Anulada";

    public InventarioService(BodegaContext db, IPublishEndpoint publishEndpoint, ILogger<InventarioService> logger)
    {
        _db = db;
        _publishEndpoint = publishEndpoint;
        _logger = logger;
    }
    // Registra una compra y aumenta stock.
    public async Task<Compra> RegistrarCompraAsync(Compra compra)
    {
        using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            compra.Estado = EstadoRegistrada;
            var nuevos = compra.Detalles.Where(d => d.ProductoId == 0 && d.Producto != null).ToList();
            foreach (var detNew in nuevos)
            {
                var p = new Producto
                {
                    Nombre = detNew.Producto!.Nombre,
                    Descripcion = detNew.Producto.Descripcion,
                    Categoria = detNew.Producto.Categoria,
                    PrecioCompra = detNew.PrecioUnitario,
                    Precio = detNew.Producto.Precio,
                    ProveedorId = compra.ProveedorId,
                    Stock = 0,
                    Activo = true
                };
                _db.Productos.Add(p);
            }

            await _db.SaveChangesAsync();

            foreach (var det in compra.Detalles)
            {
                Producto? producto = null;
                if (det.ProductoId != 0)
                {
                    producto = await _db.Productos.FirstOrDefaultAsync(p => p.Id == det.ProductoId);
                }
                else if (det.Producto != null)
                {
                    // ya fue creado y tiene Id asignado por SaveChanges
                    producto = await _db.Productos.FirstOrDefaultAsync(p => p.Nombre == det.Producto.Nombre && p.PrecioCompra == det.PrecioUnitario);
                }

                if (producto == null)
                    throw new ProductoNoEncontradoException($"Producto para detalle no encontrado o no proporcionado");

                if (producto.ProveedorId != compra.ProveedorId)
                    throw new Exception($"El producto {producto.Nombre} no pertenece al proveedor seleccionado");

                // Las compras aumentan stock
                producto.Stock += det.Cantidad;
                det.ProductoId = producto.Id;
                det.Producto = null;
            }

            _db.Compras.Add(compra);
            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            return await _db.Compras
                .AsNoTracking()
                .Include(c => c.Proveedor)
                .Include(c => c.Detalles)
                    .ThenInclude(d => d.Producto)
                        .ThenInclude(p => p.Proveedor)
                .FirstAsync(c => c.Id == compra.Id);
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    // Registra una venta y descuenta stock.
    public async Task<Venta> RegistrarVentaAsync(Venta venta)
    {
        using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            venta.Estado = EstadoRegistrada;
            // Las ventas agregan stock y permiten crear productos nuevos asociados a la venta
            // Primero crear productos nuevos que vengan embedidos en los detalles
            var nuevos = venta.Detalles.Where(d => d.ProductoId == 0 && d.Producto != null).ToList();
            foreach (var detNew in nuevos)
            {
                var p = new Producto
                {
                    Nombre = detNew.Producto!.Nombre,
                    Descripcion = detNew.Producto.Descripcion,
                    Categoria = detNew.Producto.Categoria,
                    PrecioCompra = detNew.PrecioUnitario,
                    Precio = detNew.Producto.Precio,
                    Stock = 0,
                    Activo = true
                };
                _db.Productos.Add(p);
            }

            await _db.SaveChangesAsync();

            foreach (var det in venta.Detalles)
            {
                Producto? producto = null;
                if (det.ProductoId != 0)
                {
                    producto = await _db.Productos.FirstOrDefaultAsync(p => p.Id == det.ProductoId);
                }
                else if (det.Producto != null)
                {
                    // ya fue creado y tiene Id asignado por SaveChanges
                    producto = await _db.Productos.FirstOrDefaultAsync(p => p.Nombre == det.Producto.Nombre && p.PrecioCompra == det.PrecioUnitario);
                }

                if (producto == null)
                    throw new ProductoNoEncontradoException($"Producto para detalle no encontrado o no proporcionado");

                if (producto.Stock < det.Cantidad)
                    throw new StockInsuficienteException($"Stock insuficiente para el producto {producto.Nombre}");

                producto.Stock -= det.Cantidad;
                det.ProductoId = producto.Id;
                det.Producto = null;
            }

            _db.Ventas.Add(venta);
            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            await PublicarNotificacionPedidoAsync(venta.Id, EstadoRegistrada);

            return await _db.Ventas
                .AsNoTracking()
                .Include(v => v.Cliente)
                .Include(v => v.Detalles)
                    .ThenInclude(d => d.Producto)
                        .ThenInclude(p => p.Proveedor)
                .FirstAsync(v => v.Id == venta.Id);
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    // Actualiza una compra y recalcula inventario.
    public async Task<Compra> UpdateCompraAsync(int id, Compra compra)
    {
        using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var existing = await _db.Compras.Include(c => c.Detalles).FirstOrDefaultAsync(c => c.Id == id);
            if (existing == null) throw new Exception("Compra no encontrada");
            var ajustaStock = !string.Equals(existing.Estado, EstadoAnulada, StringComparison.OrdinalIgnoreCase);

            await NormalizarDetallesCompraAsync(compra);

            // map productId -> cantidad
            var oldMap = existing.Detalles.GroupBy(d => d.ProductoId).ToDictionary(g => g.Key, g => g.Sum(d => d.Cantidad));
            var newMap = compra.Detalles.GroupBy(d => d.ProductoId).ToDictionary(g => g.Key, g => g.Sum(d => d.Cantidad));

            var productIds = oldMap.Keys.Concat(newMap.Keys).Distinct();
            foreach (var pid in productIds)
            {
                var oldQty = oldMap.ContainsKey(pid) ? oldMap[pid] : 0;
                var newQty = newMap.ContainsKey(pid) ? newMap[pid] : 0;
                var producto = await _db.Productos.FirstOrDefaultAsync(p => p.Id == pid);
                if (producto == null) throw new ProductoNoEncontradoException($"Producto {pid} no encontrado");

                if (ajustaStock)
                {
                    // compras aumentan stock: aplicar delta inverso
                    producto.Stock -= (oldQty - newQty);
                }
            }

            // actualizar entidad y detalles (simple approach: remove old detalles, add new)
            _db.DetallesCompra.RemoveRange(existing.Detalles);
            existing.Detalles = compra.Detalles;
            foreach (var det in existing.Detalles)
            {
                det.Producto = null;
            }
            existing.Fecha = compra.Fecha;
            existing.ProveedorId = compra.ProveedorId;
            existing.Total = compra.Total;

            await _db.SaveChangesAsync();
            await tx.CommitAsync();
            return existing;
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    public async Task DeleteCompraAsync(int id)
    {
        using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var existing = await _db.Compras.Include(c => c.Detalles).FirstOrDefaultAsync(c => c.Id == id);
            if (existing == null) throw new Exception("Compra no encontrada");

            // Solo revertimos stock si la compra sigue vigente.
            if (!string.Equals(existing.Estado, EstadoAnulada, StringComparison.OrdinalIgnoreCase))
            {
                foreach (var d in existing.Detalles)
                {
                    var producto = await _db.Productos.FirstOrDefaultAsync(p => p.Id == d.ProductoId);
                    if (producto == null) continue;
                    producto.Stock -= d.Cantidad;
                }
            }

            _db.DetallesCompra.RemoveRange(existing.Detalles);
            _db.Compras.Remove(existing);
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    // Actualiza una venta y recalcula inventario.
    public async Task<Venta> UpdateVentaAsync(int id, Venta venta)
    {
        using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var existing = await _db.Ventas.Include(c => c.Detalles).FirstOrDefaultAsync(c => c.Id == id);
            if (existing == null) throw new Exception("Venta no encontrada");
            var ajustaStock = !string.Equals(existing.Estado, EstadoAnulada, StringComparison.OrdinalIgnoreCase);

            await NormalizarDetallesVentaAsync(venta);

            var oldMap = existing.Detalles.GroupBy(d => d.ProductoId).ToDictionary(g => g.Key, g => g.Sum(d => d.Cantidad));
            var newMap = venta.Detalles.GroupBy(d => d.ProductoId).ToDictionary(g => g.Key, g => g.Sum(d => d.Cantidad));

            var productIds = oldMap.Keys.Concat(newMap.Keys).Distinct();
            foreach (var pid in productIds)
            {
                var oldQty = oldMap.ContainsKey(pid) ? oldMap[pid] : 0;
                var newQty = newMap.ContainsKey(pid) ? newMap[pid] : 0;
                var producto = await _db.Productos.FirstOrDefaultAsync(p => p.Id == pid);
                if (producto == null) throw new ProductoNoEncontradoException($"Producto {pid} no encontrado");

                if (ajustaStock)
                {
                    // ventas disminuyen stock: validar y aplicar delta
                    var deltaNegativo = oldQty - newQty;
                    if (producto.Stock < deltaNegativo)
                        throw new StockInsuficienteException($"Stock insuficiente para el producto {producto.Nombre}");
                    producto.Stock -= deltaNegativo;
                }
            }

            _db.DetallesVenta.RemoveRange(existing.Detalles);
            existing.Detalles = venta.Detalles;
            foreach (var det in existing.Detalles)
            {
                det.Producto = null;
            }
            existing.Fecha = venta.Fecha;
            existing.ClienteId = venta.ClienteId;
            existing.Total = venta.Total;

            await _db.SaveChangesAsync();
            await tx.CommitAsync();
            return existing;
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    public async Task DeleteVentaAsync(int id)
    {
        using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            var existing = await _db.Ventas.Include(c => c.Detalles).FirstOrDefaultAsync(c => c.Id == id);
            if (existing == null) throw new Exception("Venta no encontrada");

            // Solo revertimos stock si la venta sigue vigente.
            if (!string.Equals(existing.Estado, EstadoAnulada, StringComparison.OrdinalIgnoreCase))
            {
                foreach (var d in existing.Detalles)
                {
                    var producto = await _db.Productos.FirstOrDefaultAsync(p => p.Id == d.ProductoId);
                    if (producto == null) continue;
                    producto.Stock += d.Cantidad;
                }
            }

            _db.DetallesVenta.RemoveRange(existing.Detalles);
            _db.Ventas.Remove(existing);
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    // Cambia el estado de una compra.
    public async Task<Compra> CambiarEstadoCompraAsync(int id, string estado)
    {
        using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            estado = NormalizarEstado(estado);
            var compra = await _db.Compras.Include(c => c.Detalles).FirstOrDefaultAsync(c => c.Id == id);
            if (compra == null) throw new Exception("Compra no encontrada");

            if (compra.Estado == estado) return compra;

            if (estado == EstadoAnulada && compra.Estado != EstadoAnulada)
            {
                foreach (var d in compra.Detalles)
                {
                    var producto = await _db.Productos.FirstOrDefaultAsync(p => p.Id == d.ProductoId);
                    if (producto == null) continue;
                    producto.Stock -= d.Cantidad;
                }
            }
            else if (estado == EstadoRegistrada && compra.Estado == EstadoAnulada)
            {
                foreach (var d in compra.Detalles)
                {
                    var producto = await _db.Productos.FirstOrDefaultAsync(p => p.Id == d.ProductoId);
                    if (producto == null) continue;
                    producto.Stock += d.Cantidad;
                }
            }

            compra.Estado = estado;
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
            return compra;
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    // Cambia el estado de una venta y publica notificaciones.
    public async Task<Venta> CambiarEstadoVentaAsync(int id, string estado)
    {
        using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            estado = NormalizarEstado(estado);
            var venta = await _db.Ventas.Include(v => v.Detalles).FirstOrDefaultAsync(v => v.Id == id);
            if (venta == null) throw new Exception("Venta no encontrada");

            if (venta.Estado == estado) return venta;

            if (estado == EstadoAnulada && venta.Estado != EstadoAnulada)
            {
                foreach (var d in venta.Detalles)
                {
                    var producto = await _db.Productos.FirstOrDefaultAsync(p => p.Id == d.ProductoId);
                    if (producto == null) continue;
                    producto.Stock += d.Cantidad;
                }
            }
            else if (estado == EstadoRegistrada && venta.Estado == EstadoAnulada)
            {
                foreach (var d in venta.Detalles)
                {
                    var producto = await _db.Productos.FirstOrDefaultAsync(p => p.Id == d.ProductoId);
                    if (producto == null) continue;
                    if (producto.Stock < d.Cantidad)
                        throw new StockInsuficienteException($"Stock insuficiente para restaurar la venta del producto {producto.Nombre}");
                    producto.Stock -= d.Cantidad;
                }
            }

            venta.Estado = estado;
            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            if (EsEstadoNotificable(estado))
            {
                await PublicarNotificacionPedidoAsync(venta.Id, estado);
            }

            return venta;
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }

    private static string NormalizarEstado(string estado)
    {
        if (string.Equals(estado, EstadoAnulada, StringComparison.OrdinalIgnoreCase)) return EstadoAnulada;
        if (string.Equals(estado, EstadoDespachada, StringComparison.OrdinalIgnoreCase)) return EstadoDespachada;
        if (string.Equals(estado, EstadoEntregada, StringComparison.OrdinalIgnoreCase)) return EstadoEntregada;
        if (string.Equals(estado, "Recibido", StringComparison.OrdinalIgnoreCase)) return EstadoRegistrada;
        if (string.Equals(estado, "Pedido recibido", StringComparison.OrdinalIgnoreCase)) return EstadoRegistrada;
        if (string.Equals(estado, "Pedido despachado", StringComparison.OrdinalIgnoreCase)) return EstadoDespachada;
        if (string.Equals(estado, "Pedido entregado", StringComparison.OrdinalIgnoreCase)) return EstadoEntregada;
        return EstadoRegistrada;
    }

    private static bool EsEstadoNotificable(string estado)
    {
        return string.Equals(estado, EstadoRegistrada, StringComparison.OrdinalIgnoreCase)
            || string.Equals(estado, EstadoDespachada, StringComparison.OrdinalIgnoreCase)
            || string.Equals(estado, EstadoEntregada, StringComparison.OrdinalIgnoreCase);
    }

    // Publica el evento de notificacion en RabbitMQ.
    private async Task PublicarNotificacionPedidoAsync(int ventaId, string estado)
    {
        const int maxAttempts = 3;
        Exception? lastEx = null;

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                _logger.LogInformation("Publicando evento PedidoNotificacionEvent para venta {VentaId} estado {Estado} (intento {Attempt}/{Max})", ventaId, estado, attempt, maxAttempts);
                await _publishEndpoint.Publish(new PedidoNotificacionEvent
                {
                    VentaId = ventaId,
                    Estado = estado,
                    FechaEvento = DateTime.UtcNow
                });
                _logger.LogInformation("Evento PedidoNotificacionEvent publicado para venta {VentaId} estado {Estado}", ventaId, estado);
                lastEx = null;
                break;
            }
            catch (Exception ex)
            {
                lastEx = ex;
                _logger.LogWarning(ex, "Fallo al publicar notificacion de pedido (intento {Attempt}/{Max}) venta {VentaId} estado {Estado}.", attempt, maxAttempts, ventaId, estado);
                if (attempt < maxAttempts)
                {
                    await Task.Delay(TimeSpan.FromSeconds(Math.Pow(2, attempt)));
                }
            }
        }

        if (lastEx != null)
        {
            _logger.LogError(lastEx, "No se pudo publicar la notificación del pedido {VentaId} en estado {Estado} tras {Max} intentos.", ventaId, estado, maxAttempts);
        }
    }

    private async Task NormalizarDetallesCompraAsync(Compra compra)
    {
        foreach (var det in compra.Detalles)
        {
            if (det.ProductoId > 0)
            {
                continue;
            }

            if (det.Producto == null)
            {
                throw new ProductoNoEncontradoException("Producto para detalle no encontrado o no proporcionado");
            }

            if (det.Producto.Id > 0)
            {
                det.ProductoId = det.Producto.Id;
                continue;
            }

            var producto = await _db.Productos.FirstOrDefaultAsync(p => p.Nombre == det.Producto.Nombre && p.ProveedorId == compra.ProveedorId);
            if (producto == null)
            {
                producto = new Producto
                {
                    Nombre = det.Producto.Nombre,
                    Descripcion = det.Producto.Descripcion,
                    Categoria = det.Producto.Categoria,
                    PrecioCompra = det.PrecioUnitario,
                    Precio = det.Producto.Precio,
                    ProveedorId = compra.ProveedorId,
                    Stock = 0,
                    Activo = det.Producto.Activo
                };
                _db.Productos.Add(producto);
                await _db.SaveChangesAsync();
            }

            det.ProductoId = producto.Id;
        }
    }

    private async Task NormalizarDetallesVentaAsync(Venta venta)
    {
        foreach (var det in venta.Detalles)
        {
            if (det.ProductoId > 0)
            {
                continue;
            }

            if (det.Producto == null)
            {
                throw new ProductoNoEncontradoException("Producto para detalle no encontrado o no proporcionado");
            }

            if (det.Producto.Id > 0)
            {
                det.ProductoId = det.Producto.Id;
                continue;
            }

            throw new ProductoNoEncontradoException("La venta debe referenciar un producto existente");
        }
    }
}
