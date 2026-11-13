/* ============================
   Pedidos - admin-carneconcuero
   ============================ */

   const Pedidos = (() => {
    let productos = [];
    let pedidos = [];
    let piezasDisponibles = [];
  
    // Cada selección: { piezaId, productoId, nombreProducto, tipoVenta, cantidad, pesoUnitario, peso, precioCompra, precioVentaKg, precioVentaUnidad, unidadesDisponibles }
    let piezasSeleccionadas = [];
    let modoEdicion = false;
    let pedidoEditandoId = null;
    let estadoPedidoEditando = null;
  
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
  
    // Calcula el subtotal de un item seleccionado
    function calcularSubtotalItem(item) {
      if (item.tipoVenta === 'unidad') {
        return item.precioVentaUnidad * item.cantidad;
      }
      return item.precioVentaKg * item.peso;
    }
  
    // ----- CARGA DE DATOS -----
  
    async function cargar() {
      const tbody = document.getElementById('tbody-pedidos');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center texto-secundario" style="padding: 2rem;">Cargando...</td></tr>';
      }
  
      const resPedidos = await supabaseClient
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false });
  
      if (resPedidos.error) {
        if (tbody) {
          tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 2rem; color: #dc2626;">Error al cargar pedidos: ' + resPedidos.error.message + '</td></tr>';
        }
        return;
      }
  
      pedidos = resPedidos.data || [];
  
      if (pedidos.length > 0) {
        const idsPedidos = pedidos.map((p) => p.id);
  
        // Items de pedido con pieza y producto
        const resItems = await supabaseClient
          .from('pedido_items')
          .select('id, pedido_id, pieza_id, precio_venta_kg, precio_venta_unidad, piezas!pedido_items_pieza_id_fkey(peso_kg, peso_unitario_kg, productos(nombre, tipo_venta))')
          .in('pedido_id', idsPedidos);
  
        if (resItems.error) {
          if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 2rem; color: #dc2626;">Error al cargar items: ' + resItems.error.message + '</td></tr>';
          }
          return;
        }
  
        // Unidades asociadas a cada pedido_item (para productos por unidad)
        const idsItems = (resItems.data || []).map((i) => i.id);
        let unidadesPorItem = {};
        if (idsItems.length > 0) {
          const resUnidades = await supabaseClient
            .from('pedido_item_unidades')
            .select('pedido_item_id, cantidad')
            .in('pedido_item_id', idsItems);
  
          if (!resUnidades.error) {
            (resUnidades.data || []).forEach((u) => {
              if (!unidadesPorItem[u.pedido_item_id]) unidadesPorItem[u.pedido_item_id] = 0;
              unidadesPorItem[u.pedido_item_id] += u.cantidad;
            });
          }
        }
  
        const itemsPorPedido = {};
        (resItems.data || []).forEach((item) => {
          item.unidades = unidadesPorItem[item.id] || 0;
          if (!itemsPorPedido[item.pedido_id]) itemsPorPedido[item.pedido_id] = [];
          itemsPorPedido[item.pedido_id].push(item);
        });
  
        pedidos.forEach((p) => {
          p.pedido_items = itemsPorPedido[p.id] || [];
        });
      }
  
      renderizarTabla();
    }
  
    async function cargarProductosYDisponibles() {
      const resProd = await supabaseClient
        .from('productos')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true });
  
      if (resProd.error) return;
      productos = resProd.data || [];
  
      const resPiezas = await supabaseClient
        .from('piezas')
        .select('*, productos(nombre, tipo_venta)')
        .order('created_at', { ascending: true });
  
      if (resPiezas.error) return;
      piezasDisponibles = resPiezas.data || [];
    }
  
    // ----- TABLA -----
  
    function renderizarTabla() {
      const tbody = document.getElementById('tbody-pedidos');
      if (!tbody) return;
  
      if (pedidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center texto-secundario" style="padding: 2rem;">Todavía no hay pedidos cargados.</td></tr>';
        return;
      }
  
      tbody.innerHTML = '';
  
      pedidos.forEach((p) => {
        const cantidadPiezas = p.pedido_items ? p.pedido_items.length : 0;
  
        let totalVenta = 0;
        (p.pedido_items || []).forEach((item) => {
          const prod = item.piezas && item.piezas.productos ? item.piezas.productos : null;
          const tipo = prod ? prod.tipo_venta : 'kilo';
  
          if (tipo === 'unidad') {
            totalVenta += (item.precio_venta_unidad || 0) * (item.unidades || 0);
          } else {
            const peso = item.piezas ? item.piezas.peso_kg : 0;
            totalVenta += (item.precio_venta_kg || 0) * peso;
          }
        });
  
        const estadoClase = 'estado-' + p.estado;
        const estadoTexto = p.estado.charAt(0).toUpperCase() + p.estado.slice(1);
  
        let botones = '';
        if (p.estado === 'pendiente') {
          botones = `
            <button class="btn-secundario" data-editar-pedido="${p.id}" style="padding: 0.35rem 0.6rem; font-size: 0.8rem;">Editar</button>
            <button class="btn-secundario" data-marcar-entregado="${p.id}" style="padding: 0.35rem 0.6rem; font-size: 0.8rem;">Entregado</button>
            <button class="btn-peligro" data-cancelar="${p.id}">Cancelar</button>
            <button class="btn-peligro" data-borrar-pedido="${p.id}" title="Borrar pedido">Borrar</button>
          `;
        } else if (p.estado === 'entregado') {
          botones = `
            <button class="btn-secundario" data-editar-pedido="${p.id}" style="padding: 0.35rem 0.6rem; font-size: 0.8rem;">Editar datos</button>
            <button class="btn-peligro" data-borrar-pedido="${p.id}" title="Borrar pedido">Borrar</button>
          `;
        } else {
          botones = `
            <button class="btn-peligro" data-borrar-pedido="${p.id}" title="Borrar pedido">Borrar</button>
          `;
        }
  
        const fila = document.createElement('tr');
        fila.innerHTML = `
          <td>${formatearFecha(p.fecha)}</td>
          <td>${p.cliente_nombre}</td>
          <td>${p.cliente_telefono || '—'}</td>
          <td>${p.cliente_direccion || '—'}</td>
          <td><span class="estado-badge ${estadoClase}">${estadoTexto}</span></td>
          <td>${cantidadPiezas}</td>
          <td>${formatearPrecio(totalVenta)}</td>
          <td>${botones}</td>
        `;
        tbody.appendChild(fila);
      });
  
      tbody.querySelectorAll('[data-editar-pedido]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-editar-pedido');
          const pedido = pedidos.find((p) => p.id === id);
          if (pedido) await abrirModalEdicion(pedido);
        });
      });
  
      tbody.querySelectorAll('[data-marcar-entregado]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-marcar-entregado');
          if (!confirm('¿Marcar este pedido como entregado?')) return;
          const { error } = await supabaseClient.from('pedidos').update({ estado: 'entregado' }).eq('id', id);
          if (error) {
            alert('Error: ' + error.message);
          } else {
            cargar();
          }
        });
      });
  
      tbody.querySelectorAll('[data-cancelar]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-cancelar');
          if (!confirm('¿Cancelar este pedido? Las piezas vuelven a estar disponibles.')) return;
  
          await liberarPiezasDePedido(id);
          const { error: errPedido } = await supabaseClient.from('pedidos').update({ estado: 'cancelado' }).eq('id', id);
          if (errPedido) {
            alert('Error: ' + errPedido.message);
            return;
          }
  
          cargar();
        });
      });
  
      tbody.querySelectorAll('[data-borrar-pedido]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-borrar-pedido');
          const pedido = pedidos.find((p) => p.id === id);
          if (!pedido) return;
  
          if (pedido.estado === 'entregado') {
            if (!confirm('Este pedido está ENTREGADO. Si lo borrás, va a desaparecer del resumen y las cuentas van a cambiar. ¿Continuar?')) return;
            if (!confirm('¿Estás seguro? Esta acción no se puede deshacer.')) return;
          } else {
            if (!confirm('¿Borrar este pedido? Esta acción no se puede deshacer.')) return;
          }
  
          if (pedido.estado !== 'cancelado') {
            await liberarPiezasDePedido(id);
          }
  
          // Borrar pedido_item_unidades
          const resItems = await supabaseClient.from('pedido_items').select('id').eq('pedido_id', id);
          if (!resItems.error && resItems.data && resItems.data.length > 0) {
            const idsItems = resItems.data.map((i) => i.id);
            await supabaseClient.from('pedido_item_unidades').delete().in('pedido_item_id', idsItems);
          }
  
          await supabaseClient.from('pedido_items').delete().eq('pedido_id', id);
  
          const { error } = await supabaseClient.from('pedidos').delete().eq('id', id);
          if (error) {
            alert('Error borrando pedido: ' + error.message);
            return;
          }
  
          cargar();
        });
      });
    }
  
    // Libera las piezas de un pedido (para cancelar o borrar)
    async function liberarPiezasDePedido(pedidoId) {
      // Traer items con datos de pieza
      const resItems = await supabaseClient
        .from('pedido_items')
        .select('id, pieza_id, piezas!pedido_items_pieza_id_fkey(cantidad, peso_unitario_kg, productos(tipo_venta))')
        .eq('pedido_id', pedidoId);
  
      if (resItems.error) return;
  
      // Traer unidades
      const idsItems = (resItems.data || []).map((i) => i.id);
      let unidadesPorItem = {};
      if (idsItems.length > 0) {
        const resUnidades = await supabaseClient
          .from('pedido_item_unidades')
          .select('pedido_item_id, cantidad')
          .in('pedido_item_id', idsItems);
        if (!resUnidades.error) {
          (resUnidades.data || []).forEach((u) => {
            if (!unidadesPorItem[u.pedido_item_id]) unidadesPorItem[u.pedido_item_id] = 0;
            unidadesPorItem[u.pedido_item_id] += u.cantidad;
          });
        }
      }
  
      for (const item of resItems.data || []) {
        const pz = item.piezas;
        if (!pz) continue;
        const tipo = pz.productos ? pz.productos.tipo_venta : 'kilo';
  
        if (tipo === 'unidad') {
          // Devolver unidades a la pieza
          const unidadesADevolver = unidadesPorItem[item.id] || 0;
          if (unidadesADevolver > 0) {
            const nuevaCantidad = (pz.cantidad || 0) + unidadesADevolver;
            await supabaseClient
              .from('piezas')
              .update({ cantidad: nuevaCantidad, estado: 'disponible' })
              .eq('id', item.pieza_id);
          }
        } else {
          // Pieza completa vuelve a disponible
          await supabaseClient
            .from('piezas')
            .update({ estado: 'disponible', pedido_item_id: null })
            .eq('id', item.pieza_id);
        }
      }
  
      // Borrar registros de pedido_item_unidades
      if (idsItems.length > 0) {
        await supabaseClient.from('pedido_item_unidades').delete().in('pedido_item_id', idsItems);
      }
    }
  
    // ----- MODAL -----
  
    async function abrirModal() {
      const modal = document.getElementById('modal-pedido');
      if (!modal) return;
  
      await cargarProductosYDisponibles();
      piezasSeleccionadas = [];
      modoEdicion = false;
      pedidoEditandoId = null;
      estadoPedidoEditando = null;
  
      document.getElementById('modal-pedido-titulo').textContent = 'Nuevo pedido';
      document.getElementById('btn-guardar-pedido').textContent = 'Guardar pedido';
      document.getElementById('input-pedido-nombre').value = '';
      document.getElementById('input-pedido-telefono').value = '';
      document.getElementById('input-pedido-direccion').value = '';
      document.getElementById('input-pedido-notas').value = '';
      document.getElementById('input-pedido-fecha').value = fechaHoyISO();
      document.getElementById('modal-pedido-error').classList.remove('activo');
  
      bloquearEdicionPiezas(false);
  
      cargarDropdownProductosPedido();
      renderizarPiezasDisponibles();
      renderizarSeleccionadas();
  
      modal.classList.add('activo');
    }
  
    async function abrirModalEdicion(pedido) {
      const modal = document.getElementById('modal-pedido');
      if (!modal) return;
  
      await cargarProductosYDisponibles();
      piezasSeleccionadas = [];
      modoEdicion = true;
      pedidoEditandoId = pedido.id;
      estadoPedidoEditando = pedido.estado;
  
      document.getElementById('modal-pedido-titulo').textContent = 'Editar pedido';
      document.getElementById('btn-guardar-pedido').textContent = 'Guardar cambios';
      document.getElementById('input-pedido-nombre').value = pedido.cliente_nombre || '';
      document.getElementById('input-pedido-telefono').value = pedido.cliente_telefono || '';
      document.getElementById('input-pedido-direccion').value = pedido.cliente_direccion || '';
      document.getElementById('input-pedido-notas').value = pedido.notas || '';
      document.getElementById('input-pedido-fecha').value = pedido.fecha;
      document.getElementById('modal-pedido-error').classList.remove('activo');
  
      // Cargar items del pedido + unidades
      const resItems = await supabaseClient
        .from('pedido_items')
        .select('id, precio_venta_kg, precio_venta_unidad, pieza_id, piezas!pedido_items_pieza_id_fkey(peso_kg, peso_unitario_kg, cantidad, producto_id, productos(nombre, tipo_venta))')
        .eq('pedido_id', pedido.id);
  
      if (resItems.error) {
        document.getElementById('modal-pedido-error').textContent = 'Error cargando piezas del pedido: ' + resItems.error.message;
        document.getElementById('modal-pedido-error').classList.add('activo');
        return;
      }
  
      const idsItems = (resItems.data || []).map((i) => i.id);
      let unidadesPorItem = {};
      if (idsItems.length > 0) {
        const resUnidades = await supabaseClient
          .from('pedido_item_unidades')
          .select('pedido_item_id, cantidad')
          .in('pedido_item_id', idsItems);
        if (!resUnidades.error) {
          (resUnidades.data || []).forEach((u) => {
            if (!unidadesPorItem[u.pedido_item_id]) unidadesPorItem[u.pedido_item_id] = 0;
            unidadesPorItem[u.pedido_item_id] += u.cantidad;
          });
        }
      }
  
      (resItems.data || []).forEach((item) => {
        const pz = item.piezas;
        if (!pz) return;
        const prod = pz.productos;
        const tipo = prod ? prod.tipo_venta : 'kilo';
  
        piezasSeleccionadas.push({
          pedidoItemId: item.id,
          piezaId: item.pieza_id,
          productoId: pz.producto_id,
          nombreProducto: prod ? prod.nombre : '—',
          tipoVenta: tipo,
          cantidad: unidadesPorItem[item.id] || 0,
          pesoUnitario: pz.peso_unitario_kg || 0,
          peso: pz.peso_kg,
          precioCompra: 0,
          precioVentaKg: item.precio_venta_kg || 0,
          precioVentaUnidad: item.precio_venta_unidad || 0
        });
      });
  
      const bloquear = pedido.estado === 'entregado';
      bloquearEdicionPiezas(bloquear);
  
      cargarDropdownProductosPedido();
      renderizarPiezasDisponibles();
      renderizarSeleccionadas();
  
      modal.classList.add('activo');
    }
  
    function bloquearEdicionPiezas(bloquear) {
      const select = document.getElementById('input-pedido-producto');
      const contDisp = document.getElementById('lista-piezas-disponibles');
      const bloqueo = document.getElementById('aviso-pedido-bloqueado');
  
      if (select) select.disabled = bloquear;
      if (contDisp) {
        contDisp.style.opacity = bloquear ? '0.5' : '1';
        contDisp.style.pointerEvents = bloquear ? 'none' : 'auto';
      }
      if (bloqueo) {
        bloqueo.style.display = bloquear ? 'block' : 'none';
      }
    }
  
    function cerrarModal() {
      const modal = document.getElementById('modal-pedido');
      if (modal) modal.classList.remove('activo');
    }
  
    function cargarDropdownProductosPedido() {
      const select = document.getElementById('input-pedido-producto');
      if (!select) return;
  
      select.innerHTML = '<option value="">— Elegí un producto —</option>';
      productos.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.nombre;
        select.appendChild(opt);
      });
    }
  
    function renderizarPiezasDisponibles() {
      const contenedor = document.getElementById('lista-piezas-disponibles');
      const selectProd = document.getElementById('input-pedido-producto');
      if (!contenedor || !selectProd) return;
  
      if (modoEdicion && estadoPedidoEditando === 'entregado') {
        contenedor.innerHTML = '<p class="texto-secundario text-sm" style="padding: 0.5rem 0;">Pedido entregado: no se pueden agregar piezas.</p>';
        return;
      }
  
      const prodId = selectProd.value;
      if (!prodId) {
        contenedor.innerHTML = '<p class="texto-secundario text-sm" style="padding: 0.5rem 0;">Elegí un producto para ver sus piezas disponibles.</p>';
        return;
      }
  
      const prod = productos.find((p) => p.id === prodId);
      if (!prod) return;
  
      const esUnidad = prod.tipo_venta === 'unidad';
  
      let filtradas = piezasDisponibles.filter((pz) => {
        if (pz.producto_id !== prodId) return false;
        if (esUnidad) {
          return pz.estado === 'disponible' && (pz.cantidad || 0) > 0;
        }
        return pz.estado === 'disponible';
      });
  
      if (esUnidad) {
        // Descontar unidades ya seleccionadas en este pedido de la pieza original
        filtradas = filtradas.map((pz) => {
          const yaEnPedido = piezasSeleccionadas.find((s) => s.piezaId === pz.id && s.tipoVenta === 'unidad');
          const disponibles = yaEnPedido ? Math.max(0, (pz.cantidad || 0) - yaEnPedido.cantidad) : (pz.cantidad || 0);
          return Object.assign({}, pz, { unidadesDisponibles: disponibles });
        }).filter((pz) => pz.unidadesDisponibles > 0);
      } else {
        filtradas = filtradas.filter((pz) => !piezasSeleccionadas.some((s) => s.piezaId === pz.id));
      }
  
      if (filtradas.length === 0) {
        contenedor.innerHTML = '<p class="texto-secundario text-sm" style="padding: 0.5rem 0;">No hay piezas disponibles de este producto.</p>';
        return;
      }
  
      contenedor.innerHTML = '';
      filtradas.forEach((pz) => {
        if (esUnidad) {
          const pvUnidad = prod.precio_venta_unidad || 0;
          const unidadesDisp = pz.unidadesDisponibles;
          const pesoUnit = pz.peso_unitario_kg || 0;
  
          const div = document.createElement('div');
          div.className = 'item-temporal';
          div.style.flexWrap = 'wrap';
          div.innerHTML = `
            <div style="flex: 1; min-width: 180px;">
              <strong>${unidadesDisp} u. disponibles</strong>
              <span class="texto-secundario text-sm"> — ${pesoUnit.toFixed(3)} kg/u — venta ${formatearPrecio(pvUnidad)}/u</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <input
                type="number"
                class="input-base"
                style="width: 80px; padding: 0.35rem 0.5rem; font-size: 0.85rem;"
                value="1"
                min="1"
                max="${unidadesDisp}"
                step="1"
                data-cantidad-input="${pz.id}"
              />
              <button type="button" class="btn-primario" data-agregar-unidad="${pz.id}" style="padding: 0.35rem 0.7rem; font-size: 0.8rem;">
                + Agregar
              </button>
            </div>
          `;
          contenedor.appendChild(div);
  
          div.querySelector('[data-agregar-unidad]').addEventListener('click', () => {
            const inputCant = div.querySelector('[data-cantidad-input]');
            const cant = parseInt(inputCant.value, 10);
            if (isNaN(cant) || cant <= 0) {
              alert('La cantidad tiene que ser un número mayor a 0.');
              return;
            }
            if (cant > unidadesDisp) {
              alert('No hay suficientes unidades disponibles (' + unidadesDisp + ').');
              return;
            }
  
            const existente = piezasSeleccionadas.find((s) => s.piezaId === pz.id && s.tipoVenta === 'unidad');
            if (existente) {
              existente.cantidad += cant;
            } else {
              piezasSeleccionadas.push({
                piezaId: pz.id,
                productoId: pz.producto_id,
                nombreProducto: prod.nombre,
                tipoVenta: 'unidad',
                cantidad: cant,
                pesoUnitario: pesoUnit,
                peso: pesoUnit * cant,
                precioCompra: pz.precio_compra_kg || 0,
                precioVentaKg: 0,
                precioVentaUnidad: pvUnidad
              });
            }
            renderizarPiezasDisponibles();
            renderizarSeleccionadas();
          });
        } else {
          const pvKg = prod.precio_venta_kg || 0;
          const div = document.createElement('div');
          div.className = 'item-temporal';
          div.innerHTML = `
            <div style="flex: 1;">
              <strong>${pz.peso_kg.toFixed(3)} kg</strong>
              <span class="texto-secundario text-sm"> — compra ${formatearPrecio(pz.precio_compra_kg)}/kg</span>
            </div>
            <button type="button" class="btn-primario" data-agregar-pieza="${pz.id}" style="padding: 0.35rem 0.7rem; font-size: 0.8rem;">
              + Agregar
            </button>
          `;
          contenedor.appendChild(div);
  
          div.querySelector('[data-agregar-pieza]').addEventListener('click', () => {
            piezasSeleccionadas.push({
              piezaId: pz.id,
              productoId: pz.producto_id,
              nombreProducto: prod.nombre,
              tipoVenta: 'kilo',
              cantidad: 1,
              pesoUnitario: 0,
              peso: pz.peso_kg,
              precioCompra: pz.precio_compra_kg,
              precioVentaKg: pvKg,
              precioVentaUnidad: 0
            });
            renderizarPiezasDisponibles();
            renderizarSeleccionadas();
          });
        }
      });
    }
  
    function renderizarSeleccionadas() {
      const contenedor = document.getElementById('lista-piezas-seleccionadas');
      const btnGuardar = document.getElementById('btn-guardar-pedido');
      if (!contenedor) return;
  
      if (piezasSeleccionadas.length === 0) {
        contenedor.innerHTML = '<p class="texto-secundario text-sm" style="padding: 0.5rem 0;">Todavía no agregaste piezas.</p>';
        if (btnGuardar) btnGuardar.disabled = true;
        return;
      }
  
      contenedor.innerHTML = '';
      piezasSeleccionadas.forEach((item, indice) => {
        const subtotal = calcularSubtotalItem(item);
  
        let detalle, inputPrecioValor, labelPrecio;
  
        if (item.tipoVenta === 'unidad') {
          detalle = item.cantidad + ' u. × ' + formatearPrecio(item.precioVentaUnidad) + '/u = ' + formatearPrecio(subtotal);
          inputPrecioValor = item.precioVentaUnidad;
          labelPrecio = 'Venta /u:';
        } else {
          detalle = item.peso.toFixed(3) + ' kg × ' + formatearPrecio(item.precioVentaKg) + '/kg = ' + formatearPrecio(subtotal);
          inputPrecioValor = item.precioVentaKg;
          labelPrecio = 'Venta /kg:';
        }
  
        const div = document.createElement('div');
        div.className = 'item-temporal';
        div.style.flexWrap = 'wrap';
        div.innerHTML = `
          <div style="flex: 1; min-width: 200px;">
            <strong>${item.nombreProducto}</strong>
            <span class="texto-secundario text-sm"> — ${detalle}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <label class="texto-secundario text-xs">${labelPrecio}</label>
            <input
              type="number"
              class="input-base"
              style="width: 100px; padding: 0.35rem 0.5rem; font-size: 0.85rem;"
              value="${inputPrecioValor}"
              min="0"
              step="0.01"
              data-precio-input="${indice}"
            />
            <button type="button" class="btn-peligro" data-quitar-seleccion="${indice}">✕</button>
          </div>
        `;
        contenedor.appendChild(div);
      });
  
      contenedor.querySelectorAll('[data-precio-input]').forEach((input) => {
        input.addEventListener('input', (e) => {
          const idx = parseInt(input.getAttribute('data-precio-input'), 10);
          const valor = parseFloat(e.target.value);
          if (!isNaN(valor) && valor >= 0) {
            if (piezasSeleccionadas[idx].tipoVenta === 'unidad') {
              piezasSeleccionadas[idx].precioVentaUnidad = valor;
            } else {
              piezasSeleccionadas[idx].precioVentaKg = valor;
            }
          }
        });
      });
  
      contenedor.querySelectorAll('[data-quitar-seleccion]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-quitar-seleccion'), 10);
          piezasSeleccionadas.splice(idx, 1);
          renderizarPiezasDisponibles();
          renderizarSeleccionadas();
        });
      });
  
      if (btnGuardar) btnGuardar.disabled = false;
    }
  
    // ----- GUARDAR -----
  
    async function guardarPedido() {
      const nombre = document.getElementById('input-pedido-nombre').value.trim();
      const telefono = document.getElementById('input-pedido-telefono').value.trim();
      const direccion = document.getElementById('input-pedido-direccion').value.trim();
      const notas = document.getElementById('input-pedido-notas').value.trim();
      const fecha = document.getElementById('input-pedido-fecha').value;
      const errorBox = document.getElementById('modal-pedido-error');
  
      errorBox.classList.remove('activo');
  
      if (!nombre) {
        errorBox.textContent = 'El nombre del cliente es obligatorio.';
        errorBox.classList.add('activo');
        return;
      }
      if (!fecha) {
        errorBox.textContent = 'Elegí una fecha.';
        errorBox.classList.add('activo');
        return;
      }
      if (piezasSeleccionadas.length === 0) {
        errorBox.textContent = 'Agregá al menos una pieza al pedido.';
        errorBox.classList.add('activo');
        return;
      }
  
      if (modoEdicion) {
        await guardarEdicion(nombre, telefono, direccion, notas, fecha, errorBox);
      } else {
        await guardarNuevo(nombre, telefono, direccion, notas, fecha, errorBox);
      }
    }
  
    async function guardarNuevo(nombre, telefono, direccion, notas, fecha, errorBox) {
      const { data: pedidoCreado, error: errPedido } = await supabaseClient
        .from('pedidos')
        .insert([{
          fecha: fecha,
          cliente_nombre: nombre,
          cliente_telefono: telefono || null,
          cliente_direccion: direccion || null,
          notas: notas || null,
          estado: 'pendiente'
        }])
        .select()
        .single();
  
      if (errPedido) {
        errorBox.textContent = 'Error creando pedido: ' + errPedido.message;
        errorBox.classList.add('activo');
        return;
      }
  
      // Crear los items uno por uno para poder asociar unidades
      for (const sel of piezasSeleccionadas) {
        const payloadItem = {
          pedido_id: pedidoCreado.id,
          pieza_id: sel.piezaId,
          precio_venta_kg: sel.tipoVenta === 'unidad' ? null : sel.precioVentaKg,
          precio_venta_unidad: sel.tipoVenta === 'unidad' ? sel.precioVentaUnidad : null
        };
  
        const { data: itemCreado, error: errItem } = await supabaseClient
          .from('pedido_items')
          .insert([payloadItem])
          .select()
          .single();
  
        if (errItem) {
          errorBox.textContent = 'Error creando item: ' + errItem.message;
          errorBox.classList.add('activo');
          return;
        }
  
        if (sel.tipoVenta === 'unidad') {
          // Registrar unidades
          await supabaseClient.from('pedido_item_unidades').insert([{
            pedido_item_id: itemCreado.id,
            pieza_id: sel.piezaId,
            cantidad: sel.cantidad
          }]);
  
          // Descontar de la pieza
          const piezaOriginal = piezasDisponibles.find((p) => p.id === sel.piezaId);
          const nuevaCantidad = (piezaOriginal ? piezaOriginal.cantidad : 0) - sel.cantidad;
          await supabaseClient
            .from('piezas')
            .update({
              cantidad: nuevaCantidad,
              estado: nuevaCantidad <= 0 ? 'vendido' : 'disponible'
            })
            .eq('id', sel.piezaId);
        } else {
          // Pieza por kilo completa: marcar como vendida
          await supabaseClient
            .from('piezas')
            .update({ estado: 'vendido', pedido_item_id: itemCreado.id })
            .eq('id', sel.piezaId);
        }
      }
  
      cerrarModal();
      cargar();
    }
  
    async function guardarEdicion(nombre, telefono, direccion, notas, fecha, errorBox) {
      const { error: errPedido } = await supabaseClient
        .from('pedidos')
        .update({
          fecha: fecha,
          cliente_nombre: nombre,
          cliente_telefono: telefono || null,
          cliente_direccion: direccion || null,
          notas: notas || null
        })
        .eq('id', pedidoEditandoId);
  
      if (errPedido) {
        errorBox.textContent = 'Error actualizando pedido: ' + errPedido.message;
        errorBox.classList.add('activo');
        return;
      }
  
      // Items actuales con datos
      const { data: itemsActuales, error: errGet } = await supabaseClient
        .from('pedido_items')
        .select('id, pieza_id, precio_venta_kg, precio_venta_unidad, piezas!pedido_items_pieza_id_fkey(cantidad, peso_unitario_kg, productos(tipo_venta))')
        .eq('pedido_id', pedidoEditandoId);
  
      if (errGet) {
        errorBox.textContent = 'Error leyendo items: ' + errGet.message;
        errorBox.classList.add('activo');
        return;
      }
  
      const itemsActualesArr = itemsActuales || [];
  
      // Cargar unidades actuales
      const idsItemsActuales = itemsActualesArr.map((i) => i.id);
      let unidadesActuales = {};
      if (idsItemsActuales.length > 0) {
        const resUnidades = await supabaseClient
          .from('pedido_item_unidades')
          .select('pedido_item_id, pieza_id, cantidad')
          .in('pedido_item_id', idsItemsActuales);
        if (!resUnidades.error) {
          (resUnidades.data || []).forEach((u) => {
            unidadesActuales[u.pedido_item_id] = (unidadesActuales[u.pedido_item_id] || 0) + u.cantidad;
          });
        }
      }
  
      // 1) Eliminar items que ya no están
      for (const item of itemsActualesArr) {
        const sel = piezasSeleccionadas.find((s) =>
          (s.pedidoItemId && s.pedidoItemId === item.id) ||
          (s.piezaId === item.pieza_id && !s.pedidoItemId)
        );
  
        const tipo = item.piezas && item.piezas.productos ? item.piezas.productos.tipo_venta : 'kilo';
  
        if (!sel) {
          // Devolver stock
          if (tipo === 'unidad') {
            const unidadesADevolver = unidadesActuales[item.id] || 0;
            if (unidadesADevolver > 0) {
              const nuevaCant = (item.piezas.cantidad || 0) + unidadesADevolver;
              await supabaseClient
                .from('piezas')
                .update({ cantidad: nuevaCant, estado: 'disponible' })
                .eq('id', item.pieza_id);
            }
            // Borrar unidades
            await supabaseClient.from('pedido_item_unidades').delete().eq('pedido_item_id', item.id);
          } else {
            await supabaseClient
              .from('piezas')
              .update({ estado: 'disponible', pedido_item_id: null })
              .eq('id', item.pieza_id);
          }
          // Borrar item
          await supabaseClient.from('pedido_items').delete().eq('id', item.id);
        }
      }
  
      // 2) Actualizar items existentes (precio) y ajustar unidades
      for (const sel of piezasSeleccionadas) {
        if (sel.pedidoItemId) {
          const itemActual = itemsActualesArr.find((i) => i.id === sel.pedidoItemId);
          if (!itemActual) continue;
  
          if (sel.tipoVenta === 'unidad') {
            // Actualizar precio unidad
            await supabaseClient
              .from('pedido_items')
              .update({ precio_venta_unidad: sel.precioVentaUnidad })
              .eq('id', sel.pedidoItemId);
  
            // Ajustar unidades si cambió la cantidad
            const unidadesActualesCant = unidadesActuales[sel.pedidoItemId] || 0;
            const delta = sel.cantidad - unidadesActualesCant;
  
            if (delta !== 0) {
              // Actualizar registro de unidades
              await supabaseClient.from('pedido_item_unidades').delete().eq('pedido_item_id', sel.pedidoItemId);
              if (sel.cantidad > 0) {
                await supabaseClient.from('pedido_item_unidades').insert([{
                  pedido_item_id: sel.pedidoItemId,
                  pieza_id: sel.piezaId,
                  cantidad: sel.cantidad
                }]);
              }
  
              // Ajustar stock de la pieza
              const piezaActual = itemsActualesArr.find((i) => i.pieza_id === sel.piezaId);
              const cantActualPieza = piezaActual && piezaActual.piezas ? piezaActual.piezas.cantidad : 0;
              const nuevaCant = cantActualPieza - delta;
              await supabaseClient
                .from('piezas')
                .update({
                  cantidad: nuevaCant,
                  estado: nuevaCant <= 0 ? 'vendido' : 'disponible'
                })
                .eq('id', sel.piezaId);
            }
          } else {
            // Producto por kilo: solo actualizar precio
            await supabaseClient
              .from('pedido_items')
              .update({ precio_venta_kg: sel.precioVentaKg })
              .eq('id', sel.pedidoItemId);
          }
        } else {
          // Item nuevo
          const payload = {
            pedido_id: pedidoEditandoId,
            pieza_id: sel.piezaId,
            precio_venta_kg: sel.tipoVenta === 'unidad' ? null : sel.precioVentaKg,
            precio_venta_unidad: sel.tipoVenta === 'unidad' ? sel.precioVentaUnidad : null
          };
  
          const { data: creado, error: errIns } = await supabaseClient
            .from('pedido_items')
            .insert([payload])
            .select()
            .single();
  
          if (errIns) {
            errorBox.textContent = 'Error insertando item: ' + errIns.message;
            errorBox.classList.add('activo');
            return;
          }
  
          if (sel.tipoVenta === 'unidad') {
            await supabaseClient.from('pedido_item_unidades').insert([{
              pedido_item_id: creado.id,
              pieza_id: sel.piezaId,
              cantidad: sel.cantidad
            }]);
  
            // Descontar de la pieza
            const pieza = piezasDisponibles.find((p) => p.id === sel.piezaId);
            const cantActual = pieza ? pieza.cantidad : 0;
            const nueva = cantActual - sel.cantidad;
            await supabaseClient
              .from('piezas')
              .update({
                cantidad: nueva,
                estado: nueva <= 0 ? 'vendido' : 'disponible'
              })
              .eq('id', sel.piezaId);
          } else {
            await supabaseClient
              .from('piezas')
              .update({ estado: 'vendido', pedido_item_id: creado.id })
              .eq('id', sel.piezaId);
          }
        }
      }
  
      cerrarModal();
      cargar();
    }
  
    function inicializar() {
      const btnNuevo = document.getElementById('btn-nuevo-pedido');
      if (btnNuevo && !btnNuevo.dataset.enganchado) {
        btnNuevo.addEventListener('click', abrirModal);
        btnNuevo.dataset.enganchado = '1';
      }
  
      const btnCancelar = document.getElementById('btn-cancelar-pedido');
      if (btnCancelar && !btnCancelar.dataset.enganchado) {
        btnCancelar.addEventListener('click', cerrarModal);
        btnCancelar.dataset.enganchado = '1';
      }
  
      const btnCerrarX = document.getElementById('btn-cerrar-pedido');
      if (btnCerrarX && !btnCerrarX.dataset.enganchado) {
        btnCerrarX.addEventListener('click', cerrarModal);
        btnCerrarX.dataset.enganchado = '1';
      }
  
      const btnGuardar = document.getElementById('btn-guardar-pedido');
      if (btnGuardar && !btnGuardar.dataset.enganchado) {
        btnGuardar.addEventListener('click', guardarPedido);
        btnGuardar.dataset.enganchado = '1';
      }
  
      const selectProducto = document.getElementById('input-pedido-producto');
      if (selectProducto && !selectProducto.dataset.enganchado) {
        selectProducto.addEventListener('change', renderizarPiezasDisponibles);
        selectProducto.dataset.enganchado = '1';
      }
  
      cargar();
    }
  
    return { inicializar };
  })();