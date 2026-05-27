using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SuperBodega.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPrecioCompraToProductos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "PrecioCompra",
                table: "Productos",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PrecioCompra",
                table: "Productos");
        }
    }
}
