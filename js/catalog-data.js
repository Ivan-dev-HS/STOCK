/* Catálogo base de productos, reconstruido a partir de las planillas
   "Inventario_Sistemas.pdf" e "Inventario_Sistemas_Barras.pdf".
   Cada item: { cat, prod, color, nota } (+ diam:true para items con
   cantidad separada por diámetro D20 / D28). */

const CATALOG_RIELES = [
  // Paquetto
  { cat: 'Paquetto', prod: 'Guía Paquetto', color: 'Blanco' },
  { cat: 'Paquetto', prod: 'Cuadradillo', color: 'Blanco' },
  { cat: 'Paquetto', prod: 'Contrapeso', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Cadena 100 mm', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Cadena 150 mm', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Cadena 200 mm', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Soporte Techo', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Rodillo', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Protector contrapeso', color: 'Translúcido' },

  // Barra Guía (Acero, Negro, Blanco, Dorado, Antracita)
  ...barraGuia('Acero'),
  ...barraGuia('Negro'),
  ...barraGuia('Blanco'),
  ...barraGuia('Dorado'),
  ...barraGuia('Antracita', true),

  // Guía Manual Negro
  { cat: 'Guía Manual', prod: 'Guía Manual', color: 'Negro' },
  { cat: '-Accesorio', prod: 'Soporte Techo', color: 'Negro' },
  { cat: '-Accesorio', prod: 'Tapones', color: 'Negro' },
  { cat: '-Accesorio', prod: 'Empalme Metálico', color: '' },

  // Guía Manual Blanco
  { cat: 'Guía Manual', prod: 'Guía Manual', color: 'Blanco', nota: 'Rielchyc o Normal' },
  { cat: '-Accesorio', prod: 'Soporte Techo', color: 'Blanco', nota: 'Rielchyc o Normal' },
  { cat: '-Accesorio', prod: 'Tapones', color: 'Blanco', nota: 'Rielchyc o Normal' },
  { cat: '-Accesorio', prod: 'Soporte Techo Metálico', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Empalme Metálico', color: '' },

  // Guía Profesional Acero / Blanco
  { cat: 'Guía Profesional', prod: 'Guía Profesional', color: 'Acero' },
  { cat: '-Accesorio', prod: 'Soporte Techo', color: 'Acero' },
  { cat: '-Accesorio', prod: 'Tapones', color: 'Acero' },
  { cat: 'Guía Profesional', prod: 'Guía Profesional', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Soporte Techo', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Tapones', color: 'Blanco' },

  // Guía reforzada Blanco
  { cat: 'Guía reforzada', prod: 'Guía reforzada', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Soporte techo', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Tapones', color: 'Blanco' },

  // Guía de Velcro Blanco
  { cat: 'Guía de Velcro', prod: 'Guía de Velcro', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Soporte techo', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Corredera Normal', color: 'Negro' },
  { cat: '-Accesorio', prod: 'Corredera Normal', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Corredera Onda Perfecta 6cm', color: 'Negro' },
  { cat: '-Accesorio', prod: 'Corredera Onda Perfecta 8cm', color: 'Negro' },
  { cat: '-Accesorio', prod: 'Corredera Onda Perfecta 6cm', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Corredera Onda Perfecta 8cm', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Tirador metálico', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Tirador metálico', color: 'Gris' },
  { cat: '-Accesorio', prod: 'Soporte rápido', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Soporte rápido', color: 'Gris' },
  { cat: '-Accesorio', prod: 'Escuadra de 3cm Rielchyc', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Escuadra de 7cm Rielchyc', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Escuadra de 12cm Rielchyc', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Escuadra Extensible 11-16cm', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Escuadra Extensible 16-24cm', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Azapaño', color: 'Negro' },
  { cat: '-Accesorio', prod: 'Azapaño', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Azapaño', color: 'Dorado' },
  { cat: '-Accesorio', prod: 'Azapaño', color: 'Gris' },
  { cat: '-Accesorio', prod: 'Cuerda Panel', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Cuerda Panel', color: 'Gris' },

  // Riel extensible
  { cat: 'Riel extensible', prod: 'Riel extensible de 0,87 - 150', color: 'Blanco' },
  { cat: 'Riel extensible', prod: 'Riel extensible de 1,37 - 250', color: 'Blanco' },
  { cat: 'Riel extensible', prod: 'Riel extensible de 1,89 - 350', color: 'Blanco' },
  { cat: 'Riel extensible', prod: 'Riel extensible de 2,37 - 450', color: 'Blanco' },

  // Guía Curvable Blanco
  { cat: 'Guía Curvable', prod: 'Guía', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Correderas', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Soporte', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Terminal Metálico', color: 'Blanco' },
  { cat: '-Accesorio', prod: 'Empalme', color: 'Blanco' },
];

function barraGuia(color, conEmpalme) {
  const items = [
    { cat: 'Barra Guía', prod: 'Barra Guía', color },
    { cat: '-Accesorio', prod: 'Soporte Techo', color },
    { cat: '-Accesorio', prod: 'Soporte Frente', color },
    { cat: '-Accesorio', prod: 'Soporte Frente Doble', color },
    { cat: '-Accesorio', prod: 'Tapones', color },
  ];
  if (conEmpalme) items.push({ cat: '-Accesorio', prod: 'Empalme Metálico', color: '' });
  return items;
}

function barraDeForja(color) {
  return [
    { cat: '-Barra de forja', prod: 'Barra de 150', color, diam: true },
    { cat: '-Barra de forja', prod: 'Barra de 200', color, diam: true },
    { cat: '-Barra de forja', prod: 'Barra de 250', color, diam: true },
    { cat: '-Accesorio', prod: 'Sop. Techo', color, diam: true },
    { cat: '-Accesorio', prod: 'Sop. Frente', color, diam: true },
    { cat: '-Accesorio', prod: 'Sop. Frente doble', color, diam: true },
    { cat: '-Accesorio', prod: 'Final Tapón', color, diam: true },
    { cat: '-Accesorio', prod: 'Final Bola', color, diam: true },
  ];
}

const CATALOG_BARRAS = [
  ...barraDeForja('Acero'),
  ...barraDeForja('Oro'),
  ...barraDeForja('Negro'),
  ...barraDeForja('Óxido'),
  ...barraDeForja('Blanca'),

  { cat: '-Barrita a presión', prod: 'Barrita de 20/30', color: 'Blanca' },
  { cat: '-Barrita a presión', prod: 'Barrita de 30/50', color: 'Blanca' },
  { cat: '-Barrita a presión', prod: 'Barrita de 46/80', color: 'Blanca' },
  { cat: '-Barrita a presión', prod: 'Barrita de 80/110', color: 'Blanca' },
  { cat: '-Barrita a presión', prod: 'Barrita de 90/140', color: 'Blanca' },

  { cat: '-Barrita a tornillo', prod: 'Barrita de 20/35', color: 'Blanca' },
  { cat: '-Barrita a tornillo', prod: 'Barrita de 20/36', color: 'Blanca' },
  { cat: '-Barrita a tornillo', prod: 'Barrita de 20/37', color: 'Blanca' },
  { cat: '-Barrita a tornillo', prod: 'Barrita de 20/38', color: 'Blanca' },
  { cat: '-Barrita a tornillo', prod: 'Barrita de 20/39', color: 'Blanca' },

  { cat: '-Barrita a alcayata', prod: 'Barrita de 20/40', color: '' },
  { cat: '-Barrita a alcayata', prod: 'Barrita de 20/41', color: '' },
  { cat: '-Barrita a alcayata', prod: 'Barrita de 20/42', color: '' },
  { cat: '-Barrita a alcayata', prod: 'Barrita de 20/43', color: '' },
  { cat: '-Barrita a alcayata', prod: 'Barrita de 20/44', color: '' },
  { cat: '-Barrita a alcayata', prod: 'Barrita de 20/45', color: '' },
  { cat: '-Barrita a alcayata', prod: 'Barrita de 20/46', color: '' },
];

// Asigna un id estable a cada fila del catálogo según su posición.
CATALOG_RIELES.forEach((item, i) => { item.id = 'r' + i; });
CATALOG_BARRAS.forEach((item, i) => { item.id = 'b' + i; });
