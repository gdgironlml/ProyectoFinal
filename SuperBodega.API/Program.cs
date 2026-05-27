using Microsoft.EntityFrameworkCore;
using MassTransit;
using SuperBodega.API.Data;
using SuperBodega.API.Consumers;
using SuperBodega.API.Services.Notifications;
using SuperBodega.API.Services;
 
var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure CORS
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

            // MassTransit mueve los mensajes fallidos a la cola específica del endpoint: ventas-realizadas_error.
        });

        cfg.ReceiveEndpoint("notificaciones-pedidos", e =>
        {
            e.UseMessageRetry(r => r.Interval(3, TimeSpan.FromSeconds(5)));
            e.ConfigureConsumer<PedidoNotificationConsumer>(context);
        });
    });
});

// Connection string to SQL Server
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Server=localhost;Database=SuperBodegaDB;User Id=sa;Password=SecurePassword;TrustServerCertificate=True;";
builder.Services.AddDbContext<BodegaContext>(options => options.UseSqlServer(connectionString));
builder.Services.AddScoped<InventarioService>();
builder.Services.AddScoped<IEmailNotificationService, EmailNotificationService>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<BodegaContext>();
    db.Database.Migrate();
}

// Configure the HTTP request pipeline.
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "SuperBodega API V1");
    c.RoutePrefix = string.Empty;
});

app.UseHttpsRedirection();

app.UseRouting();

// Use CORS
app.UseCors("PermitirTodo");

app.MapControllers();

app.Run();
