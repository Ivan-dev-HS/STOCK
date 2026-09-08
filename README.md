# Inventario de Pedidos

Aplicación web multiusuario para marcar qué falta reponer en la tienda, con
urgencia, compartida en tiempo real entre todos los teléfonos del equipo. Los
datos viven en una base de datos en la nube (Supabase), no solo en el
teléfono.

## Uso (empleados)

1. Abre `index.html` (u la URL publicada) desde el teléfono. La primera vez
   pide tu **nombre** — se recuerda en ese teléfono, así que solo hay que
   escribirlo una vez (se puede cambiar con el enlace "Cambiar" del
   encabezado si otra persona usa el mismo teléfono).
2. En las pestañas **Guías** y **Barras** está todo el catálogo, agrupado en
   secciones plegables. Por cada producto que falte, toca uno de los tres
   botones de urgencia:
   - **No hay** (rojo) — sin stock.
   - **Queda poco** (naranja) — stock bajo.
   - **Aún queda** (azul) — pedido preventivo, "por si acaso".
   Tocar el mismo botón otra vez lo desmarca; tocar otro cambia la urgencia.
   Se guarda al instante en la nube (hace falta conexión a internet).
3. Si falta algo que no está en el catálogo, agrégalo en **Otros** (con su
   propia urgencia).
4. La pestaña **Catálogo** deja agregar, editar o eliminar productos del
   catálogo (incluido fabricante y referencia): los cambios se ven al
   momento en todos los teléfonos, sin pasos manuales.
5. **Vaciar mis marcas** borra únicamente lo que tú marcaste.

Cada empleado solo ve y gestiona **sus propias marcas** — no hace falta
coordinarse ni preocuparse por pisar el trabajo de otro.

## Uso (administrador)

En la pestaña **Admin**, con el email y contraseña de administrador, se ve
el pedido de **todos los empleados combinado**: si dos personas marcan el
mismo producto, aparece una sola vez, con la urgencia más alta de las dos y
los nombres de quienes lo marcaron.

- **Semana en curso**: lo que está pendiente ahora mismo.
- Cada **viernes a las 17:00 UTC**, un proceso automático archiva todo lo
  pendiente en un informe de esa semana y empieza una semana nueva. También
  se puede tocar **"Cerrar semana ahora"** para hacerlo manualmente en
  cualquier momento.
- El desplegable de arriba deja ver cualquier semana anterior.
- **Descargar PDF** / **Imprimir** generan el informe (agrupado por familia
  de producto, con urgencia, fabricante, referencia y quién lo marcó) de la
  semana que se esté viendo.

## Arquitectura

Esta app dejó de ser "todo en el teléfono": ahora es un cliente estático
(HTML/CSS/JS) que habla con un proyecto **Supabase** compartido.

- Proyecto: `inventario-pedidos-stock` (org `Ivan-dev-HS's Org`, región
  `eu-west-1`).
- Tablas: `inv_requests` (una fila = un empleado marcó un producto con una
  urgencia), `inv_weekly_reports` (informes semanales archivados),
  `inv_catalog_edits` / `inv_catalog_deleted` / `inv_catalog_custom`
  (catálogo compartido: ediciones, bajas y productos nuevos).
- Seguridad (RLS): cualquiera puede marcar/editar su semana en curso y el
  catálogo; **solo el admin autenticado** puede leer semanas ya archivadas
  y los informes semanales.
- El cierre semanal corre con `pg_cron` dentro de la propia base de datos
  (no depende de que la app esté abierta en ningún teléfono).

**Esto implica que la app ya no funciona sin conexión a internet** para
marcar productos (si no hay red, no se puede guardar la marca) — a cambio,
gana que todo el equipo ve lo mismo en tiempo real.

### Credenciales de administrador

- Email: `lizado.dev@gmail.com`
- Contraseña inicial: (se entregó por chat al crear la cuenta — cámbiala
  cuando quieras desde el panel de Supabase, sección Authentication).

### Nota sobre el proyecto Supabase reutilizado

La cuenta de Supabase ya tenía 2 proyectos activos (el límite del plan
gratuito), así que para crear este proyecto se **pausó** (no se borró) el
proyecto `lizadex-tiendas`, que no estaba en uso. Se puede reactivar en
cualquier momento desde el dashboard de Supabase si hace falta.

## Estructura del proyecto

- `index.html` — estructura de la página (pestañas Guías, Barras, Otros,
  Catálogo, Admin).
- `css/styles.css` — estilos, pensados primero para móvil.
- `js/catalog-data.js` — catálogo base de productos (reconstruido de las
  planillas `Inventario_Sistemas` e `Inventario_Sistemas_Barras`).
- `js/supabase-config.js` — URL y clave pública (anon) del proyecto
  Supabase. La clave anon está pensada para ir en el cliente; el acceso
  real lo controlan las políticas RLS del proyecto.
- `js/app.js` — toda la lógica: catálogo compartido, marcas por empleado,
  urgencia, panel de administrador, generación de PDF/impresión.
- `js/vendor/` — [jsPDF](https://github.com/parallax/jsPDF) y
  [supabase-js](https://github.com/supabase/supabase-js) incluidos
  localmente (sin depender de un CDN externo).
