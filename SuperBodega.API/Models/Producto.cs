using System.ComponentModel.DataAnnotations;

namespace SuperBodega.API.Models;

public class Producto
{
    public int Id { get; set; }
    [Required]
    public string Nombre { get; set; } = null!;
    public int? ProveedorId { get; set; }
    public string? Descripcion { get; set; }
    public string? Categoria { get; set; }
    public decimal PrecioCompra { get; set; }
    public decimal Precio { get; set; } // Precio de Venta
    public int Stock { get; set; }
    public bool Activo { get; set; } = true;
    public Proveedor? Proveedor { get; set; }
}
