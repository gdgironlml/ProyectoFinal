using Microsoft.EntityFrameworkCore;
using SuperBodega.API.Models;

namespace SuperBodega.API.Data;

// Contexto principal de Entity Framework.
public class BodegaContext : DbContext
{
    public BodegaContext(DbContextOptions<BodegaContext> options) : base(options)
    {
    }

    // Tablas del negocio.
    public DbSet<Producto> Productos { get; set; } = null!;
    public DbSet<Proveedor> Proveedores { get; set; } = null!;
    public DbSet<Cliente> Clientes { get; set; } = null!;
    public DbSet<Compra> Compras { get; set; } = null!;
    public DbSet<DetalleCompra> DetallesCompra { get; set; } = null!;
    public DbSet<Venta> Ventas { get; set; } = null!;
    public DbSet<DetalleVenta> DetallesVenta { get; set; } = null!;
    public DbSet<Carrito> Carritos { get; set; } = null!;
    public DbSet<CarritoItem> CarritoItems { get; set; } = null!;

// Se crea la estructura de la base de datos en C# gracias a EF Core
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Define precisiones y relaciones para evitar inconsistencias.
        modelBuilder.Entity<Producto>()
            .Property(p => p.Precio)
            .HasColumnType("decimal(18,2)");

        modelBuilder.Entity<Producto>()
            .HasOne(p => p.Proveedor)
            .WithMany()
            .HasForeignKey(p => p.ProveedorId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Venta>()
            .Property(v => v.Total)
            .HasColumnType("decimal(18,2)");

        modelBuilder.Entity<DetalleVenta>()
            .Property(dv => dv.PrecioUnitario)
            .HasColumnType("decimal(18,2)");

        modelBuilder.Entity<DetalleCompra>()
            .Property(dc => dc.PrecioUnitario)
            .HasColumnType("decimal(18,2)");

        modelBuilder.Entity<DetalleCompra>()
            .HasOne(dc => dc.Producto)
            .WithMany()
            .HasForeignKey(dc => dc.ProductoId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<DetalleVenta>()
            .HasOne(dv => dv.Producto)
            .WithMany()
            .HasForeignKey(dv => dv.ProductoId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
