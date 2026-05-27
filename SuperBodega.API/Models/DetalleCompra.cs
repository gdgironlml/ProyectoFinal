using System.Text.Json.Serialization;

namespace SuperBodega.API.Models;

public class DetalleCompra
{
    public int Id { get; set; }
    public int CompraId { get; set; }
    public int ProductoId { get; set; }
    public int Cantidad { get; set; }
    public decimal PrecioUnitario { get; set; }

    [JsonIgnore]
    public Compra? Compra { get; set; }
    public Producto? Producto { get; set; }
}
