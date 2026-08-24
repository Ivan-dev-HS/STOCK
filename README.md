# Inventario de Pedidos

Aplicación web para hacer el conteo de inventario desde el teléfono y generar
un PDF listo para enviar a la sección de pedidos (o para imprimir), en
reemplazo de la planilla en papel.

## Uso

1. Abre `index.html` en el navegador del teléfono o del computador (no
   requiere instalación ni conexión a internet una vez cargada la página).
2. Completa **Sucursal / Local**, **Solicitado por** y, si quieres,
   **Observaciones**.
3. En las pestañas **Guías y Rieles** y **Barras** están todos los productos
   del catálogo (igual que las planillas originales). Escribe la cantidad a
   pedir en cada producto que haga falta. Para las barras hay dos campos,
   **D20** y **D28**, según el diámetro.
4. Usa el buscador para encontrar un producto rápido, o activa **"Ver solo
   marcados"** para revisar antes de enviar el pedido.
5. Si necesitas pedir algo que no está en el catálogo, agrégalo en la
   pestaña **Otros**.
6. Cuando termines, toca **Generar PDF** para descargar el pedido listo para
   enviar por correo/WhatsApp a la sección de pedidos, o **Imprimir** para
   imprimirlo directamente.
7. **Vaciar** borra las cantidades marcadas (los datos de sucursal y
   solicitante se mantienen) para empezar un pedido nuevo.

Los datos se guardan automáticamente en el propio teléfono/navegador
(`localStorage`), así que puedes cerrar la app y seguir completando el
inventario más tarde sin perder lo ya marcado.

## Publicar la app

Como es HTML/CSS/JS puro, se puede alojar en cualquier hosting estático
(por ejemplo, GitHub Pages: Settings → Pages → Deploy from branch, usando
esta misma rama y carpeta raíz). Luego se abre la URL desde el teléfono y,
opcionalmente, se agrega a la pantalla de inicio como acceso directo.

## Estructura del proyecto

- `index.html` — estructura de la página.
- `css/styles.css` — estilos, pensados primero para móvil.
- `js/catalog-data.js` — catálogo de productos (reconstruido de las
  planillas `Inventario_Sistemas` e `Inventario_Sistemas_Barras`).
- `js/app.js` — lógica de la app: listas, guardado local, búsqueda,
  generación de PDF y vista de impresión.
- `js/vendor/` — librería [jsPDF](https://github.com/parallax/jsPDF) (y su
  plugin `autotable`) incluida localmente para que la generación de PDF
  funcione sin depender de un servicio externo.
