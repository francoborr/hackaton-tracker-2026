import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyGame, type Game } from "./game";
import { notifySlack, playMessage, publicBaseUrl } from "./slack";

const NOW = new Date("2026-09-07T14:21:00Z");
const URL_BASE = "https://tracker.test";

function game(): Game {
  return {
    ...emptyGame(),
    startedAt: "2026-09-07T12:00:00Z",
    teams: [
      { id: "t1", name: "Barbanegra" },
      { id: "t2", name: "La Perla Negra" },
      { id: "t3", name: "El Kraken" },
    ],
  };
}

// Los campos llegan como "*Etiqueta*\nvalor": los aplano para poder assertear.
function fields(blocks: ReturnType<typeof playMessage>["blocks"]): Record<string, string> {
  const section = blocks.find((b) => b.type === "section");
  const out: Record<string, string> = {};
  for (const f of section?.fields ?? []) {
    const [label, value] = f.text.split("\n");
    out[label.replaceAll("*", "")] = value;
  }
  return out;
}

const header = (blocks: ReturnType<typeof playMessage>["blocks"]) =>
  blocks.find((b) => b.type === "header")?.text?.text;

const context = (blocks: ReturnType<typeof playMessage>["blocks"]) =>
  blocks.find((b) => b.type === "context")?.elements?.[0].text;

describe("playMessage", () => {
  it("sabotaje sin defensa", () => {
    const { blocks, text } = playMessage(
      game(), { attackerId: "t1", cardId: "mano-de-garfio", victimId: "t2" }, NOW, URL_BASE,
    );
    expect(header(blocks)).toBe("⚔️ Sabotaje jugado");
    expect(fields(blocks)).toMatchObject({
      Víctima: "La Perla Negra",
      Carta: "Mano de garfio",
      Duración: "10 min",
      Efecto: "Escriben con una mano",
    });
    expect(text).toContain("La Perla Negra");
  });

  // Si la víctima sabe quién le pegó, se venga: el atacante no va en el mensaje.
  it("no nombra al atacante en ninguna variante de sabotaje", () => {
    const defenses = [undefined, "casco", "viento", "kraken", "botin"] as const;
    for (const defense of defenses) {
      const { blocks, text } = playMessage(
        game(),
        { attackerId: "t1", cardId: "mano-de-garfio", victimId: "t2", defense, redirectId: "t3" },
        NOW, URL_BASE,
      );
      expect(fields(blocks).Atacante).toBeUndefined();
      expect(JSON.stringify(blocks)).not.toContain("Barbanegra");
      expect(text).not.toContain("Barbanegra");
    }
  });

  it("pone el arte de la carta y el link al tablero", () => {
    const { blocks } = playMessage(
      game(), { attackerId: "t1", cardId: "mano-de-garfio", victimId: "t2" }, NOW, URL_BASE,
    );
    const section = blocks.find((b) => b.type === "section");
    expect(section?.accessory).toMatchObject({
      type: "image",
      image_url: "https://tracker.test/cards/mano-de-garfio.jpg",
    });
    expect(context(blocks)).toContain("<https://tracker.test|Ver el tablero>");
    // la hora la formatea Slack en el huso de cada uno
    expect(context(blocks)).toContain("<!date^");
  });

  it("inmunidad: bloqueado, sin duración", () => {
    const { blocks } = playMessage(
      game(),
      { attackerId: "t1", cardId: "mano-de-garfio", victimId: "t2", defense: "casco" },
      NOW, URL_BASE,
    );
    expect(header(blocks)).toBe("🛡️ Sabotaje bloqueado");
    expect(fields(blocks)).toMatchObject({
      Defensa: "Inmunidad",
      Resultado: "Sin efecto — se gastan las dos cartas",
    });
    expect(fields(blocks).Duración).toBeUndefined();
    expect(context(blocks)).not.toContain("termina");
  });

  it("viento en contra: nombra al barco que la termina sufriendo", () => {
    const { blocks } = playMessage(
      game(),
      { attackerId: "t1", cardId: "mano-de-garfio", victimId: "t2", defense: "viento", redirectId: "t3" },
      NOW, URL_BASE,
    );
    expect(header(blocks)).toBe("🌀 Sabotaje redirigido");
    expect(fields(blocks)).toMatchObject({
      Defensa: "Viento en contra",
      "La sufre": "El Kraken",
      Duración: "10 min",
    });
  });

  it("kraken: la sufren los dos barcos", () => {
    const { blocks } = playMessage(
      game(),
      { attackerId: "t1", cardId: "mano-de-garfio", victimId: "t2", defense: "kraken" },
      NOW, URL_BASE,
    );
    expect(header(blocks)).toBe("🐙 Sabotaje espejado");
    expect(fields(blocks)["La sufren"]).toBe("La Perla Negra y quien la lanzó");
  });

  it("botín: suma la compensación", () => {
    const { blocks } = playMessage(
      game(),
      { attackerId: "t1", cardId: "mano-de-garfio", victimId: "t2", defense: "botin" },
      NOW, URL_BASE,
    );
    expect(header(blocks)).toBe("🎁 Sabotaje con botín");
    expect(fields(blocks)).toMatchObject({
      Defensa: "Botín de repuesto",
      Compensación: "+1 carta de ayuda",
    });
  });

  it("ayuda: habla de tripulación, no de víctima", () => {
    const { blocks } = playMessage(
      game(), { attackerId: "t3", cardId: "consejo-cartografo" }, NOW, URL_BASE,
    );
    expect(header(blocks)).toBe("🕊️ Ayuda usada");
    expect(fields(blocks)).toMatchObject({
      Tripulación: "El Kraken",
      Carta: "Consejo de cartógrafo",
      Efecto: "Consulta a Javi",
      Duración: "10 min",
    });
    expect(fields(blocks).Atacante).toBeUndefined();
  });

  it("un barco borrado de la flota no rompe el mensaje", () => {
    const { blocks } = playMessage(
      game(), { attackerId: "t1", cardId: "naufrago", victimId: "fantasma" }, NOW, URL_BASE,
    );
    expect(fields(blocks).Víctima).toBe("¿?");
  });
});

describe("publicBaseUrl", () => {
  beforeEach(() => {
    delete process.env.APP_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  });

  const req = (url: string) => new Request(url, { method: "POST" });

  it("usa APP_URL si está configurada", () => {
    process.env.APP_URL = "https://cartas.mimiquate.com/";
    expect(publicBaseUrl(req("http://localhost:3000/api/plays"))).toBe("https://cartas.mimiquate.com");
  });

  // Slack tiene que poder bajar la imagen: el dominio de producción siempre es público,
  // el de una preview está detrás del login de Vercel.
  it("cae al dominio de producción de Vercel antes que al del request", () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "tracker.vercel.app";
    expect(publicBaseUrl(req("https://tracker-git-rama-x.vercel.app/api/plays")))
      .toBe("https://tracker.vercel.app");
  });

  it("sin nada configurado usa el origen del request", () => {
    expect(publicBaseUrl(req("http://localhost:3000/api/plays"))).toBe("http://localhost:3000");
  });
});

describe("notifySlack", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response("ok"));
    delete process.env.SLACK_WEBHOOK_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SLACK_WEBHOOK_URL;
  });

  it("sin webhook configurado no llama a nadie", async () => {
    await notifySlack({ text: "hola", blocks: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("postea el mensaje al webhook", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.test/abc";
    await notifySlack({ text: "hola", blocks: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.slack.test/abc");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ text: "hola", blocks: [] });
  });

  // Que Slack se caiga no puede tumbar la jugada.
  it("se traga los errores de red", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.test/abc";
    fetchMock.mockRejectedValue(new Error("sin red"));
    await expect(notifySlack({ text: "hola", blocks: [] })).resolves.toBeUndefined();
  });

  it("se traga las respuestas de error de Slack", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.test/abc";
    fetchMock.mockResolvedValue(new Response("invalid_payload", { status: 400 }));
    await expect(notifySlack({ text: "hola", blocks: [] })).resolves.toBeUndefined();
  });
});
