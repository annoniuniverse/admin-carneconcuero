/* ============================
   Pedidos - admin-carneconcuero
   ============================ */

   const Pedidos = (() => {
    let productos = [];
    let pedidos = [];
    let piezasDisponibles = [];
  
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
  
    // ----- CARGA DE DATOS -----
  
    async function cargar() {
      const tbody = document.getElementById('tbody-pedidos');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center texto-secundario" style="padding: 2rem;">Cargando...</td></tr>';
      }
  
      const resPedidos = await supabaseClient
        .from('pedidos')
        .select('*, pedido_items(id, precio_venta_kg, piezas!pedido_items_pieza_id_fkey(peso_kg))')
        .order('created_at', { ascending: false });
  
      if (resPedidos.error) {
        if (tbody) {
          tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 2rem; color: #dc2626;">Error al cargar pedidos: ' + resPedidos.error.message + '</td></tr>';
        }
        return;
      }
  
      pedidos = resPedidos.data || [];
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
        .select('*, productos(nombre)')
        .eq('estado', 'disponible')
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
          const peso = item.piezas ? item.piezas.peso_kg : 0;
          totalVenta += item.precio_venta_kg * peso;
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
  
          const resItems = await supabaseClient
            .from('pedido_items')
            .select('pieza_id')
            .eq('pedido_id', id);
  
          if (resItems.error) {
            alert('Error: ' + resItems.error.message);
            return;
          }
  
          const piezaIds = (resItems.data || []).map((i) => i.pieza_id);
  
          if (piezaIds.length > 0) {
            const { error: errPiezas } = await supabaseClient
              .from('piezas')
              .update({ estado: 'disponible', pedido_item_id: null })
              .in('id', piezaIds);
            if (errPiezas) {
              alert('Error liberando piezas: ' + errPiezas.message);
              return;
            }
          }
  
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
  
          // Confirmación extra si está entregado
          if (pedido.estado === 'entregado') {
            if (!confirm('Este pedido está ENTREGADO. Si lo borrás, va a desaparecer del resumen y las cuentas van a cambiar. ¿Continuar?')) {
              return;
            }
            if (!confirm('¿Estás seguro? Esta acción no se puede deshacer.')) {
              return;
            }
          } else {
            if (!confirm('¿Borrar este pedido? Esta acción no se puede deshacer.')) {
              return;
            }
          }
  
          // 1) Traer items para liberar piezas (solo si NO está cancelado)
          if (pedido.estado !== 'cancelado') {
            const resItems = await supabaseClient
              .from('pedido_items')
              .select('pieza_id')
              .eq('pedido_id', id);
  
            if (!resItems.error) {
              const piezaIds = (resItems.data || []).map((i) => i.pieza_id);
              if (piezaIds.length > 0) {
                await supabaseClient
                  .from('piezas')
                  .update({ estado: 'disponible', pedido_item_id: null })
                  .in('id', piezaIds);
              }
            }
          }
  
          // 2) Borrar items (por si la FK no tiene cascade)
          await supabaseClient.from('pedido_items').delete().eq('pedido_id', id);
  
          // 3) Borrar pedido
          const { error } = await supabaseClient.from('pedidos').delete().eq('id', id);
          if (error) {
            alert('Error borrando pedido: ' + error.message);
            return;
          }
  
          cargar();
        });
      });
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
  
      const resItems = await supabaseClient
        .from('pedido_items')
        .select('id, precio_venta_kg, pieza_id, piezas!pedido_items_pieza_id_fkey(peso_kg, precio_compra_kg, producto_id, productos(nombre))')
        .eq('pedido_id', pedido.id);
  
      if (resItems.error) {
        document.getElementById('modal-pedido-error').textContent = 'Error cargando piezas del pedido: ' + resItems.error.message;
        document.getElementById('modal-pedido-error').classList.add('activo');
        return;
      }
  
      (resItems.data || []).forEach((item) => {
        const pz = item.piezas;
        if (!pz) return;
        piezasSeleccionadas.push({
          piezaId: item.pieza_id,
          productoId: pz.producto_id,
          nombreProducto: pz.productos ? pz.productos.nombre : '—',
          peso: pz.peso_kg,
          precioCompra: pz.precio_compra_kg,
          precioVenta: item.precio_venta_kg
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
  
      const filtradas = piezasDisponibles.filter(
        (pz) => pz.producto_id === prodId && !piezasSeleccionadas.some((s) => s.piezaId === pz.id)
      );
  
      if (filtradas.length === 0) {
        contenedor.innerHTML = '<p class="texto-secundario text-sm" style="padding: 0.5rem 0;">No hay piezas disponibles de este producto.</p>';
        return;
      }
  
      contenedor.innerHTML = '';
      filtradas.forEach((pz) => {
        const prod = productos.find((p) => p.id === pz.producto_id);
        const precioVentaSugerido = prod ? prod.precio_venta_kg : 0;
  
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
            nombreProducto: prod ? prod.nombre : '—',
            peso: pz.peso_kg,
            precioCompra: pz.precio_compra_kg,
            precioVenta: precioVentaSugerido
          });
          renderizarPiezasDisponibles();
          renderizarSeleccionadas();
        });
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
        const div = document.createElement('div');
        div.className = 'item-temporal';
        div.style.flexWrap = 'wrap';
        div.innerHTML = `
          <div style="flex: 1; min-width: 140px;">
            <strong>${item.nombreProducto}</strong>
            <span class="texto-secundario text-sm"> — ${item.peso.toFixed(3)} kg</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <label class="texto-secundario text-xs">Venta /kg:</label>
            <input
              type="number"
              class="input-base"
              style="width: 100px; padding: 0.35rem 0.5rem; font-size: 0.85rem;"
              value="${item.precioVenta}"
              min="0"
              step="0.01"
              data-precio-venta="${indice}"
            />
            <button type="button" class="btn-peligro" data-quitar-seleccion="${indice}">✕</button>
          </div>
        `;
        contenedor.appendChild(div);
      });
  
      contenedor.querySelectorAll('[data-precio-venta]').forEach((input) => {
        input.addEventListener('input', (e) => {
          const idx = parseInt(input.getAttribute('data-precio-venta'), 10);
          const valor = parseFloat(e.target.value);
          if (!isNaN(valor) && valor >= 0) {
            piezasSeleccionadas[idx].precioVenta = valor;
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
  
      const itemsPayload = piezasSeleccionadas.map((s) => ({
        pedido_id: pedidoCreado.id,
        pieza_id: s.piezaId,
        precio_venta_kg: s.precioVenta
      }));
  
      const { data: itemsCreados, error: errItems } = await supabaseClient
        .from('pedido_items')
        .insert(itemsPayload)
        .select();
  
      if (errItems) {
        await supabaseClient.from('pedidos').delete().eq('id', pedidoCreado.id);
        errorBox.textContent = 'Error creando items: ' + errItems.message;
        errorBox.classList.add('activo');
        return;
      }
  
      for (let i = 0; i < itemsCreados.length; i++) {
        const item = itemsCreados[i];
        const seleccion = piezasSeleccionadas[i];
        await supabaseClient
          .from('piezas')
          .update({ estado: 'vendido', pedido_item_id: item.id })
          .eq('id', seleccion.piezaId);
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
  
      const { data: itemsActuales, error: errGet } = await supabaseClient
        .from('pedido_items')
        .select('id, pieza_id, precio_venta_kg')
        .eq('pedido_id', pedidoEditandoId);
  
      if (errGet) {
        errorBox.textContent = 'Error leyendo items: ' + errGet.message;
        errorBox.classList.add('activo');
        return;
      }
  
      const itemsActualesArr = itemsActuales || [];
      const idsSeleccionados = piezasSeleccionadas.map((s) => s.piezaId);
  
      const aEliminar = itemsActualesArr.filter((i) => !idsSeleccionados.includes(i.pieza_id));
      const aInsertar = piezasSeleccionadas.filter(
        (s) => !itemsActualesArr.some((i) => i.pieza_id === s.piezaId)
      );
  
      for (const item of aEliminar) {
        await supabaseClient
          .from('piezas')
          .update({ estado: 'disponible', pedido_item_id: null })
          .eq('id', item.pieza_id);
        await supabaseClient.from('pedido_items').delete().eq('id', item.id);
      }
  
      for (const item of itemsActualesArr) {
        const seleccion = piezasSeleccionadas.find((s) => s.piezaId === item.pieza_id);
        if (seleccion && seleccion.precioVenta !== item.precio_venta_kg) {
          await supabaseClient
            .from('pedido_items')
            .update({ precio_venta_kg: seleccion.precioVenta })
            .eq('id', item.id);
        }
      }
  
      if (aInsertar.length > 0) {
        const payload = aInsertar.map((s) => ({
          pedido_id: pedidoEditandoId,
          pieza_id: s.piezaId,
          precio_venta_kg: s.precioVenta
        }));
  
        const { data: creados, error: errIns } = await supabaseClient
          .from('pedido_items')
          .insert(payload)
          .select();
  
        if (errIns) {
          errorBox.textContent = 'Error insertando items nuevos: ' + errIns.message;
          errorBox.classList.add('activo');
          return;
        }
  
        for (let i = 0; i < creados.length; i++) {
          const item = creados[i];
          const seleccion = aInsertar[i];
          await supabaseClient
            .from('piezas')
            .update({ estado: 'vendido', pedido_item_id: item.id })
            .eq('id', seleccion.piezaId);
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