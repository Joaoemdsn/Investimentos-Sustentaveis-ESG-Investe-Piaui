"""Small read-only API with explicit, validated filter universes."""

from flask import Blueprint, request
from backend.domain import fne, climate
from backend.domain.internal import referral_indicator


def create_api(repository):
    api = Blueprint("api", __name__, url_prefix="/api/v1")

    def choice(name, default, values):
        value = request.args.get(name, default)
        if value not in values:
            raise ValueError(f"Parâmetro {name} inválido.")
        return value

    @api.errorhandler(ValueError)
    def invalid(error):
        return {"error": str(error)}, 400

    @api.get("/health")
    def health():
        return {
            "status": "ok",
            "project": "Piauí em Perspectiva",
            "snapshot": repository.metadata("export.json")["exported_snapshot"],
        }

    @api.get("/datasets/<name>")
    def dataset(name):
        methods = {"finance": repository.finance, "fne": repository.fne, "atlas": repository.atlas}
        if name not in methods:
            return {"error": "Dataset não encontrado."}, 404
        return methods[name]()

    @api.get("/catalog")
    def catalog():
        return {"items": repository.catalog()}

    @api.get("/fne/summary")
    def fne_summary():
        return fne.summary(
            repository.fne(),
            choice("year", "2025", fne.YEARS),
            choice("group", "todos", fne.GROUPS),
            choice("comparison", "NE", ("NE", "FNE")),
        )

    @api.get("/fne/records")
    def fne_records():
        rows, _ufs = fne.selected(
            repository.fne(),
            choice("year", "2025", fne.YEARS),
            choice("group", "todos", fne.GROUPS),
        )
        municipality = request.args.get("municipality")
        if municipality:
            if municipality not in {r["id"] for r in repository.municipalities()}:
                raise ValueError("Município inválido.")
            rows = [r for r in rows if r["cityId"] == municipality]
        try:
            page, size = int(request.args.get("page", 1)), int(request.args.get("per_page", 50))
            if page < 1 or not 1 <= size <= 500:
                raise ValueError
        except ValueError:
            raise ValueError("Paginação inválida.") from None
        start = (page - 1) * size
        return {"total": len(rows), "page": page, "per_page": size, "items": rows[start : start + size]}

    @api.get("/clima/summary")
    def climate_summary():
        sizes = ("todos",) + tuple(sorted({r["size"] for r in repository.finance()["rows"]}))
        return climate.summary(
            repository.finance(),
            choice("year", "todos", fne.YEARS),
            choice("sector", "todos", climate.SECTORS),
            choice("size", "todos", sizes),
            choice("comparison", "NE", ("NE", "BR")),
        )

    @api.get("/internal/indicator")
    def internal_indicator():
        period = repository.internal_period()
        return referral_indicator(repository.internal_projects(), **period)

    return api
