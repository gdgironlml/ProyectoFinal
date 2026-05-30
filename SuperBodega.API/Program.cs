using Microsoft.EntityFrameworkCore;
using MassTransit;
using SuperBodega.API.Data;
using SuperBodega.API.Consumers;
using SuperBodega.API.Services.Notifications;
using SuperBodega.API.Services;
 
var builder = WebApplication.CreateBuilder(args);

// Configuracion base de la API.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Permite acceso desde el frontend y las pruebas.
builder.Services.AddCors(options =>
{
    options.AddPolicy("PermitirTodo", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var rabbitMqHost = Environment.GetEnvironmentVariable("RabbitMQ__Host") ?? "localhost";
var rabbitMqUsername = Environment.GetEnvironmentVariable("RabbitMQ__Username") ?? "user";
var rabbitMqPassword = Environment.GetEnvironmentVariable("RabbitMQ__Password") ?? "password";

// RabbitMQ mueve eventos de ventas y notificaciones.
builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<VentaConsumer>();
    x.AddConsumer<PedidoNotificationConsumer>();

    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host(rabbitMqHost, "/", h =>
        {
            h.Username(rabbitMqUsername);
            h.Password(rabbitMqPassword);
        });

        cfg.ReceiveEndpoint("ventas-realizadas", e =>
        {
            e.UseMessageRetry(r =>
            {
                r.Ignore<StockInsuficienteException>();
                r.Interval(3, TimeSpan.FromSeconds(5));
            });

            e.ConfigureConsumer<VentaConsumer>(context);

        });

        cfg.ReceiveEndpoint("notificaciones-pedidos", e =>
        {
            e.UseMessageRetry(r => r.Interval(3, TimeSpan.FromSeconds(5)));
            e.ConfigureConsumer<PedidoNotificationConsumer>(context);
        });
    });
});

// Toma la conexion de SQL Server desde configuracion.
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Server=localhost;Database=SuperBodegaDB;User Id=sa;Password=SecurePassword;TrustServerCertificate=True;";
builder.Services.AddDbContext<BodegaContext>(options => options.UseSqlServer(connectionString));
builder.Services.AddScoped<InventarioService>();
builder.Services.AddScoped<IEmailNotificationService, EmailNotificationService>();

var app = builder.Build();

// Ejecuta migraciones al arrancar.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<BodegaContext>();
    db.Database.Migrate();
}

// Publica la documentacion Swagger.
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "SuperBodega API V1");
    c.RoutePrefix = string.Empty;
});

app.UseHttpsRedirection();

// Habilita rutas y CORS.
app.UseRouting();

app.UseCors("PermitirTodo");

app.MapControllers();

app.Run();
