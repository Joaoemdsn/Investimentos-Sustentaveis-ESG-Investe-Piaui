"""Application factory for the portable dashboard."""

from pathlib import Path
from flask import Flask, Response, send_from_directory
from backend.api.routes import create_api
from backend.repositories.csv_repository import CsvRepository
from backend.services.offline import offline_html

ROOT = Path(__file__).resolve().parent.parent


def create_app(data_dir=None):
    app = Flask(
        __name__,
        static_folder=str(ROOT / "frontend" / "assets"),
        static_url_path="/assets",
    )
    app.json.ensure_ascii = False
    app.json.sort_keys = False
    repository = CsvRepository(Path(data_dir) if data_dir else ROOT / "data")
    app.extensions["dashboard_repository"] = repository
    app.register_blueprint(create_api(repository))

    @app.get("/")
    @app.get("/index.html")
    def index():
        return send_from_directory(ROOT / "frontend", "index.html")

    @app.get("/contexto.html")
    def context():
        return send_from_directory(ROOT / "frontend", "contexto.html")

    @app.get("/offline.html")
    def offline():
        return Response(
            offline_html(repository, ROOT / "frontend"),
            mimetype="text/html",
            headers={"Content-Disposition": "attachment; filename=Piaui_em_Perspectiva.html"},
        )

    @app.get("/contexto-offline.html")
    def offline_context():
        return Response(
            offline_html(repository, ROOT / "frontend", page="context"),
            mimetype="text/html",
            headers={"Content-Disposition": "attachment; filename=Piaui_Contexto_Produtivo.html"},
        )

    @app.errorhandler(404)
    def missing(_error):
        return {"error": "Recurso não encontrado."}, 404

    return app
