using MassTransit;
using Microsoft.EntityFrameworkCore;
using SuperBodega.API.Data;
using SuperBodega.API.Messages;
using SuperBodega.API.Services.Notifications;

namespace SuperBodega.API.Consumers;

public class PedidoNotificationConsumer : IConsumer<PedidoNotificacionEvent>
{
    private readonly BodegaContext _db;
    private readonly IEmailNotificationService _emailNotificationService;
    private readonly ILogger<PedidoNotificationConsumer> _logger;

    public PedidoNotificationConsumer(BodegaContext db, IEmailNotificationService emailNotificationService, ILogger<PedidoNotificationConsumer> logger)
    {
        _db = db;
        _emailNotificationService = emailNotificationService;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<PedidoNotificacionEvent> context)
    {
        _logger.LogInformation("Received PedidoNotificacionEvent: VentaId={VentaId} Estado={Estado}", context.Message.VentaId, context.Message.Estado);
        var estado = NormalizarEstado(context.Message.Estado);
        if (!EsEstadoNotificable(estado))
        {
            return;
        }

        var venta = await _db.Ventas
            .Include(v => v.Cliente)
            .Include(v => v.Detalles)
                .ThenInclude(d => d.Producto)
            .FirstOrDefaultAsync(v => v.Id == context.Message.VentaId, context.CancellationToken);

        if (venta == null)
        {
            _logger.LogWarning("No se encontró la venta {VentaId} para enviar notificación.", context.Message.VentaId);
            return;
        }

        try
        {
            _logger.LogInformation("Enviando notificación por email para venta {VentaId} estado {Estado}", venta.Id, estado);
            await _emailNotificationService.SendPedidoAsync(venta, estado, context.CancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "No se pudo enviar la notificación de la venta {VentaId}.", venta.Id);
            throw;
        }
    }

    private static bool EsEstadoNotificable(string estado)
    {
        return string.Equals(estado, "Registrada", StringComparison.OrdinalIgnoreCase)
            || string.Equals(estado, "Despachada", StringComparison.OrdinalIgnoreCase)
            || string.Equals(estado, "Entregada", StringComparison.OrdinalIgnoreCase);
    }

    private static string NormalizarEstado(string estado)
    {
        if (string.Equals(estado, "Pedido recibido", StringComparison.OrdinalIgnoreCase)) return "Registrada";
        if (string.Equals(estado, "Pedido despachado", StringComparison.OrdinalIgnoreCase)) return "Despachada";
        if (string.Equals(estado, "Pedido entregado", StringComparison.OrdinalIgnoreCase)) return "Entregada";
        return estado;
    }
}