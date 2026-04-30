using Microsoft.EntityFrameworkCore;
using MassTransit;
using SuperBodega.API.Data;
using SuperBodega.API.Consumers;
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

builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<VentaConsumer>();

    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host("localhost", "/", h =>
        {
            h.Username("user");
            h.Password("password");
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
    });
});

// Connection string to SQL Server in Docker
var connectionString = "Server=localhost;Database=SuperBodegaDB;User Id=sa;Password=ProyectoUMG2026!;TrustServerCertificate=True;";
builder.Services.AddDbContext<BodegaContext>(options => options.UseSqlServer(connectionString));
builder.Services.AddScoped<InventarioService>();

var app = builder.Build();

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
