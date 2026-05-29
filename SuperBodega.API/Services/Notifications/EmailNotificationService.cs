using System.Net;
using System.Net.Mail;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using SuperBodega.API.Data;
using SuperBodega.API.Models;

namespace SuperBodega.API.Services.Notifications;

public class EmailNotificationService : IEmailNotificationService
{
    private readonly BodegaContext _db;
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailNotificationService> _logger;

    public EmailNotificationService(BodegaContext db, IConfiguration configuration, ILogger<EmailNotificationService> logger)
    {
        _db = db;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendPedidoAsync(Venta venta, string estado, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var ventaCompleta = await _db.Ventas
            .Include(v => v.Cliente)
            .Include(v => v.Detalles)
                .ThenInclude(d => d.Producto)
            .FirstOrDefaultAsync(v => v.Id == venta.Id, cancellationToken);

        if (ventaCompleta == null)
        {
            _logger.LogWarning("No se encontró la venta {VentaId} para notificar por email.", venta.Id);
            return;
        }

        var cliente = ventaCompleta.Cliente;
        if (cliente == null || string.IsNullOrWhiteSpace(cliente.Email))
        {
            _logger.LogWarning("La venta {VentaId} no tiene un email de cliente válido; no se envió notificación.", ventaCompleta.Id);
            return;
        }

        var (subject, bodyText) = BuildMessage(ventaCompleta, estado);

        var host = _configuration["Email:Smtp:Host"] ?? Environment.GetEnvironmentVariable("Email__Smtp__Host");
        var portText = _configuration["Email:Smtp:Port"] ?? Environment.GetEnvironmentVariable("Email__Smtp__Port");
        var username = _configuration["Email:Smtp:Username"] ?? Environment.GetEnvironmentVariable("Email__Smtp__Username");
        var password = _configuration["Email:Smtp:Password"] ?? Environment.GetEnvironmentVariable("Email__Smtp__Password");
        var fromAddress = _configuration["Email:Smtp:FromAddress"] ?? Environment.GetEnvironmentVariable("Email__Smtp__FromAddress") ?? username;
        var fromName = _configuration["Email:Smtp:FromName"] ?? Environment.GetEnvironmentVariable("Email__Smtp__FromName") ?? "SuperBodega";
        var enableSslText = _configuration["Email:Smtp:EnableSsl"] ?? Environment.GetEnvironmentVariable("Email__Smtp__EnableSsl") ?? "true";

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(fromAddress))
        {
            _logger.LogWarning("La configuración SMTP no está completa; no se envió la notificación de la venta {VentaId}.", ventaCompleta.Id);
            return;
        }

        var port = int.TryParse(portText, out var parsedPort) ? parsedPort : 587;
        var enableSsl = bool.TryParse(enableSslText, out var parsedSsl) && parsedSsl;

        using var message = new MailMessage
        {
            From = new MailAddress(fromAddress, fromName),
            Subject = subject,
            Body = bodyText,
            IsBodyHtml = false
        };

        message.To.Add(cliente.Email);

        using var smtp = new SmtpClient(host, port)
        {
            EnableSsl = enableSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network
        };

        if (!string.IsNullOrWhiteSpace(username))
        {
            smtp.Credentials = new NetworkCredential(username, password);
        }

        const int maxAttempts = 3;
        var attempt = 0;
        Exception? lastEx = null;

        while (attempt < maxAttempts)
        {
            attempt++;
            try
            {
                await smtp.SendMailAsync(message);
                _logger.LogInformation("Notificación enviada al cliente {ClienteId} para la venta {VentaId} con estado {Estado}. (intento {Attempt})", cliente.Id, ventaCompleta.Id, estado, attempt);
                lastEx = null;
                break;
            }
            catch (SmtpException ex)
            {
                lastEx = ex;
                _logger.LogWarning(ex, "Fallo al enviar email (intento {Attempt}/{Max}). Host={Host} Port={Port} To={To}", attempt, maxAttempts, host, port, cliente.Email);
            }
            catch (Exception ex)
            {
                lastEx = ex;
                _logger.LogWarning(ex, "Error inesperado al enviar email (intento {Attempt}/{Max}). To={To}", attempt, maxAttempts, cliente.Email);
            }

            if (attempt < maxAttempts)
            {
                // Exponential backoff
                await Task.Delay(TimeSpan.FromSeconds(Math.Pow(2, attempt)), cancellationToken);
            }
        }

        if (lastEx != null)
        {
            _logger.LogError(lastEx, "No se pudo enviar la notificación de la venta {VentaId} tras {Max} intentos.", ventaCompleta.Id, maxAttempts);
            throw lastEx;
        }
    }

    private static (string Subject, string Body) BuildMessage(Venta venta, string estado)
    {
        var estadoVisible = estado.Trim().ToLowerInvariant() switch
        {
            "registrada" => "Pedido recibido",
            "despachada" => "Pedido despachado",
            "entregada" => "Pedido entregado",
            "anulada" => "Pedido anulado",
            _ => estado
        };

        var estadoNormalizado = estado.Trim().ToLowerInvariant();
        var titulo = estadoNormalizado switch
        {
            "registrada" => "Pedido recibido",
            "despachada" => "Pedido despachado",
            "entregada" => "Pedido entregado",
            "anulada" => "Pedido anulado",
            _ => $"Actualización de pedido: {estado}"
        };

        var lineas = new List<string>
        {
            $"Hola {venta.Cliente?.Nombre ?? "cliente"},",
            string.Empty,
            estadoNormalizado == "anulada" ? 
                $"Lamentamos informarte que tu pedido #{venta.Id} ha sido anulado." : 
                $"Tu pedido #{venta.Id} cambió a estado: {estadoVisible}.",
            $"Fecha: {venta.Fecha:yyyy-MM-dd}",
            $"Total: {FormatearQuetzales(venta.Total)}",
            string.Empty,
            "Detalle del pedido:"
        };

        foreach (var detalle in venta.Detalles)
        {
            var nombreProducto = detalle.Producto?.Nombre ?? $"Producto #{detalle.ProductoId}";
            lineas.Add($"- {nombreProducto} x {detalle.Cantidad} = {FormatearQuetzales(detalle.PrecioUnitario * detalle.Cantidad)}");
        }

        lineas.Add(string.Empty);
        lineas.Add("Gracias por comprar en SuperBodega.");

        return (titulo, string.Join(Environment.NewLine, lineas));
    }

    private static string FormatearQuetzales(decimal valor)
        => $"Q{valor.ToString("#,##0.00", CultureInfo.InvariantCulture)}";
}