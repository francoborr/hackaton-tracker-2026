import { cardById } from "./cards";
import { DEFENSE_CARD, type Game, type PlayInput } from "./game";

type Field = { type: "mrkdwn"; text: string };

export type Block = {
  type: "header" | "section" | "context";
  text?: { type: string; text: string; emoji?: boolean };
  fields?: Field[];
  accessory?: { type: "image"; image_url: string; alt_text: string };
  elements?: { type: "mrkdwn"; text: string }[];
};

export type SlackMessage = { text: string; blocks: Block[] };

const field = (label: string, value: string): Field => ({
  type: "mrkdwn",
  text: `*${label}*\n${value}`,
});

// Slack muestra la hora en el huso de cada uno si se la manda así.
const slackTime = (d: Date) =>
  `<!date^${Math.floor(d.getTime() / 1000)}^{time}|${d.toISOString().slice(11, 16)}>`;

/**
 * Arma el mensaje de una jugada ya registrada: título según lo que pasó, los datos en
 * dos columnas, el arte de la carta y el link al tablero.
 */
export function playMessage(game: Game, input: PlayInput, now: Date, boardUrl: string): SlackMessage {
  const card = cardById(input.cardId);
  if (!card) throw new Error("carta inválida");

  const name = (id?: string) => game.teams.find((t) => t.id === id)?.name ?? "¿?";
  const attacker = name(input.attackerId);
  const victim = name(input.victimId);
  const duration = card.minutes ? `${card.minutes} min` : "";
  const endsAt = card.minutes ? new Date(now.getTime() + card.minutes * 60_000) : null;
  const defenseName = input.defense ? cardById(DEFENSE_CARD[input.defense])?.name ?? "" : "";

  let header: string;
  let fields: Field[];
  let text: string;
  let ends = endsAt;

  if (card.type === "ayuda") {
    header = "🕊️ Ayuda usada";
    fields = [
      field("Tripulación", attacker),
      field("Carta", card.name),
      field("Efecto", card.effect),
      field("Duración", duration),
    ];
    text = `${attacker} usó ${card.name}`;
  } else if (input.defense === "casco") {
    header = "🛡️ Sabotaje bloqueado";
    fields = [
      field("Atacante", attacker),
      field("Víctima", victim),
      field("Carta", card.name),
      field("Defensa", defenseName),
      field("Resultado", "Sin efecto — se gastan las dos cartas"),
    ];
    text = `${victim} bloqueó ${card.name} de ${attacker}`;
    ends = null;
  } else if (input.defense === "viento") {
    header = "🌀 Sabotaje redirigido";
    fields = [
      field("Atacante", attacker),
      field("Víctima", victim),
      field("Carta", card.name),
      field("Defensa", defenseName),
      field("La sufre", name(input.redirectId)),
      field("Duración", duration),
    ];
    text = `${victim} redirigió ${card.name} hacia ${name(input.redirectId)}`;
  } else if (input.defense === "kraken") {
    header = "🐙 Sabotaje espejado";
    fields = [
      field("Atacante", attacker),
      field("Víctima", victim),
      field("Carta", card.name),
      field("Defensa", defenseName),
      field("La sufren", `${attacker} y ${victim}`),
      field("Duración", duration),
    ];
    text = `${card.name} la sufren ${attacker} y ${victim}`;
  } else if (input.defense === "botin") {
    header = "🎁 Sabotaje con botín";
    fields = [
      field("Atacante", attacker),
      field("Víctima", victim),
      field("Carta", card.name),
      field("Defensa", defenseName),
      field("Duración", duration),
      field("Compensación", "+1 carta de ayuda"),
    ];
    text = `${victim} sufre ${card.name} pero se lleva una carta de ayuda`;
  } else {
    header = "⚔️ Sabotaje jugado";
    fields = [
      field("Atacante", attacker),
      field("Víctima", victim),
      field("Carta", card.name),
      field("Duración", duration),
      field("Efecto", card.effect),
    ];
    text = `${attacker} le jugó ${card.name} a ${victim}`;
  }

  const link = `<${boardUrl}|Ver el tablero>`;
  return {
    text,
    blocks: [
      { type: "header", text: { type: "plain_text", text: header, emoji: true } },
      {
        type: "section",
        fields,
        accessory: {
          type: "image",
          image_url: `${boardUrl}/cards/${card.id}.jpg`,
          alt_text: card.name,
        },
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: ends ? `${link} · termina ${slackTime(ends)}` : link }],
      },
    ],
  };
}

/**
 * Manda el mensaje al webhook. Sin `SLACK_WEBHOOK_URL` no hace nada, y cualquier falla
 * queda acá: avisar por Slack nunca puede tumbar una jugada.
 */
export async function notifySlack(message: SlackMessage): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) console.warn(`slack respondió ${res.status}`);
  } catch (e) {
    console.warn("no se pudo avisar por slack:", e);
  }
}
