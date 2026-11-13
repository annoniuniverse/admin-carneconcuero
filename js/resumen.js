/* ============================
   Resumen - admin-carneconcuero
   ============================ */

   const Resumen = (() => {
    let pagosDelRango = [];
  
    function formatearPrecio(valor) {
      return '$' + Math.round(valor).toLocaleString('es-AR');
    }
  
    function formatearFecha(fechaStr) {
      if (!fechaStr) return '—';
      const partes = fechaStr.split('-');
      if (partes.length !== 3) return fechaStr;
      return partes[2] + '/' + partes[1] + '/' + partes[0];
    }
  
    function fmtFecha(d) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    }
  
    function fechaHoyISO() {
      return fmtFecha(new Date());
    }
  
    function setearMesActual() {
      const hoy = new Date();
      const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  
      const inputDesde = document.getElementById('resumen-desde');
      const inputHasta = document.getElementById('resumen-hasta');
      if (inputDesde) inputDesde.value = fmtFecha(primerDia);
      if (inputHasta) inputHasta.value = fmtFecha(ultimoDia);
    }
  
    // ----- CÁLCULOS -----
  
    async function calcular() {
      const inputDesde = document.getElementById('resumen-desde');
      const inputHasta = document.getElementById('resumen-hasta');
      const elCosto = document.getElementById('resumen-costo');
      const elVentas = document.getElementById('resumen-ventas');
      const elGanancia = document.getElementById('resumen-ganancia');
      const elPagadoRango = document.getElementById('resumen-pagado-rango');
      const elSaldoRango = document.getElementById('resumen-saldo-rango');
      const elSaldoTotal = document.getElementById('resumen-saldo-total');
      const errorBox = document.getElementById('resumen-error');
  
      if (!inputDesde || !inputHasta || !elCosto || !elVentas || !elGanancia) return;
  
      if (errorBox) {
        errorBox.classList.remove('activo');
        errorBox.textContent = '';
      }
  
      const desde = inputDesde.value;
      const hasta = inputHasta.value;
  
      if (!desde || !hasta) {
        if (errorBox) {
          errorBox.textContent = 'Elegí una fecha desde y hasta.';
          errorBox.classList.add('activo');
        }
        return;
      }
  
      if (desde > hasta) {
        if (errorBox) {
          errorBox.textContent = 'La fecha "desde" no puede ser mayor que "hasta".';
          errorBox.classList.add('activo');
        }
        return;
      }
  
      elCosto.textContent = '...';
      elVentas.textContent = '...';
      elGanancia.textContent = '...';
      if (elPagadoRango) elPagadoRango.textContent = '...';
      if (elSaldoRango) elSaldoRango.textContent = '...';
      if (elSaldoTotal) elSaldoTotal.textContent = '...';
  
      // 1) Costo frigorífico del rango
      const resPiezas = await supabaseClient
        .from('piezas')
        .select('peso_kg, precio_compra_kg, fecha_ingreso')
        .gte('fecha_ingreso', desde)
        .lte('fecha_ingreso', hasta);
  
      if (resPiezas.error) {
        elCosto.textContent = 'Error';
        if (errorBox) {
          errorBox.textContent = 'Error cargando piezas: ' + resPiezas.error.message;
          errorBox.classList.add('activo');
        }
        return;
      }
  
      let costoRango = 0;
      (resPiezas.data || []).forEach((p) => {
        costoRango += p.peso_kg * p.precio_compra_kg;
      });
  
      // 2) Ventas y ganancia del rango
      const resPedidos = await supabaseClient
        .from('pedidos')
        .select('id, fecha, estado, pedido_items(precio_venta_kg, piezas!pedido_items_pieza_id_fkey(peso_kg, precio_compra_kg))')
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .neq('estado', 'cancelado');
  
      if (resPedidos.error) {
        elVentas.textContent = 'Error';
        if (errorBox) {
          errorBox.textContent = 'Error cargando pedidos: ' + resPedidos.error.message;
          errorBox.classList.add('activo');
        }
        return;
      }
  
      let ventasRango = 0;
      let gananciaRango = 0;
  
      (resPedidos.data || []).forEach((pedido) => {
        (pedido.pedido_items || []).forEach((item) => {
          const pz = item.piezas;
          if (!pz) return;
          const peso = pz.peso_kg;
          const precioVenta = item.precio_venta_kg;
          const precioCompra = pz.precio_compra_kg;
  
          ventasRango += precioVenta * peso;
          gananciaRango += (precioVenta - precioCompra) * peso;
        });
      });
  
      // 3) Pagos del rango
      const resPagosRango = await supabaseClient
        .from('pagos')
        .select('*')
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('fecha', { ascending: false });
  
      if (resPagosRango.error) {
        if (errorBox) {
          errorBox.textContent = 'Error cargando pagos: ' + resPagosRango.error.message;
          errorBox.classList.add('activo');
        }
        return;
      }
  
      pagosDelRango = resPagosRango.data || [];
      let pagadoRango = 0;
      pagosDelRango.forEach((p) => {
        pagadoRango += p.importe;
      });
  
      // 4) Saldo total histórico: TODO el costo (sin filtro de fecha) - TODOS los pagos (sin filtro)
      const resCostoTotal = await supabaseClient
        .from('piezas')
        .select('peso_kg, precio_compra_kg');
  
      const resPagosTotal = await supabaseClient
        .from('pagos')
        .select('importe');
  
      let costoTotalHistorico = 0;
      (resCostoTotal.data || []).forEach((p) => {
        costoTotalHistorico += p.peso_kg * p.precio_compra_kg;
      });
  
      let pagadoTotalHistorico = 0;
      (resPagosTotal.data || []).forEach((p) => {
        pagadoTotalHistorico += p.importe;
      });
  
      const saldoRango = costoRango - pagadoRango;
      const saldoTotalHistorico = costoTotalHistorico - pagadoTotalHistorico;
  
      elCosto.textContent = formatearPrecio(costoRango);
      elVentas.textContent = formatearPrecio(ventasRango);
      elGanancia.textContent = formatearPrecio(gananciaRango);
      if (elPagadoRango) elPagadoRango.textContent = formatearPrecio(pagadoRango);
      if (elSaldoRango) elSaldoRango.textContent = formatearPrecio(saldoRango);
      if (elSaldoTotal) elSaldoTotal.textContent = formatearPrecio(saldoTotalHistorico);
  
      renderizarTablaPagos();
    }
  
    // ----- TABLA DE PAGOS -----
  
    function renderizarTablaPagos() {
      const tbody = document.getElementById('tbody-pagos');
      if (!tbody) return;
  
      if (pagosDelRango.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center texto-secundario" style="padding: 2rem;">No hay pagos registrados en este rango.</td></tr>';
        return;
      }
  
      tbody.innerHTML = '';
  
      pagosDelRango.forEach((p) => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
          <td>${formatearFecha(p.fecha)}</td>
          <td>${p.quien_transfirio || '—'}</td>
          <td>${p.destinatario || '—'}</td>
          <td>${formatearPrecio(p.importe)}</td>
          <td>${p.anotacion || '—'}</td>
          <td>
            <button class="btn-secundario" data-editar-pago="${p.id}" style="padding: 0.35rem 0.6rem; font-size: 0.8rem;">Editar</button>
            <button class="btn-peligro" data-eliminar-pago="${p.id}">Borrar</button>
          </td>
        `;
        tbody.appendChild(fila);
      });
  
      tbody.querySelectorAll('[data-editar-pago]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-editar-pago');
          const pago = pagosDelRango.find((p) => p.id === id);
          if (pago) abrirModalEdicion(pago);
        });
      });
  
      tbody.querySelectorAll('[data-eliminar-pago]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-eliminar-pago');
          if (!confirm('¿Borrar este pago? Esta acción no se puede deshacer.')) return;
          const { error } = await supabaseClient.from('pagos').delete().eq('id', id);
          if (error) {
            alert('Error: ' + error.message);
          } else {
            calcular();
          }
        });
      });
    }
  
    // ----- MODAL PAGO -----
  
    function abrirModalNuevo() {
      const modal = document.getElementById('modal-pago');
      if (!modal) return;
  
      document.getElementById('modal-pago-titulo').textContent = 'Registrar pago';
      document.getElementById('input-pago-id').value = '';
      document.getElementById('input-pago-fecha').value = fechaHoyISO();
      document.getElementById('input-pago-importe').value = '';
      document.getElementById('input-pago-quien').value = '';
      document.getElementById('input-pago-destinatario').value = '';
      document.getElementById('input-pago-anotacion').value = '';
      document.getElementById('modal-pago-error').classList.remove('activo');
  
      modal.classList.add('activo');
    }
  
    function abrirModalEdicion(pago) {
      const modal = document.getElementById('modal-pago');
      if (!modal) return;
  
      document.getElementById('modal-pago-titulo').textContent = 'Editar pago';
      document.getElementById('input-pago-id').value = pago.id;
      document.getElementById('input-pago-fecha').value = pago.fecha;
      document.getElementById('input-pago-importe').value = pago.importe;
      document.getElementById('input-pago-quien').value = pago.quien_transfirio || '';
      document.getElementById('input-pago-destinatario').value = pago.destinatario || '';
      document.getElementById('input-pago-anotacion').value = pago.anotacion || '';
      document.getElementById('modal-pago-error').classList.remove('activo');
  
      modal.classList.add('activo');
    }
  
    function cerrarModal() {
      const modal = document.getElementById('modal-pago');
      if (modal) modal.classList.remove('activo');
    }
  
    async function guardarPago() {
      const id = document.getElementById('input-pago-id').value.trim();
      const fecha = document.getElementById('input-pago-fecha').value;
      const importe = parseFloat(document.getElementById('input-pago-importe').value);
      const quien = document.getElementById('input-pago-quien').value.trim();
      const destinatario = document.getElementById('input-pago-destinatario').value.trim();
      const anotacion = document.getElementById('input-pago-anotacion').value.trim();
      const errorBox = document.getElementById('modal-pago-error');
  
      errorBox.classList.remove('activo');
  
      if (!fecha) {
        errorBox.textContent = 'Elegí una fecha.';
        errorBox.classList.add('activo');
        return;
      }
  
      if (isNaN(importe) || importe <= 0) {
        errorBox.textContent = 'El importe tiene que ser un número mayor a 0.';
        errorBox.classList.add('activo');
        return;
      }
  
      const payload = {
        fecha: fecha,
        importe: importe,
        quien_transfirio: quien || null,
        destinatario: destinatario || null,
        anotacion: anotacion || null
      };
  
      let resultado;
      if (id) {
        resultado = await supabaseClient.from('pagos').update(payload).eq('id', id);
      } else {
        resultado = await supabaseClient.from('pagos').insert([payload]);
      }
  
      if (resultado.error) {
        errorBox.textContent = 'Error: ' + resultado.error.message;
        errorBox.classList.add('activo');
        return;
      }
  
      cerrarModal();
      calcular();
    }
  
    // ----- INIT -----
  
    function inicializar() {
      const inputDesde = document.getElementById('resumen-desde');
      const inputHasta = document.getElementById('resumen-hasta');
      if (inputDesde && inputHasta) {
        if (!inputDesde.value || !inputHasta.value) {
          setearMesActual();
        }
      }
  
      const btnCalcular = document.getElementById('btn-calcular-resumen');
      if (btnCalcular && !btnCalcular.dataset.enganchado) {
        btnCalcular.addEventListener('click', calcular);
        btnCalcular.dataset.enganchado = '1';
      }
  
      const btnNuevoPago = document.getElementById('btn-nuevo-pago');
      if (btnNuevoPago && !btnNuevoPago.dataset.enganchado) {
        btnNuevoPago.addEventListener('click', abrirModalNuevo);
        btnNuevoPago.dataset.enganchado = '1';
      }
  
      const btnCancelar = document.getElementById('btn-cancelar-pago');
      if (btnCancelar && !btnCancelar.dataset.enganchado) {
        btnCancelar.addEventListener('click', cerrarModal);
        btnCancelar.dataset.enganchado = '1';
      }
  
      const btnCerrarX = document.getElementById('btn-cerrar-pago');
      if (btnCerrarX && !btnCerrarX.dataset.enganchado) {
        btnCerrarX.addEventListener('click', cerrarModal);
        btnCerrarX.dataset.enganchado = '1';
      }
  
      const btnGuardar = document.getElementById('btn-guardar-pago');
      if (btnGuardar && !btnGuardar.dataset.enganchado) {
        btnGuardar.addEventListener('click', guardarPago);
        btnGuardar.dataset.enganchado = '1';
      }
  
      calcular();
    }
  
    return { inicializar };
  })();