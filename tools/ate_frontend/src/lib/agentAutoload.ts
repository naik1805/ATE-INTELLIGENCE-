export type AutoloadFilePayload = {
  name: string;
  type: string;
  buffer: ArrayBuffer;
};

export type AutoloadMessage = {
  type: "verilumen-autoload";
  agentId: string;
  dataBase: string;
  bootstrap: Record<string, unknown>;
  files: AutoloadFilePayload[];
};

export function toFile(payload: AutoloadFilePayload): File {
  const leaf = payload.name.split("/").pop() || payload.name;
  return new File([payload.buffer], leaf, {
    type: payload.type || "application/octet-stream",
  });
}

export async function buildAutoloadMessage(
  agentId: string,
  dataBase: string,
): Promise<AutoloadMessage> {
  const bootstrap = (await fetch(
    `/api/default-data/agents/${agentId}/bootstrap`,
  ).then((r) => r.json())) as Record<string, unknown>;

  const meta = (bootstrap.files as Array<{ name: string }> | undefined) ?? [];
  const files: AutoloadFilePayload[] = [];

  for (const entry of meta) {
    const res = await fetch(
      `/api/default-data/agents/${agentId}/files/${encodeURIComponent(entry.name)}`,
    );
    if (!res.ok) continue;
    files.push({
      name: entry.name,
      type: res.headers.get("content-type") || "application/octet-stream",
      buffer: await res.arrayBuffer(),
    });
  }

  return {
    type: "verilumen-autoload",
    agentId,
    dataBase,
    bootstrap,
    files,
  };
}

export function postAutoloadToIframe(
  iframe: HTMLIFrameElement | null,
  message: AutoloadMessage,
) {
  if (!iframe?.contentWindow) return;
  const transfers = message.files.map((f) => f.buffer);
  iframe.contentWindow.postMessage(message, "*", transfers);
}
