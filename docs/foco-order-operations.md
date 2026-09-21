# Operación de pedidos Foco

Condiciones aprobadas el 21 de septiembre de 2026. Stock inicial confirmado: 30 tarjetas. Sitio pendiente de publicación; no hay despachos ni pedidos reales procesados desde esta tarea.

## Antes de habilitar compras

1. Cotizar desde Bogotá con peso y medidas del paquete completo. Recomendación: comparar en [Envia.com](https://help.envia.com/como-cotizar-un-envio/) y escoger el servicio de menor costo que cumpla el plazo y cobertura. No se ha comprado una guía ni comprobado una tarifa real; el precio depende de destino, peso, dimensiones y cargos de protección/valor declarado aplicables. Las medidas 86 × 54 mm son de la tarjeta, no del paquete.
2. Confirmar tratamiento tributario de esta venta personal. La [Facturación Gratuita DIAN](https://www.dian.gov.co/impuestos/factura-electronica/facturacion-gratuita/paginas/default.aspx) es la opción propuesta si se emitirá factura electrónica. No se realizó habilitación tributaria ni se determinó exención de facturar. El comprobante Wompi prueba el pago; no sustituye una factura exigible. El documento soporte en adquisiciones a no obligados corresponde al adquirente obligado cuando aplique, no es el nombre de nuestro recibo comercial.
3. Completar `commerce-config.mjs`: transportadora/estrategia operativa confirmada, `billingConfirmed` y `consentEvidenceVerified`. Mantener `productionEnabled: false` hasta revisión final y publicación de condiciones/retorno.
4. Verificar aceptación: inspección de Wompi realizada. El formulario permite hasta dos referencias de texto obligatorias; no expone una casilla nativa de condiciones del vendedor ni edición de estos campos en los enlaces ya creados. Hace falta probar en sandbox que respuestas y versión de condiciones queden consultables junto a una transacción. **No se probó aún persistencia ni atribución a un pedido.** Una casilla local o activar un booleano no suple esa evidencia. Si estos campos no dan un flujo adecuado, proponer el registro mínimo del lado del servidor antes de ampliar infraestructura. No cambiar los tres enlaces de producción hasta verificar el reemplazo.
5. Confirmar aprobación del comercio y proceso operativo de reembolsos con Wompi. El panel todavía muestra saldo en revisión; no se verificó liquidación bancaria.

## Por cada pedido

- Verificar APPROVED, COP, link/SKU, cantidad e importe en Wompi. Comprobar por ID completo que no existe despacho previo ni reembolso/reversión.
- Asignar referencia `FOCO-[ID Wompi]`. Guardar copia de condiciones vigentes y evidencia de aceptación vinculada al pago.
- Confirmar el pedido al comprador con la [plantilla de comprobante](templates/confirmacion-pedido.md), preferentemente dentro del día calendario siguiente a recibirlo. Adjuntar factura cuando proceda. No confundir el mensaje neutro de retorno con este comprobante.
- Descontar unidades del stock disponible. Mantener aparte las destinadas a garantías y las comprometidas en pedidos aprobados.
- Verificar la lectura/validación Foco de cada tarjeta antes de empacar. Registrar su identificador interno sin publicar ni enviar el token NFC.
- Generar guía con la dirección de Wompi, preparar el paquete, despachar y enviar [seguimiento](templates/seguimiento-pedido.md) por WhatsApp.
- Conservar referencia, cantidad, estados, fecha y guía en un registro privado. No guardar datos de clientes en este repositorio ni duplicar direcciones en un formulario web.

## Inventario manual

Pausar TODOS los enlaces de producción en Wompi y deshabilitar el checkout al llegar a cinco tarjetas disponibles. El contador estático no se descuenta automáticamente: se actualiza por el operador. Pausar solo la web no cierra enlaces compartidos directamente.

Antes de reabrir, revisar pagos pendientes que podrían aprobarse y conciliarlos con el stock. El margen de cinco reduce, pero no elimina, ventas simultáneas. No anunciar “últimas unidades” con cifras no actualizadas. Sin preventas automáticas. Si no se puede entregar una compra aprobada, contactar y aplicar las condiciones de reintegro; no imponer una nueva fecha.

## Reclamaciones, devoluciones y garantías

Usar la [plantilla de radicación](templates/radicacion-reclamacion.md), registrar fecha/hora originales, radicado único, responsable, siguiente acción y vencimiento. Facilitar seguimiento por el mismo canal. Primera respuesta en un día hábil no reemplaza respuesta de fondo.

Distinguir retracto, garantía y reversión. Para reembolsar, comprobar estado anterior y posibles disputas; documentar el resultado. No ejecutar una segunda devolución de una operación ya reversada. Ningún reembolso real se automatiza desde la web.

## Mensajes y privacidad

Estas plantillas son borradores de operación: la tarea no envía mensajes al comprador. Compartir únicamente datos del pedido con su titular y lo necesario para la entrega con la transportadora. No usar direcciones/teléfonos para marketing sin autorización separada. Guardar el registro operativo con acceso restringido y conservarlo según finalidad/obligación aplicable.
