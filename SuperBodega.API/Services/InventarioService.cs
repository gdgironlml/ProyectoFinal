using Microsoft.EntityFrameworkCore;
using SuperBodega.API.Data;
using SuperBodega.API.Models;

namespace SuperBodega.API.Services;

public class StockInsuficienteException : Exception
{
    public StockInsuficienteException(string message) : base(message)
    {
    }
}

public class InventarioService
{
    private readonly BodegaContext _db;

    public InventarioService(BodegaContext db)
    {
        _db = db;
    }

    public async Task<Compra> RegistrarCompraAsync(Compra compra)
    {
        // Add compra and update stock
        using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            _db.Compras.Add(compra);
            foreach (var det in compra.Detalles)
            {
                var producto = await _db.Productos.FirstOrDefaultAsync(p => p.Id == det.ProductoId);
                if (producto == null)
                    throw new Exception($"Producto {det.ProductoId} no encontrado");

                producto.Stock += det.Cantidad;
            }

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

    public async Task<Venta> RegistrarVentaAsync(Venta venta)
    {
        using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            // validate stock
            foreach (var det in venta.Detalles)
            {
                var producto = await _db.Productos.FirstOrDefaultAsync(p => p.Id == det.ProductoId);
                if (producto == null)
                    throw new ProductoNoEncontradoException($"Producto {det.ProductoId} no encontrado");
                if (producto.Stock < det.Cantidad)
                    throw new StockInsuficienteException($"Stock insuficiente para el producto {producto.Nombre}");
                producto.Stock -= det.Cantidad;
            }

            _db.Ventas.Add(venta);
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
            return venta;
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }
}
