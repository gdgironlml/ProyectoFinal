using SuperBodega.API.Models;

namespace SuperBodega.API.Services.Notifications;

public interface IEmailNotificationService
{
    Task SendPedidoAsync(Venta venta, string estado, CancellationToken cancellationToken = default);
}