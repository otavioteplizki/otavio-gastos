import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";

function clean(s: unknown, max: number): string {
  return String(s ?? "").trim().slice(0, max);
}

export default async (req: Request, _context: Context) => {
  const db = getDatabase();
  const url = new URL(req.url);
  const idMatch = url.pathname.match(/\/api\/gastos\/(\d+)\/?$/);

  try {
    await db.sql`
      CREATE TABLE IF NOT EXISTS gastos (
        id SERIAL PRIMARY KEY,
        valor NUMERIC(12,2) NOT NULL,
        categoria TEXT NOT NULL,
        descricao TEXT NOT NULL DEFAULT '',
        data DATE NOT NULL,
        texto_original TEXT,
        nome TEXT,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    if (req.method === "GET") {
      const rows = await db.sql`
        SELECT id, valor, categoria, descricao, to_char(data, 'YYYY-MM-DD') AS data, texto_original AS "textoOriginal", nome, criado_em AS "criadoEm"
        FROM gastos
        ORDER BY data DESC, criado_em DESC
        LIMIT 5000
      `;
      return Response.json(rows);
    }

    if (req.method === "POST") {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return new Response("JSON invalido", { status: 400 });
      }
      const valor = Number(body?.valor);
      const categoria = clean(body?.categoria, 60);
      const descricao = clean(body?.descricao, 200) || "(sem descricao)";
      const data = clean(body?.data, 10);
      const textoOriginal = clean(body?.textoOriginal, 500);
      const nome = clean(body?.nome, 60);

      if (!(valor > 0)) return new Response("valor invalido", { status: 400 });
      if (!categoria) return new Response("categoria invalida", { status: 400 });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return new Response("data invalida", { status: 400 });

      const [row] = await db.sql`
        INSERT INTO gastos (valor, categoria, descricao, data, texto_original, nome)
        VALUES (${Math.round(valor * 100) / 100}, ${categoria}, ${descricao}, ${data}, ${textoOriginal}, ${nome})
        RETURNING id, valor, categoria, descricao, to_char(data, 'YYYY-MM-DD') AS data, texto_original AS "textoOriginal", nome, criado_em AS "criadoEm"
      `;
      return Response.json(row, { status: 201 });
    }

    if (req.method === "DELETE" && idMatch) {
      const id = Number(idMatch[1]);
      await db.sql`DELETE FROM gastos WHERE id = ${id}`;
      return new Response(null, { status: 204 });
    }

    return new Response("Not found", { status: 404 });
  } catch (err: any) {
    return new Response("Erro no servidor: " + (err?.message || String(err)), { status: 500 });
  }
};

export const config: Config = {
  path: ["/api/gastos", "/api/gastos/*"],
};
