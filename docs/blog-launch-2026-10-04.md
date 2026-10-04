# Lecturas y preguntas para el lanzamiento · 4 de octubre de 2026

El propietario autorizó publicar los tres artículos después de verificarlos. Las cinco publicaciones anteriores conservan sus fechas; las tres nuevas llevan `publishedAt: 2026-10-04`. El índice muestra primero las lecturas más recientes.

## Tres problemas concretos

| Artículo | Aporte práctico | Conexión con Foco |
| --- | --- | --- |
| [Cómo estudiar sin mirar el celular: un bloque de 45 minutos](https://getfoco.co/blog/estudiar-sin-mirar-el-celular/) | Horario completo con pausa, preparación del teléfono, comprobación de aprendizaje y plantilla de cierre | Un modo de estudio opcional, explicado al final |
| [Cómo concentrarte si necesitas WhatsApp para trabajar](https://getfoco.co/blog/concentrarse-con-whatsapp-en-el-trabajo/) | Mensaje para acordar disponibilidad, tres situaciones laborales y una nota para retomar la tarea | Dejar WhatsApp disponible y pausar otras apps; no promete bloquear chats individuales |
| [Qué hacer en una pausa de cinco minutos sin abrir redes](https://getfoco.co/blog/pausas-sin-redes-sociales/) | Seis alternativas, plantilla de pausa y vuelta, ajustes si el descanso se alarga | Mantener las redes pausadas durante un descanso dentro de una sesión |

## Verificación editorial

- Cornell Learning Strategies Center: práctica de recuperación y comprobación con una hoja en blanco. El bloque de 45 minutos es una propuesta editorial, no un protocolo atribuido a Cornell.
- Apple: configuración de Enfoque y notificaciones permitidas. Se distingue del bloqueo de acceso de Foco y se indica probar el canal importante antes de depender de él.
- PLOS ONE, Albulescu et al. (2022), DOI 10.1371/journal.pone.0272460: efectos pequeños sobre vigor y fatiga; efecto no significativo sobre desempeño general. El menú de pausas no se presenta como un protocolo validado ni se atribuye eficacia a Foco.
- Fuentes consultadas el 4 de octubre de 2026, enlazadas junto a la afirmación correspondiente y al final de cada artículo.
- Ejemplos y plantillas originales; sin testimonios, estadísticas de clientes ni promesas de resultados. Las duraciones son adaptables.
- Las guías sirven sin comprar nada. Solo una sección breve de producto en cada cuerpo, además del cierre compartido del blog.

## Cuatro preguntas comerciales nuevas

- ¿Puedo seguir usando WhatsApp y Mapas?
- ¿Tengo que borrar mis redes sociales?
- ¿Me sirve para estudiar y para trabajar?
- ¿Qué plan me conviene?

Se incorporan a la portada y soporte desde `scripts/faq.mjs`, con respuestas equivalentes en el asistente. Se conservan los precios y condiciones aprobados; no se cambian los documentos legales.

## Comprobaciones de publicación

Ejecutar `npm test` y `npm run build:vercel`. Revisar las tres lecturas y las preguntas en navegador, incluyendo anchura móvil, enlaces de fuentes, índice, sitemap, canonical y fecha. Publicar el mismo commit comprobado y leer las URLs de producción antes de darlo por terminado.
