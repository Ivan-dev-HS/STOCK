# Inventario de Pedidos

Aplicación web para hacer el conteo de inventario desde el teléfono y generar
un PDF listo para enviar a la sección de pedidos (o para imprimir), en
reemplazo de la planilla en papel.

## Uso

1. Abre `index.html` en el navegador del teléfono o del computador (no
   requiere instalación ni conexión a internet una vez cargada la página).
2. Completa la **Fecha** y, si quieres, **Solicitado por** y
   **Observaciones** en "Datos del pedido".
3. En las pestañas **Guías** y **Barras** están todos los productos del
   catálogo (igual que las planillas originales), agrupados en secciones
   plegables por familia de producto. Marca cada producto que haga falta
   pedir — es un checklist, no hay que indicar cantidades. Para las barras,
   los diámetros D20 y D28 aparecen como productos separados.
4. Usa el buscador para encontrar un producto rápido, o activa **"Solo
   marcados"** para revisar antes de enviar el pedido.
5. Si necesitas pedir algo que no está en el catálogo, agrégalo en la
   pestaña **Otros**.
6. Cuando termines, toca **Generar PDF** para descargar el pedido listo para
   enviar por correo/WhatsApp a la sección de pedidos, o **Imprimir** para
   imprimirlo directamente. El PDF sale organizado por secciones, igual que
   en la app, para que se entienda de un vistazo a qué familia pertenece
   cada accesorio marcado.
7. Al generar el PDF o imprimir, el pedido queda guardado en la pestaña
   **Historial** y las marcas se vacían automáticamente para el próximo
   pedido. Desde el Historial se puede volver a descargar o reimprimir
   cualquier pedido anterior, eliminarlo, o vaciar todo el historial.
8. **Vaciar** borra lo marcado sin generar nada (los datos de solicitante se
   mantienen) por si necesitas empezar de cero.
9. Desde la pestaña **Catálogo** se puede agregar, editar o eliminar
   cualquier producto (incluido su **Fabricante** y **Ref. fabricante**,
   que salen como columnas a la derecha en el PDF) sin tocar código.

Los datos se guardan automáticamente en el propio teléfono/navegador
(`localStorage`), así que puedes cerrar la app y seguir completando el
inventario más tarde sin perder lo ya marcado.

### Un catálogo por dispositivo (y cómo compartirlo)

Los cambios hechos en la pestaña **Catálogo** (productos agregados, editados,
eliminados, fabricante/referencia) se guardan solo en el teléfono donde se
hicieron — no hay una base de datos compartida detrás de la app. Para que se
vean en otros teléfonos:

1. En el teléfono donde hiciste los cambios, ve a **Catálogo** y toca
   **"Exportar catálogo"**: descarga un archivo `.json`.
2. Comparte ese archivo (WhatsApp, correo, AirDrop...) a los demás teléfonos.
3. En cada uno, ve a **Catálogo** → **"Importar catálogo"** y elige el
   archivo recibido. Esto reemplaza el catálogo manual de ese teléfono por
   el importado (no los mezcla), así que conviene hacerlo desde una única
   fuente "oficial" cada vez que se actualice.

El pedido en curso, el historial de pedidos y los datos de "Otros" no se
exportan — son propios de cada teléfono.

## Publicar la app

Como es HTML/CSS/JS puro, se puede alojar en cualquier hosting estático
(por ejemplo, GitHub Pages: Settings → Pages → Deploy from branch, usando
esta misma rama y carpeta raíz). Luego se abre la URL desde el teléfono y,
opcionalmente, se agrega a la pantalla de inicio como acceso directo.

## Estructura del proyecto

- `index.html` — estructura de la página.
- `css/styles.css` — estilos, pensados primero para móvil.
- `js/catalog-data.js` — catálogo de productos (reconstruido de las
  planillas `Inventario_Sistemas` e `Inventario_Sistemas_Barras`), agrupado
  en secciones.
- `js/app.js` — lógica de la app: listas, guardado local, búsqueda,
  historial de pedidos, generación de PDF y vista de impresión.
- `js/vendor/` — librería [jsPDF](https://github.com/parallax/jsPDF) (y su
  plugin `autotable`) incluida localmente para que la generación de PDF
  funcione sin depender de un servicio externo.
