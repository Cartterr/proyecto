# Cotizador: guía de edición y validación

## Qué cambia

- Cada fila de repisa permite **Actualizar valor en tabla** con un icono gris de guardado. Editar el campo de precio sigue afectando solamente a esa cotización hasta pulsar el botón y confirmar el rango.
- Los racks completos llegan como productos independientes, con nombre de modelo, medidas fijas y cajas incluidas. Su precio neto es manual: no se consulta ni modifica la tabla de repisas. Se conserva al mover/girar el mismo modelo; cambiar el modelo reinicia el precio. No se permite generar un PDF con un rack sin precio positivo.
- La sincronización elimina las filas de muebles retirados, incluso el último. El PDF y la cotización guardada conservan la descripción y el tipo de producto. Las medidas del rack también son de solo lectura al editar una cotización guardada.
- La confirmación identifica alto, profundidad total y rango de largos. La API relee la tabla, rechaza rangos ambiguos o precios previamente modificados y verifica la celda después de escribir.
- La profundidad comercial incluye los dos pilares: 48 cm corresponden a 40 cm útiles en la tabla.
- No se escriben precios cuando la tabla remota no está disponible. Las cotizaciones guardadas no se recalculan.
- El PDF sigue el diseño de Maxi del 25-09 (tamaño carta, cuatro páginas): cotización con vista isométrica y planta, servicios adicionales con precio neto y con IVA, galería y preguntas frecuentes. Los servicios contratados aparecen como filas de la cotización. Las vistas se achican hasta 110 pt para que unas seis filas quepan en la página 1; cotizaciones más largas agregan páginas de detalle y ninguna fila desaparece.
- Las dos vistas son verticales, 214×270 y 148×270 pt, y se exportan a triple resolución. Logo y fotos viven en `netlify/functions/quote-assets/`, tomados del PDF de Maxi.
- La generación de PDF se ejecuta en Node, sin subir libros temporales a Drive. El guardado posterior de la cotización conserva su flujo existente.
- Si falla una vista del proyecto, se pide reintentar antes de emitir el PDF; no se entrega silenciosamente una cotización incompleta.
- El plano se conserva junto al borrador local al alternar entre móvil y escritorio. Reiniciar borra el plano; los servicios adicionales se desplazan dentro de su tarjeta sin ensanchar toda la página.

## Archivos a editar

| Necesidad | Archivo |
|---|---|
| Distribución, textos, imágenes y márgenes del PDF | `netlify/functions/lib/quote-pdf.mjs` |
| Tamaño solicitado de las vistas | `VISTAS_PDF` en `src/admin/PorCotizar.jsx` |
| Botón y confirmación de precios | `src/admin/PorCotizar.jsx` |
| Escritura de una celda de precios | `netlify/functions/update-precio.mjs` |
| Validación de rango y precio previo | `netlify/functions/lib/price-update.mjs` |
| Tabla de respaldo y búsqueda de rangos | `src/admin/preciosRepisas.js` |

Las posiciones del PDF están en puntos de impresión; los tamaños solicitados al visor están en píxeles. Mantener las proporciones evita deformaciones. El PDF sigue la entrega de Maxi (`cotizador.zip`, 25-09): mismas posiciones, textos, colores y fuentes Lora/Poppins (licencia SIL OFL, en `netlify/functions/quote-assets/fonts`). El botón "Pagar cotización" usa el link de Mercado Pago de Don Maxi, salvo que `payment_url` traiga otra URL HTTPS válida.

## Entorno local nativo

Colocar este repositorio en `erp` y el configurador en la carpeta vecina `configurator`.

1. En `configurator`: `pnpm install --frozen-lockfile` y `pnpm build`.
2. En `erp`: `npm ci`.
3. En `erp`: `node scripts/local-dev/start-native.mjs`.
4. Abrir `http://127.0.0.1:5176/admin`. La contraseña de demostración está en `scripts/local-dev/server.mjs`.

Si el configurador está en otra ubicación, definir `REPISAS_CONFIGURATOR_DIR` con esa ruta antes de ejecutar el script. Se necesitan libres los puertos 3000, 8899 y 5176. Ctrl+C cierra los procesos que inició el lanzador.
Para un túnel temporal existente, definir `LOCAL_PUBLIC_URL` antes del arranque: así los enlaces locales a PDFs usan la misma dirección de prueba.

Visitas, cotizaciones, tabla de precios y PDFs se guardan localmente. No se cargan credenciales de producción, no se escribe en Google y no se envían mensajes. Los datos de prueba viven en `scripts/local-dev/data.json` y `scripts/local-dev/pdfs/`, ignorados por Git.

## Validación

```text
npm test
npm run build
node scripts/local-dev/verify-refinements.mjs
```

La prueba E2E usa Chrome instalado nativamente, solo acepta localhost y guarda capturas en `docs/evidence/2026-09-21-refinements/`. El PDF descargado queda en `output/quote-e2e.pdf`. Incluye cambio de precio, lectura posterior, edición integrada y generación/descarga del PDF. Los ejemplos utilizan datos ficticios.

Para producción, `ADMIN_PASSWORD`, `PRECIOS_SHEET_ID` y las credenciales Google existentes siguen siendo necesarias para la tabla. La cuenta de Google debe tener permiso de edición. El control de precio previo detecta cambios entre la lectura de pantalla y el guardado; Google Sheets no ofrece una transacción compare-and-swap, por lo que no sustituye un bloqueo distribuido entre escrituras simultáneas.

## Colaboración y siguiente producto

Maxi puede crear una rama, cambiar la plantilla o las vistas, ejecutar estas pruebas y abrir un PR con capturas. Revisar juntos el resultado y fusionar después de la revisión. No compartir archivos `.env` ni credenciales.

La futura vista pública del cotizador es un producto separado: reutilizar la configuración y las exportaciones, definir primero qué puede editar el cliente, qué precio se muestra y cuándo se requiere revisión humana. Nunca exponer `update-precio` ni controles administrativos en esa vista. Antes de publicarla, sustituir la contraseña compartida del administrador por autenticación individual y autorización del lado del servidor.
