"""Local development entry point. Use Gunicorn/wsgi.py for production."""

import argparse
from backend import create_app

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Piauí em Perspectiva")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()
    create_app().run(host=args.host, port=args.port, debug=args.debug)
