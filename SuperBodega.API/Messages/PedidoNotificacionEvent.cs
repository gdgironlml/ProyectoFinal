namespace SuperBodega.API.Messages;

public class PedidoNotificacionEvent
{
    public int VentaId { get; set; }
    public string Estado { get; set; } = string.Empty;
    public DateTime FechaEvento { get; set; }
}