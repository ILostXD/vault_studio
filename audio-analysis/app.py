from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock

import essentia.standard as es


DATA_ROOT = Path(os.environ.get("AUDIO_DATA_ROOT", "/app/data")).resolve()
MAX_REQUEST_BYTES = 16 * 1024
ANALYSIS_LOCK = Lock()


def resolve_audio_path(file_path: str) -> Path:
    path = Path(file_path).resolve()
    try:
        path.relative_to(DATA_ROOT)
    except ValueError as error:
        raise ValueError("file_path must be inside the configured audio data directory")
    if not path.is_file():
        raise ValueError("audio file does not exist")
    return path


def analyze(file_path: str) -> dict[str, object]:
    path = resolve_audio_path(file_path)
    audio = es.MonoLoader(filename=str(path), sampleRate=44100)()
    if len(audio) < 44100 * 3:
        raise ValueError("audio must be at least 3 seconds long")

    with ANALYSIS_LOCK:
        bpm, _, _, _, _ = es.RhythmExtractor2013(
            method="multifeature",
            minTempo=40,
            maxTempo=250,
        )(audio)
        key, scale, strength = es.KeyExtractor(
            sampleRate=44100,
            profileType="bgate",
        )(audio)

    return {
        "bpm": round(float(bpm)),
        "key": key,
        "scale": scale,
        "key_string": f"{key} {scale}",
        "key_strength": float(strength),
        "file_path": str(path),
    }


class AnalysisHandler(BaseHTTPRequestHandler):
    def send_json(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/health":
            self.send_json(200, {"status": "ok"})
            return
        self.send_json(404, {"detail": "not found"})

    def do_POST(self) -> None:
        if self.path not in {"/analyze", "/detect-bpm", "/detect-key"}:
            self.send_json(404, {"detail": "not found"})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > MAX_REQUEST_BYTES:
                raise ValueError("invalid request size")
            request = json.loads(self.rfile.read(content_length))
            result = analyze(str(request.get("file_path", "")))

            if self.path == "/detect-bpm":
                result = {"bpm": result["bpm"], "file_path": result["file_path"]}
            elif self.path == "/detect-key":
                result = {
                    "key": result["key"],
                    "scale": result["scale"],
                    "key_string": result["key_string"],
                    "file_path": result["file_path"],
                }

            self.send_json(200, result)
        except (ValueError, TypeError, json.JSONDecodeError) as error:
            self.send_json(400, {"detail": str(error)})
        except Exception as error:
            self.send_json(500, {"detail": f"analysis failed: {error}"})

    def log_message(self, format: str, *args: object) -> None:
        print(f"audio-analysis: {format % args}", flush=True)


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8001), AnalysisHandler).serve_forever()
