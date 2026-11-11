"""Comparable FNE Verde filters and indicators."""

from collections import defaultdict

GROUPS = ("todos", "FNE Verde: demais linhas", "FNE Verde MPE", "FNE Verde Sol PF")
YEARS = ("todos", "2021", "2022", "2023", "2024", "2025")


def selected(payload, year="2025", group="todos"):
    def keep(row):
        return (year == "todos" or row["year"] == int(year)) and (group == "todos" or row["group"] == group)

    return [row for row in payload["rows"] if keep(row)], [row for row in payload["ufRows"] if keep(row)]


def distribution(rows, field):
    groups = defaultdict(int)
    total = sum(row["cents"] for row in rows)
    for row in rows:
        groups[row[field] or "Não informado"] += row["cents"]
    return [
        {"category": key, "cents": amount, "share": amount / total if total else None}
        for key, amount in sorted(groups.items(), key=lambda item: (-item[1], item[0]))
    ]


def summary(payload, year="2025", group="todos", comparison="NE"):
    pi, ufs = selected(payload, year, group)
    benchmark = [r for r in ufs if comparison == "FNE" or r["region"] == "Nordeste"]
    total = sum(r["cents"] for r in pi)
    denominator = sum(r["cents"] for r in benchmark)
    return {
        "instrument": "FNE_VERDE",
        "year": year,
        "group": group,
        "comparison": comparison,
        "partial_years": [2023] if year in ("2023", "todos") else [],
        "value_cents": total,
        "benchmark_cents": denominator,
        "pi_share": total / denominator if denominator else None,
        "aggregated_lines": len(pi),
        "quantity_units_1e4": sum(r["qUnits"] for r in pi),
        "municipalities_with_lines": len({r["cityId"] for r in pi}),
        "sector_distribution": distribution(pi, "sector"),
        "size_distribution": distribution(pi, "size"),
        "quantity_note": "Linhas e QTD BNB não representam contratos distintos.",
    }
