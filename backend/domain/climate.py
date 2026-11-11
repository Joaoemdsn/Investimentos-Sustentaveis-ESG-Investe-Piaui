"""Fundo Clima keeps its own record units and niche union."""

from backend.domain.fne import distribution

NE = {"AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"}
SECTORS = ("todos", "agro", "energia", "logistica")


def selected(payload, year="todos", sector="todos", size="todos"):
    return [
        row
        for row in payload["rows"]
        if (year == "todos" or row["year"] == int(year))
        and (bool(row["tags"]) if sector == "todos" else sector in row["tags"])
        and (size == "todos" or row["size"] == size)
    ]


def summary(payload, year="todos", sector="todos", size="todos", comparison="NE"):
    rows = selected(payload, year, sector, size)
    pi = [r for r in rows if r["uf"] == "PI"]
    benchmark = [r for r in rows if comparison == "BR" or r["uf"] in NE]
    total = sum(r["cents"] for r in pi)
    denominator = sum(r["cents"] for r in benchmark)
    direct = {r["operation"] for r in pi if r["grain"] == "subcredito"}
    automatic = [r for r in pi if r["grain"] == "registro_operacao_automatica"]
    return {
        "instrument": "FUNDO_CLIMA",
        "year": year,
        "sector": sector,
        "size": size,
        "comparison": comparison,
        "value_cents": total,
        "benchmark_cents": denominator,
        "pi_share": total / denominator if denominator and pi else None,
        "direct_contracts": len(direct),
        "automatic_records": len(automatic),
        "operations_and_records": len(direct) + len(automatic),
        "sector_distribution": distribution(pi, "sector"),
        "size_distribution": distribution(pi, "size"),
        "interstate_mention_records": [r["id"] for r in rows if r["uf"] != "PI" and r["piMention"]],
    }
