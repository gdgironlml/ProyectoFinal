using MassTransit;
using SuperBodega.API.Data;
using SuperBodega.API.Messages;
using SuperBodega.API.Models;
using SuperBodega.API.Services;
using Microsoft.EntityFrameworkCore;

namespace SuperBodega.API.Consumers;

public class VentaConsumer : IConsumer<VentaRealizadaEvent>
{
    private readonly InventarioService _inventarioService;
    private readonly BodegaContext _context;
    private readonly ILogger<VentaConsumer> _logger;

    public VentaConsumer(InventarioService inventarioService, BodegaContext context, ILogger<VentaConsumer> logger)
    {
        _inventarioService = inventarioService;
        _context = context;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<VentaRealizadaEvent> context)
    {
        try
        {
            var mensaje = context.Message;

            var clienteExiste = await _context.Clientes.AnyAsync(c => c.Id == mensaje.ClienteId);
            if (!clienteExiste)
            {
                _logger.LogError("La venta {MessageId} no se procesó porque el ClienteId {ClienteId} no existe en la base de datos.", context.MessageId, mensaje.ClienteId);
                throw new InvalidOperationException($"El cliente con ID {mensaje.ClienteId} no existe en la base de datos.");
            }

            var venta = new Venta
            {
                ClienteId = mensaje.ClienteId,
                Fecha = mensaje.Fecha,
                Total = mensaje.Total,
                Detalles = mensaje.Detalles.Select(detalle => new DetalleVenta
                {
                    ProductoId = detalle.ProductoId,
                    Cantidad = detalle.Cantidad,
                    PrecioUnitario = detalle.PrecioUnitario
                }).ToList()
            };

            await _inventarioService.RegistrarVentaAsync(venta);
        }
        catch (StockInsuficienteException ex)
        {
            _logger.LogWarning(ex, "La venta {MessageId} no se procesó por stock insuficiente.", context.MessageId);
        }
        catch (ProductoNoEncontradoException ex)
        {
            _logger.LogWarning(ex, "La venta {MessageId} no se procesó porque falta un producto.", context.MessageId);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "La venta {MessageId} no se procesó porque el cliente no existe.", context.MessageId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error inesperado al procesar la venta {MessageId}.", context.MessageId);
            throw;
        }
    }
}