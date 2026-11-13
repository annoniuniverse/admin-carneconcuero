/* ============================
   Precios - admin-carneconcuero
   ============================ */

   const Precios = (() => {
    let productos = [];
  
    function formatearPrecio(valor) {
      return '$' + Math.round(valor).toLocaleString('es-AR');
    }
  
    function calcularMargen(precioCompra, precioVenta) {
      if (precioCompra <= 0) return 0;
      return ((precioVenta - precioCompra) / precioCompra) * 100;
    }
  
    function calcularGananciaKg(precioCompra, precioVenta) {
      return precioVenta - precioCompra;
    }
  
    async function cargar() {
      const tbody = document.getElementById('tbody-precios');
      if (!tbody) return;
  
      tbody.innerHTML = '<tr><td colspan="7" class="text-center texto-secundario" style="padding: 2rem;">Cargando...</td></tr>';
  
      const { data, error } = await supabaseClient
        .from('productos')
        .select('*')
        .order('nombre', { ascending: true });
  
      if (error) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 2rem; color: #dc2626;">Error al cargar: ' + error.message + '</td></tr>';
        return;
      }
  
      productos = data || [];
      renderizarTabla();
    }
  
    function renderizarTabla() {
      const tbody = document.getElementById('tbody-precios');
      if (!tbody) return;
  
      if (productos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center texto-secundario" style="padding: 2rem;">No hay productos cargados. Agregá el primero.</td></tr>';
        return;
      }
  
      tbody.innerHTML = '';
  
      productos.forEach((prod) => {
        const esUnidad = prod.tipo_venta === 'unidad';
        const tipoTexto = esUnidad ? 'Por unidad' : 'Por kilo';
        const tipoClase = esUnidad ? 'estado-vendido' : 'estado-disponible';
  
        let precioCompraMostrar, precioVentaMostrar, margen, ganancia;
  
        if (esUnidad) {
          const pcUnidad = prod.precio_compra_unidad || 0;
          const pvUnidad = prod.precio_venta_unidad || 0;
          precioCompraMostrar = formatearPrecio(pcUnidad) + ' / u.';
          precioVentaMostrar = formatearPrecio(pvUnidad) + ' / u.';
          margen = calcularMargen(pcUnidad, pvUnidad);
          ganancia = calcularGananciaKg(pcUnidad, pvUnidad);
        } else {
          precioCompraMostrar = formatearPrecio(prod.precio_compra_kg);
          precioVentaMostrar = formatearPrecio(prod.precio_venta_kg);
          margen = calcularMargen(prod.precio_compra_kg, prod.precio_venta_kg);
          ganancia = calcularGananciaKg(prod.precio_compra_kg, prod.precio_venta_kg);
        }
  
        const fila = document.createElement('tr');
        fila.innerHTML = `
          <td>${prod.nombre}</td>
          <td><span class="estado-badge ${tipoClase}">${tipoTexto}</span></td>
          <td>${precioCompraMostrar}</td>
          <td>${precioVentaMostrar}</td>
          <td style="color: ${margen >= 0 ? '#10b981' : '#dc2626'}; font-weight: 700;">${margen.toFixed(1)}%</td>
          <td style="color: ${ganancia >= 0 ? '#10b981' : '#dc2626'}; font-weight: 700;">${formatearPrecio(ganancia)}</td>
          <td>
            <button class="btn-secundario" data-editar="${prod.id}" style="padding: 0.35rem 0.6rem; font-size: 0.8rem;">Editar</button>
            <button class="btn-peligro" data-eliminar="${prod.id}">Borrar</button>
          </td>
        `;
        tbody.appendChild(fila);
      });
  
      tbody.querySelectorAll('[data-editar]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-editar');
          const prod = productos.find((p) => p.id === id);
          if (prod) abrirModalEdicion(prod);
        });
      });
  
      tbody.querySelectorAll('[data-eliminar]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-eliminar');
          if (!confirm('¿Borrar este producto? Si tiene piezas asociadas, no se va a poder.')) return;
          const { error } = await supabaseClient.from('productos').delete().eq('id', id);
          if (error) {
            alert('No se pudo borrar: ' + error.message);
          } else {
            cargar();
          }
        });
      });
    }
  
    function actualizarFormularioTipo() {
      const tipo = document.getElementById('input-producto-tipo').value;
      const labelCompra = document.getElementById('label-producto-compra');
      const labelVenta = document.getElementById('label-producto-venta');
      const inputCompra = document.getElementById('input-producto-compra');
      const inputVentaKg = document.getElementById('input-producto-venta');
      const inputVentaUnidad = document.getElementById('input-producto-venta-unidad');
      const grupoVentaKg = document.getElementById('grupo-producto-venta-kg');
      const grupoVentaUnidad = document.getElementById('grupo-producto-venta-unidad');
  
      if (tipo === 'unidad') {
        if (labelCompra) labelCompra.textContent = 'Precio compra / unidad';
        if (labelVenta) labelVenta.textContent = 'Precio venta / unidad';
        if (grupoVentaKg) grupoVentaKg.style.display = 'none';
        if (grupoVentaUnidad) grupoVentaUnidad.style.display = '';
      } else {
        if (labelCompra) labelCompra.textContent = 'Precio compra / kg';
        if (labelVenta) labelVenta.textContent = 'Precio venta / kg';
        if (grupoVentaKg) grupoVentaKg.style.display = '';
        if (grupoVentaUnidad) grupoVentaUnidad.style.display = 'none';
      }
    }
  
    function abrirModalNuevo() {
      const modal = document.getElementById('modal-producto');
      if (!modal) return;
      document.getElementById('modal-producto-titulo').textContent = 'Nuevo producto';
      document.getElementById('input-producto-id').value = '';
      document.getElementById('input-producto-nombre').value = '';
      document.getElementById('input-producto-compra').value = '';
      document.getElementById('input-producto-venta').value = '';
      document.getElementById('input-producto-venta-unidad').value = '';
      document.getElementById('input-producto-tipo').value = 'kilo';
      document.getElementById('modal-producto-error').classList.remove('activo');
      actualizarFormularioTipo();
      modal.classList.add('activo');
    }
  
    function abrirModalEdicion(prod) {
      const modal = document.getElementById('modal-producto');
      if (!modal) return;
      const esUnidad = prod.tipo_venta === 'unidad';
  
      document.getElementById('modal-producto-titulo').textContent = 'Editar producto';
      document.getElementById('input-producto-id').value = prod.id;
      document.getElementById('input-producto-nombre').value = prod.nombre;
      document.getElementById('input-producto-tipo').value = prod.tipo_venta || 'kilo';
  
      if (esUnidad) {
        document.getElementById('input-producto-compra').value = prod.precio_compra_unidad || '';
        document.getElementById('input-producto-venta-unidad').value = prod.precio_venta_unidad || '';
        document.getElementById('input-producto-venta').value = '';
      } else {
        document.getElementById('input-producto-compra').value = prod.precio_compra_kg || '';
        document.getElementById('input-producto-venta').value = prod.precio_venta_kg || '';
        document.getElementById('input-producto-venta-unidad').value = '';
      }
  
      document.getElementById('modal-producto-error').classList.remove('activo');
      actualizarFormularioTipo();
      modal.classList.add('activo');
    }
  
    function cerrarModal() {
      const modal = document.getElementById('modal-producto');
      if (modal) modal.classList.remove('activo');
    }
  
    async function guardar() {
      const id = document.getElementById('input-producto-id').value.trim();
      const nombre = document.getElementById('input-producto-nombre').value.trim();
      const tipo = document.getElementById('input-producto-tipo').value;
      const errorBox = document.getElementById('modal-producto-error');
  
      errorBox.classList.remove('activo');
  
      if (!nombre) {
        errorBox.textContent = 'El nombre es obligatorio.';
        errorBox.classList.add('activo');
        return;
      }
  
      const payload = {
        nombre: nombre,
        tipo_venta: tipo,
        activo: true
      };
  
      if (tipo === 'unidad') {
        const compra = parseFloat(document.getElementById('input-producto-compra').value);
        const ventaUnidad = parseFloat(document.getElementById('input-producto-venta-unidad').value);
  
        if (isNaN(compra) || compra < 0) {
          errorBox.textContent = 'El precio de compra por unidad tiene que ser un número mayor o igual a 0.';
          errorBox.classList.add('activo');
          return;
        }
        if (isNaN(ventaUnidad) || ventaUnidad < 0) {
          errorBox.textContent = 'El precio de venta por unidad tiene que ser un número mayor o igual a 0.';
          errorBox.classList.add('activo');
          return;
        }
  
        payload.precio_compra_unidad = compra;
        payload.precio_venta_unidad = ventaUnidad;
        payload.precio_compra_kg = null;
        payload.precio_venta_kg = null;
      } else {
        const compra = parseFloat(document.getElementById('input-producto-compra').value);
        const ventaKg = parseFloat(document.getElementById('input-producto-venta').value);
  
        if (isNaN(compra) || compra < 0) {
          errorBox.textContent = 'El precio de compra por kg tiene que ser un número mayor o igual a 0.';
          errorBox.classList.add('activo');
          return;
        }
        if (isNaN(ventaKg) || ventaKg < 0) {
          errorBox.textContent = 'El precio de venta por kg tiene que ser un número mayor o igual a 0.';
          errorBox.classList.add('activo');
          return;
        }
  
        payload.precio_compra_kg = compra;
        payload.precio_venta_kg = ventaKg;
        payload.precio_compra_unidad = null;
        payload.precio_venta_unidad = null;
      }
  
      let resultado;
      if (id) {
        resultado = await supabaseClient.from('productos').update(payload).eq('id', id);
      } else {
        resultado = await supabaseClient.from('productos').insert([payload]);
      }
  
      if (resultado.error) {
        errorBox.textContent = 'Error: ' + resultado.error.message;
        errorBox.classList.add('activo');
        return;
      }
  
      cerrarModal();
      cargar();
    }
  
    function inicializar() {
      const btnNuevo = document.getElementById('btn-nuevo-producto');
      if (btnNuevo && !btnNuevo.dataset.enganchado) {
        btnNuevo.addEventListener('click', abrirModalNuevo);
        btnNuevo.dataset.enganchado = '1';
      }
  
      const btnCancelar = document.getElementById('btn-cancelar-producto');
      if (btnCancelar && !btnCancelar.dataset.enganchado) {
        btnCancelar.addEventListener('click', cerrarModal);
        btnCancelar.dataset.enganchado = '1';
      }
  
      const btnGuardar = document.getElementById('btn-guardar-producto');
      if (btnGuardar && !btnGuardar.dataset.enganchado) {
        btnGuardar.addEventListener('click', guardar);
        btnGuardar.dataset.enganchado = '1';
      }
  
      const selectTipo = document.getElementById('input-producto-tipo');
      if (selectTipo && !selectTipo.dataset.enganchado) {
        selectTipo.addEventListener('change', actualizarFormularioTipo);
        selectTipo.dataset.enganchado = '1';
      }
  
      cargar();
    }
  
    return { inicializar };
  })();