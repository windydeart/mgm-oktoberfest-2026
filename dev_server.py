import http.server
import socketserver
import os
import time
import threading

PORT = 8085
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

clients = []
last_mtime = 0

def get_latest_mtime():
    max_mtime = 0
    for root, dirs, files in os.walk(DIRECTORY):
        if '.git' in root or '__pycache__' in root:
            continue
        for f in files:
            filepath = os.path.join(root, f)
            try:
                mtime = os.path.getmtime(filepath)
                if mtime > max_mtime:
                    max_mtime = mtime
            except Exception:
                pass
    return max_mtime

def file_watcher():
    global last_mtime
    last_mtime = get_latest_mtime()
    while True:
        time.sleep(0.5)
        current_mtime = get_latest_mtime()
        if current_mtime > last_mtime:
            last_mtime = current_mtime
            # Notify SSE clients
            dead_clients = []
            for client in clients:
                try:
                    client.wfile.write(b"data: reload\n\n")
                    client.wfile.flush()
                except Exception:
                    dead_clients.append(client)
            for dc in dead_clients:
                if dc in clients:
                    clients.remove(dc)

class LiveReloadHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path == '/events':
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Connection', 'keep-alive')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            clients.append(self)
            try:
                while True:
                    time.sleep(10)
                    self.wfile.write(b": ping\n\n")
                    self.wfile.flush()
            except Exception:
                if self in clients:
                    clients.remove(self)
            return
        return super().do_GET()

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == '__main__':
    watcher_thread = threading.Thread(target=file_watcher, daemon=True)
    watcher_thread.start()

    with ThreadedTCPServer(("", PORT), LiveReloadHandler) as httpd:
        print(f"🚀 Live Reload Server running at http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
