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
    public async Task<IActionResult> Get([FromQuery] string? categoria, [FromQuery] int page = 1, [FromQuery] int pageSize = 0)
    {
        var query = _db.Productos.Where(p => p.Activo).AsQueryable();

        if (!string.IsNullOrWhiteSpace(categoria))
        {
            query = query.Where(p => p.Categoria == categoria);
        }

        if (pageSize > 0)
        {
            var totalItems = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);
            
            var items = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new
            {
                TotalItems = totalItems,
                TotalPages = totalPages,
                CurrentPage = page,
                PageSize = pageSize,
                Items = items
            });
        }

        return Ok(await query.ToListAsync());
    }

    [HttpGet("all")]
    public async Task<IEnumerable<Producto>> GetAll() => await _db.Productos.ToListAsync();

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
