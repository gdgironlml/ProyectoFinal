using System.ComponentModel.DataAnnotations;

namespace SuperBodega.API.Models;

public class Cliente
{
    public int Id { get; set; }
    [Required]
    public string Nombre { get; set; } = null!;
    public string? Telefono { get; set; }
    public string? Email { get; set; }
}
