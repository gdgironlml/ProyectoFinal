using System.ComponentModel.DataAnnotations;

namespace SuperBodega.API.Models;

public class Compra
{
    public int Id { get; set; }
    public DateTime Fecha { get; set; } = DateTime.UtcNow;
    public int ProveedorId { get; set; }
    public decimal Total { get; set; }
    public string Estado { get; set; } = string.Empty;

    public Proveedor? Proveedor { get; set; }
    public List<DetalleCompra> Detalles { get; set; } = new();
}
