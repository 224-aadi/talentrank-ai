import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";

const port = Number(process.env.MOCK_INTEGRATIONS_PORT || 3060);
const root = path.join(process.cwd(), ".data", "mock-object-storage");

async function collectBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const server = http.createServer(async (request, response) => {
  if (!request.url || request.method !== "POST") {
    response.writeHead(404).end();
    return;
  }

  const body = await collectBody(request);
  if (request.url === "/scan") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "clean", bytes: body.length }));
    return;
  }

  if (request.url === "/ocr") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ text: "", provider: "mock-ocr", warnings: ["Mock OCR does not extract text."] }));
    return;
  }

  if (request.url === "/upload") {
    await fs.mkdir(root, { recursive: true });
    const storageKey = `external/mock/${Date.now()}-${Math.random().toString(16).slice(2)}.bin`;
    await fs.writeFile(path.join(root, storageKey.replaceAll("/", "_")), body);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ storageKey, encrypted: false, bytes: body.length }));
    return;
  }

  if (request.url === "/signed-download") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ url: `http://127.0.0.1:${port}/mock-signed-download` }));
    return;
  }

  response.writeHead(404).end();
});

server.listen(port, () => {
  console.log(`Mock integrations listening on http://127.0.0.1:${port}`);
  console.log(`Storage: http://127.0.0.1:${port}/upload`);
  console.log(`Scanner: http://127.0.0.1:${port}/scan`);
  console.log(`OCR: http://127.0.0.1:${port}/ocr`);
});
