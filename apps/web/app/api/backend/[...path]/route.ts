import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const cookieName = "irminsul_session";
type Context = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, context: Context) {
  const path = (await context.params).path.join("/");
  const method = request.method;
  const permitted = method === "GET"
    ? /^(health|auth\/me|accounts\/[0-9]{6,20}\/(stats|wishes|archive|builds|hoyolab-builds)|(?:sync-sessions|build-sync-sessions)\/[A-Za-z0-9]{64})$/.test(path)
    : /^(auth\/(login|register|logout|password)|archives\/import|sync-sessions|accounts\/[0-9]{6,20}\/build-sync|build-sync-sessions\/[A-Za-z0-9]{64}\/cancel)$/.test(path);
  if (!permitted) return NextResponse.json({ message: "Not found." }, { status: 404 });
  const origin = process.env.APP_ORIGIN ?? request.nextUrl.origin;
  if (method !== "GET" && (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site" || !request.headers.get("content-type")?.includes("application/json"))) {
    return NextResponse.json({ message: "Permintaan lintas situs ditolak." }, { status: 403 });
  }
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  const authEntry = path === "auth/login" || path === "auth/register";
  if (!token && !authEntry && path !== "health") return NextResponse.json({ message: "Silakan login." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const base = (process.env.API_INTERNAL_BASE ?? "http://127.0.0.1:8000/api").replace(/\/$/, "");
    const backend = new URL(base);
    if (backend.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(backend.hostname)) throw new Error("API requires HTTPS");
    let body: string | undefined;
    if (method !== "GET") {
      const limit = path === "archives/import" ? 4 * 1024 * 1024 : 16 * 1024;
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > limit) { await reader.cancel(); return NextResponse.json({ message: "File terlalu besar." }, { status: 413 }); }
        chunks.push(part.value);
      }
      body = Buffer.concat(chunks).toString("utf8");
    }
    const response = await fetch(`${base}/${path}${request.nextUrl.search}`, {
      method, headers: { Accept: "application/json", "Content-Type": "application/json", ...(!authEntry && token ? { Authorization: `Bearer ${token}` } : {}) },
      body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(110000),
    });
    const data = response.status >= 500 ? { message: "API sedang bermasalah. Coba lagi." } : await response.json();
    if (authEntry && response.ok && typeof data.token === "string") {
      jar.set(cookieName, data.token, { httpOnly: true, secure: new URL(origin).protocol === "https:", sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60 });
      delete data.token;
    }
    if (response.status === 401 || (response.ok && ["auth/logout", "auth/password"].includes(path))) jar.delete(cookieName);
    return NextResponse.json(data, { status: response.status, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ message: "API belum bisa dihubungi. Coba lagi sebentar." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = proxy;
export const POST = proxy;
