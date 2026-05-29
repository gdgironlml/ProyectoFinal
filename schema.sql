IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
CREATE TABLE [Clientes] (
    [Id] int NOT NULL IDENTITY,
    [Nombre] nvarchar(max) NOT NULL,
    [Telefono] nvarchar(max) NULL,
    [Email] nvarchar(max) NULL,
    CONSTRAINT [PK_Clientes] PRIMARY KEY ([Id])
);

CREATE TABLE [Productos] (
    [Id] int NOT NULL IDENTITY,
    [Nombre] nvarchar(max) NOT NULL,
    [Descripcion] nvarchar(max) NULL,
    [Precio] decimal(18,2) NOT NULL,
    [Stock] int NOT NULL,
    CONSTRAINT [PK_Productos] PRIMARY KEY ([Id])
);

CREATE TABLE [Proveedores] (
    [Id] int NOT NULL IDENTITY,
    [Nombre] nvarchar(max) NOT NULL,
    [Telefono] nvarchar(max) NULL,
    [Email] nvarchar(max) NULL,
    CONSTRAINT [PK_Proveedores] PRIMARY KEY ([Id])
);

CREATE TABLE [Ventas] (
    [Id] int NOT NULL IDENTITY,
    [Fecha] datetime2 NOT NULL,
    [ClienteId] int NOT NULL,
    [Total] decimal(18,2) NOT NULL,
    CONSTRAINT [PK_Ventas] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Ventas_Clientes_ClienteId] FOREIGN KEY ([ClienteId]) REFERENCES [Clientes] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [Compras] (
    [Id] int NOT NULL IDENTITY,
    [Fecha] datetime2 NOT NULL,
    [ProveedorId] int NOT NULL,
    [Total] decimal(18,2) NOT NULL,
    CONSTRAINT [PK_Compras] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Compras_Proveedores_ProveedorId] FOREIGN KEY ([ProveedorId]) REFERENCES [Proveedores] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [DetallesVenta] (
    [Id] int NOT NULL IDENTITY,
    [VentaId] int NOT NULL,
    [ProductoId] int NOT NULL,
    [Cantidad] int NOT NULL,
    [PrecioUnitario] decimal(18,2) NOT NULL,
    CONSTRAINT [PK_DetallesVenta] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_DetallesVenta_Productos_ProductoId] FOREIGN KEY ([ProductoId]) REFERENCES [Productos] ([Id]) ON DELETE NO ACTION,
    CONSTRAINT [FK_DetallesVenta_Ventas_VentaId] FOREIGN KEY ([VentaId]) REFERENCES [Ventas] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [DetallesCompra] (
    [Id] int NOT NULL IDENTITY,
    [CompraId] int NOT NULL,
    [ProductoId] int NOT NULL,
    [Cantidad] int NOT NULL,
    [PrecioUnitario] decimal(18,2) NOT NULL,
    CONSTRAINT [PK_DetallesCompra] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_DetallesCompra_Compras_CompraId] FOREIGN KEY ([CompraId]) REFERENCES [Compras] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_DetallesCompra_Productos_ProductoId] FOREIGN KEY ([ProductoId]) REFERENCES [Productos] ([Id]) ON DELETE NO ACTION
);

CREATE INDEX [IX_Compras_ProveedorId] ON [Compras] ([ProveedorId]);

CREATE INDEX [IX_DetallesCompra_CompraId] ON [DetallesCompra] ([CompraId]);

CREATE INDEX [IX_DetallesCompra_ProductoId] ON [DetallesCompra] ([ProductoId]);

CREATE INDEX [IX_DetallesVenta_ProductoId] ON [DetallesVenta] ([ProductoId]);

CREATE INDEX [IX_DetallesVenta_VentaId] ON [DetallesVenta] ([VentaId]);

CREATE INDEX [IX_Ventas_ClienteId] ON [Ventas] ([ClienteId]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260429043948_InitialCreate', N'10.0.7');

COMMIT;
GO

BEGIN TRANSACTION;
ALTER TABLE [Productos] ADD [Activo] bit NOT NULL DEFAULT CAST(1 AS bit);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260429121500_AddProductoActivo', N'10.0.7');

COMMIT;
GO

BEGIN TRANSACTION;
ALTER TABLE [Ventas] ADD [Estado] nvarchar(max) NOT NULL DEFAULT N'';

ALTER TABLE [Compras] ADD [Estado] nvarchar(max) NOT NULL DEFAULT N'';

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260513172919_AddEstadosComprasVentas', N'10.0.7');

COMMIT;
GO

BEGIN TRANSACTION;
INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260513174934_AddEstadoVentas', N'10.0.7');

COMMIT;
GO

BEGIN TRANSACTION;
ALTER TABLE [Productos] ADD [Categoria] nvarchar(max) NULL;

CREATE TABLE [Carritos] (
    [Id] int NOT NULL IDENTITY,
    [ClienteId] int NOT NULL,
    [FechaCreacion] datetime2 NOT NULL,
    CONSTRAINT [PK_Carritos] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Carritos_Clientes_ClienteId] FOREIGN KEY ([ClienteId]) REFERENCES [Clientes] ([Id]) ON DELETE CASCADE
);

CREATE TABLE [CarritoItems] (
    [Id] int NOT NULL IDENTITY,
    [CarritoId] int NOT NULL,
    [ProductoId] int NOT NULL,
    [Cantidad] int NOT NULL,
    CONSTRAINT [PK_CarritoItems] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_CarritoItems_Carritos_CarritoId] FOREIGN KEY ([CarritoId]) REFERENCES [Carritos] ([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_CarritoItems_Productos_ProductoId] FOREIGN KEY ([ProductoId]) REFERENCES [Productos] ([Id]) ON DELETE CASCADE
);

CREATE INDEX [IX_CarritoItems_CarritoId] ON [CarritoItems] ([CarritoId]);

CREATE INDEX [IX_CarritoItems_ProductoId] ON [CarritoItems] ([ProductoId]);

CREATE INDEX [IX_Carritos_ClienteId] ON [Carritos] ([ClienteId]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260514170722_AddCategoriaAndCarrito', N'10.0.7');

COMMIT;
GO

BEGIN TRANSACTION;
ALTER TABLE [Productos] ADD [ProveedorId] int NULL;

CREATE INDEX [IX_Productos_ProveedorId] ON [Productos] ([ProveedorId]);

ALTER TABLE [Productos] ADD CONSTRAINT [FK_Productos_Proveedores_ProveedorId] FOREIGN KEY ([ProveedorId]) REFERENCES [Proveedores] ([Id]) ON DELETE NO ACTION;

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260518181726_AddProveedorIdToProductos', N'10.0.7');

COMMIT;
GO

BEGIN TRANSACTION;
DECLARE @var nvarchar(max);
SELECT @var = QUOTENAME([d].[name])
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Productos]') AND [c].[name] = N'ProveedorId');
IF @var IS NOT NULL EXEC(N'ALTER TABLE [Productos] DROP CONSTRAINT ' + @var + ';');
ALTER TABLE [Productos] ALTER COLUMN [ProveedorId] int NULL;

DROP INDEX [IX_Compras_ProveedorId] ON [Compras];
DECLARE @var1 nvarchar(max);
SELECT @var1 = QUOTENAME([d].[name])
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Compras]') AND [c].[name] = N'ProveedorId');
IF @var1 IS NOT NULL EXEC(N'ALTER TABLE [Compras] DROP CONSTRAINT ' + @var1 + ';');
UPDATE [Compras] SET [ProveedorId] = 0 WHERE [ProveedorId] IS NULL;
ALTER TABLE [Compras] ALTER COLUMN [ProveedorId] int NOT NULL;
ALTER TABLE [Compras] ADD DEFAULT 0 FOR [ProveedorId];
CREATE INDEX [IX_Compras_ProveedorId] ON [Compras] ([ProveedorId]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260518181833_ReconcileProductoProveedor', N'10.0.7');

COMMIT;
GO

BEGIN TRANSACTION;
ALTER TABLE [Productos] ADD [PrecioCompra] decimal(18,2) NOT NULL DEFAULT 0.0;

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260519195021_AddPrecioCompraToProductos', N'10.0.7');

COMMIT;
GO

