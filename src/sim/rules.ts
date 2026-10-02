// Reglamento del control de seguridad del aeropuerto: el mismo texto para los dos agentes.

export const SEALS = ['pasa', 'retirar', 'revisar', 'alerta'] as const;
export type Seal = (typeof SEALS)[number];

export const SEAL_LABEL: Record<Seal, string> = {
  pasa: 'PASA',
  retirar: 'RETIRAR',
  revisar: 'REVISAR',
  alerta: 'ALERTA',
};

/** Descripción de cada decisión: es el espacio de salida tipado de Jev. */
export const SEAL_CRITERIA: Record<Seal, string> = {
  pasa: 'Pasa: el equipaje no cumple ninguna regla de las otras tres categorías, una vez aplicadas las excepciones.',
  retirar: 'Retirar: hay un objeto prohibido en cabina que se retira (líquido de más de 100 ml sin excepción, hoja de más de 6 cm, herramienta de más de 7 cm, réplica de arma, batería de más de 160 Wh, más de un mechero, bolsa de líquidos de más de 1 litro en total).',
  revisar: 'Revisar: hace falta una revisión manual de la bolsa (portátil sin sacar, masa opaca sin identificar, más de 350 g de polvo, batería de entre 100 y 160 Wh).',
  alerta: 'Alerta: riesgo inmediato, se avisa a la policía (explosivos o pirotecnia, arma de fuego real, cables con pila y temporizador sin aparato reconocible, gas o combustible inflamable).',
};

/** Prioridad cuando se cumplen varias reglas: gana la primera. */
export const PRIORITY: Seal[] = ['alerta', 'retirar', 'revisar', 'pasa'];

export const REGLAMENTO = `REGLAMENTO DEL CONTROL DE SEGURIDAD (equipaje de mano)
Cada bandeja o bulto recibe exactamente una decisión. Primero se aplican las excepciones de cada regla; después, si siguen cumpliéndose varias reglas, manda la de mayor prioridad: ALERTA > RETIRAR > REVISAR > PASA. Por ejemplo, una mochila con petardos y un portátil dentro es ALERTA, y una con un champú de 250 ml y un portátil dentro es RETIRAR.

ALERTA
A1. Explosivos y pirotecnia: petardos, bengalas, fuegos artificiales, pólvora, detonadores. Un libro o una revista sobre pirotecnia no es pirotecnia.
A2. Armas de fuego reales. Las de juguete de colores vivos no cuentan; las réplicas realistas son RETIRAR.
A3. Cables unidos a una pila y a un temporizador que no forman parte de un aparato reconocible. Un despertador, unos auriculares o un cargador con su pila no son alerta.
A4. Gas o combustible inflamable: bombonas de camping, gasolina, olor a combustible.

RETIRAR
R1. Líquidos, geles y aerosoles en envases de MÁS de 100 ml. Cuenta la capacidad del envase, en la unidad que venga: 1 l = 100 cl = 1.000 ml; medio litro son 500 ml, 33 cl son 330 ml y 0,1 l son 100 ml (se permite). Excepciones: los medicamentos líquidos con receta, la comida o leche de bebé, y los productos del duty-free en bolsa precintada con su ticket pueden pasar con más de 100 ml. Sin precinto o sin receta, no hay excepción.
R2. Objetos con hoja de MÁS de 6 cm, es decir, de más de 60 mm (navajas, tijeras, cúteres, cuchillos). Hojas de 6 cm o menos se permiten. Los cubiertos de plástico no tienen hoja.
R3. Herramientas de MÁS de 7 cm, es decir, de más de 70 mm (destornilladores, llaves, alicates).
R4. Réplicas realistas de armas.
R5. Baterías externas de MÁS de 160 Wh. Si la batería viene en mAh y voltios, Wh = mAh × V / 1.000 (por ejemplo, 20.000 mAh a 3,7 V son 74 Wh).
R6. Más de un mechero por pasajero. Un solo mechero se permite.
R7. La bolsa de líquidos de cabina: la suma de todos sus envases no puede pasar de 1 litro (1.000 ml), aunque cada envase cumpla R1. Exactamente 1.000 ml se permite.

REVISAR
V1. Un portátil o una tableta que siguen dentro de la mochila o la maleta. Si vienen en bandeja aparte, no hay que revisar.
V2. Una masa opaca que la máquina no identifica. Si el parte la identifica (por ejemplo, queso curado o libros), no hay que revisar.
V3. Más de 350 g de polvo (proteínas, harina, café molido, especias). 0,35 kg son 350 g y medio kilo son 500 g.
V4. Baterías externas de MÁS de 100 Wh y hasta 160 Wh (si vienen en mAh y voltios, se calcula como en R5).

PASA
Todo lo que no cumpla ninguna regla anterior una vez aplicadas sus excepciones.`;
