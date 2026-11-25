import functools
import http.server
import os
import socket
import sys
import threading
import webview


def get_dist_dir() -> str:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, "dist")
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist"))


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


def start_server(dist_dir: str) -> tuple[http.server.ThreadingHTTPServer, int]:
    handler = functools.partial(QuietHandler, directory=dist_dir)
    # Prefer a deterministic localhost port so localStorage persists across launches
    for port in (18473, 18474, 0):
        try:
            server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
            actual_port = server.server_address[1]
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            return server, actual_port
        except OSError:
            continue
    raise RuntimeError("Could not bind a local port for ChessForge.")


def main():
    dist_dir = get_dist_dir()
    server, port = start_server(dist_dir)
    storage_dir = os.path.join(
        os.environ.get("LOCALAPPDATA", os.path.expanduser("~")),
        "ChessForge",
        "webview",
    )
    os.makedirs(storage_dir, exist_ok=True)

    url = f"http://127.0.0.1:{port}/index.html"
    try:
        webview.create_window(
            "ChessForge — Custom Chess Variant Sandbox & Graph AI",
            url=url,
            width=1360,
            height=860,
            min_size=(960, 640),
            background_color="#1a1612",
        )
        webview.start(private_mode=False, storage_path=storage_dir)
    finally:
        server.shutdown()


if __name__ == "__main__":
    main()
