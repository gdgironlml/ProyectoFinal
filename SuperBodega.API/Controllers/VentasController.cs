using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperBodega.API.Data;
using SuperBodega.API.Messages;
using SuperBodega.API.Models;
using SuperBodega.API.Services;

namespace SuperBodega.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VentasController : ControllerBase
{
    private readonly BodegaContext _db;
    private readonly InventarioService _inv;

    public VentasController(BodegaContext db, InventarioService inv)
    {
        _db = db;
        _inv = inv;
    }

    [HttpGet]
    public async Task<IEnumerable<Venta>> Get() => await _db.Ventas
        .Include(v => v.Cliente)
        .Include(v => v.Detalles)
        .ToListAsync();

    [HttpGet("{id}")]
    public async Task<ActionResult<Venta>> Get(int id)
    {
        var e = await _db.Ventas
            .Include(v => v.Cliente)
            .Include(v => v.Detalles)
            .FirstOrDefaultAsync(v => v.Id == id);
        if (e == null) return NotFound();
        return e;
    }

    [HttpPost]
    public async Task<ActionResult<Venta>> Post(Venta venta)
    {
        var result = await _inv.RegistrarVentaAsync(venta);
        return CreatedAtAction(nameof(Get), new { id = result.Id }, result);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Put(int id, Venta venta)
    {
        if (id != venta.Id) return BadRequest();
        var updated = await _inv.UpdateVentaAsync(id, venta);
        return Ok(updated);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        await _inv.DeleteVentaAsync(id);
        return NoContent();
    }

    [HttpPatch("{id}/estado")]
    public async Task<ActionResult<Venta>> PatchEstado(int id, [FromBody] EstadoCambioRequest request)
    {
        var updated = await _inv.CambiarEstadoVentaAsync(id, request.Estado);
        return Ok(updated);
    }

    [HttpGet("report/period")]
    public async Task<IEnumerable<Venta>> ReportByPeriod(DateTime from, DateTime to)
    {
        var fromDate = from.Date;
        var toDate = to.Date.AddDays(1).AddTicks(-1);
        return await _db.Ventas
            .Include(v => v.Cliente)
            .Include(v => v.Detalles)
            .Where(v => v.Fecha >= fromDate && v.Fecha <= toDate)
            .ToListAsync();
    }

    [HttpGet("report/product/{productId}")]
    public async Task<IActionResult> ReportByProduct(int productId)
    {
        var detalles = await _db.DetallesVenta.Where(d => d.ProductoId == productId).ToListAsync();
        var totalCantidad = detalles.Sum(d => d.Cantidad);
        var totalVentas = detalles.Sum(d => d.Cantidad * d.PrecioUnitario);
        return Ok(new { productId, totalCantidad, totalVentas, detalles });
    }

    [HttpGet("report/cliente/{clienteId}")]
    public async Task<IEnumerable<Venta>> ReportByCliente(int clienteId)
    {
        return await _db.Ventas
            .Include(v => v.Cliente)
            .Include(v => v.Detalles)
            .Where(v => v.ClienteId == clienteId)
            .ToListAsync();
    }

    [HttpGet("report/proveedor/{proveedorId}")]
    public async Task<IActionResult> ReportByProveedor(int proveedorId)
    {
        var proveedor = await _db.Proveedores.FirstOrDefaultAsync(p => p.Id == proveedorId);
        var productoIds = await _db.Compras
            .Where(c => c.ProveedorId == proveedorId)
            .SelectMany(c => c.Detalles)
            .Select(d => d.ProductoId)
            .Distinct()
            .ToListAsync();

        var detalles = await _db.DetallesVenta.Where(d => productoIds.Contains(d.ProductoId)).ToListAsync();
        var totalCantidad = detalles.Sum(d => d.Cantidad);
        var totalVentas = detalles.Sum(d => d.Cantidad * d.PrecioUnitario);
        return Ok(new { proveedor, proveedorId, totalCantidad, totalVentas, detalles });
    }
}
