using System.ComponentModel.DataAnnotations;

namespace SuperBodega.API.Models;

public class Venta
{
    public int Id { get; set; }
    public DateTime Fecha { get; set; } = DateTime.UtcNow;
    public int ClienteId { get; set; }
    public decimal Total { get; set; }

    public Cliente? Cliente { get; set; }
    public List<DetalleVenta> Detalles { get; set; } = new();
}
