const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const publicRoot = path.resolve(__dirname, "..", "public");
const port = Number(process.env.PORT) || 3000;
const maxRequestBytes = 1024 * 1024;
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

function setSecurityHeaders(response) {
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' 'unsafe-inline' https://www.gstatic.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://firestore.googleapis.com; frame-src 'self' https://*.firebaseapp.com https://accounts.google.com;"
  );
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

function safePublicPath(requestUrl) {
  let requestPath;
  try {
    requestPath = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  } catch {
    return null;
  }
  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  if (relativePath.split(/[\\/]/).some((part) => part === ".." || part.startsWith("."))) {
    return null;
  }
  const filePath = path.resolve(publicRoot, relativePath);
  return filePath.startsWith(`${publicRoot}${path.sep}`) ? filePath : null;
}

const server = http.createServer((request, response) => {
  setSecurityHeaders(response);

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method Not Allowed");
    return;
  }

  let bodyBytes = 0;
  request.on("data", (chunk) => {
    bodyBytes += chunk.length;
    if (bodyBytes > maxRequestBytes) {
      response.writeHead(413);
      response.end("Request body too large");
      request.destroy();
    }
  });

  request.on("end", () => {
    const filePath = safePublicPath(request.url);
    if (!filePath) {
      response.writeHead(404);
      response.end("Not Found");
      return;
    }

    fs.stat(filePath, (statError, stats) => {
      if (statError || !stats.isFile()) {
        response.writeHead(404);
        response.end("Not Found");
        return;
      }

      const contentType = contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
      response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      fs.createReadStream(filePath).pipe(response);
    });
  });
});

server.listen(port, () => {
  console.log(`DocsToSheets server listening on port ${port}`);
});
