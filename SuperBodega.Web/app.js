// En Netlify, usar ruta relativa para que _redirects haga proxy al backend en Azure.
const API_BASE = '/api';

const state = {
    productos: [],
    clientes: [],
    proveedores: [],
    compras: [],
    ventas: []
};

const CATEGORY_OPTIONS = [
    'Abarrotes',
    'Bebidas',
    'Lacteos',
    'Limpieza',
    'Hogar',
    'Snacks',
    'Frutas y verduras',
    'Carnes',
    'Panaderia',
    'Otros'
];

let compraRowCounter = 0;
let ventaRowCounter = 0;

const alertContainer = document.getElementById('alertContainer');

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showAlert(message, type = 'success') {
    alertContainer.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${escapeHtml(message)}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
        </div>
    `;
}

function setStatus(id, text) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = text;
    }
}

function formatMoney(value) {
    return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(Number(value ?? 0));
}

function categoryOptions(selectedValue = '') {
    return ['<option value="">Seleccione una categoría</option>']
        .concat(CATEGORY_OPTIONS.map((category) => `<option value="${escapeHtml(category)}" ${category === selectedValue ? 'selected' : ''}>${escapeHtml(category)}</option>`))
        .join('');
}

function getClientById(id) {
    return state.clientes.find((client) => Number(client.id) === Number(id));
}

function getProviderById(id) {
    return state.proveedores.find((provider) => Number(provider.id) === Number(id));
}

function getProductById(id) {
    return state.productos.find((product) => Number(product.id) === Number(id));
}

function formatContact(entity) {
    if (!entity) return '';
    const parts = [];
    if (entity.telefono) parts.push(`Tel: ${entity.telefono}`);
    if (entity.email) parts.push(`Email: ${entity.email}`);
    return parts.join(' · ');
}

function partyDisplay(entity, fallbackId) {
    const data = entity || { id: fallbackId, nombre: `ID ${fallbackId}` };
    const contact = formatContact(data);
    return `
        <div>
            <div class="fw-semibold">#${escapeHtml(data.id)} - ${escapeHtml(data.nombre || `ID ${fallbackId}`)}</div>
            ${contact ? `<div class="small text-muted">${escapeHtml(contact)}</div>` : ''}
        </div>
    `;
}

function productDisplay(product) {
    return `#${product.id} - ${product.nombre} · Stock: ${product.stock}`;
}

function saleStateButtons(id, state) {
    const s = state || 'Registrada';

    if (s === 'Anulada') {
        return `
            <button class="btn btn-sm btn-outline-primary me-1 btn-editar-venta" data-id="${id}">Editar</button>
            <button class="btn btn-sm btn-outline-success me-1 btn-cambiar-estado-venta" data-id="${id}" data-estado="Registrada">Restaurar</button>
            <button class="btn btn-sm btn-outline-danger btn-eliminar-venta" data-id="${id}">Eliminar</button>
        `;
    }

    let actionBtn = '';
    if (s === 'Registrada') {
        actionBtn = `<button class="btn btn-sm btn-outline-info me-1 btn-cambiar-estado-venta" data-id="${id}" data-estado="Despachada">Despachar</button>`;
    } else if (s === 'Despachada') {
        actionBtn = `<button class="btn btn-sm btn-outline-success me-1 btn-cambiar-estado-venta" data-id="${id}" data-estado="Entregada">Entregar</button>`;
    }

    return `
        <button class="btn btn-sm btn-outline-primary me-1 btn-editar-venta" data-id="${id}">Editar</button>
        ${actionBtn}
        <button class="btn btn-sm btn-outline-warning me-1 btn-cambiar-estado-venta" data-id="${id}" data-estado="Anulada">Anular</button>
        <button class="btn btn-sm btn-outline-danger btn-eliminar-venta" data-id="${id}">Eliminar</button>
    `;
}

function availableProducts(query = '') {
    const normalized = query.trim().toLowerCase();
    return state.productos.filter((product) => {
        if (Number(product.stock) <= 0 || product.activo === false) return false;
        if (!normalized) return true;
        return [product.id, product.nombre, product.descripcion || '', product.stock, product.precio]
            .join(' ')
            .toLowerCase()
            .includes(normalized);
    });
}

function getPurchaseProviderId() {
    return Number(document.getElementById('compraProveedorId')?.value || 0);
}

function availablePurchaseProducts(query = '') {
    const providerId = getPurchaseProviderId();
    const normalized = query.trim().toLowerCase();

    return state.productos.filter((product) => {
        if (Number(product.stock) <= 0 || product.activo === false) return false;
        if (!providerId || Number(product.proveedorId || 0) !== providerId) return false;
        if (!normalized) return true;
        return [product.id, product.nombre, product.descripcion || '', product.stock, product.precio]
            .join(' ')
            .toLowerCase()
            .includes(normalized);
    });
}

function renderEmptyRow(bodyId, colspan, message, type = 'info') {
    document.getElementById(bodyId).innerHTML = `
        <tr>
            <td colspan="${colspan}">
                <div class="alert alert-${type} mb-0 py-2">${escapeHtml(message)}</div>
            </td>
        </tr>
    `;
}

async function apiFetch(endpoint, options = {}, action = 'realizar la solicitud') {
    const method = (options.method || 'GET').toUpperCase();
    const config = {
        ...options,
        method,
        headers: {
            ...(options.headers || {})
        }
    };

    if (method !== 'GET' && method !== 'HEAD') {
        config.headers['Content-Type'] = 'application/json';
    }

    let response;
    try {
        response = await fetch(`${API_BASE}${endpoint}`, config);
    } catch {
        throw new Error(`Error de conexión al ${action}. Verifica la API en ${API_BASE}.`);
    }

    if (!response.ok) {
        let detail = '';
        try {
            detail = await response.text();
        } catch {
            detail = '';
        }
        const suffix = detail ? ` - ${detail.replace(/\s+/g, ' ').trim()}` : '';
        throw new Error(`No fue posible ${action} (HTTP ${response.status})${suffix}`);
    }

    if (response.status === 204) {
        return null;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

function productOptions(selectedId = '') {
    return ['<option value="">Seleccione...</option>']
        .concat(state.productos.map((p) => `<option value="${p.id}" ${Number(selectedId) === Number(p.id) ? 'selected' : ''}>#${p.id} - ${escapeHtml(p.nombre)} · Stock: ${p.stock}</option>`))
        .join('');
}

function clientOptions(selectedId = '') {
    return ['<option value="">Seleccione...</option>']
        .concat(state.clientes.map((c) => {
            const contact = formatContact(c);
            const label = `#${c.id} - ${c.nombre}${contact ? ` | ${contact}` : ''}`;
            return `<option value="${c.id}" ${Number(selectedId) === Number(c.id) ? 'selected' : ''}>${escapeHtml(label)}</option>`;
        }))
        .join('');
}

function providerOptions(selectedId = '') {
    return ['<option value="">Seleccione...</option>']
        .concat(state.proveedores.map((p) => {
            const contact = formatContact(p);
            const label = `#${p.id} - ${p.nombre}${contact ? ` | ${contact}` : ''}`;
            return `<option value="${p.id}" ${Number(selectedId) === Number(p.id) ? 'selected' : ''}>${escapeHtml(label)}</option>`;
        }))
        .join('');
}

function saleProductOptions(selectedId = '', query = '') {
    const selected = selectedId ? getProductById(selectedId) : null;
    const filtered = availableProducts(query);
    if (selected && !filtered.some((product) => Number(product.id) === Number(selected.id))) {
        filtered.unshift(selected);
    }

    return ['<option value="">Seleccione...</option>']
        .concat(filtered.map((product) => `<option value="${product.id}" ${Number(selectedId) === Number(product.id) ? 'selected' : ''}>${escapeHtml(productDisplay(product))}</option>`))
        .join('');
}

function purchaseProductOptions(selectedId = '', query = '') {
    const providerId = getPurchaseProviderId();

    if (!providerId) {
        return '<option value="">Seleccione un proveedor primero...</option>';
    }

    const selected = selectedId ? getProductById(selectedId) : null;
    const filtered = availablePurchaseProducts(query);

    if (selected && Number(selected.proveedorId || 0) === providerId && !filtered.some((product) => Number(product.id) === Number(selected.id))) {
        filtered.unshift(selected);
    }

    return ['<option value="">Seleccione...</option>']
        .concat(filtered.map((product) => `<option value="${product.id}" ${Number(selectedId) === Number(product.id) ? 'selected' : ''}>${escapeHtml(productDisplay(product))}</option>`))
        .join('');
}

function detailPurchaseRow(detail = {}) {
    const id = `compra-row-${++compraRowCounter}`;
    const isNew = detail.productoId === 0 && !detail.producto?.id;
    const selectedProduct = detail.producto || getProductById(detail.productoId);
    const searchValue = selectedProduct ? selectedProduct.nombre : '';
    const locked = !isNew && !!selectedProduct;

    return `
        <div class="border rounded-3 p-3 mb-3 compra-detail-row" data-row-id="${id}">
            <!-- Fila 1: Tipo y Cantidad/Precio -->
            <div class="row g-2 mb-3 align-items-end">
                <div class="col-md-2">
                    <label class="form-label fw-bold">Tipo</label>
                    <select class="form-select compra-modo">
                        <option value="existing" ${isNew ? '' : 'selected'}>Existente</option>
                        <option value="new" ${isNew ? 'selected' : ''}>Nuevo</option>
                    </select>
                </div>
                <div class="col-md-2">
                    <label class="form-label fw-bold">Cantidad</label>
                    <input type="number" min="1" class="form-control compra-cantidad" value="${detail.cantidad ?? 1}">
                </div>
                <div class="col-md-2">
                    <label class="form-label fw-bold">Precio U.</label>
                    <input type="number" min="0" step="0.01" class="form-control compra-precio" value="${detail.precioUnitario ?? selectedProduct?.precioCompra ?? 0}">
                </div>
                <div class="col-md-4"></div>
                <div class="col-md-2 text-end">
                    <button type="button" class="btn btn-outline-danger btn-sm btn-remove-compra-detalle w-100">Quitar</button>
                </div>
            </div>
            
            <!-- Fila 2: Producto Existente (solo visible si tipo = existing) -->
            <div class="compra-existing-group ${isNew ? 'd-none' : ''}">
                <div class="row g-2 mb-3 align-items-end">
                    <div class="col-md-6">
                        <label class="form-label">Buscar producto</label>
                        <input type="text" class="form-control compra-producto-search" value="${escapeHtml(searchValue)}" placeholder="Ingrese nombre del producto..." ${locked ? 'readonly' : ''}>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">Seleccione producto</label>
                        <select class="form-select compra-producto-id" ${locked ? 'disabled' : ''}>${purchaseProductOptions(detail.productoId || '', searchValue)}</select>
                    </div>
                </div>
            </div>
            
            <!-- Fila 3: Nuevo Producto (solo visible si tipo = new) -->
            <div class="compra-new-group ${isNew ? '' : 'd-none'}">
                <div class="row g-2 align-items-end">
                    <div class="col-md-6">
                        <label class="form-label">Nombre del producto</label>
                        <input type="text" class="form-control compra-producto-nombre" value="${escapeHtml(detail.producto?.nombre || '')}" placeholder="Ingrese nombre..." ${locked ? 'readonly' : ''}>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">Descripción</label>
                        <input type="text" class="form-control compra-producto-descripcion" value="${escapeHtml(detail.producto?.descripcion || '')}" placeholder="Ingrese descripción..." ${locked ? 'readonly' : ''}>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">Categoría</label>
                        <select class="form-select compra-producto-categoria" ${locked ? 'disabled' : ''}>${categoryOptions(detail.producto?.categoria || '')}</select>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">Precio Venta</label>
                        <input type="number" min="0" step="0.01" class="form-control compra-producto-precio-venta" value="${detail.producto?.precio ?? 0}" ${locked ? 'readonly' : ''}>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function detailSaleRow(detail = {}) {
    const id = `venta-row-${++ventaRowCounter}`;
    const selectedProduct = detail.producto || getProductById(detail.productoId);
    const searchValue = selectedProduct ? selectedProduct.nombre : '';
    return `
        <div class="border rounded-3 p-3 mb-2 venta-detail-row" data-row-id="${id}">
            <div class="row g-2 align-items-end">
                <div class="col-md-5">
                    <label class="form-label">Buscar producto</label>
                    <input type="text" class="form-control venta-producto-search" value="${escapeHtml(searchValue)}" placeholder="Escribe nombre, ID o stock">
                </div>
                <div class="col-md-5">
                    <label class="form-label">Producto disponible</label>
                    <select class="form-select venta-producto-id">${saleProductOptions(detail.productoId || '', searchValue)}</select>
                </div>
                <div class="col-md-3">
                    <label class="form-label">Cantidad</label>
                    <input type="number" min="1" class="form-control venta-cantidad" value="${detail.cantidad ?? 1}">
                </div>
                <div class="col-md-3">
                    <label class="form-label">Precio unitario</label>
                    <input type="number" min="0" step="0.01" class="form-control venta-precio" value="${detail.precioUnitario ?? (selectedProduct?.precio ?? 0)}" readonly>
                </div>
                <div class="col-md-1 text-end">
                    <button type="button" class="btn btn-outline-danger btn-sm btn-remove-venta-detalle">Quitar</button>
                </div>
            </div>
        </div>
    `;
}

function readCompraDetails() {
    const rows = [...document.querySelectorAll('.compra-detail-row')];
    return rows.map((row) => {
        const modo = row.querySelector('.compra-modo')?.value || 'existing';
        const cantidad = Number(row.querySelector('.compra-cantidad').value);
        const precioUnitario = Number(row.querySelector('.compra-precio').value);

        if (modo === 'new') {
            const nombre = row.querySelector('.compra-producto-nombre').value.trim();
            const descripcion = row.querySelector('.compra-producto-descripcion').value.trim() || null;
            const categoria = row.querySelector('.compra-producto-categoria').value || null;
            const precioVenta = Number(row.querySelector('.compra-producto-precio-venta').value);
            return {
                productoId: 0,
                cantidad,
                precioUnitario,
                producto: {
                    nombre,
                    descripcion,
                    categoria,
                    precioCompra: precioUnitario,
                    precio: precioVenta,
                    stock: 0,
                    activo: true
                }
            };
        }

        return {
            productoId: Number(row.querySelector('.compra-producto-id').value),
            cantidad,
            precioUnitario
        };
    }).filter((detail) => detail.cantidad > 0 && (detail.productoId > 0 || detail.producto?.nombre));
}

function readVentaDetails() {
    const rows = [...document.querySelectorAll('.venta-detail-row')];
    return rows.map((row) => ({
        productoId: Number(row.querySelector('.venta-producto-id').value),
        cantidad: Number(row.querySelector('.venta-cantidad').value),
        precioUnitario: Number(row.querySelector('.venta-precio').value)
    })).filter((detail) => detail.productoId > 0 && detail.cantidad > 0);
}

function calculateTotal(details) {
    return details.reduce((sum, detail) => sum + (Number(detail.cantidad) * Number(detail.precioUnitario)), 0);
}

function resetProductForm() {
    document.getElementById('productoId').value = '';
    document.getElementById('productoNombre').value = '';
    document.getElementById('productoDescripcion').value = '';
    document.getElementById('productoCategoria').value = '';
    document.getElementById('productoPrecioCompra').value = '';
    document.getElementById('productoPrecio').value = '';
    document.getElementById('productoStock').value = '';
    document.getElementById('productoActivo').value = 'true';
    document.getElementById('productoGuardarBtn').textContent = 'Guardar';
}

function resetClientForm() {
    document.getElementById('clienteId').value = '';
    document.getElementById('clienteNombre').value = '';
    document.getElementById('clienteTelefono').value = '';
    document.getElementById('clienteEmail').value = '';
    document.getElementById('clienteGuardarBtn').textContent = 'Guardar';
}

function resetProviderForm() {
    document.getElementById('proveedorId').value = '';
    document.getElementById('proveedorNombre').value = '';
    document.getElementById('proveedorTelefono').value = '';
    document.getElementById('proveedorEmail').value = '';
    document.getElementById('proveedorGuardarBtn').textContent = 'Guardar';
}

function resetCompraForm() {
    document.getElementById('compraId').value = '';
    document.getElementById('compraFecha').value = '';
    document.getElementById('compraModoProveedor').value = 'existing';
    document.getElementById('compraProveedorId').value = '';
    document.getElementById('compraProveedorId').required = true;
    document.getElementById('compraModoProveedor').disabled = false;
    document.getElementById('compraProveedorId').disabled = false;
    document.getElementById('compraProveedorNombre').value = '';
    document.getElementById('compraProveedorEmail').value = '';
    document.getElementById('compraProveedorTelefono').value = '';
    document.getElementById('compraDetalles').innerHTML = detailPurchaseRow();
    document.getElementById('compraTotal').value = '0.00';
    document.getElementById('compraGuardarBtn').textContent = 'Guardar';
    
    // Mostrar/ocultar grupos de proveedor
    document.querySelectorAll('.compra-proveedor-existing-group').forEach((el) => el.classList.remove('d-none'));
    document.querySelectorAll('.compra-proveedor-new-group').forEach((el) => el.classList.add('d-none'));
}

function setCompraEditState(isEditing, providerId = '') {
    const modoProveedor = document.getElementById('compraModoProveedor');
    const proveedorId = document.getElementById('compraProveedorId');
    const existingGroups = document.querySelectorAll('.compra-proveedor-existing-group');
    const newGroups = document.querySelectorAll('.compra-proveedor-new-group');

    if (isEditing) {
        modoProveedor.value = 'existing';
        modoProveedor.disabled = true;
        proveedorId.disabled = true;
        proveedorId.required = false;
        if (providerId) {
            proveedorId.value = String(providerId);
        }
        existingGroups.forEach((el) => el.classList.remove('d-none'));
        newGroups.forEach((el) => el.classList.add('d-none'));
        return;
    }

    modoProveedor.disabled = false;
    proveedorId.disabled = false;
    proveedorId.required = true;
    existingGroups.forEach((el) => el.classList.remove('d-none'));
    newGroups.forEach((el) => el.classList.add('d-none'));
}

function resetVentaForm() {
    document.getElementById('ventaId').value = '';
    document.getElementById('ventaFecha').value = '';
    document.getElementById('ventaClienteId').value = '';
    document.getElementById('ventaDetalles').innerHTML = detailSaleRow();
    document.getElementById('ventaTotal').value = '0.00';
    document.getElementById('ventaGuardarBtn').textContent = 'Guardar';
}

async function loadProductos() {
    setStatus('inventarioStatus', 'Cargando...');
    try {
        state.productos = await apiFetch('/Productos/all', { method: 'GET' }, 'cargar productos');
        const body = document.getElementById('inventarioBody');

        if (!state.productos || state.productos.length === 0) {
            setStatus('inventarioStatus', 'Sin registros');
            renderEmptyRow('inventarioBody', 9, 'No hay productos.');
            return;
        }

        const activos = state.productos.filter((p) => p.activo !== false).length;
        const inactivos = state.productos.length - activos;

        body.innerHTML = state.productos.map((p) => `
            <tr>
                <td>${p.id}</td>
                <td>${escapeHtml(p.nombre)}</td>
                <td>${escapeHtml(p.descripcion || '')}</td>
                <td>${escapeHtml(p.categoria || '')}</td>
                <td>${formatMoney(p.precioCompra || 0)}</td>
                <td>${formatMoney(p.precio)}</td>
                <td>${p.stock}</td>
                <td><span class="badge ${p.activo === false ? 'text-bg-secondary' : 'text-bg-success'}">${p.activo === false ? 'Inactivo' : 'Activo'}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1 btn-editar-producto" data-id="${p.id}">Editar</button>
                    ${p.activo === false
                        ? `<button class="btn btn-sm btn-outline-success btn-activar-producto" data-id="${p.id}">Activar</button>`
                        : `<button class="btn btn-sm btn-outline-danger btn-eliminar-producto" data-id="${p.id}">Desactivar</button>`}
                </td>
            </tr>
        `).join('');

        setStatus('inventarioStatus', `${state.productos.length} registro(s) · ${activos} activos · ${inactivos} inactivos`);
    } catch (error) {
        setStatus('inventarioStatus', 'Error');
        renderEmptyRow('inventarioBody', 8, error.message, 'danger');
        showAlert(error.message, 'danger');
    }
}

async function loadClientes() {
    setStatus('clientesStatus', 'Cargando...');
    try {
        state.clientes = await apiFetch('/Clientes', { method: 'GET' }, 'cargar clientes');
        const body = document.getElementById('clientesBody');

        if (!state.clientes || state.clientes.length === 0) {
            setStatus('clientesStatus', 'Sin registros');
            renderEmptyRow('clientesBody', 5, 'No hay clientes.');
            return;
        }

        body.innerHTML = state.clientes.map((c) => `
            <tr>
                <td>${c.id}</td>
                <td>${escapeHtml(c.nombre)}</td>
                <td>${escapeHtml(c.telefono || '')}</td>
                <td>${escapeHtml(c.email || '')}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1 btn-editar-cliente" data-id="${c.id}">Editar</button>
                    <button class="btn btn-sm btn-outline-danger btn-eliminar-cliente" data-id="${c.id}">Eliminar</button>
                </td>
            </tr>
        `).join('');

        setStatus('clientesStatus', `${state.clientes.length} cliente(s)`);
    } catch (error) {
        setStatus('clientesStatus', 'Error');
        renderEmptyRow('clientesBody', 5, error.message, 'danger');
        showAlert(error.message, 'danger');
    }
}

async function loadProveedores() {
    setStatus('proveedoresStatus', 'Cargando...');
    try {
        state.proveedores = await apiFetch('/Proveedores', { method: 'GET' }, 'cargar proveedores');
        const body = document.getElementById('proveedoresBody');

        if (!state.proveedores || state.proveedores.length === 0) {
            setStatus('proveedoresStatus', 'Sin registros');
            renderEmptyRow('proveedoresBody', 5, 'No hay proveedores.');
            return;
        }

        body.innerHTML = state.proveedores.map((p) => `
            <tr>
                <td>${p.id}</td>
                <td>${escapeHtml(p.nombre)}</td>
                <td>${escapeHtml(p.telefono || '')}</td>
                <td>${escapeHtml(p.email || '')}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1 btn-editar-proveedor" data-id="${p.id}">Editar</button>
                    <button class="btn btn-sm btn-outline-danger btn-eliminar-proveedor" data-id="${p.id}">Eliminar</button>
                </td>
            </tr>
        `).join('');

        setStatus('proveedoresStatus', `${state.proveedores.length} proveedor(es)`);
    } catch (error) {
        setStatus('proveedoresStatus', 'Error');
        renderEmptyRow('proveedoresBody', 5, error.message, 'danger');
        showAlert(error.message, 'danger');
    }
}

async function loadCompras() {
    setStatus('comprasStatus', 'Cargando...');
    try {
        state.compras = await apiFetch('/Compras', { method: 'GET' }, 'cargar compras');
        const body = document.getElementById('comprasBody');

        if (!state.compras || state.compras.length === 0) {
            setStatus('comprasStatus', 'Sin registros');
            renderEmptyRow('comprasBody', 7, 'No hay compras registradas.');
            return;
        }

        body.innerHTML = state.compras.map((c) => {
            const provider = c.proveedor || getProviderById(c.proveedorId);
            return `
            <tr>
                <td>${c.id}</td>
                <td>${escapeHtml(new Date(c.fecha).toLocaleDateString('es-ES'))}</td>
                <td>${partyDisplay(provider, c.proveedorId)}</td>
                <td>${formatMoney(c.total)}</td>
                <td>${(c.detalles || []).map((d) => { const p = getProductById(d.productoId); return `${escapeHtml(p ? p.nombre : String(d.productoId))} x ${d.cantidad}`; }).join('<br>')}</td>
                <td><span class="badge ${c.estado === 'Anulada' ? 'text-bg-danger' : 'text-bg-success'}">${escapeHtml(c.estado || 'Registrada')}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1 btn-editar-compra" data-id="${c.id}">Editar</button>
                    <button class="btn btn-sm btn-outline-warning me-1 btn-cambiar-estado-compra" data-id="${c.id}" data-estado="${c.estado === 'Anulada' ? 'Registrada' : 'Anulada'}">${c.estado === 'Anulada' ? 'Restaurar' : 'Anular'}</button>
                    <button class="btn btn-sm btn-outline-danger btn-eliminar-compra" data-id="${c.id}">Eliminar</button>
                </td>
            </tr>
        `;
        }).join('');

        setStatus('comprasStatus', `${state.compras.length} compra(s)`);
    } catch (error) {
        setStatus('comprasStatus', 'Error');
        renderEmptyRow('comprasBody', 6, error.message, 'danger');
        showAlert(error.message, 'danger');
    }
}

async function loadVentas() {
    setStatus('ventasStatus', 'Cargando...');
    try {
        state.ventas = await apiFetch('/Ventas', { method: 'GET' }, 'cargar ventas');
        const body = document.getElementById('ventasBody');

        if (!state.ventas || state.ventas.length === 0) {
            setStatus('ventasStatus', 'Sin registros');
            renderEmptyRow('ventasBody', 7, 'No hay ventas registradas.');
            return;
        }

        body.innerHTML = state.ventas.map((v) => {
            const client = v.cliente || getClientById(v.clienteId);
            return `
            <tr>
                <td>${v.id}</td>
                <td>${escapeHtml(new Date(v.fecha).toLocaleDateString('es-ES'))}</td>
                <td>${partyDisplay(client, v.clienteId)}</td>
                <td>${formatMoney(v.total)}</td>
                <td>${(v.detalles || []).map((d) => { const p = getProductById(d.productoId); return `${escapeHtml(p ? p.nombre : String(d.productoId))} x ${d.cantidad}`; }).join('<br>')}</td>
                <td><span class="badge ${v.estado === 'Anulada' ? 'text-bg-danger' : 'text-bg-success'}">${escapeHtml(v.estado || 'Registrada')}</span></td>
                <td>
                    <div class="d-flex flex-wrap gap-1">
                        ${saleStateButtons(v.id, v.estado)}
                    </div>
                </td>
            </tr>
        `;
        }).join('');

        setStatus('ventasStatus', `${state.ventas.length} venta(s)`);
    } catch (error) {
        setStatus('ventasStatus', 'Error');
        renderEmptyRow('ventasBody', 6, error.message, 'danger');
        showAlert(error.message, 'danger');
    }
}

function refreshSelectors() {
    const compraProveedorValue = document.getElementById('compraProveedorId')?.value || '';
    const ventaClienteValue = document.getElementById('ventaClienteId')?.value || '';
    const reporteProductoValue = document.getElementById('reporteProductoId')?.value || '';
    const reporteClienteValue = document.getElementById('reporteClienteId')?.value || '';
    const reporteProveedorValue = document.getElementById('reporteProveedorId')?.value || '';

    const compraProveedor = document.getElementById('compraProveedorId');
    const ventaCliente = document.getElementById('ventaClienteId');
    const reporteProducto = document.getElementById('reporteProductoId');
    const reporteCliente = document.getElementById('reporteClienteId');
    const reporteProveedor = document.getElementById('reporteProveedorId');

    if (compraProveedor) {
        compraProveedor.innerHTML = providerOptions(compraProveedorValue);
        compraProveedor.value = compraProveedorValue;
    }
    if (ventaCliente) {
        ventaCliente.innerHTML = clientOptions(ventaClienteValue);
        ventaCliente.value = ventaClienteValue;
    }
    if (reporteProducto) {
        reporteProducto.innerHTML = productOptions(reporteProductoValue);
        reporteProducto.value = reporteProductoValue;
    }
    if (reporteCliente) {
        reporteCliente.innerHTML = clientOptions(reporteClienteValue);
        reporteCliente.value = reporteClienteValue;
    }
    if (reporteProveedor) {
        reporteProveedor.innerHTML = providerOptions(reporteProveedorValue);
        reporteProveedor.value = reporteProveedorValue;
    }
}

function refreshSaleProductSelectors() {
    document.querySelectorAll('.venta-detail-row').forEach((row) => {
        const search = row.querySelector('.venta-producto-search');
        const select = row.querySelector('.venta-producto-id');
        if (!select) return;
        select.innerHTML = saleProductOptions(select.value, search ? search.value : '');
    });
}

function refreshPurchaseProductSelectors() {
    document.querySelectorAll('.compra-detail-row').forEach((row) => {
        const search = row.querySelector('.compra-producto-search');
        const select = row.querySelector('.compra-producto-id');
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = purchaseProductOptions(currentValue, search ? search.value : '');

        if (currentValue && ![...select.options].some((option) => Number(option.value) === Number(currentValue))) {
            select.value = '';
            if (search) search.value = '';
        }
    });
}

function refreshDetailRows() {
    const compraContainer = document.getElementById('compraDetalles');
    const ventaContainer = document.getElementById('ventaDetalles');
    if (!compraContainer.children.length) {
        compraContainer.innerHTML = detailPurchaseRow();
    }
    if (!ventaContainer.children.length) {
        ventaContainer.innerHTML = detailSaleRow();
    }
}

function updatePurchaseTotal() {
    const details = readCompraDetails();
    document.getElementById('compraTotal').value = calculateTotal(details).toFixed(2);
}

function updateSaleTotal() {
    const details = readVentaDetails();
    document.getElementById('ventaTotal').value = calculateTotal(details).toFixed(2);
}

async function loadAll() {
    await Promise.all([
        loadProductos(),
        loadClientes(),
        loadProveedores()
    ]);
    await Promise.all([
        loadCompras(),
        loadVentas()
    ]);
    refreshSelectors();
    refreshDetailRows();
    refreshSaleProductSelectors();
}

async function onInventarioClick(event) {
    const editBtn = event.target.closest('.btn-editar-producto');
    const delBtn = event.target.closest('.btn-eliminar-producto');
    const activateBtn = event.target.closest('.btn-activar-producto');

    if (editBtn) {
        const id = Number(editBtn.dataset.id);
        try {
            const p = await apiFetch(`/Productos/${id}`, { method: 'GET' }, 'obtener producto');
            document.getElementById('productoId').value = p.id;
            document.getElementById('productoNombre').value = p.nombre || '';
            document.getElementById('productoDescripcion').value = p.descripcion || '';
            document.getElementById('productoCategoria').value = p.categoria || '';
            document.getElementById('productoPrecioCompra').value = p.precioCompra || 0;
            document.getElementById('productoPrecio').value = p.precio;
            document.getElementById('productoStock').value = p.stock;
            document.getElementById('productoActivo').value = String(Boolean(p.activo));
            document.getElementById('productoGuardarBtn').textContent = 'Actualizar';
            showAlert(`Producto #${id} listo para editar.`, 'info');
        } catch (error) {
            showAlert(error.message, 'danger');
        }
        return;
    }

    if (delBtn) {
        const id = Number(delBtn.dataset.id);
        const ok = confirm(`¿Deseas desactivar el producto #${id}?`);
        if (!ok) return;

        try {
            await apiFetch(`/Productos/${id}`, { method: 'DELETE' }, 'desactivar producto');
            showAlert('Producto desactivado.', 'success');
            await loadAll();
        } catch (error) {
            showAlert(error.message, 'danger');
        }
        return;
    }

    if (activateBtn) {
        const id = Number(activateBtn.dataset.id);
        const ok = confirm(`¿Deseas activar el producto #${id}?`);
        if (!ok) return;

        try {
            const producto = await apiFetch(`/Productos/${id}`, { method: 'GET' }, 'obtener producto');
            await apiFetch(`/Productos/${id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    ...producto,
                    activo: true
                })
            }, 'activar producto');
            showAlert('Producto activado.', 'success');
            await loadAll();
        } catch (error) {
            showAlert(error.message, 'danger');
        }
    }
}

async function onSubmitProducto(event) {
    event.preventDefault();

    const id = document.getElementById('productoId').value;
    const payload = {
        id: id ? Number(id) : 0,
        nombre: document.getElementById('productoNombre').value.trim(),
        descripcion: document.getElementById('productoDescripcion').value.trim() || null,
        categoria: document.getElementById('productoCategoria').value || null,
        precioCompra: Number(document.getElementById('productoPrecioCompra').value),
        precio: Number(document.getElementById('productoPrecio').value),
        stock: Number(document.getElementById('productoStock').value),
        activo: document.getElementById('productoActivo').value === 'true'
    };

    try {
        if (id) {
            await apiFetch(`/Productos/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            }, 'actualizar producto');
            showAlert('Producto actualizado.', 'success');
        } else {
            delete payload.id;
            await apiFetch('/Productos', {
                method: 'POST',
                body: JSON.stringify(payload)
            }, 'crear producto');
            showAlert('Producto creado.', 'success');
        }

        resetProductForm();
        await loadAll();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function onClientesClick(event) {
    const editBtn = event.target.closest('.btn-editar-cliente');
    const delBtn = event.target.closest('.btn-eliminar-cliente');

    if (editBtn) {
        const id = Number(editBtn.dataset.id);
        const cliente = await apiFetch(`/Clientes/${id}`, { method: 'GET' }, 'obtener cliente');
        document.getElementById('clienteId').value = cliente.id;
        document.getElementById('clienteNombre').value = cliente.nombre || '';
        document.getElementById('clienteTelefono').value = cliente.telefono || '';
        document.getElementById('clienteEmail').value = cliente.email || '';
        document.getElementById('clienteGuardarBtn').textContent = 'Actualizar';
        return;
    }

    if (delBtn) {
        const id = Number(delBtn.dataset.id);
        if (!confirm(`¿Eliminar cliente #${id}?`)) return;
        await apiFetch(`/Clientes/${id}`, { method: 'DELETE' }, 'eliminar cliente');
        showAlert('Cliente eliminado.', 'success');
        await loadAll();
    }
}

async function onProveedoresClick(event) {
    const editBtn = event.target.closest('.btn-editar-proveedor');
    const delBtn = event.target.closest('.btn-eliminar-proveedor');

    if (editBtn) {
        const id = Number(editBtn.dataset.id);
        const proveedor = await apiFetch(`/Proveedores/${id}`, { method: 'GET' }, 'obtener proveedor');
        document.getElementById('proveedorId').value = proveedor.id;
        document.getElementById('proveedorNombre').value = proveedor.nombre || '';
        document.getElementById('proveedorTelefono').value = proveedor.telefono || '';
        document.getElementById('proveedorEmail').value = proveedor.email || '';
        document.getElementById('proveedorGuardarBtn').textContent = 'Actualizar';
        return;
    }

    if (delBtn) {
        const id = Number(delBtn.dataset.id);
        if (!confirm(`¿Eliminar proveedor #${id}?`)) return;
        await apiFetch(`/Proveedores/${id}`, { method: 'DELETE' }, 'eliminar proveedor');
        showAlert('Proveedor eliminado.', 'success');
        await loadAll();
    }
}

async function onSubmitCliente(event) {
    event.preventDefault();
    const id = document.getElementById('clienteId').value;
    const payload = {
        id: id ? Number(id) : 0,
        nombre: document.getElementById('clienteNombre').value.trim(),
        telefono: document.getElementById('clienteTelefono').value.trim() || null,
        email: document.getElementById('clienteEmail').value.trim() || null
    };

    try {
        if (id) {
            await apiFetch(`/Clientes/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            }, 'actualizar cliente');
            showAlert('Cliente actualizado.', 'success');
        } else {
            // Validar que no exista duplicado
            const duplicado = state.clientes.some(c => 
                (c.nombre.toLowerCase() === payload.nombre.toLowerCase()) ||
                (payload.telefono && c.telefono === payload.telefono) ||
                (payload.email && c.email === payload.email)
            );
            
            if (duplicado) {
                showAlert('Ya existe un cliente con ese nombre, teléfono o email.', 'warning');
                return;
            }
            
            delete payload.id;
            await apiFetch('/Clientes', {
                method: 'POST',
                body: JSON.stringify(payload)
            }, 'crear cliente');
            showAlert('Cliente agregado.', 'success');
        }

        resetClientForm();
        await loadAll();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function onSubmitProveedor(event) {
    event.preventDefault();
    const id = document.getElementById('proveedorId').value;
    const payload = {
        id: id ? Number(id) : 0,
        nombre: document.getElementById('proveedorNombre').value.trim(),
        telefono: document.getElementById('proveedorTelefono').value.trim() || null,
        email: document.getElementById('proveedorEmail').value.trim() || null
    };

    try {
        if (id) {
            await apiFetch(`/Proveedores/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            }, 'actualizar proveedor');
            showAlert('Proveedor actualizado.', 'success');
        } else {
            // Validar que no exista duplicado
            const duplicado = state.proveedores.some(p => 
                (p.nombre.toLowerCase() === payload.nombre.toLowerCase()) ||
                (payload.telefono && p.telefono === payload.telefono) ||
                (payload.email && p.email === payload.email)
            );
            
            if (duplicado) {
                showAlert('Ya existe un proveedor con ese nombre, teléfono o email.', 'warning');
                return;
            }
            
            delete payload.id;
            await apiFetch('/Proveedores', {
                method: 'POST',
                body: JSON.stringify(payload)
            }, 'crear proveedor');
            showAlert('Proveedor agregado.', 'success');
        }

        resetProviderForm();
        await loadAll();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

function addCompraDetail(detail = {}) {
    document.getElementById('compraDetalles').insertAdjacentHTML('beforeend', detailPurchaseRow(detail));
    refreshSelectors();
}

function addVentaDetail(detail = {}) {
    document.getElementById('ventaDetalles').insertAdjacentHTML('beforeend', detailSaleRow(detail));
    refreshSelectors();
    refreshSaleProductSelectors();
}

async function onCompraFormSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('compraId').value;
    const detalles = readCompraDetails();
    const fechaValue = document.getElementById('compraFecha').value;
    const modoProveedor = document.getElementById('compraModoProveedor').value;
    
    let proveedorId;
    
    // Si es nuevo proveedor, crearlo primero
    if (modoProveedor === 'new') {
        const nombre = document.getElementById('compraProveedorNombre').value.trim();
        const email = document.getElementById('compraProveedorEmail').value.trim() || null;
        const telefono = document.getElementById('compraProveedorTelefono').value.trim() || null;
        
        if (!nombre) {
            showAlert('Por favor ingrese el nombre del proveedor.', 'warning');
            return;
        }
        
        try {
            const proveedorPayload = {
                id: 0,
                nombre,
                email,
                telefono
            };
            
            const newProveedor = await apiFetch('/Proveedores', {
                method: 'POST',
                body: JSON.stringify(proveedorPayload)
            }, 'crear proveedor');
            
            proveedorId = newProveedor.id;
            showAlert('Proveedor creado exitosamente.', 'success');
        } catch (error) {
            showAlert(`Error al crear proveedor: ${error.message}`, 'danger');
            return;
        }
    } else {
        proveedorId = Number(document.getElementById('compraProveedorId').value);
    }
    
    const payload = {
        id: id ? Number(id) : 0,
        fecha: fechaValue ? new Date(fechaValue + 'T00:00:00').toISOString() : new Date().toISOString(),
        proveedorId,
        total: Number(document.getElementById('compraTotal').value) || calculateTotal(detalles),
        detalles
    };

    try {
        if (id) {
            await apiFetch(`/Compras/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            }, 'actualizar compra');
            showAlert('Compra actualizada.', 'success');
        } else {
            delete payload.id;
            await apiFetch('/Compras', {
                method: 'POST',
                body: JSON.stringify(payload)
            }, 'registrar compra');
            showAlert('Compra registrada.', 'success');
        }

        resetCompraForm();
        await loadAll();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function onVentaFormSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('ventaId').value;
    const detalles = readVentaDetails();
    const fechaValue = document.getElementById('ventaFecha').value;
    const payload = {
        id: id ? Number(id) : 0,
        fecha: fechaValue ? new Date(fechaValue + 'T00:00:00').toISOString() : new Date().toISOString(),
        clienteId: Number(document.getElementById('ventaClienteId').value),
        total: Number(document.getElementById('ventaTotal').value) || calculateTotal(detalles),
        detalles
    };

    try {
        if (id) {
            await apiFetch(`/Ventas/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            }, 'actualizar venta');
            showAlert('Venta actualizada.', 'success');
        } else {
            delete payload.id;
            await apiFetch('/Ventas', {
                method: 'POST',
                body: JSON.stringify(payload)
            }, 'registrar venta');
            showAlert('Venta registrada.', 'success');
        }

        resetVentaForm();
        await loadAll();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function onComprasTableClick(event) {
    const editBtn = event.target.closest('.btn-editar-compra');
    const stateBtn = event.target.closest('.btn-cambiar-estado-compra');
    const delBtn = event.target.closest('.btn-eliminar-compra');

    if (editBtn) {
        const id = Number(editBtn.dataset.id);
        const compra = await apiFetch(`/Compras/${id}`, { method: 'GET' }, 'obtener compra');
        document.getElementById('compraId').value = compra.id;
        document.getElementById('compraFecha').value = compra.fecha ? new Date(compra.fecha).toISOString().slice(0, 10) : '';
        document.getElementById('compraModoProveedor').value = 'existing';
        document.getElementById('compraProveedorId').value = compra.proveedorId || '';
        document.getElementById('compraDetalles').innerHTML = '';
        (compra.detalles || []).forEach((detail) => addCompraDetail(detail));
        document.getElementById('compraTotal').value = Number(compra.total ?? calculateTotal(readCompraDetails())).toFixed(2);
        document.getElementById('compraGuardarBtn').textContent = 'Actualizar';
        setCompraEditState(true, compra.proveedorId || '');
        refreshPurchaseProductSelectors();
        return;
    }

    if (stateBtn) {
        const id = Number(stateBtn.dataset.id);
        const estado = stateBtn.dataset.estado;
        if (!confirm(`¿Cambiar el estado de la compra #${id} a ${estado}?`)) return;
        await apiFetch(`/Compras/${id}/estado`, {
            method: 'PATCH',
            body: JSON.stringify({ estado })
        }, 'cambiar estado de compra');
        showAlert('Estado de compra actualizado.', 'success');
        await loadAll();
        return;
    }

    if (delBtn) {
        const id = Number(delBtn.dataset.id);
        if (!confirm(`¿Eliminar compra #${id}?`)) return;
        await apiFetch(`/Compras/${id}`, { method: 'DELETE' }, 'eliminar compra');
        showAlert('Compra eliminada.', 'success');
        await loadAll();
    }
}

async function onVentasTableClick(event) {
    const editBtn = event.target.closest('.btn-editar-venta');
    const stateBtn = event.target.closest('.btn-cambiar-estado-venta');
    const delBtn = event.target.closest('.btn-eliminar-venta');

    if (editBtn) {
        const id = Number(editBtn.dataset.id);
        const venta = await apiFetch(`/Ventas/${id}`, { method: 'GET' }, 'obtener venta');
        document.getElementById('ventaId').value = venta.id;
        document.getElementById('ventaFecha').value = venta.fecha ? new Date(venta.fecha).toISOString().slice(0, 10) : '';
        document.getElementById('ventaClienteId').value = venta.clienteId || '';
        document.getElementById('ventaDetalles').innerHTML = '';
        (venta.detalles || []).forEach((detail) => addVentaDetail(detail));
        document.getElementById('ventaTotal').value = Number(venta.total ?? calculateTotal(readVentaDetails())).toFixed(2);
        document.getElementById('ventaGuardarBtn').textContent = 'Actualizar';
        refreshSaleProductSelectors();
        return;
    }

    if (stateBtn) {
        const id = Number(stateBtn.dataset.id);
        const estado = stateBtn.dataset.estado;
        if (!confirm(`¿Cambiar el estado de la venta #${id} a ${estado}?`)) return;
        await apiFetch(`/Ventas/${id}/estado`, {
            method: 'PATCH',
            body: JSON.stringify({ estado })
        }, 'cambiar estado de venta');
        showAlert('Estado de venta actualizado.', 'success');
        await loadAll();
        return;
    }

    if (delBtn) {
        const id = Number(delBtn.dataset.id);
        if (!confirm(`¿Eliminar venta #${id}?`)) return;
        await apiFetch(`/Ventas/${id}`, { method: 'DELETE' }, 'eliminar venta');
        showAlert('Venta eliminada.', 'success');
        await loadAll();
    }
}

async function runReportByPeriod() {
    const from = document.getElementById('reporteDesde').value;
    const to = document.getElementById('reporteHasta').value;
    if (!from || !to) {
        showAlert('Selecciona ambas fechas.', 'warning');
        return;
    }

    const data = await apiFetch(`/Ventas/report/period?from=${encodeURIComponent(new Date(from).toISOString())}&to=${encodeURIComponent(new Date(to).toISOString())}`, { method: 'GET' }, 'consultar reporte por periodo');
    const body = document.getElementById('reportePeriodoBody');

    if (!data || data.length === 0) {
        renderEmptyRow('reportePeriodoBody', 4, 'No hay ventas en el periodo seleccionado.');
        return;
    }

    body.innerHTML = data.map((v) => {
        const client = v.cliente || getClientById(v.clienteId);
        return `
        <tr>
            <td>${v.id}</td>
            <td>${escapeHtml(new Date(v.fecha).toLocaleDateString('es-ES'))}</td>
            <td>${partyDisplay(client, v.clienteId)}</td>
            <td>${formatMoney(v.total)}</td>
        </tr>
    `;
    }).join('');
}

async function runReportByProduct() {
    const productId = Number(document.getElementById('reporteProductoId').value);
    if (!productId) {
        showAlert('Selecciona un producto.', 'warning');
        return;
    }

    const data = await apiFetch(`/Ventas/report/product/${productId}`, { method: 'GET' }, 'consultar reporte por producto');
    document.getElementById('reporteProductoResultado').innerHTML = `
        <div class="card bg-light border-0">
            <div class="card-body">
                <h3 class="h6">Resumen producto #${productId}</h3>
                <p class="mb-1"><strong>Cantidad total:</strong> ${data.totalCantidad ?? 0}</p>
                <p class="mb-0"><strong>Total vendido:</strong> ${formatMoney(data.totalVentas ?? 0)}</p>
            </div>
        </div>
    `;
}

async function runReportByCliente() {
    const clienteId = Number(document.getElementById('reporteClienteId').value);
    if (!clienteId) {
        showAlert('Selecciona un cliente.', 'warning');
        return;
    }

    const data = await apiFetch(`/Ventas/report/cliente/${clienteId}`, { method: 'GET' }, 'consultar reporte por cliente');
    const cliente = getClientById(clienteId);
    const clienteResultado = document.getElementById('reporteClienteResultado');
    if (clienteResultado) {
        clienteResultado.innerHTML = `
            <div class="card bg-light border-0">
                <div class="card-body">
                    <h3 class="h6 mb-1">Cliente seleccionado</h3>
                    ${partyDisplay(cliente, clienteId)}
                </div>
            </div>
        `;
    }
    const body = document.getElementById('reporteClienteBody');

    if (!data || data.length === 0) {
        renderEmptyRow('reporteClienteBody', 4, 'No hay ventas para ese cliente.');
        return;
    }

    body.innerHTML = data.map((v) => `
        <tr>
            <td>${v.id}</td>
            <td>${escapeHtml(new Date(v.fecha).toLocaleDateString('es-ES'))}</td>
            <td>${formatMoney(v.total)}</td>
            <td>${(v.detalles || []).length}</td>
        </tr>
    `).join('');
}

async function runReportByProveedor() {
    const proveedorId = Number(document.getElementById('reporteProveedorId').value);
    if (!proveedorId) {
        showAlert('Selecciona un proveedor.', 'warning');
        return;
    }

    const data = await apiFetch(`/Ventas/report/proveedor/${proveedorId}`, { method: 'GET' }, 'consultar reporte por proveedor');
    const proveedor = getProviderById(proveedorId);
    document.getElementById('reporteProveedorResultado').innerHTML = `
        <div class="card bg-light border-0">
            <div class="card-body">
                <h3 class="h6 mb-1">Proveedor seleccionado</h3>
                ${partyDisplay(proveedor, proveedorId)}
                <hr>
                <h3 class="h6">Resumen proveedor #${proveedorId}</h3>
                <p class="mb-1"><strong>Cantidad total:</strong> ${data.totalCantidad ?? 0}</p>
                <p class="mb-0"><strong>Total vendido:</strong> ${formatMoney(data.totalVentas ?? 0)}</p>
            </div>
        </div>
    `;
}

function onDetailChange(event) {
    if (event.target.closest('.venta-detail-row') && event.target.classList.contains('venta-producto-search')) {
        const row = event.target.closest('.venta-detail-row');
        const select = row.querySelector('.venta-producto-id');
        if (select) {
            select.innerHTML = saleProductOptions(select.value, event.target.value);
        }
        updateSaleTotal();
        return;
    }

    if (event.target.closest('.compra-detail-row') && event.target.classList.contains('compra-producto-search')) {
        const row = event.target.closest('.compra-detail-row');
        const select = row.querySelector('.compra-producto-id');
        if (select) {
            select.innerHTML = purchaseProductOptions(select.value, event.target.value);
        }
        updatePurchaseTotal();
        return;
    }

    if (event.target.closest('.venta-detail-row') && event.target.classList.contains('venta-producto-id')) {
        const row = event.target.closest('.venta-detail-row');
        const search = row.querySelector('.venta-producto-search');
        const priceInput = row.querySelector('.venta-precio');
        const product = getProductById(event.target.value);
        if (search && product) {
            search.value = product.nombre;
        }
        if (priceInput && product) {
            priceInput.value = product.precio;
        }
        updateSaleTotal();
        return;
    }

    if (event.target.closest('.compra-detail-row') && event.target.classList.contains('compra-producto-id')) {
        const row = event.target.closest('.compra-detail-row');
        const search = row.querySelector('.compra-producto-search');
        const priceInput = row.querySelector('.compra-precio');
        const product = getProductById(event.target.value);
        if (search && product) {
            search.value = product.nombre;
        }
        if (priceInput && product) {
            priceInput.value = product.precioCompra;
        }
        updatePurchaseTotal();
        return;
    }

    if (event.target.closest('.compra-detail-row') && event.target.classList.contains('compra-producto-id')) {
        const row = event.target.closest('.compra-detail-row');
        const search = row.querySelector('.compra-producto-search');
        const product = getProductById(event.target.value);
        if (search && product) {
            search.value = product.nombre;
        }
        updatePurchaseTotal();
        return;
    }

    const ventaRow = event.target.closest('.venta-detail-row');
    if (ventaRow && event.target.classList.contains('venta-modo')) {
        const isNew = event.target.value === 'new';
        ventaRow.querySelector('.venta-existing-group').classList.toggle('d-none', isNew);
        ventaRow.querySelectorAll('.venta-new-group').forEach((el) => el.classList.toggle('d-none', !isNew));
        updateSaleTotal();
        return;
    }

    const compraRow = event.target.closest('.compra-detail-row');
    if (compraRow && event.target.classList.contains('compra-modo')) {
        const isNew = event.target.value === 'new';
        compraRow.querySelectorAll('.compra-existing-group').forEach((el) => el.classList.toggle('d-none', isNew));
        compraRow.querySelectorAll('.compra-new-group').forEach((el) => el.classList.toggle('d-none', !isNew));
        refreshPurchaseProductSelectors();
        updatePurchaseTotal();
        return;
    }

    if (event.target.closest('.compra-detail-row')) {
        updatePurchaseTotal();
    }

    if (event.target.closest('.venta-detail-row')) {
        updateSaleTotal();
    }
}

function setupEvents() {
    document.getElementById('inventarioBody').addEventListener('click', onInventarioClick);
    document.getElementById('clientesBody').addEventListener('click', onClientesClick);
    document.getElementById('proveedoresBody').addEventListener('click', onProveedoresClick);
    document.getElementById('comprasBody').addEventListener('click', onComprasTableClick);
    document.getElementById('ventasBody').addEventListener('click', onVentasTableClick);

    document.getElementById('productoForm').addEventListener('submit', onSubmitProducto);
    document.getElementById('clienteForm').addEventListener('submit', onSubmitCliente);
    document.getElementById('proveedorForm').addEventListener('submit', onSubmitProveedor);
    document.getElementById('compraForm').addEventListener('submit', onCompraFormSubmit);
    document.getElementById('ventaForm').addEventListener('submit', onVentaFormSubmit);

    document.getElementById('productoCancelarBtn').addEventListener('click', resetProductForm);
    document.getElementById('clienteCancelarBtn').addEventListener('click', resetClientForm);
    document.getElementById('proveedorCancelarBtn').addEventListener('click', resetProviderForm);
    document.getElementById('compraCancelarBtn').addEventListener('click', resetCompraForm);
    document.getElementById('ventaCancelarBtn').addEventListener('click', resetVentaForm);

    const refreshAllButton = document.getElementById('btnRefrescarTodo');
    if (refreshAllButton) {
        refreshAllButton.addEventListener('click', async () => {
            await loadAll();
            showAlert('Vista actualizada.', 'info');
        });
    }

    document.getElementById('btnAgregarCompraDetalle').addEventListener('click', () => {
        addCompraDetail();
        updatePurchaseTotal();
    });

    document.getElementById('btnAgregarVentaDetalle').addEventListener('click', () => {
        addVentaDetail();
        updateSaleTotal();
        refreshSaleProductSelectors();
    });

    document.getElementById('compraDetalles').addEventListener('change', onDetailChange);
    document.getElementById('compraDetalles').addEventListener('input', updatePurchaseTotal);
    document.getElementById('compraProveedorId').addEventListener('change', () => {
        refreshPurchaseProductSelectors();
        updatePurchaseTotal();
    });
    document.getElementById('ventaDetalles').addEventListener('change', onDetailChange);
    document.getElementById('ventaDetalles').addEventListener('input', onDetailChange);
    document.getElementById('ventaDetalles').addEventListener('input', updateSaleTotal);

    // Manejar cambio entre Proveedor Existente y Nuevo
    document.getElementById('compraModoProveedor').addEventListener('change', (event) => {
        const isNew = event.target.value === 'new';
        document.querySelectorAll('.compra-proveedor-existing-group').forEach((el) => el.classList.toggle('d-none', isNew));
        document.querySelectorAll('.compra-proveedor-new-group').forEach((el) => el.classList.toggle('d-none', !isNew));
        document.getElementById('compraProveedorId').required = !isNew;
    });

    document.getElementById('btnReportePeriodo').addEventListener('click', runReportByPeriod);
    document.getElementById('btnReporteProducto').addEventListener('click', runReportByProduct);
    document.getElementById('btnReporteCliente').addEventListener('click', runReportByCliente);
    document.getElementById('btnReporteProveedor').addEventListener('click', runReportByProveedor);

    document.getElementById('compraDetalles').addEventListener('click', (event) => {
        const button = event.target.closest('.btn-remove-compra-detalle');
        if (!button) return;
        if (document.querySelectorAll('.compra-detail-row').length === 1) return;
        button.closest('.compra-detail-row').remove();
        updatePurchaseTotal();
    });

    document.getElementById('ventaDetalles').addEventListener('click', (event) => {
        const button = event.target.closest('.btn-remove-venta-detalle');
        if (!button) return;
        if (document.querySelectorAll('.venta-detail-row').length === 1) return;
        button.closest('.venta-detail-row').remove();
        updateSaleTotal();
    });
}

setupEvents();
refreshSelectors();
refreshDetailRows();
loadAll();
