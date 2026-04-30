using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MassTransit;
using SuperBodega.API.Data;
using SuperBodega.API.Models;
using SuperBodega.API.Messages;

namespace SuperBodega.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VentasController : ControllerBase
{
    private readonly BodegaContext _db;
    private readonly IPublishEndpoint _publishEndpoint;

    public VentasController(BodegaContext db, IPublishEndpoint publishEndpoint)
    {
        _db = db;
        _publishEndpoint = publishEndpoint;
    }

    [HttpGet]
    public async Task<IEnumerable<Venta>> Get() => await _db.Ventas.Include(v => v.Detalles).ToListAsync();

    [HttpGet("{id}")]
    public async Task<ActionResult<Venta>> Get(int id)
    {
        var e = await _db.Ventas.Include(v => v.Detalles).FirstOrDefaultAsync(v => v.Id == id);
        if (e == null) return NotFound();
        return e;
    }

    [HttpPost]
    public async Task<ActionResult<Venta>> Post(Venta venta)
    {
        var ventaRealizadaEvent = new VentaRealizadaEvent
        {
            ClienteId = venta.ClienteId,
            Fecha = venta.Fecha,
            Total = venta.Total,
            Detalles = venta.Detalles.Select(detalle => new VentaRealizadaDetalleEvent
            {
                ProductoId = detalle.ProductoId,
                Cantidad = detalle.Cantidad,
                PrecioUnitario = detalle.PrecioUnitario
            }).ToList()
        };

        await _publishEndpoint.Publish(ventaRealizadaEvent);

        return Accepted(new
        {
            message = "Venta enviada para procesamiento asincrono.",
            venta.ClienteId,
            venta.Total
        });
    }
}
