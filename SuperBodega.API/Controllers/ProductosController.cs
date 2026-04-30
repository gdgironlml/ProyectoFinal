using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperBodega.API.Data;
using SuperBodega.API.Models;

namespace SuperBodega.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProductosController : ControllerBase
{
    private readonly BodegaContext _db;

    public ProductosController(BodegaContext db) => _db = db;

    [HttpGet]
    public async Task<IEnumerable<Producto>> Get() => await _db.Productos.Where(p => p.Activo).ToListAsync();

    [HttpGet("{id}")]
    public async Task<ActionResult<Producto>> Get(int id)
    {
        var p = await _db.Productos.FindAsync(id);
        if (p == null) return NotFound();
        return p;
    }

    [HttpPost]
    public async Task<ActionResult<Producto>> Post(Producto producto)
    {
        _db.Productos.Add(producto);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = producto.Id }, producto);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Put(int id, Producto producto)
    {
        if (id != producto.Id) return BadRequest();
        _db.Entry(producto).State = EntityState.Modified;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var updatedRows = await _db.Productos
            .Where(p => p.Id == id && p.Activo)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(p => p.Activo, false));

        if (updatedRows == 0) return NotFound();

        return NoContent();
    }
}
