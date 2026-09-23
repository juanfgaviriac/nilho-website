# Blog Foco: primera colección en español

Estado: cinco artículos aprobados para publicación por el propietario el 23 de septiembre de 2026. Fecha de publicación registrada: 23 de septiembre de 2026. La aprobación editorial no implica revisión clínica.

## Decisión editorial

Lanzar las cinco lecturas juntas es una opción razonable cuando hayan pasado revisión: forman una colección conectada y responden preguntas distintas. Esto es una recomendación editorial, no una garantía de posicionamiento. No escalonar por una supuesta bonificación de frescura ni cambiar las fechas sin cambios sustanciales.

Google prioriza contenido útil y original; añadir contenido solo para aparentar frescura no ayuda por sí mismo. Sus recomendaciones para resultados con IA mantienen las bases de SEO: acceso técnico, contenido legible, valor propio y medios pertinentes. No exigen un esquema especial de IA ni un archivo llms.txt. Ninguna implementación garantiza indexación, ranking o citas de una IA.

Fuentes oficiales consultadas el 23 de septiembre de 2026:

- [Contenido útil y centrado en las personas](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).
- [Optimización para experiencias de búsqueda con IA](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).

## Cinco intenciones, sin competir entre sí

Estas son hipótesis editoriales de intención, no volúmenes de búsqueda medidos.

| Lectura | Consulta principal | Aporte propio | Siguiente paso natural |
| --- | --- | --- | --- |
| Cómo usar menos el celular: un plan de 7 días | cómo usar menos el celular | Experimento concreto de hábitos; ejemplo de un modo de lectura; distinción entre sesiones y uso real | Probar controles gratuitos o entender Foco |
| Adicción a las redes sociales: cuándo el uso empieza a ser un problema | adicción a redes sociales / al celular | Lenguaje no diagnóstico, datos con población explícita y límites del producto | Pedir apoyo si hace falta; leer el plan de hábitos |
| Foco vs. Tiempo en pantalla: qué opción te conviene | Foco vs Tiempo en pantalla | Comparación con la documentación actual de iOS 27, no una versión obsoleta | Elegir la opción adecuada, incluida la gratuita |
| Foco vs. Brick: diferencias para comprar desde Colombia | Foco vs Brick Colombia | Compatibilidad, formato, modelo de pago y límites de una comparación internacional de costos | Confirmar costo final y compatibilidad |
| Cuánto cuesta Foco en Colombia: tarjeta, envío y pago único | cuánto cuesta Foco / precio tarjeta Foco | Tabla y gráfico calculados desde la configuración real del checkout | Revisar el resumen de compra |

## Experiencia de lectura

- Diseño editorial con Manrope e IBM Plex Mono, la paleta de Foco y el footer compartido de la homepage.
- Respuesta breve al inicio, índice de secciones, lectura sin JavaScript, fuentes enlazadas y artículos relacionados.
- Capturas reales de la app en renders existentes de producto. Se aclara que pueden mostrar una versión anterior y datos de ejemplo.
- Dos gráficos útiles, no decorativos: proporciones de la encuesta HBSC y costo unitario de Foco. Escalas desde cero, cifras visibles, fuente y tabla accesible.
- Tablas desplazables dentro del artículo en pantallas pequeñas; sin desbordar la página.
- No se añaden librerías de gráficos, fuentes remotas ni código de cliente para leer los artículos.

## SEO y descubrimiento

- HTML generado en build, títulos y descripciones diferenciados, canonical propio, `lang=es-CO`, Open Graph y Twitter Card.
- `BlogPosting` con autor organizacional real, fuentes, imagen y fechas de publicación reales; `BreadcrumbList` y un índice `CollectionPage`.
- Nada de reseñas, puntuaciones, expertos clínicos o resultados de clientes inventados. Las preguntas visibles no se marcan como un resultado enriquecido médico.
- Enlaces internos entre intenciones relacionadas. Los enlaces a borradores no publicados se omiten del contenido público.
- Sitemap solo con artículos publicados. Los borradores no se copian al artefacto de producción normal.
- Preload de la fuente local; medios y CSS con huella de contenido para caché segura; imágenes responsive y lazy loading fuera de la imagen principal.
- El sistema de consentimiento de analítica existente se conserva cuando se publiquen. Las páginas del preview editorial no cargan analítica.

## Fuentes y hechos sensibles

- OMS Europa / HBSC: gráfico de 2018 y 2022; adolescentes, no adultos colombianos. Un porcentaje poblacional no diagnostica a un lector ni prueba la eficacia de Foco.
- APA: orientación sobre adolescentes, no un test universal ni una validación clínica de esta guía.
- Apple: documentación vigente de Tiempo en pantalla y requisitos de versión, consultada el 23 de septiembre de 2026.
- Brick: precio anunciado, compatibilidad y términos en sus propias páginas. No se comprobó un checkout entregado en Colombia; no se convierte el precio a COP sin una cotización fechada.
- Foco: configuración de checkout, soporte y condiciones actuales. La tabla distingue tarjeta, envío, descuento de paquete y cupones adicionales. Mi tiempo mide sesiones, no “horas recuperadas”.

Las URLs y fechas de consulta viven en `scripts/blog-content.mjs` y aparecen en cada artículo. `scripts/blog.mjs` calcula los precios y renders; no duplicar cifras comerciales dentro de los textos.

## Revisión antes de publicar

1. Revisar voz, ejemplos, compatibilidad y el funcionamiento descrito contra la versión actual de Foco. Si se quieren capturas de la última interfaz, sustituir los renders existentes por capturas aprobadas, no por interfaces generadas.
2. Revisar cuidadosamente el artículo de bienestar digital. No atribuir revisión clínica si no la hubo; para ampliar recomendaciones de salud, obtener revisión de un profesional cualificado.
3. Volver a comprobar precio y compatibilidad de Brick si pasa tiempo antes del lanzamiento. No presentar como observado un checkout internacional que no se haya verificado.
4. Confirmar precio, envío, disponibilidad y condiciones en el checkout publicado de Foco. La fuente de código evita discrepancias de copia, pero no demuestra por sí sola el estado de producción.
5. Aprobar publicación explícitamente. Marcar los artículos aprobados `status: 'published'` y registrar su `publishedAt` real. Usar `modifiedAt` solo para una revisión sustantiva posterior.
6. Construir sin `FOCO_BLOG_PREVIEW`, verificar canonical, robots, sitemap, enlaces, imágenes y consentimiento. Publicar con el flujo habitual y leer de vuelta las URLs reales antes de darlo por terminado.

## Preview local

```sh
npm ci
FOCO_BLOG_PREVIEW=1 npm run build:vercel
python3 -m http.server 4337 --bind 127.0.0.1 --directory dist
```

Abrir <http://127.0.0.1:4337/blog/>. El modo de preview permite revisar artículos publicados y futuros borradores, con banner de revisión y `noindex`. No hay fechas de publicación simuladas ni envío de visitas del preview a GA.

Para una compilación normal: `npm run build:vercel`. Ahora incluye las cinco rutas aprobadas y sus entradas en el sitemap. Los futuros artículos con estado `draft` siguen excluidos del build público.

## Qué medir después del lanzamiento

Priorizar tres señales: búsquedas que realmente traen lectores, visitas al checkout desde artículos y compras confirmadas atribuibles con consentimiento. Separar contenido informativo de comparación/compra; no interpretar cada visita al artículo de salud como una oportunidad comercial.

Usar Search Console y los reportes GA4 existentes. No se crearon reportes, campañas ni eventos nuevos en esta tarea. Revisar consultas reales y preguntas de soporte para elegir la próxima lectura, en lugar de fabricar grandes series de variantes de la misma palabra clave.

## Verificación inicial de los borradores

- 11 pruebas nuevas de publicación, SEO, fuentes, precios, visuales y enlaces.
- 163/163 pruebas pasan en el Node 26 local. En el Node 22 configurado por el proyecto: 162/163; la única falla es el presupuesto preexistente del CSS de la homepage (8.015 bytes gzip frente a <8.000). La entrada y dependencias de ese bundle no cambiaron en esta tarea; no se relajó el límite.
- Builds normal y de preview con Node 22 completados en ambos destinos estáticos. Se comprobó que el build normal no contiene rutas de borradores ni sus entradas en el sitemap; el preview resolvió 180 referencias locales y no cargó analítica.
- Siete páginas comprobadas en cuatro anchos (320, 390, 768 y 1.440 px): sin desbordes ni errores de página. Axe no detectó violaciones en las siete páginas. Se probaron la tabla expandible del gráfico y el desplazamiento horizontal de la tabla de precios. Capturas en `output/playwright/` (artefactos locales, no se publican).
- En la etapa de borrador no se desplegó a producción ni se modificó la app iOS o el checkout. La publicación posterior se verifica sobre un checkout limpio de la versión más reciente de `origin/main`.
