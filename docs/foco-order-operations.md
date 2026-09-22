# Operación de pedidos Foco

Condiciones aprobadas el 21 de septiembre de 2026. Stock inicial confirmado: 30 tarjetas. Sitio https://getfoco.co publicado en el proyecto Vercel `getfoco` de `juanfgaviriacs-projects`, con checkout de producción autorizado; esta tarea no ha realizado compras con dinero real ni despachos.

## Configuración de lanzamiento

1. Flujo por pedido y Resend configurados según el [runbook vigente](foco-checkout-launch.md). Compra sandbox, aceptación almacenada y entrega de un comprobante verificadas. Checkout y correos habilitados en producción.
2. El usuario confirmó aprobación de Wompi y decidió mantener los precios sin IVA añadido. El correo es un comprobante de compra, no una factura electrónica; no determina una exención tributaria ni reemplaza una factura exigible.
3. El usuario aplazó la selección de transportadora. Despacho desde Bogotá, guía por WhatsApp y plazos aprobados se mantienen. Escoger el servicio al despachar, según peso/medidas reales y destino; no se ha cotizado ni comprado una guía.
4. Los tres enlaces reutilizables anteriores se desactivaron durante el cambio aprobado. Revisar el primer pago real y su comprobante en producción; ver el alcance actualizado de las pruebas en [la verificación de migración](foco-vercel-migration.md).

## Por cada pedido

- El aviso automático **“Nueva compra Foco”** llega directamente a **team@nilho.co**, desde **team@getfoco.co**, después de verificar el pago APPROVED con Wompi. Incluye cantidad, total, referencia e ID de transacción, y un botón para abrir Wompi. No depende del reenvío de soporte. La dirección del comprador se consulta en Wompi.
- Verificar APPROVED, COP, link/SKU, cantidad e importe en Wompi. Comprobar por ID completo que no existe despacho previo ni reembolso/reversión.
- Usar la referencia `FOCO-[UUID pedido]` generada por el servidor, vinculada al SKU del enlace y al ID Wompi aprobado. Consultar en el registro privado la fecha/versiones de aceptación y sus copias archivadas.
- Verificar que Resend haya entregado el comprobante automático. Si requiere atención manual, usar la [plantilla de comprobante](templates/confirmacion-pedido.md) solo después de descartar un envío anterior; resolver dentro del día calendario siguiente a recibir el pedido. Adjuntar factura cuando proceda. No confundir el mensaje neutro de retorno con este comprobante.
- Descontar unidades del stock disponible. Mantener aparte las destinadas a garantías y las comprometidas en pedidos aprobados.
- Verificar la lectura/validación Foco de cada tarjeta antes de empacar. Registrar su identificador interno sin publicar ni enviar el token NFC.
- Generar guía con la dirección de Wompi, preparar el paquete, despachar y enviar [seguimiento](templates/seguimiento-pedido.md) por WhatsApp.
- Conservar referencia, cantidad, estados, fecha y guía en un registro privado. No guardar datos de clientes en este repositorio ni duplicar direcciones en un formulario web.

## Inventario manual

Pausar los enlaces de venta pendientes en Wompi y deshabilitar la creación de nuevos enlaces con `FOCO_CHECKOUT_ENABLED=false` al llegar a cinco tarjetas disponibles. El contador estático no se descuenta automáticamente: se actualiza por el operador. Pausar solo la web no cierra enlaces compartidos directamente.

Antes de reabrir, revisar pagos pendientes que podrían aprobarse y conciliarlos con el stock. El margen de cinco reduce, pero no elimina, ventas simultáneas. No anunciar “últimas unidades” con cifras no actualizadas. Sin preventas automáticas. Si no se puede entregar una compra aprobada, contactar y aplicar las condiciones de reintegro; no imponer una nueva fecha.

## Reclamaciones, devoluciones y garantías

Usar la [plantilla de radicación](templates/radicacion-reclamacion.md), registrar fecha/hora originales, radicado único, responsable, siguiente acción y vencimiento. Facilitar seguimiento por el mismo canal. Primera respuesta en un día hábil no reemplaza respuesta de fondo.

Distinguir retracto, garantía y reversión. Para reembolsar, comprobar estado anterior y posibles disputas; documentar el resultado. No ejecutar una segunda devolución de una operación ya reversada. Ningún reembolso real se automatiza desde la web.

## Mensajes y privacidad

Estas plantillas son borradores de operación: la tarea no envía mensajes al comprador. Compartir únicamente datos del pedido con su titular y lo necesario para la entrega con la transportadora. No usar direcciones/teléfonos para marketing sin autorización separada. Guardar el registro operativo con acceso restringido y conservarlo según finalidad/obligación aplicable.

## Comprobantes y reintentos

Revisar a diario Wompi APPROVED frente a `paid/`, `receipts/` (comprador) y `alerts/` (aviso interno) del almacén privado Vercel Blob `foco-orders-production` (prefijo `prod/`). Un ID de Resend guardado significa que Resend aceptó el correo, no que llegó al buzón: consultar entrega/rebote en Resend. El servidor no guarda dirección postal ni datos del instrumento de pago; esos se consultan en Wompi.

Ante `pending`, `sending` vencido o `manual_review`, comprobar el ID de transacción y los registros de Resend antes de reenviar. Dentro de la ventana segura, reenviar el evento original desde Wompi conserva el mismo payload y clave idempotente. Los correos se reintentan por separado: un fallo del aviso interno no vuelve a enviar el comprobante, ni viceversa. Pasadas 23 horas se exige revisión manual para evitar duplicados; no borrar el registro de envío como mecanismo de reintento. Rebotes o direcciones erróneas requieren contactar al titular por el canal de soporte y verificar la corrección; no redirigir el recibo a un email recibido sin verificar.

El despliegue no recorre pedidos antiguos ni envía avisos retroactivos en lote. Si Wompi reenvía un evento antiguo que solo tenía comprobante, se genera su aviso interno una vez; comprobar la fecha en Wompi antes de tratarlo como un pedido nuevo. La conciliación diaria sigue siendo necesaria ante rebotes, fallos de webhook o correos que requieran revisión manual.

Los enlaces vencen en una hora, pero un pago ya iniciado puede seguir pendiente y aprobarse más tarde. Conciliarlo antes de liberar stock. Los pedidos `creating` sin enlace retornado son intentos ambiguos: buscar el UUID en Wompi antes de recrearlos. El margen de cinco tarjetas y el vencimiento no constituyen reservas ni eliminan sobreventa.

Restringir el acceso del equipo a Vercel/Wompi/Resend. No exportar los registros a este repositorio ni imprimirlos en logs. Revisar y retirar intentos abandonados y datos de recibos cuando dejen de ser necesarios, preservando los soportes de operaciones y autorizaciones sujetos a conservación. No hay automatización de marketing ni vinculación con usuarios de la app.
