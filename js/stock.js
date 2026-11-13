/* ============================
   Stock - admin-carneconcuero
   ============================ */

   const Stock = (() => {
    function formatearPrecio(valor) {
      return '$' + Math.round(valor).toLocaleString('es-AR');
    }
  
    function formatearFecha(fechaStr) {
      if (!fechaStr) return '—';
      const partes = fechaStr.split('-');
      if (partes.length !== 3) return fechaStr;
      return partes[2] + '/' + partes[1] + '/' + partes[0];
    }
  
    async function cargar() {
      const tbody = document.getElementById('tbody-stock');
      if (!tbody) return;
  
      tbody.innerHTML = '<tr><td colspan="5" class="text-center texto-secundario" style="padding: 2rem;">Cargando...</td></tr>';
  
      const { data, error } = await supabaseClient
        .from('piezas')
        .select('*, productos(nombre, tipo_venta)')
        .eq('estado', 'disponible')
        .order('created_at', { ascending: true });
  
      if (error) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 2rem; color: #dc2626;">Error al cargar stock: ' + error.message + '</td></tr>';
        return;
      }
  
      const piezasMostrar = (data || []).filter((p) => {
        const tipo = p.productos ? p.productos.tipo_venta : 'kilo';
        if (tipo === 'unidad') {
          return (p.cantidad || 0) > 0;
        }
        return true;
      });
  
      renderizar(piezasMostrar);
    }
  
    function renderizar(piezas) {
      const tbody = document.getElementById('tbody-stock');
      if (!tbody) return;
  
      if (piezas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center texto-secundario" style="padding: 2rem;">No hay piezas disponibles en stock.</td></tr>';
        return;
      }
  
      tbody.innerHTML = '';
  
      piezas.forEach((p) => {
        const nombreProducto = p.productos ? p.productos.nombre : '(producto eliminado)';
        const tipo = p.productos ? p.productos.tipo_venta : 'kilo';
        const esPorUnidad = tipo === 'unidad';
  
        let pesoMostrar, precioCompraMostrar;
  
        if (esPorUnidad) {
          const cantidad = p.cantidad || 0;
          const precioUnidad = p.precio_compra_unidad || 0;
          pesoMostrar = cantidad + ' u.';
          precioCompraMostrar = formatearPrecio(precioUnidad) + ' / u.';
        } else {
          pesoMostrar = p.peso_kg.toFixed(3) + ' kg';
          precioCompraMostrar = formatearPrecio(p.precio_compra_kg) + ' / kg';
        }
  
        const fila = document.createElement('tr');
        fila.innerHTML = `
          <td>${nombreProducto}</td>
          <td>${pesoMostrar}</td>
          <td>${precioCompraMostrar}</td>
          <td>${formatearFecha(p.fecha_ingreso)}</td>
          <td><span class="estado-badge estado-disponible">Disponible</span></td>
        `;
        tbody.appendChild(fila);
      });
    }
  
    function inicializar() {
      cargar();
    }
  
    return { inicializar };
  })();