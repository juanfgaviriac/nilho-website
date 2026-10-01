# Foco — paquete de aprobación del nuevo modelo

**Candidato local consolidado; no publicado por esta entrega.** La redacción comercial y el checkout están terminados para revisión. La aprobación de Apple no sustituye la validación alojada de Wompi ni abre cobros automáticamente.

## Candidatos que se aprueban juntos

| Parte | Rama y referencia |
| --- | --- |
| Sitio | `codex/pricing-release`, reúne `codex/plans-first-checkout` (`b2e6ea8`), `origin/main` (`a6d935f`) y la redacción final de `codex/pricing-terms` |
| Backend | `codex/pricing-release-backend`, commit `a939768`, sobre `b443f52` de preparación Apple |
| App | 1.0.8 (50), ya enviada a revisión; sin cambios de binario en esta consolidación |

El árbol raíz de Foco y los borradores anteriores se conservan. No aplicar de nuevo los cambios de `pricing-terms` sobre este candidato. Las dos ramas nuevas están guardadas localmente; esta entrega no las empuja ni despliega.

## Qué queda resuelto

- Una sola oferta para compras nuevas: planes web COP 14.900 / 39.900 / 119.900, y Apple Colombia COP 17.500 / 45.900 / 137.900.
- Landing, FAQs y respuestas del asistente, blog, soporte, condiciones de compra/suscripción y privacidad concordantes. Eliminadas las tablas de paquetes antiguos y su oferta estructurada de buscadores.
- `/comprar/`, `/foco/comprar/` y `/empezar/` muestran planes antes de pedir la cuenta. Totales iniciales, envío, prueba, renovación y consentimiento explícitos. Catálogos con precios o versión de términos distintos se rechazan.
- Endpoints antiguos de creación de checkout en Vercel y Netlify devuelven 410 sin llamar a Wompi. Un carrito antiguo abierto no inicia otra compra. Sus scripts/catálogos ya no se distribuyen en el sitio público.
- Conservados los webhooks de pedidos anteriores, la página de resultado, recibos, derechos vitalicios y archivos legales previamente aceptados. Estos registros históricos son las referencias deliberadas al modelo anterior; no se borran ni se convierten en suscripciones.
- Vendedor Wompi: Juan Felipe Gaviria Campo, NIT 1001368555. Proveedor App Store: Nilho S.A.S., NIT 902003133-7. Dirección de notificaciones confirmada para ambos: Transversal 1 Este #68-50, Bogotá D.C., Colombia.
- Condiciones congeladas `foco-web-subscription-2026-09-30.1`, tres documentos y manifiesto SHA-256 en `/foco/suscripciones/versiones/2026-09-30.1/`. El consentimiento enlaza esas copias; el servidor registra la versión. La nueva migración no cambia acuerdos existentes ni habilita ningún gate.

Las reglas de prueba, tarjeta, transporte, reembolso, activación y recuperación están en [pricing-terms-update-2026-09-30.md](pricing-terms-update-2026-09-30.md).

## Evidencia local

| Verificación | Resultado |
| --- | --- |
| Sitio | 253 pruebas PASS, cero omitidas; builds estático y Vercel PASS |
| Backend | 330 pruebas PASS, dos tests de red optativos omitidos; TypeScript PASS |
| Consentimiento | Migración PGlite: conserva acuerdos/flags, rechaza términos anteriores para acuerdos nuevos, registra la versión nueva; cero cargos |
| Archivos históricos | Conservación byte por byte; sin cambios en archivos ya aceptados |
| Recorrido de navegador | Datos ficticios: anual + prueba → cuenta → código → entrega → COP 10.000 hoy / COP 119.900 al año después de la prueba |
| Presentación | 37 estados locales de checkout/billing con título y sin desbordamiento a 320 px CSS; plan, autorización, términos y blog revisados también a 390/1440 px según pantalla |
| Producción | No se hizo ningún cobro, envío, deploy, migración remota o cambio de flags en esta entrega |

Revisión local: `http://127.0.0.1:4342/revision/suscripcion/`; galería de estados: `/revision/inspeccion/`. Las pantallas son fixtures sin pagos ni cuentas reales. Las capturas y logs quedan fuera del artefacto público. No representan una nueva validación de compras Wompi alojadas.

## Controles para liberar

1. **Apple:** confirmar aprobación de app, grupo y tres productos, precios y acuerdos comerciales; desactivar Streamlined Purchasing cuando el build aprobado lo permita. Seguir `docs/apple-production-launch-2026-09-30.md` del candidato backend. Ese commit registra verificación Production y notificación TEST exitosa, con los tres checkouts Apple cerrados. La discrepancia visual USD/COP y las pruebas de dispositivo aún pendientes permanecen documentadas; no se declaran resueltas aquí.
2. **Wompi alojado:** completar la configuración sandbox pendiente y verificar una autorización/pago con webhook firmado, vinculación/activación, renovación, cancelación y recuperación tras rechazo. Verificar también entrega/conciliación/atención de reembolsos y entrada real por Apple en la web. Las pruebas locales no sustituyen ese ensayo. Mantener cerrada la oferta web hasta que pase.
3. **Publicación coordinada web:** publicar y leer por HTTPS las tres copias legales exactas y su manifiesto; aplicar la migración `20261001023543_subscription_published_consent.sql`; comprobar que los seis productos web tienen la versión nueva, y que flags, acuerdos existentes y registros vitalicios no cambiaron. Desplegar el candidato completo, comprobar aliases/FAQ/blog/términos y respuestas 410 antiguas; abrir solo el checkout del proveedor autorizado para lanzar.
4. **Aceptación de producción:** instalación desde App Store, precio del catálogo/hoja Apple, compra autorizada por su titular, acceso correcto, restauración y cancelación. Una compra real requiere autorización específica; TestFlight y TEST firmada no la sustituyen. Apple puede liberarse por separado si Wompi aún no está listo.

Antes de despliegue, actualizar los remotos y comparar los commits: una configuración o rama posterior puede cambiar el preflight. No copiar secretos al repositorio ni convertir eventos sandbox en acceso de producción.

## Retroceso

Cerrar nuevas compras del proveedor afectado y mostrar su indisponibilidad. Conservar la verificación, notificaciones, acceso ya pagado, contratos aceptados y ledger. No volver a publicar el carrito de pago único ni reescribir sus archivos. No revertir una versión de términos que ya haya sido aceptada. El runbook Apple contiene el SQL acotado para cerrar solo sus ofertas.
