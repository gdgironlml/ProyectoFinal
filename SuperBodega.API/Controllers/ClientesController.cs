using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SuperBodega.API.Data;
using SuperBodega.API.Models;

namespace SuperBodega.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ClientesController : ControllerBase
{
    private readonly BodegaContext _db;
    public ClientesController(BodegaContext db) => _db = db;

    [HttpGet]
    public async Task<IEnumerable<Cliente>> Get() => await _db.Clientes.ToListAsync();

    [HttpGet("{id}")]
    public async Task<ActionResult<Cliente>> Get(int id)
    {
        var e = await _db.Clientes.FindAsync(id);
        if (e == null) return NotFound();
        return e;
    }

    [HttpPost]
    public async Task<ActionResult<Cliente>> Post(Cliente cliente)
    {
        _db.Clientes.Add(cliente);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = cliente.Id }, cliente);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Put(int id, Cliente cliente)
    {
        if (id != cliente.Id) return BadRequest();
        _db.Entry(cliente).State = EntityState.Modified;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var e = await _db.Clientes.FindAsync(id);
        if (e == null) return NotFound();
        _db.Clientes.Remove(e);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
