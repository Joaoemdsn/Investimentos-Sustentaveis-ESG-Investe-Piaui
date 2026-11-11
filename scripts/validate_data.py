"""Reconcile values, quantities and counts for every FNE filter combination."""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.repositories.csv_repository import CsvRepository, DataError
from backend.domain import fne
from backend.domain.internal import referral_indicator


def require(condition, message):
    if not condition:
        raise DataError(message)


def validate(repository):
    cities = repository.municipalities()
    ids = {c["id"] for c in cities}
    require(len(cities) == len(ids) == 224, "Esperados 224 municípios únicos.")
    require({g["id"] for g in repository.geometry()} == ids, "Malha e municípios divergem.")
    atlas = repository.atlas()  # Matrix completeness and duplicate checks in the repository.
    require(atlas["years"] == [2021, 2022, 2023, 2024, 2025], "Período produtivo inesperado.")
    payload = repository.fne()
    require(len({r["id"] for r in payload["rows"]}) == len(payload["rows"]), "IDs FNE duplicados.")
    require(all(r["cityId"] in ids for r in payload["rows"]), "Município FNE desconhecido.")
    require(
        all(r["group"] in fne.GROUPS for r in payload["rows"] + payload["ufRows"]), "Grupo FNE desconhecido."
    )
    require(
        all(r["cents"] >= 0 and r["qUnits"] >= 0 for r in payload["rows"] + payload["ufRows"]),
        "FNE: valor negativo.",
    )
    combinations = 0
    for year in fne.YEARS:
        for group in fne.GROUPS:
            pi, ufs = fne.selected(payload, year, group)
            comparable_pi = [r for r in ufs if r["uf"] == "PI"]
            for field in ("cents", "qUnits"):
                require(
                    sum(r[field] for r in pi) == sum(r[field] for r in comparable_pi),
                    f"FNE {year}/{group}: divergência em {field}.",
                )
            require(
                len(pi) == sum(r["lines"] for r in comparable_pi), f"Contagem FNE {year}/{group} divergente."
            )
            for scope in ("NE", "FNE"):
                summary = fne.summary(payload, year, group, scope)
                require(summary["benchmark_cents"] >= summary["value_cents"], "Denominador menor que PI.")
                combinations += 1
    for ref in payload["years"]:
        year = str(ref["year"])
        summary = fne.summary(payload, year)
        require(summary["value_cents"] == ref["piCents"], f"Resumo {year}: PI divergente.")
        require(summary["benchmark_cents"] == ref["neCents"], f"Resumo {year}: NE divergente.")
        require(summary["aggregated_lines"] == ref["lines"], f"Resumo {year}: linhas divergentes.")
        require(
            fne.summary(payload, year, comparison="FNE")["benchmark_cents"] == ref["areaCents"],
            "Área FNE divergente.",
        )
        require(
            all(r["cutoff"] == ref["cutoff"] for r in payload["rows"] if str(r["year"]) == year),
            "Corte de ano inconsistente.",
        )
    require(
        next(r for r in payload["years"] if r["year"] == 2023)["cutoff"] == "2023-09-30",
        "O recorte 2023 é parcial.",
    )
    finance = repository.finance()
    require(len({r["id"] for r in finance["rows"]}) == len(finance["rows"]), "ID Fundo Clima duplicado.")
    rule_ids = {r["id"] for r in finance["rules"]}
    for row in finance["rows"]:
        require(row["cents"] >= 0, "Fundo Clima: valor negativo.")
        require(set(row["rules"]) <= rule_ids, "Regra de enquadramento desconhecida.")
        require(set(row["tags"]) <= {"agro", "energia", "logistica"}, "Nicho desconhecido.")
    internal = referral_indicator(repository.internal_projects(), **repository.internal_period())
    require(
        internal["status"] != "invalid",
        "Registros internos inválidos: " + str(internal.get("errors", internal["label"])),
    )
    return {
        "municipios": len(cities),
        "fne_pi": len(payload["rows"]),
        "fne_ufs": len(payload["ufRows"]),
        "fundo_clima": len(finance["rows"]),
        "combinacoes_reconciliadas": combinations,
        "indicador_interno": internal["status"],
    }


if __name__ == "__main__":
    import json

    print(json.dumps(validate(CsvRepository(ROOT / "data")), ensure_ascii=False, indent=2))
