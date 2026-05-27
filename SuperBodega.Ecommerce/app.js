// Para probar con localhost
// const API_BASE = 'http://localhost:8080/api';
const API_BASE = 'https://refill-blurt-utter.ngrok-free.dev/api';
const CLIENT_STORAGE_KEY = 'superbodega.ecommerce.client';
const carritoModalEl = document.getElementById('carritoModal');
const clienteModalEl = document.getElementById('clienteModal');
const carritoModal = carritoModalEl ? bootstrap.Modal.getOrCreateInstance(carritoModalEl) : null;
const clienteModal = clienteModalEl ? bootstrap.Modal.getOrCreateInstance(clienteModalEl) : null;

let currentClient = loadStoredClient();
let clientRequestResolver = null;

function setStatus(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = text;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return (text || '').replace(/[&<>"']/g, (m) => map[m]);
}

function formatMoney(num) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num || 2);
}

function showAlert(message, type = 'info') {
    const container = document.getElementById('alertContainer');
    if (!container) return;

    const alertId = 'alert-' + Date.now();
    const alert = document.createElement('div');
    alert.id = alertId;
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${escapeHtml(message)}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    container.appendChild(alert);

    setTimeout(() => {
        const el = document.getElementById(alertId);
        if (el) el.remove();
    }, 5000);
}

function loadStoredClient() {
    try {
        const raw = localStorage.getItem(CLIENT_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function saveCurrentClient(cliente) {
    currentClient = cliente;
    localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(cliente));
    updateClientSessionUI();
}

function clearCurrentClient() {
    currentClient = null;
    localStorage.removeItem(CLIENT_STORAGE_KEY);
    updateClientSessionUI();
}

function updateClientSessionUI() {
    const status = document.getElementById('clienteActivoStatus');
    if (!status) return;

    if (currentClient) {
        status.innerHTML = `Cliente: <strong>${escapeHtml(currentClient.nombre || 'Sin nombre')}</strong> · ${escapeHtml(currentClient.email || 'sin correo')}`;
    } else {
        status.textContent = 'Aún no se ha identificado un cliente.';
    }
}

function fillClientSessionForm() {
    const nombre = document.getElementById('clienteSesionNombre');
    const email = document.getElementById('clienteSesionEmail');
    const telefono = document.getElementById('clienteSesionTelefono');

    if (nombre) nombre.value = currentClient?.nombre || '';
    if (email) email.value = currentClient?.email || '';
    if (telefono) telefono.value = currentClient?.telefono || '';
}

function openClientModal() {
    if (!clienteModal) return;
    fillClientSessionForm();
    clienteModal.show();
}

function requestClientSession() {
    openClientModal();
    return new Promise((resolve) => {
        clientRequestResolver = resolve;
    });
}

async function ensureCurrentClient() {
    if (currentClient?.id) {
        return currentClient;
    }

    return await requestClientSession();
}

async function validateStoredClient() {
    if (!currentClient?.id) return;

    try {
        const client = await apiFetch(`/Clientes/${currentClient.id}`, { method: 'GET' }, 'validar cliente');
        saveCurrentClient(client);
    } catch {
        clearCurrentClient();
    }
}

async function apiFetch(url, options = {}, action = 'procesar') {
    try {
        const method = (options.method || 'GET').toUpperCase();
        const headers = {
            'ngrok-skip-browser-warning': 'true',
            ...(options.headers || {})
        };

        if (method !== 'GET' && method !== 'HEAD') {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(API_BASE + url, {
            ...options,
            headers
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Error al ${action}: ${error || response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        throw new Error(error.message || `Error al ${action}`);
    }
}

let currentPage = 1;

async function loadTienda(page = 1) {
    setStatus('tiendaStatus', 'Cargando productos...');
    const grid = document.getElementById('tiendaGrid');
    const categoria = document.getElementById('filtroCategoria').value.trim();
    const pageSize = document.getElementById('pageSize').value;

    try {
        let url = `/Productos?page=${page}&pageSize=${pageSize}`;
        if (categoria) url += `&categoria=${encodeURIComponent(categoria)}`;

        const data = await apiFetch(url, { method: 'GET' }, 'cargar productos');
        const productos = data.items || data; // Maneja ambos responses: paginado y list() si es que la API cambió

        currentPage = data.currentPage || 1;

        if (!productos || productos.length === 0) {
            setStatus('tiendaStatus', 'Sin productos en esta categoría o página.');
            grid.innerHTML = '<div class="col-12"><div class="alert alert-info mb-0">No hay productos disponibles.</div></div>';
            document.getElementById('paginationControls').innerHTML = '';
            return;
        }

        grid.innerHTML = productos.map((p) => `
            <div class="col-md-6 col-xl-4">
                <article class="card product-card h-100">
                    <div class="card-body d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h3 class="h5 mb-0">${escapeHtml(p.nombre)}</h3>
                            <span class="badge text-bg-primary">Stock: ${p.stock}</span>
                        </div>
                        <p class="text-muted small mb-1">${escapeHtml(p.descripcion || 'Sin descripción')}</p>
                        ${p.categoria ? `<span class="badge bg-secondary mb-3 align-self-start">${escapeHtml(p.categoria)}</span>` : ''}
                        <div class="mt-auto">
                            <div class="fw-bold fs-5 text-primary mb-3">${formatMoney(p.precio)}</div>
                            <div class="input-group mb-2">
                                <span class="input-group-text">Cant.</span>
                                <input type="number" class="form-control tienda-cantidad" min="1" max="${p.stock}" value="1" data-id="${p.id}">
                            </div>
                            <button class="btn btn-success w-100 btn-comprar" data-id="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>Agregar al Carrito 🛒</button>
                        </div>
                    </div>
                </article>
            </div>
        `).join('');

        if (data.totalPages) {
            let pagHTML = '';
            for(let i = 1; i <= data.totalPages; i++) {
                pagHTML += `<li class="page-item ${i === currentPage ? 'active' : ''}"><a class="page-link" href="#" onclick="event.preventDefault(); loadTienda(${i})">${i}</a></li>`;
            }
            document.getElementById('paginationControls').innerHTML = pagHTML;
            setStatus('tiendaStatus', `Mostrando página ${currentPage} de ${data.totalPages} (Total: ${data.totalItems} productos)`);
        } else {
            setStatus('tiendaStatus', `${productos.length} productos mostrados`);
            document.getElementById('paginationControls').innerHTML = '';
        }
        
        loadCartCount();

    } catch (error) {
        showAlert(error.message, 'danger');
        setStatus('tiendaStatus', 'Error al cargar');
    }
}

let clientActionResolver = null;
let emailLookupTimer = null;

function setPhoneGroupVisible(visible) {
    const group = document.getElementById('clienteTelefonoGroup');
    const phone = document.getElementById('clienteSesionTelefono');
    if (group) {
        group.classList.toggle('d-none', !visible);
    }
    if (phone) {
        phone.required = visible;
    }
    if (!visible && phone) {
        phone.value = '';
    }
}

function fillClientSessionForm() {
    const nombre = document.getElementById('clienteSesionNombre');
    const email = document.getElementById('clienteSesionEmail');
    const telefono = document.getElementById('clienteSesionTelefono');

    if (nombre) nombre.value = currentClient?.nombre || '';
    if (email) email.value = currentClient?.email || '';
    if (telefono) telefono.value = currentClient?.telefono || '';
    setPhoneGroupVisible(Boolean(currentClient?.telefono));
}

async function lookupClientByEmail(email) {
    const normalized = email.trim();
    if (!normalized) {
        return null;
    }

    try {
        return await apiFetch(`/Clientes/por-correo?email=${encodeURIComponent(normalized)}`, { method: 'GET' }, 'buscar cliente por correo');
    } catch (error) {
        const message = String(error.message || '').toLowerCase();
        if (message.includes('404') || message.includes('not found') || message.includes('no encontrado')) {
            return null;
        }
        throw error;
    }
}

async function handleEmailChange() {
    const emailInput = document.getElementById('clienteSesionEmail');
    const nombreInput = document.getElementById('clienteSesionNombre');
    const telefonoInput = document.getElementById('clienteSesionTelefono');
    const email = emailInput ? emailInput.value.trim() : '';

    if (!email) {
        setPhoneGroupVisible(false);
        return;
    }

    const existingClient = await lookupClientByEmail(email);
    if (existingClient) {
        if (nombreInput && !nombreInput.value.trim()) {
            nombreInput.value = existingClient.nombre || '';
        }
        if (telefonoInput) {
            telefonoInput.value = existingClient.telefono || '';
        }
        setPhoneGroupVisible(false);
        saveCurrentClient(existingClient);
        return;
    }

    setPhoneGroupVisible(true);
    if (currentClient && currentClient.email && currentClient.email.toLowerCase() !== email.toLowerCase()) {
        clearCurrentClient();
    }
}

function openClientModal() {
    if (!clienteModal) return;
    fillClientSessionForm();
    clienteModal.show();
}

function requestClientSession() {
    openClientModal();
    return new Promise((resolve) => {
        clientActionResolver = resolve;
    });
}

async function ensureCurrentClient() {
    if (currentClient?.id) {
        return currentClient;
    }

    return await requestClientSession();
}

async function resolveClientFromForm() {
    const nombre = document.getElementById('clienteSesionNombre').value.trim();
    const email = document.getElementById('clienteSesionEmail').value.trim();
    const telefono = document.getElementById('clienteSesionTelefono').value.trim();

    const payload = {
        nombre,
        email,
        telefono: telefono || null
    };

    return await apiFetch('/Clientes/resolver', {
        method: 'POST',
        body: JSON.stringify(payload)
    }, 'identificar cliente');
}

async function loadCartCount() {
    const clienteId = currentClient?.id;
    if (!clienteId) {
        const cartCount = document.getElementById('cartCount');
        if (cartCount) cartCount.textContent = '0';
        return;
    }

    try {
        const carrito = await apiFetch(`/Carritos/${clienteId}`, { method: 'GET' }, 'cargar carrito');
        const count = carrito.items?.reduce((s, i) => s + i.cantidad, 0) || 0;
        document.getElementById('cartCount').textContent = count;
    } catch {
        document.getElementById('cartCount').textContent = '0';
    }
}

async function loadCarrito() {
    const clienteId = currentClient?.id;
    if (!clienteId) {
        return;
    }

    const body = document.getElementById('carritoBody');
    body.innerHTML = 'Cargando...';

    try {
        const carrito = await apiFetch(`/Carritos/${clienteId}`, { method: 'GET' }, 'cargar carrito');

        if (!carrito.items || carrito.items.length === 0) {
            body.innerHTML = '<div class="alert alert-info">Tu carrito está vacío.</div>';
            document.getElementById('carritoTotal').textContent = '$0';
            document.getElementById('btnProcesarVentaAsync').disabled = true;
            return;
        }

        let total = 0;
        let html = '<table class="table align-middle"><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th><th></th></tr></thead><tbody>';

        carrito.items.forEach((item) => {
            const sub = item.cantidad * item.producto.precio;
            total += sub;
            html += `
            <tr>
                <td>${escapeHtml(item.producto.nombre)}</td>
                <td>${item.cantidad}</td>
                <td>${formatMoney(item.producto.precio)}</td>
                <td>${formatMoney(sub)}</td>
                <td><button class="btn btn-sm btn-danger px-2 py-1 btn-eliminar-item" data-id="${item.productoId}">X</button></td>
            </tr>`;
        });

        html += '</tbody></table>';
        body.innerHTML = html;
        document.getElementById('carritoTotal').textContent = formatMoney(total);
        document.getElementById('btnProcesarVentaAsync').disabled = false;

        body.querySelectorAll('.btn-eliminar-item').forEach((button) => {
            button.onclick = async () => {
                await apiFetch(`/Carritos/${clienteId}/items/${button.dataset.id}`, { method: 'DELETE' }, 'quitar ítem');
                await loadCarrito();
                await loadTienda(currentPage);
            };
        });
    } catch (error) {
        body.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
    }
}

async function openCarrito() {
    const client = await ensureCurrentClient();
    if (!client) return;

    await loadCartCount();
    await loadCarrito();
    if (carritoModal) {
        carritoModal.show();
    }
}

async function procesarVentaCarrito(modo = 'async') {
    const client = await ensureCurrentClient();
    if (!client) return;

    const endpoint = modo === 'sync'
        ? `/Carritos/${client.id}/checkout/sync`
        : `/Carritos/${client.id}/checkout/async`;

    try {
        await apiFetch(endpoint, { method: 'POST' }, 'confirmar compra');
        showAlert(modo === 'sync'
            ? '¡Compra procesada de forma síncrona!'
            : '¡Compra enviada a procesamiento asíncrono!', 'success');
        if (carritoModal) {
            carritoModal.hide();
        }
        await loadTienda(currentPage);
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function onTiendaClick(event) {
    const button = event.target.closest('.btn-comprar');
    if (!button) return;

    const productoId = Number(button.dataset.id);
    const cantidadInput = document.querySelector(`.tienda-cantidad[data-id="${productoId}"]`);
    const cantidad = Math.max(1, Number(cantidadInput ? cantidadInput.value : 1) || 1);
    const client = await ensureCurrentClient();
    if (!client) return;

    try {
        await apiFetch(`/Carritos/${client.id}/items`, {
            method: 'POST',
            body: JSON.stringify({ productoId, cantidad })
        }, 'agregar al carrito');

        showAlert('Producto agregado al carrito con éxito.', 'success');
        await loadTienda(currentPage);
        await loadCartCount();
    } catch (error) {
        showAlert(error.message, 'danger');
    }
}

async function onClienteSesionSubmit(event) {
    event.preventDefault();

    const submitButton = document.getElementById('btnGuardarClienteSesion');
    if (submitButton) submitButton.disabled = true;

    try {
        const cliente = await resolveClientFromForm();
        saveCurrentClient(cliente);

        if (clientActionResolver) {
            clientActionResolver(cliente);
            clientActionResolver = null;
        }

        if (clienteModal) {
            clienteModal.hide();
        }

        showAlert('Cliente listo para comprar.', 'success');
        await loadCartCount();
        await loadTienda(currentPage);
    } catch (error) {
        showAlert(error.message, 'danger');
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

async function init() {
    // For privacy / testing: always clear stored client on page load
    // so the user is prompted to enter client data each time the page reloads.
    clearCurrentClient();
    await validateStoredClient();
    loadTienda();

    document.getElementById('tiendaGrid').addEventListener('click', onTiendaClick);
    document.getElementById('btnRefrescar').addEventListener('click', () => loadTienda(currentPage));
    document.getElementById('btnBuscar').addEventListener('click', () => loadTienda(1));
    document.getElementById('btnProcesarVentaAsync').addEventListener('click', () => procesarVentaCarrito('async'));
    document.getElementById('btnCarrito').addEventListener('click', openCarrito);
    document.getElementById('clienteSesionForm').addEventListener('submit', onClienteSesionSubmit);
    document.getElementById('clienteSesionEmail').addEventListener('blur', handleEmailChange);
    document.getElementById('clienteSesionEmail').addEventListener('change', handleEmailChange);

    if (!currentClient?.id) {
        openClientModal();
    } else {
        await loadCartCount();
    }
}

document.addEventListener('DOMContentLoaded', init);
