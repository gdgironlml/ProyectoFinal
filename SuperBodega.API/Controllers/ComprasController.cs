using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperBodega.API.Data;
using SuperBodega.API.Messages;
using SuperBodega.API.Models;
using SuperBodega.API.Services;

namespace SuperBodega.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ComprasController : ControllerBase
{
    private readonly BodegaContext _db;
    private readonly InventarioService _inv;

    public ComprasController(BodegaContext db, InventarioService inv)
    {
        _db = db;
        _inv = inv;
    }

    [HttpGet]
    public async Task<IEnumerable<Compra>> Get() => await _db.Compras
        .Include(c => c.Proveedor)
        .Include(c => c.Detalles)
        .ToListAsync();

    [HttpGet("{id}")]
    public async Task<ActionResult<Compra>> Get(int id)
    {
        var e = await _db.Compras
            .Include(c => c.Proveedor)
            .Include(c => c.Detalles)
            .FirstOrDefaultAsync(c => c.Id == id);
        if (e == null) return NotFound();
        return e;
    }

    [HttpPost]
    public async Task<ActionResult<Compra>> Post(Compra compra)
    {
        var result = await _inv.RegistrarCompraAsync(compra);
        return CreatedAtAction(nameof(Get), new { id = result.Id }, result);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Put(int id, Compra compra)
    {
        if (id != compra.Id) return BadRequest();
        var updated = await _inv.UpdateCompraAsync(id, compra);
        return Ok(updated);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        await _inv.DeleteCompraAsync(id);
        return NoContent();
    }

    [HttpPatch("{id}/estado")]
    public async Task<ActionResult<Compra>> PatchEstado(int id, [FromBody] EstadoCambioRequest request)
    {
        var updated = await _inv.CambiarEstadoCompraAsync(id, request.Estado);
        return Ok(updated);
    }
}
