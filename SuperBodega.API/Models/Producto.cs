using System.ComponentModel.DataAnnotations;

namespace SuperBodega.API.Models;

public class Producto
{
    public int Id { get; set; }
    [Required]
    public string Nombre { get; set; } = null!;
    public string? Descripcion { get; set; }
    public decimal Precio { get; set; }
    public int Stock { get; set; }
    public bool Activo { get; set; } = true;
}
