#!/usr/bin/env python3
"""Local server for this template's clone. Serves ./public with the correct
JavaScript MIME type for .mjs modules so the site's runtime (and every image and
animation it renders) loads in the browser. Double-click "Open Site" instead of
opening index.html directly.

Extras over a plain static server:
  - URLs with a query string map to the file saved as  name__<sha1(query)[:8]>.ext
  - extensionless files get their recorded Content-Type from public/_types.json
  - unknown extensionless paths fall back to /index.html (client-side routers)

Usage: python3 _serve.py [--port N] [--no-browser]"""
import os, re, sys, socket, threading, webbrowser, functools, http.server, hashlib, json
from urllib.parse import urlsplit, unquote

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "public")
if not os.path.isfile(os.path.join(ROOT, "index.html")):
    ROOT = os.path.join(HERE, "site")
if not os.path.isfile(os.path.join(ROOT, "index.html")):
    print("No clone found (expected a public/ or site/ folder next to this file).")
    input("Press Return to close.")
    sys.exit(1)

try:
    TYPES = json.load(open(os.path.join(ROOT, "_types.json"), encoding="utf-8"))
except Exception:
    TYPES = {}


def clean(seg):
    """Same rule as lib/mirror.mjs clean(): unsafe characters -> _, long segments shortened + hashed."""
    c = re.sub(r'[<>:"|?*\\\x00-\x1f]', "_", seg)
    c = "_" if re.fullmatch(r"\.+", c) else c
    return c[:40] + "__" + hashlib.sha1(c.encode("utf-8")).hexdigest()[:8] if len(c.encode("utf-8")) > 180 else c


def query_variant(path, query):
    """Same naming rule the scraper uses: stem__hash8.ext"""
    h = hashlib.sha1(query.encode("utf-8")).hexdigest()[:8]
    head, tail = os.path.split(path)
    stem, ext = os.path.splitext(tail)
    return os.path.join(head, "%s__%s%s" % (stem, h, ext))


class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def translate_path(self, path):
        parts = urlsplit(path)
        segs = [clean(x) for x in unquote(parts.path).split("/") if x]
        base = os.path.join(ROOT, *segs)
        if parts.path.endswith("/") and parts.path != "/":
            base_idx = os.path.join(base, "__index")      # a non-page resource saved for "/dir/"
        else:
            base_idx = None
        if parts.query:
            for b in filter(None, (base_idx, base)):
                v = query_variant(b, unquote(parts.query))
                if os.path.isfile(v):
                    return v
        if base_idx and os.path.isfile(base_idx):
            return base_idx
        if os.path.isdir(base) and os.path.isfile(os.path.join(base, "index.html")):
            # serve /about from about/index.html directly: no 301 to /about/, which would change the page's base URL
            return os.path.join(base, "index.html")
        if os.path.exists(base):
            return base
        # SPA fallback: extensionless route that was never captured
        if not os.path.splitext(parts.path)[1]:
            return os.path.join(ROOT, "index.html")
        return base

    def send_head(self):
        # Framer's CMS loader asks for byte slices of its .framercms files as ?range=a-b,c-d and checks the returned length.
        # Serve a saved per-query variant when one exists (translate_path), otherwise cut the slices out of the full file.
        parts = urlsplit(self.path)
        m = re.fullmatch(r"range=((?:\d+-\d+,?)+)", unquote(parts.query))
        if not m:
            return super().send_head()
        full = self.translate_path(parts.path)
        if not os.path.isfile(full) or os.path.basename(full) != os.path.basename(parts.path):
            return super().send_head()          # a saved variant (stem__hash8.ext) is already the exact response
        data = open(full, "rb").read()
        body = b"".join(data[int(a):int(b) + 1] for a, b in (r.split("-") for r in m.group(1).strip(",").split(",")))
        self.send_response(200)
        self.send_header("Content-Type", self.guess_type(full))
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        import io
        return io.BytesIO(body)

    def guess_type(self, path):
        rel = os.path.relpath(str(path), ROOT).replace(os.sep, "/")
        if rel in TYPES:
            return TYPES[rel]
        p = str(path).lower()
        if p.endswith(".mjs") or p.endswith(".js"):
            return "text/javascript"
        if p.endswith(".json"):
            return "application/json"
        if p.endswith(".css"):
            return "text/css"
        if p.endswith(".svg"):
            return "image/svg+xml"
        if p.endswith(".wasm"):
            return "application/wasm"
        return super().guess_type(path)

    def log_message(self, *a):
        pass


port = 0
if "--port" in sys.argv:
    port = int(sys.argv[sys.argv.index("--port") + 1])
if not port:
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 256  # default 5 drops connections when the runtime fires dozens of module imports at once
    daemon_threads = True


httpd = Server(("127.0.0.1", port), functools.partial(H, directory=ROOT))
url = "http://localhost:%d" % port
print("Serving this clone at  %s" % url, flush=True)
print("(keep this window open; press Ctrl+C to stop)", flush=True)
if "--no-browser" not in sys.argv:
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\nStopped.")
