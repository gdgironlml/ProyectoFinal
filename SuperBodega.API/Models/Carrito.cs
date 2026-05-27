using System.ComponentModel.DataAnnotations;

namespace SuperBodega.API.Models;

public class Carrito
{
    public int Id { get; set; }
    public int ClienteId { get; set; }
    public Cliente Cliente { get; set; } = null!;
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    public List<CarritoItem> Items { get; set; } = new();
}

public class CarritoItem
{
    public int Id { get; set; }
    public int CarritoId { get; set; }
    public int ProductoId { get; set; }
    public Producto Producto { get; set; } = null!;
    public int Cantidad { get; set; }
}