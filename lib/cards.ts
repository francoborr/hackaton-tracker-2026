export type CardType = "sabotaje" | "ayuda" | "defensa";

export type Card = {
  id: string;
  name: string;
  type: CardType;
  effect: string;
  minutes?: number; // sabotaje: duración de la maldición; ayuda: duración de la bendición
};

export const CARDS: Card[] = [
  { id: "naufrago", name: "Naufrago", type: "sabotaje", effect: "Sin internet", minutes: 5 },
  { id: "guardia-nocturna", name: "Guardia nocturna", type: "sabotaje", effect: "Sin hablar", minutes: 5 },
  { id: "catalejo", name: "El catalejo del capitán", type: "sabotaje", effect: "Una sola pantalla", minutes: 15 },
  { id: "secuestro", name: "Secuestro de tripulación", type: "sabotaje", effect: "Sin un integrante", minutes: 10 },
  { id: "mano-de-garfio", name: "Mano de garfio", type: "sabotaje", effect: "Escriben con una mano", minutes: 10 },
  { id: "tabla-de-castigo", name: "Tabla de castigo", type: "sabotaje", effect: "Sin sillas", minutes: 15 },
  { id: "bandera-extranjera", name: "Bandera extranjera", type: "sabotaje", effect: "Hablan en inglés", minutes: 15 },
  { id: "codigo-del-corsario", name: "Código del corsario", type: "sabotaje", effect: "Disfrazados de pirata", minutes: 15 },
  { id: "consejo-cartografo", name: "Consejo de cartógrafo", type: "ayuda", effect: "Consulta a Javi", minutes: 10 },
  { id: "consejo-almirante", name: "Consejo del almirante", type: "ayuda", effect: "Consulta a un CEO de Mimiquate", minutes: 10 },
  { id: "senal-de-humo", name: "Señal de humo", type: "ayuda", effect: "Consulta al jurado", minutes: 10 },
  { id: "casco-blindado", name: "Casco blindado", type: "defensa", effect: "Bloquea el próximo poder recibido" },
  { id: "viento-en-contra", name: "Viento en contra", type: "defensa", effect: "Redirige un poder que te lanzaron" },
  { id: "maldicion-del-kraken", name: "Maldición del Kraken", type: "defensa", effect: "La carta aplica también al atacante" },
  { id: "botin-de-repuesto", name: "Botín de repuesto", type: "defensa", effect: "Sufrís el sabotaje y ganás una ayuda" },
];

export function cardById(id: string): Card | undefined {
  return CARDS.find((c) => c.id === id);
}
