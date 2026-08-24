/* Catálogo base de productos, reconstruido a partir de las planillas
   "Inventario_Sistemas.pdf" e "Inventario_Sistemas_Barras.pdf".
   Cada item: { grupo, cat, prod, color, nota } (+ diam:true para items
   con cantidad separada por diámetro D20 / D28). */

function barraGuia(color, conEmpalme) {
  const items = [
    { grupo: 'Barra Guía', cat: 'Barra Guía', prod: 'Barra Guía', color },
    { grupo: 'Barra Guía', cat: '-Accesorio', prod: 'Soporte Techo', color },
    { grupo: 'Barra Guía', cat: '-Accesorio', prod: 'Soporte Frente', color },
    { grupo: 'Barra Guía', cat: '-Accesorio', prod: 'Soporte Frente Doble', color },
    { grupo: 'Barra Guía', cat: '-Accesorio', prod: 'Tapones', color },
  ];
  if (conEmpalme) items.push({ grupo: 'Barra Guía', cat: '-Accesorio', prod: 'Empalme Metálico', color: '' });
  return items;
}

function barraDeForja(color) {
  const grupo = 'Barra de forja';
  return [
    { grupo, cat: '-Barra de forja', prod: 'Barra de 150', color, diam: true },
    { grupo, cat: '-Barra de forja', prod: 'Barra de 200', color, diam: true },
    { grupo, cat: '-Barra de forja', prod: 'Barra de 250', color, diam: true },
    { grupo, cat: '-Accesorio', prod: 'Sop. Techo', color, diam: true },
    { grupo, cat: '-Accesorio', prod: 'Sop. Frente', color, diam: true },
    { grupo, cat: '-Accesorio', prod: 'Sop. Frente doble', color, diam: true },
    { grupo, cat: '-Accesorio', prod: 'Final Tapón', color, diam: true },
    { grupo, cat: '-Accesorio', prod: 'Final Bola', color, diam: true },
  ];
}

const CATALOG_RIELES = [
  // Paquetto
  { grupo: 'Paquetto', cat: 'Paquetto', prod: 'Guía Paquetto', color: 'Blanco' },
  { grupo: 'Paquetto', cat: 'Paquetto', prod: 'Cuadradillo', color: 'Blanco' },
  { grupo: 'Paquetto', cat: 'Paquetto', prod: 'Contrapeso', color: 'Blanco' },
  { grupo: 'Paquetto', cat: '-Accesorio', prod: 'Cadena 100 mm', color: 'Blanco' },
  { grupo: 'Paquetto', cat: '-Accesorio', prod: 'Cadena 150 mm', color: 'Blanco' },
  { grupo: 'Paquetto', cat: '-Accesorio', prod: 'Cadena 200 mm', color: 'Blanco' },
  { grupo: 'Paquetto', cat: '-Accesorio', prod: 'Soporte Techo', color: 'Blanco' },
  { grupo: 'Paquetto', cat: '-Accesorio', prod: 'Rodillo', color: 'Blanco' },
  { grupo: 'Paquetto', cat: '-Accesorio', prod: 'Protector contrapeso', color: 'Translúcido' },

  // Barra Guía (Acero, Negro, Blanco, Dorado, Antracita)
  ...barraGuia('Acero'),
  ...barraGuia('Negro'),
  ...barraGuia('Blanco'),
  ...barraGuia('Dorado'),
  ...barraGuia('Antracita', true),

  // Guía Manual Negro
  { grupo: 'Guía Manual', cat: 'Guía Manual', prod: 'Guía Manual', color: 'Negro' },
  { grupo: 'Guía Manual', cat: '-Accesorio', prod: 'Soporte Techo', color: 'Negro' },
  { grupo: 'Guía Manual', cat: '-Accesorio', prod: 'Tapones', color: 'Negro' },
  { grupo: 'Guía Manual', cat: '-Accesorio', prod: 'Empalme Metálico', color: '' },

  // Guía Manual Blanco
  { grupo: 'Guía Manual', cat: 'Guía Manual', prod: 'Guía Manual', color: 'Blanco', nota: 'Rielchyc o Normal' },
  { grupo: 'Guía Manual', cat: '-Accesorio', prod: 'Soporte Techo', color: 'Blanco', nota: 'Rielchyc o Normal' },
  { grupo: 'Guía Manual', cat: '-Accesorio', prod: 'Tapones', color: 'Blanco', nota: 'Rielchyc o Normal' },
  { grupo: 'Guía Manual', cat: '-Accesorio', prod: 'Soporte Techo Metálico', color: 'Blanco' },
  { grupo: 'Guía Manual', cat: '-Accesorio', prod: 'Empalme Metálico', color: '' },

  // Guía Profesional Acero / Blanco
  { grupo: 'Guía Profesional', cat: 'Guía Profesional', prod: 'Guía Profesional', color: 'Acero' },
  { grupo: 'Guía Profesional', cat: '-Accesorio', prod: 'Soporte Techo', color: 'Acero' },
  { grupo: 'Guía Profesional', cat: '-Accesorio', prod: 'Tapones', color: 'Acero' },
  { grupo: 'Guía Profesional', cat: 'Guía Profesional', prod: 'Guía Profesional', color: 'Blanco' },
  { grupo: 'Guía Profesional', cat: '-Accesorio', prod: 'Soporte Techo', color: 'Blanco' },
  { grupo: 'Guía Profesional', cat: '-Accesorio', prod: 'Tapones', color: 'Blanco' },

  // Guía reforzada Blanco
  { grupo: 'Guía reforzada', cat: 'Guía reforzada', prod: 'Guía reforzada', color: 'Blanco' },
  { grupo: 'Guía reforzada', cat: '-Accesorio', prod: 'Soporte techo', color: 'Blanco' },
  { grupo: 'Guía reforzada', cat: '-Accesorio', prod: 'Tapones', color: 'Blanco' },

  // Guía de Velcro Blanco
  { grupo: 'Guía de Velcro', cat: 'Guía de Velcro', prod: 'Guía de Velcro', color: 'Blanco' },
  { grupo: 'Guía de Velcro', cat: '-Accesorio', prod: 'Soporte techo', color: 'Blanco' },
  { grupo: 'Guía de Velcro', cat: '-Accesorio', prod: 'Corredera Normal', color: 'Negro' },
  { grupo: 'Guía de Velcro', cat: '-Accesorio', prod: 'Corredera Normal', color: 'Blanco' },
  { grupo: 'Guía de Velcro', cat: '-Accesorio', prod: 'Corredera Onda Perfecta 6cm', color: 'Negro' },
  { grupo: 'Guía de Velcro', cat: '-Accesorio', prod: 'Corredera Onda Perfecta 8cm', color: 'Negro' },
  { grupo: 'Guía de Velcro', cat: '-Accesorio', prod: 'Corredera Onda Perfecta 6cm', color: 'Blanco' },
  { grupo: 'Guía de Velcro', cat: '-Accesorio', prod: 'Corredera Onda Perfecta 8cm', color: 'Blanco' },
  { grupo: 'Guía de Velcro', cat: '-Accesorio', prod: 'Tirador metálico', color: 'Blanco' },
  { grupo: 'Guía de Velcro', cat: '-Accesorio', prod: 'Tirador metálico', color: 'Gris' },
  { grupo: 'Guía de Velcro', cat: '-Accesorio', prod: 'Soporte rápido', color: 'Blanco' },
  { grupo: 'Guía de Velcro', cat: '-Accesorio', prod: 'Soporte rápido', color: 'Gris' },
  { grupo: 'Guía de Velcro', cat: '-Accesorio', prod: 'Escuadra de 3cm Rielchyc', color: 'Blanco' },
  { grupo: 'Guía de Velcro', cat: '-Accesorio', prod: 'Escuadra de 7cm Rielchyc', color: 'Blanco' },
  { grupo: 'Guía de Velcro', cat: '-Accesorio', prod: 'Escuadra de 12cm Rielchyc', color: 'Blanco' },
  { grupo: 'Guía de Velcro', cat: '-Accesorio', prod: 'Escuadra Extensible 11-16cm', color: 'Blanco' },
  { grupo: 'Guía de Velcro', cat: '-Accesorio', prod: 'Escuadra Extensible 16-24cm', color: 'Blanco' },
  { grupo: 'Guía de Velcro', cat: '-Accesorio', prod: 'Azapaño', color: 'Negro' },
  { grupo: 'Guía de Velcro', cat: '-Accesorio', prod: 'Azapaño', color: 'Blanco' },
  { grupo: 'Guía de Velcro', cat: '-Accesorio', prod: 'Azapaño', color: 'Dorado' },
  { grupo: 'Guía de Velcro', cat: '-Accesorio', prod: 'Azapaño', color: 'Gris' },
  { grupo: 'Guía de Velcro', cat: '-Accesorio', prod: 'Cuerda Panel', color: 'Blanco' },
  { grupo: 'Guía de Velcro', cat: '-Accesorio', prod: 'Cuerda Panel', color: 'Gris' },

  // Riel extensible
  { grupo: 'Riel extensible', cat: 'Riel extensible', prod: 'Riel extensible de 0,87 - 150', color: 'Blanco' },
  { grupo: 'Riel extensible', cat: 'Riel extensible', prod: 'Riel extensible de 1,37 - 250', color: 'Blanco' },
  { grupo: 'Riel extensible', cat: 'Riel extensible', prod: 'Riel extensible de 1,89 - 350', color: 'Blanco' },
  { grupo: 'Riel extensible', cat: 'Riel extensible', prod: 'Riel extensible de 2,37 - 450', color: 'Blanco' },

  // Guía Curvable Blanco
  { grupo: 'Guía Curvable', cat: 'Guía Curvable', prod: 'Guía', color: 'Blanco' },
  { grupo: 'Guía Curvable', cat: '-Accesorio', prod: 'Correderas', color: 'Blanco' },
  { grupo: 'Guía Curvable', cat: '-Accesorio', prod: 'Soporte', color: 'Blanco' },
  { grupo: 'Guía Curvable', cat: '-Accesorio', prod: 'Terminal Metálico', color: 'Blanco' },
  { grupo: 'Guía Curvable', cat: '-Accesorio', prod: 'Empalme', color: 'Blanco' },
];

const CATALOG_BARRAS = [
  ...barraDeForja('Acero'),
  ...barraDeForja('Oro'),
  ...barraDeForja('Negro'),
  ...barraDeForja('Óxido'),
  ...barraDeForja('Blanca'),

  { grupo: 'Barrita a presión', cat: '-Barrita a presión', prod: 'Barrita de 20/30', color: 'Blanca' },
  { grupo: 'Barrita a presión', cat: '-Barrita a presión', prod: 'Barrita de 30/50', color: 'Blanca' },
  { grupo: 'Barrita a presión', cat: '-Barrita a presión', prod: 'Barrita de 46/80', color: 'Blanca' },
  { grupo: 'Barrita a presión', cat: '-Barrita a presión', prod: 'Barrita de 80/110', color: 'Blanca' },
  { grupo: 'Barrita a presión', cat: '-Barrita a presión', prod: 'Barrita de 90/140', color: 'Blanca' },

  { grupo: 'Barrita a tornillo', cat: '-Barrita a tornillo', prod: 'Barrita de 20/35', color: 'Blanca' },
  { grupo: 'Barrita a tornillo', cat: '-Barrita a tornillo', prod: 'Barrita de 20/36', color: 'Blanca' },
  { grupo: 'Barrita a tornillo', cat: '-Barrita a tornillo', prod: 'Barrita de 20/37', color: 'Blanca' },
  { grupo: 'Barrita a tornillo', cat: '-Barrita a tornillo', prod: 'Barrita de 20/38', color: 'Blanca' },
  { grupo: 'Barrita a tornillo', cat: '-Barrita a tornillo', prod: 'Barrita de 20/39', color: 'Blanca' },

  { grupo: 'Barrita a alcayata', cat: '-Barrita a alcayata', prod: 'Barrita de 20/40', color: '' },
  { grupo: 'Barrita a alcayata', cat: '-Barrita a alcayata', prod: 'Barrita de 20/41', color: '' },
  { grupo: 'Barrita a alcayata', cat: '-Barrita a alcayata', prod: 'Barrita de 20/42', color: '' },
  { grupo: 'Barrita a alcayata', cat: '-Barrita a alcayata', prod: 'Barrita de 20/43', color: '' },
  { grupo: 'Barrita a alcayata', cat: '-Barrita a alcayata', prod: 'Barrita de 20/44', color: '' },
  { grupo: 'Barrita a alcayata', cat: '-Barrita a alcayata', prod: 'Barrita de 20/45', color: '' },
  { grupo: 'Barrita a alcayata', cat: '-Barrita a alcayata', prod: 'Barrita de 20/46', color: '' },
];

// Asigna un id estable a cada fila del catálogo según su posición.
CATALOG_RIELES.forEach((item, i) => { item.id = 'r' + i; });
CATALOG_BARRAS.forEach((item, i) => { item.id = 'b' + i; });

// Agrupa los items consecutivos que comparten "grupo" en secciones,
// preservando el orden del catálogo original.
function buildSections(list) {
  const sections = [];
  let current = null;
  list.forEach((item) => {
    if (!current || current.title !== item.grupo) {
      current = { title: item.grupo, items: [] };
      sections.push(current);
    }
    current.items.push(item);
  });
  return sections;
}

const SECTIONS_RIELES = buildSections(CATALOG_RIELES);
const SECTIONS_BARRAS = buildSections(CATALOG_BARRAS);
