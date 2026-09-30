# Compra con planes antes de la cuenta

## Cambio preparado

`/comprar/` reemplaza la selección antigua de cantidades con los planes mensual, trimestral y anual. `/empezar/` comparte esta entrada. `/cuenta/` conserva el acceso y la gestión de cuenta.

Orden: elegir plan y prueba opcional → entrar o crear la cuenta → entrega → autorización y pago con Wompi. La selección se guarda por pestaña durante un máximo de 24 horas; no contiene correo, dirección, códigos, identidad, precios ni autorización de cobro. El callback de Apple sigue siendo `/cuenta/`. Una cuenta ya autenticada conserva su sesión; el servidor vuelve a verificar su acceso antes de continuar.

Los usuarios vitalicios y quienes tienen una suscripción o autorización pendiente mantienen las rutas de gestión existentes. Cambiar de cuenta borra los datos privados y la selección. Los pagos y resultados de compras anteriores se conservan; no se cambiaron llaves, condiciones archivadas, contratos de pago ni los interruptores de producción.

La página de planes se incluye en el HTML inicial. Las rutas de compra usan la protección de caché y referencia de las rutas de cuenta; no cargan analítica ni publican la antigua oferta de pago único en datos estructurados. Ambos builds sustituyen también `/foco/comprar/`.

## Verificación

- 241 pruebas automatizadas pasan, incluidas recuperación y vencimiento de selección, rechazo de datos extra, precios, identidad, elegibilidad, pagos y archivos legales históricos.
- Recorrido local con datos ficticios: anual + prueba → cuenta → código → entrega → resumen de $10.000 de envío y renovación anual de $119.900.
- Recargar conserva plan y prueba; cambiar plan tras verificar no obliga a repetir cuenta; edición a trimestral actualiza el resumen.
- Vista de escritorio y ancho de contenido de 390 px revisados sin desbordamiento horizontal.
- El acceso real con Apple no se repitió: se conserva el callback y se prueba la recuperación de la selección por separado. Las vistas de prueba simuladas nunca se publican en Vercel.

## Publicación pendiente

Lectura real de `https://getfoco.co/api/foco/account?action=config` el 30 de septiembre: cuenta y Apple habilitados; checkout deshabilitado; sin configuración de checkout recurrente.

La URL pública actual vende tarjetas con pago único. Reemplazarla ahora por estos planes dejaría a los visitantes sin una compra disponible hasta habilitar y verificar la facturación recurrente. Se mantiene producción sin cambios hasta resolver si se espera al lanzamiento del cobro recurrente o se publica anticipadamente sin pagos.

Antes del lanzamiento comercial completo también deben concordar las referencias de pago único de la landing, FAQ y contenido editorial con la oferta recurrente. Los archivos de condiciones aceptadas deben permanecer inmutables.
