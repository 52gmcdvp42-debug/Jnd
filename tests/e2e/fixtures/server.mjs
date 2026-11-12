// Servidor de vídeo de prueba (simula el CDN del proveedor). Soporta Range.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
const file = readFileSync(new URL("./test.webm", import.meta.url));
createServer((req, res) => {
  const range = req.headers.range;
  const headers = { "Content-Type": "video/webm", "Accept-Ranges": "bytes", "Access-Control-Allow-Origin": "*" };
  if (range) {
    const [s, e] = range.replace("bytes=", "").split("-");
    const start = Number(s), end = e ? Number(e) : file.length - 1;
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${file.length}`, "Content-Length": end - start + 1 });
    res.end(file.subarray(start, end + 1));
  } else {
    res.writeHead(200, { ...headers, "Content-Length": file.length });
    res.end(file);
  }
}).listen(4100);
