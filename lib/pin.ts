export function checkPin(req: Request): boolean {
  const pin = process.env.JURY_PIN;
  if (!pin) return true;
  return req.headers.get("x-jury-pin") === pin;
}

export function unauthorized(): Response {
  return Response.json({ error: "PIN inválido" }, { status: 401 });
}
