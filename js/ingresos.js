/* ============================
   Ingresos - admin-carneconcuero
   ============================ */

   const Ingresos = (() => {
    let productos = [];
    let piezas = [];
    let listaTemporal = [];
  
    function formatearPrecio(valor) {
      return '$' + Math.round(valor).toLocaleString('es-AR');
    }
  
    function formatearFecha(fechaStr) {
      if (!fechaStr) return '—';
      const partes = fechaStr.split('-');
      if (partes.length !== 3) return fechaStr;
      return partes[2] + '/' + partes[1] + '/' + partes[0];
    }
  
    function fechaHoyISO() {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    }
  
    async function cargar() {
      const tbody = document.getElementById('tbody-ingresos');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center texto-secundario" style="padding: 2rem;">Cargando...</td></tr>';
      }
  
      const resProd = await supabaseClient
        .from('productos')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true });
  
      if (resProd.error) {
        if (tbody) {
          tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 2rem; color: #dc2626;">Error al cargar productos: ' + resProd.error.message + '</td></tr>';
        }
        return;
      }
      productos = resProd.data || [];
  
      const resPiezas = await supabaseClient
        .from('piezas')
        .select('*, productos(nombre)')
        .order('created_at', { ascending: false });
  
      if (resPiezas.error) {
        if (tbody) {
          tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 2rem; color: #dc2626;">Error al cargar piezas: ' + resPiezas.error.message + '</td></tr>';
        }
        return;
      }
      piezas = resPiezas.data || [];
  
      renderizarTabla();
    }
  
    function renderizarTabla() {
      const tbody = document.getElementById('tbody-ingresos');
      if (!tbody) return;
  
      if (piezas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center texto-secundario" style="padding: 2rem;">Todavía no hay piezas cargadas.</td></tr>';
        return;
      }
  
      tbody.innerHTML = '';
  
      piezas.forEach((p) => {
        const nombreProducto = p.productos ? p.productos.nombre : '(producto eliminado)';
        const costo = p.peso_kg * p.precio_compra_kg;
        const fechaMostrar = formatearFecha(p.fecha_ingreso);
        const estadoClase = p.estado === 'disponible' ? 'estado-disponible' : 'estado-vendido';
        const estadoTexto = p.estado === 'disponible' ? 'Disponible' : 'Vendido';
        const esEditable = p.estado === 'disponible';
  
        const fila = document.createElement('tr');
        fila.innerHTML = `
          <td>${fechaMostrar}</td>
          <td>${nombreProducto}</td>
          <td>${p.peso_kg.toFixed(3)} kg</td>
          <td>${formatearPrecio(p.precio_compra_kg)}</td>
          <td>${formatearPrecio(costo)}</td>
          <td>${p.origen || 'Frigorífico'}</td>
          <td><span class="estado-badge ${estadoClase}">${estadoTexto}</span></td>
          <td>
            ${esEditable
              ? `<button class="btn-secundario" data-editar="${p.id}" style="padding: 0.35rem 0.6rem; font-size: 0.8rem;">Editar</button>
                 <button class="btn-peligro" data-eliminar="${p.id}">Borrar</button>`
              : `<span class="texto-secundario text-xs">—</span>`}
          </td>
        `;
        tbody.appendChild(fila);
      });
  
      tbody.querySelectorAll('[data-editar]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-editar');
          const pieza = piezas.find((p) => p.id === id);
          if (pieza) abrirModalEdicion(pieza);
        });
      });
  
      tbody.querySelectorAll('[data-eliminar]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-eliminar');
          const pieza = piezas.find((p) => p.id === id);
          if (!pieza) return;
  
          if (pieza.estado !== 'disponible') {
            alert('No se puede borrar: esta pieza está vendida (asociada a un pedido).');
            return;
          }
  
          if (!confirm('¿Borrar esta pieza? Esta acción no se puede deshacer.')) return;
  
          const { error } = await supabaseClient.from('piezas').delete().eq('id', id);
          if (error) {
            alert('No se pudo borrar: ' + error.message);
          } else {
            cargar();
          }
        });
      });
    }
  
    function cargarDropdownProductos() {
      const select = document.getElementById('input-ingreso-producto');
      if (!select) return;
  
      if (productos.length === 0) {
        select.innerHTML = '<option value="">(No hay productos cargados)</option>';
        return;
      }
  
      select.innerHTML = '<option value="">— Seleccioná un producto —</option>';
      productos.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.nombre + ' — ' + formatearPrecio(p.precio_compra_kg) + '/kg';
        select.appendChild(opt);
      });
    }
  
    function actualizarPrecioDesdeProducto() {
      const select = document.getElementById('input-ingreso-producto');
      const inputPrecio = document.getElementById('input-ingreso-precio');
      if (!select || !inputPrecio) return;
  
      const id = select.value;
      if (!id) {
        inputPrecio.value = '';
        return;
      }
  
      const prod = productos.find((p) => p.id === id);
      if (!prod) {
        inputPrecio.value = '';
        return;
      }
  
      inputPrecio.value = prod.precio_compra_kg;
    }
  
    function abrirModal() {
      const modal = document.getElementById('modal-ingreso');
      if (!modal) return;
  
      cargarDropdownProductos();
      listaTemporal = [];
  
      document.getElementById('input-ingreso-producto').value = '';
      document.getElementById('input-ingreso-peso').value = '';
      document.getElementById('input-ingreso-precio').value = '';
      document.getElementById('input-ingreso-origen').value = 'Frigorífico';
      document.getElementById('input-ingreso-fecha').value = fechaHoyISO();
      document.getElementById('modal-ingreso-error').classList.remove('activo');
      renderizarListaTemporal();
  
      modal.classList.add('activo');
    }
  
    function cerrarModal() {
      const modal = document.getElementById('modal-ingreso');
      if (modal) modal.classList.remove('activo');
    }
  
    function agregarALista() {
      const productoId = document.getElementById('input-ingreso-producto').value;
      const peso = parseFloat(document.getElementById('input-ingreso-peso').value);
      const precio = parseFloat(document.getElementById('input-ingreso-precio').value);
      const origen = document.getElementById('input-ingreso-origen').value.trim() || 'Frigorífico';
      const errorBox = document.getElementById('modal-ingreso-error');
  
      errorBox.classList.remove('activo');
  
      if (!productoId) {
        errorBox.textContent = 'Elegí un producto.';
        errorBox.classList.add('activo');
        return;
      }
  
      if (isNaN(peso) || peso <= 0) {
        errorBox.textContent = 'El peso tiene que ser un número mayor a 0.';
        errorBox.classList.add('activo');
        return;
      }
  
      if (isNaN(precio) || precio < 0) {
        errorBox.textContent = 'El precio de compra tiene que ser un número mayor o igual a 0.';
        errorBox.classList.add('activo');
        return;
      }
  
      const prod = productos.find((p) => p.id === productoId);
      if (!prod) {
        errorBox.textContent = 'Producto no encontrado.';
        errorBox.classList.add('activo');
        return;
      }
  
      listaTemporal.push({
        productoId: prod.id,
        nombreProducto: prod.nombre,
        peso: peso,
        precioCompra: precio,
        origen: origen
      });
  
      document.getElementById('input-ingreso-peso').value = '';
      document.getElementById('input-ingreso-peso').focus();
  
      renderizarListaTemporal();
    }
  
    function quitarDeLista(indice) {
      listaTemporal.splice(indice, 1);
      renderizarListaTemporal();
    }
  
    function renderizarListaTemporal() {
      const contenedor = document.getElementById('lista-temporal-ingreso');
      const btnGuardar = document.getElementById('btn-guardar-ingreso');
      if (!contenedor) return;
  
      if (listaTemporal.length === 0) {
        contenedor.innerHTML = '<p class="texto-secundario text-sm" style="padding: 0.5rem 0;">Todavía no agregaste piezas a la lista.</p>';
        if (btnGuardar) {
          btnGuardar.textContent = 'Guardar piezas';
          btnGuardar.disabled = true;
        }
        return;
      }
  
      contenedor.innerHTML = '';
      listaTemporal.forEach((item, indice) => {
        const div = document.createElement('div');
        div.className = 'item-temporal';
        div.innerHTML = `
          <div style="flex: 1;">
            <strong>${item.nombreProducto}</strong>
            <span class="texto-secundario text-sm"> — ${item.peso.toFixed(3)} kg — ${formatearPrecio(item.precioCompra)}/kg — ${item.origen}</span>
          </div>
          <button type="button" class="btn-peligro" data-quitar-temporal="${indice}">✕</button>
        `;
        contenedor.appendChild(div);
      });
  
      contenedor.querySelectorAll('[data-quitar-temporal]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-quitar-temporal'), 10);
          quitarDeLista(idx);
        });
      });
  
      if (btnGuardar) {
        btnGuardar.textContent = 'Guardar ' + listaTemporal.length + ' pieza' + (listaTemporal.length === 1 ? '' : 's');
        btnGuardar.disabled = false;
      }
    }
  
    async function guardarTodas() {
      const fecha = document.getElementById('input-ingreso-fecha').value;
      const errorBox = document.getElementById('modal-ingreso-error');
  
      errorBox.classList.remove('activo');
  
      if (listaTemporal.length === 0) {
        errorBox.textContent = 'Agregá al menos una pieza a la lista.';
        errorBox.classList.add('activo');
        return;
      }
  
      if (!fecha) {
        errorBox.textContent = 'Elegí una fecha de ingreso.';
        errorBox.classList.add('activo');
        return;
      }
  
      const payload = listaTemporal.map((item) => ({
        producto_id: item.productoId,
        peso_kg: item.peso,
        precio_compra_kg: item.precioCompra,
        fecha_ingreso: fecha,
        estado: 'disponible',
        origen: item.origen
      }));
  
      const { error } = await supabaseClient.from('piezas').insert(payload);
  
      if (error) {
        errorBox.textContent = 'Error: ' + error.message;
        errorBox.classList.add('activo');
        return;
      }
  
      cerrarModal();
      cargar();
    }
  
    // ----- MODAL EDICIÓN -----
    function abrirModalEdicion(pieza) {
      const modal = document.getElementById('modal-editar-pieza');
      if (!modal) return;
  
      if (pieza.estado !== 'disponible') {
        alert('No se puede editar: esta pieza está vendida.');
        return;
      }
  
      document.getElementById('input-editar-pieza-id').value = pieza.id;
      document.getElementById('input-editar-pieza-peso').value = pieza.peso_kg;
      document.getElementById('input-editar-pieza-precio').value = pieza.precio_compra_kg;
      document.getElementById('input-editar-pieza-origen').value = pieza.origen || 'Frigorífico';
      document.getElementById('input-editar-pieza-fecha').value = pieza.fecha_ingreso;
      document.getElementById('modal-editar-pieza-error').classList.remove('activo');
  
      const nombreEl = document.getElementById('modal-editar-pieza-nombre');
      if (nombreEl) {
        nombreEl.textContent = pieza.productos ? pieza.productos.nombre : '';
      }
  
      modal.classList.add('activo');
    }
  
    function cerrarModalEdicion() {
      const modal = document.getElementById('modal-editar-pieza');
      if (modal) modal.classList.remove('activo');
    }
  
    async function guardarEdicion() {
      const id = document.getElementById('input-editar-pieza-id').value;
      const peso = parseFloat(document.getElementById('input-editar-pieza-peso').value);
      const precio = parseFloat(document.getElementById('input-editar-pieza-precio').value);
      const origen = document.getElementById('input-editar-pieza-origen').value.trim() || 'Frigorífico';
      const fecha = document.getElementById('input-editar-pieza-fecha').value;
      const errorBox = document.getElementById('modal-editar-pieza-error');
  
      errorBox.classList.remove('activo');
  
      if (isNaN(peso) || peso <= 0) {
        errorBox.textContent = 'El peso tiene que ser un número mayor a 0.';
        errorBox.classList.add('activo');
        return;
      }
  
      if (isNaN(precio) || precio < 0) {
        errorBox.textContent = 'El precio de compra tiene que ser un número mayor o igual a 0.';
        errorBox.classList.add('activo');
        return;
      }
  
      if (!fecha) {
        errorBox.textContent = 'Elegí una fecha.';
        errorBox.classList.add('activo');
        return;
      }
  
      const { error } = await supabaseClient
        .from('piezas')
        .update({ peso_kg: peso, precio_compra_kg: precio, origen: origen, fecha_ingreso: fecha })
        .eq('id', id);
  
      if (error) {
        errorBox.textContent = 'Error: ' + error.message;
        errorBox.classList.add('activo');
        return;
      }
  
      cerrarModalEdicion();
      cargar();
    }
  
    function inicializar() {
      const btnNuevo = document.getElementById('btn-nuevo-ingreso');
      if (btnNuevo && !btnNuevo.dataset.enganchado) {
        btnNuevo.addEventListener('click', abrirModal);
        btnNuevo.dataset.enganchado = '1';
      }
  
      const btnCancelar = document.getElementById('btn-cancelar-ingreso');
      if (btnCancelar && !btnCancelar.dataset.enganchado) {
        btnCancelar.addEventListener('click', cerrarModal);
        btnCancelar.dataset.enganchado = '1';
      }
  
      const btnCerrarX = document.getElementById('btn-cerrar-ingreso');
      if (btnCerrarX && !btnCerrarX.dataset.enganchado) {
        btnCerrarX.addEventListener('click', cerrarModal);
        btnCerrarX.dataset.enganchado = '1';
      }
  
      const btnAgregar = document.getElementById('btn-agregar-a-lista');
      if (btnAgregar && !btnAgregar.dataset.enganchado) {
        btnAgregar.addEventListener('click', agregarALista);
        btnAgregar.dataset.enganchado = '1';
      }
  
      const btnGuardar = document.getElementById('btn-guardar-ingreso');
      if (btnGuardar && !btnGuardar.dataset.enganchado) {
        btnGuardar.addEventListener('click', guardarTodas);
        btnGuardar.dataset.enganchado = '1';
      }
  
      const selectProducto = document.getElementById('input-ingreso-producto');
      if (selectProducto && !selectProducto.dataset.enganchado) {
        selectProducto.addEventListener('change', actualizarPrecioDesdeProducto);
        selectProducto.dataset.enganchado = '1';
      }
  
      const inputPeso = document.getElementById('input-ingreso-peso');
      if (inputPeso && !inputPeso.dataset.enganchado) {
        inputPeso.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            agregarALista();
          }
        });
        inputPeso.dataset.enganchado = '1';
      }
  
      const btnCancelarEdit = document.getElementById('btn-cancelar-editar-pieza');
      if (btnCancelarEdit && !btnCancelarEdit.dataset.enganchado) {
        btnCancelarEdit.addEventListener('click', cerrarModalEdicion);
        btnCancelarEdit.dataset.enganchado = '1';
      }
  
      const btnCerrarEditX = document.getElementById('btn-cerrar-editar-pieza');
      if (btnCerrarEditX && !btnCerrarEditX.dataset.enganchado) {
        btnCerrarEditX.addEventListener('click', cerrarModalEdicion);
        btnCerrarEditX.dataset.enganchado = '1';
      }
  
      const btnGuardarEdit = document.getElementById('btn-guardar-editar-pieza');
      if (btnGuardarEdit && !btnGuardarEdit.dataset.enganchado) {
        btnGuardarEdit.addEventListener('click', guardarEdicion);
        btnGuardarEdit.dataset.enganchado = '1';
      }
  
      cargar();
    }
  
    return { inicializar };
  })();