namespace SuperBodega.API.Messages;

public class VentaRealizadaEvent
{
    public int ClienteId { get; set; }
    public DateTime Fecha { get; set; }
    public decimal Total { get; set; }
    public List<VentaRealizadaDetalleEvent> Detalles { get; set; } = new();
}

public class VentaRealizadaDetalleEvent
{
    public int ProductoId { get; set; }
    public int Cantidad { get; set; }
    public decimal PrecioUnitario { get; set; }
}