import { NextRequest, NextResponse } from "next/server";
import { handleOfflineApi, isOfflineCorePath, isOfflineDesktop } from "@/lib/offlineDesktop";

/**
 * Same-origin API proxy for Vercel → Render.
 * Browser calls /api/*; this forwards to the FastAPI backend (avoids CORS "Failed to fetch").
 */
async function proxy(req: NextRequest, pathSegments: string[]) {
  const offline = handleOfflineApi(req, pathSegments);
  if (offline) return offline;

  const path = pathSegments.join("/");
  const proxyTarget = (process.env.API_PROXY_TARGET || "").replace(/\/$/, "");

  // Safety net: never send core dashboard APIs to the integration server.
  if (proxyTarget.endsWith(":8810") || isOfflineCorePath(path)) {
    const forced = handleOfflineApi(req, pathSegments, { force: true });
    if (forced) return forced;
  }

  if (isOfflineDesktop()) {
    return NextResponse.json(
      { detail: "Offline desktop mode — this API endpoint is not available locally." },
      { status: 404 },
    );
  }

  if (!proxyTarget) {
    return NextResponse.json(
      { detail: "No API backend configured. Run via Start ATE Intelligence.bat (offline desktop)." },
      { status: 502 },
    );
  }

  const url = `${proxyTarget}/api/${path}${req.nextUrl.search}`;

  const headers = new Headers();
  const auth = req.headers.get("authorization");
  if (auth) headers.set("authorization", auth);
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: "no-store",
    redirect: "manual",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch {
    return NextResponse.json(
      {
        detail:
          "Backend unreachable. Wake https://wafer-yield-api.onrender.com/api/health then retry.",
      },
      { status: 502 },
    );
  }

  const out = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) out.set("content-type", ct);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: out,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
