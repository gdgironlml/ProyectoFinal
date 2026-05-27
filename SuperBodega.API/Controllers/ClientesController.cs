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

    [HttpGet("por-correo")]
    public async Task<ActionResult<Cliente>> GetByEmail([FromQuery] string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return BadRequest("El correo es obligatorio.");
        }

        var normalizedEmail = email.Trim().ToLower();
        var cliente = await _db.Clientes.FirstOrDefaultAsync(c => c.Email != null && c.Email.ToLower() == normalizedEmail);
        if (cliente == null)
        {
            return NotFound();
        }

        return Ok(cliente);
    }

    [HttpPost("resolver")]
    public async Task<ActionResult<Cliente>> Resolver([FromBody] ClienteSesionRequest request)
    {
        var email = request.Email?.Trim();
        if (string.IsNullOrWhiteSpace(email))
        {
            return BadRequest("El correo es obligatorio.");
        }

        var cliente = await _db.Clientes.FirstOrDefaultAsync(c => c.Email != null && c.Email.ToLower() == email.ToLower());
        if (cliente != null)
        {
            if (!string.IsNullOrWhiteSpace(request.Nombre) && string.IsNullOrWhiteSpace(cliente.Nombre))
            {
                cliente.Nombre = request.Nombre.Trim();
            }

            if (!string.IsNullOrWhiteSpace(request.Telefono) && string.IsNullOrWhiteSpace(cliente.Telefono))
            {
                cliente.Telefono = request.Telefono.Trim();
            }

            await _db.SaveChangesAsync();
            return Ok(cliente);
        }

        cliente = new Cliente
        {
            Nombre = string.IsNullOrWhiteSpace(request.Nombre) ? email : request.Nombre.Trim(),
            Email = email,
            Telefono = string.IsNullOrWhiteSpace(request.Telefono) ? null : request.Telefono.Trim()
        };

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

public class ClienteSesionRequest
{
    public string Nombre { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Telefono { get; set; }
}
