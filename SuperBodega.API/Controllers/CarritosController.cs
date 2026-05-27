using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MassTransit;
using SuperBodega.API.Data;
using SuperBodega.API.Messages;
using SuperBodega.API.Models;
using SuperBodega.API.Services;

namespace SuperBodega.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CarritosController : ControllerBase
{
    private readonly BodegaContext _db;
    private readonly InventarioService _inventarioService;
    private readonly IPublishEndpoint _publishEndpoint;

    public CarritosController(BodegaContext db, InventarioService inventarioService, IPublishEndpoint publishEndpoint)
    {
        _db = db;
        _inventarioService = inventarioService;
        _publishEndpoint = publishEndpoint;
    }

    [HttpGet("{clienteId}")]
    public async Task<ActionResult<Carrito>> GetCarrito(int clienteId)
    {
        var carrito = await _db.Carritos
            .Include(c => c.Cliente)
            .Include(c => c.Items)
            .ThenInclude(i => i.Producto)
            .FirstOrDefaultAsync(c => c.ClienteId == clienteId);

        if (carrito == null)
        {
            carrito = new Carrito { ClienteId = clienteId };
            _db.Carritos.Add(carrito);
            await _db.SaveChangesAsync();
            return await _db.Carritos
                .Include(c => c.Cliente)
                .Include(c => c.Items)
                .ThenInclude(i => i.Producto)
                .FirstAsync(c => c.ClienteId == clienteId);
        }

        return carrito;
    }

    [HttpPost("{clienteId}/items")]
    public async Task<ActionResult<Carrito>> AddItem(int clienteId, [FromBody] CarritoItemDto dto)
    {
        if (dto.Cantidad <= 0)
        {
            return BadRequest("La cantidad debe ser mayor que cero.");
        }

        var clienteExiste = await _db.Clientes.AnyAsync(c => c.Id == clienteId);
        if (!clienteExiste)
        {
            return NotFound($"El cliente con ID {clienteId} no existe.");
        }

        var producto = await _db.Productos.FirstOrDefaultAsync(p => p.Id == dto.ProductoId && p.Activo);
        if (producto == null)
        {
            return NotFound($"El producto con ID {dto.ProductoId} no existe o está inactivo.");
        }

        var carrito = await _db.Carritos
            .Include(c => c.Items)
            .FirstOrDefaultAsync(c => c.ClienteId == clienteId);

        if (carrito == null)
        {
            carrito = new Carrito { ClienteId = clienteId };
            _db.Carritos.Add(carrito);
        }

        var itemExistente = carrito.Items.FirstOrDefault(i => i.ProductoId == dto.ProductoId);
        if (itemExistente != null)
        {
            itemExistente.Cantidad += dto.Cantidad;
        }
        else
        {
            carrito.Items.Add(new CarritoItem
            {
                ProductoId = dto.ProductoId,
                Cantidad = dto.Cantidad
            });
        }

        await _db.SaveChangesAsync();
        return await GetCarrito(clienteId);
    }

    [HttpPost("{clienteId}/checkout")]
    public Task<ActionResult<Venta>> Checkout(int clienteId)
    {
        return CheckoutSync(clienteId);
    }

    [HttpPost("{clienteId}/checkout/sync")]
    public async Task<ActionResult<Venta>> CheckoutSync(int clienteId)
    {
        var carrito = await _db.Carritos
            .Include(c => c.Cliente)
            .Include(c => c.Items)
                .ThenInclude(i => i.Producto)
            .FirstOrDefaultAsync(c => c.ClienteId == clienteId);

        if (carrito == null)
        {
            return NotFound("No existe un carrito para este cliente.");
        }

        if (carrito.Items.Count == 0)
        {
            return BadRequest("El carrito está vacío.");
        }

        var venta = new Venta
        {
            ClienteId = clienteId,
            Fecha = DateTime.UtcNow,
            Total = carrito.Items.Sum(i => i.Cantidad * i.Producto.Precio),
            Detalles = carrito.Items.Select(i => new DetalleVenta
            {
                ProductoId = i.ProductoId,
                Cantidad = i.Cantidad,
                PrecioUnitario = i.Producto.Precio
            }).ToList()
        };

        var result = await _inventarioService.RegistrarVentaAsync(venta);

        _db.CarritoItems.RemoveRange(carrito.Items);
        await _db.SaveChangesAsync();

        return Ok(result);
    }

    [HttpPost("{clienteId}/checkout/async")]
    public async Task<ActionResult> CheckoutAsync(int clienteId)
    {
        var carrito = await _db.Carritos
            .Include(c => c.Cliente)
            .Include(c => c.Items)
                .ThenInclude(i => i.Producto)
            .FirstOrDefaultAsync(c => c.ClienteId == clienteId);

        if (carrito == null)
        {
            return NotFound("No existe un carrito para este cliente.");
        }

        if (carrito.Items.Count == 0)
        {
            return BadRequest("El carrito está vacío.");
        }

        var evento = new VentaRealizadaEvent
        {
            ClienteId = clienteId,
            Fecha = DateTime.UtcNow,
            Total = carrito.Items.Sum(i => i.Cantidad * i.Producto.Precio),
            Detalles = carrito.Items.Select(i => new VentaRealizadaDetalleEvent
            {
                ProductoId = i.ProductoId,
                Cantidad = i.Cantidad,
                PrecioUnitario = i.Producto.Precio
            }).ToList()
        };

        await _publishEndpoint.Publish(evento);

        _db.CarritoItems.RemoveRange(carrito.Items);
        await _db.SaveChangesAsync();

        return Accepted(new
        {
            mensaje = "La compra fue enviada a la cola de procesamiento.",
            clienteId,
            total = evento.Total,
            fecha = evento.Fecha
        });
    }
    
    [HttpDelete("{clienteId}/items/{productoId}")]
    public async Task<ActionResult<Carrito>> RemoveItem(int clienteId, int productoId)
    {
        var carrito = await _db.Carritos
            .Include(c => c.Items)
            .FirstOrDefaultAsync(c => c.ClienteId == clienteId);

        if (carrito != null)
        {
            var item = carrito.Items.FirstOrDefault(i => i.ProductoId == productoId);
            if (item != null)
            {
                carrito.Items.Remove(item);
                await _db.SaveChangesAsync();
            }
        }
        return await GetCarrito(clienteId);
    }
}

public class CarritoItemDto
{
    public int ProductoId { get; set; }
    public int Cantidad { get; set; }
}