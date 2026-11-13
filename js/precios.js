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
  
    // Cargar productos desde Supabase
    async function cargar() {
      const tbody = document.getElementById('tbody-precios');
      if (!tbody) return;
  
      tbody.innerHTML = '<tr><td colspan="6" class="text-center texto-secundario" style="padding: 2rem;">Cargando...</td></tr>';
  
      const { data, error } = await supabaseClient
        .from('productos')
        .select('*')
        .order('nombre', { ascending: true });
  
      if (error) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 2rem; color: #dc2626;">Error al cargar: ' + error.message + '</td></tr>';
        return;
      }
  
      productos = data || [];
      renderizarTabla();
    }
  
    function renderizarTabla() {
      const tbody = document.getElementById('tbody-precios');
      if (!tbody) return;
  
      if (productos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center texto-secundario" style="padding: 2rem;">No hay productos cargados. Agregá el primero.</td></tr>';
        return;
      }
  
      tbody.innerHTML = '';
  
      productos.forEach((prod) => {
        const margen = calcularMargen(prod.precio_compra_kg, prod.precio_venta_kg);
        const ganancia = calcularGananciaKg(prod.precio_compra_kg, prod.precio_venta_kg);
  
        const fila = document.createElement('tr');
        fila.innerHTML = `
          <td>${prod.nombre}</td>
          <td>${formatearPrecio(prod.precio_compra_kg)}</td>
          <td>${formatearPrecio(prod.precio_venta_kg)}</td>
          <td style="color: ${margen >= 0 ? '#10b981' : '#dc2626'}; font-weight: 700;">${margen.toFixed(1)}%</td>
          <td style="color: ${ganancia >= 0 ? '#10b981' : '#dc2626'}; font-weight: 700;">${formatearPrecio(ganancia)}</td>
          <td>
            <button class="btn-secundario" data-editar="${prod.id}" style="padding: 0.35rem 0.6rem; font-size: 0.8rem;">Editar</button>
            <button class="btn-peligro" data-eliminar="${prod.id}">Borrar</button>
          </td>
        `;
        tbody.appendChild(fila);
      });
  
      // Listeners
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
  
    // Abrir modal para nuevo producto
    function abrirModalNuevo() {
      const modal = document.getElementById('modal-producto');
      if (!modal) return;
      document.getElementById('modal-producto-titulo').textContent = 'Nuevo producto';
      document.getElementById('input-producto-id').value = '';
      document.getElementById('input-producto-nombre').value = '';
      document.getElementById('input-producto-compra').value = '';
      document.getElementById('input-producto-venta').value = '';
      document.getElementById('modal-producto-error').classList.remove('activo');
      modal.classList.add('activo');
    }
  
    // Abrir modal para editar
    function abrirModalEdicion(prod) {
      const modal = document.getElementById('modal-producto');
      if (!modal) return;
      document.getElementById('modal-producto-titulo').textContent = 'Editar producto';
      document.getElementById('input-producto-id').value = prod.id;
      document.getElementById('input-producto-nombre').value = prod.nombre;
      document.getElementById('input-producto-compra').value = prod.precio_compra_kg;
      document.getElementById('input-producto-venta').value = prod.precio_venta_kg;
      document.getElementById('modal-producto-error').classList.remove('activo');
      modal.classList.add('activo');
    }
  
    function cerrarModal() {
      const modal = document.getElementById('modal-producto');
      if (modal) modal.classList.remove('activo');
    }
  
    async function guardar() {
      const id = document.getElementById('input-producto-id').value.trim();
      const nombre = document.getElementById('input-producto-nombre').value.trim();
      const compra = parseFloat(document.getElementById('input-producto-compra').value);
      const venta = parseFloat(document.getElementById('input-producto-venta').value);
      const errorBox = document.getElementById('modal-producto-error');
  
      errorBox.classList.remove('activo');
  
      if (!nombre) {
        errorBox.textContent = 'El nombre es obligatorio.';
        errorBox.classList.add('activo');
        return;
      }
      if (isNaN(compra) || compra < 0) {
        errorBox.textContent = 'El precio de compra tiene que ser un número mayor o igual a 0.';
        errorBox.classList.add('activo');
        return;
      }
      if (isNaN(venta) || venta < 0) {
        errorBox.textContent = 'El precio de venta tiene que ser un número mayor o igual a 0.';
        errorBox.classList.add('activo');
        return;
      }
  
      const payload = {
        nombre: nombre,
        precio_compra_kg: compra,
        precio_venta_kg: venta,
        activo: true
      };
  
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
      if (btnNuevo) btnNuevo.addEventListener('click', abrirModalNuevo);
  
      const btnCancelar = document.getElementById('btn-cancelar-producto');
      if (btnCancelar) btnCancelar.addEventListener('click', cerrarModal);
  
      const btnGuardar = document.getElementById('btn-guardar-producto');
      if (btnGuardar) btnGuardar.addEventListener('click', guardar);
  
      cargar();
    }
  
    return { inicializar };
  })();