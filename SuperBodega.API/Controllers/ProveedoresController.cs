using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperBodega.API.Data;
using SuperBodega.API.Models;

namespace SuperBodega.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProveedoresController : ControllerBase
{
    private readonly BodegaContext _db;
    public ProveedoresController(BodegaContext db) => _db = db;

    [HttpGet]
    public async Task<IEnumerable<Proveedor>> Get() => await _db.Proveedores.ToListAsync();

    [HttpGet("{id}")]
    public async Task<ActionResult<Proveedor>> Get(int id)
    {
        var e = await _db.Proveedores.FindAsync(id);
        if (e == null) return NotFound();
        return e;
    }

    [HttpPost]
    public async Task<ActionResult<Proveedor>> Post(Proveedor proveedor)
    {
        _db.Proveedores.Add(proveedor);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = proveedor.Id }, proveedor);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Put(int id, Proveedor proveedor)
    {
        if (id != proveedor.Id) return BadRequest();
        _db.Entry(proveedor).State = EntityState.Modified;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var e = await _db.Proveedores.FindAsync(id);
        if (e == null) return NotFound();
        _db.Proveedores.Remove(e);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
