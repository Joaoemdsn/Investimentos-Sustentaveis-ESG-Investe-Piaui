"""Reconstruct the dashboard contracts from CSVs and small metadata files."""

import csv
import json
from decimal import Decimal, InvalidOperation
from functools import lru_cache
from pathlib import Path


class DataError(ValueError):
    """Invalid or inconsistent project data."""


def fixed_units(value, places):
    """Convert a decimal string to integer units without silent rounding."""
    try:
        number = Decimal(str(value))
        scaled = number * (10**places)
        if not number.is_finite() or scaled != scaled.to_integral_value():
            raise DataError(f"Valor fora da precisão de {places} casas: {value!r}")
        return int(scaled)
    except (InvalidOperation, TypeError):
        raise DataError(f"Valor numérico inválido: {value!r}") from None


class CsvRepository:
    def __init__(self, data_dir):
        self.data_dir = Path(data_dir).resolve()

    def read_csv(self, name, *, template=False):
        folder = "templates" if template else "processed"
        with (self.data_dir / folder / name).open(encoding="utf-8-sig", newline="") as handle:
            return list(csv.DictReader(handle))

    def metadata(self, name):
        return json.loads((self.data_dir / "metadata" / name).read_text(encoding="utf-8"))

    @lru_cache(maxsize=1)
    def municipalities(self):
        return self.read_csv("municipios.csv")

    @lru_cache(maxsize=1)
    def geometry(self):
        return self.metadata("municipal_geometry.json")["geometry"]

    def _financial_rows(self, name, ints, lists=(), bools=()):
        records = []
        for original in self.read_csv(name):
            row = dict(original)
            row["cents"] = fixed_units(row.pop("valor_contratado_reais"), 2)
            if "quantidade_bnb" in row:
                row["qUnits"] = fixed_units(row.pop("quantidade_bnb"), 4)
            for key in ints:
                row[key] = int(row[key]) if row[key] else None
            for key in lists:
                row[key] = json.loads(row[key])
            for key in bools:
                if row[key] not in ("0", "1"):
                    raise DataError(f"Valor booleano inválido no campo {key}.")
                row[key] = row[key] == "1"
            for key in row:
                if row[key] == "" and key in ("interest", "person", "category", "region"):
                    row[key] = None
            records.append(row)
        return records

    @lru_cache(maxsize=1)
    def catalog(self):
        rows = self.read_csv("instrumentos.csv")
        for row in rows:
            row["tags"] = json.loads(row["tags"])
            row["hasData"] = row["hasData"] == "1"
        return rows

    @lru_cache(maxsize=1)
    def finance(self):
        payload = self.metadata("finance.json")
        payload.update(
            rows=self._financial_rows(
                "fundo_clima.csv",
                ints=("sourceRow", "year"),
                lists=("tags", "rules", "evidenceUrls"),
                bools=("piMention",),
            ),
            catalog=self.catalog(),
            rules=self.read_csv("regras_enquadramento.csv"),
            cities=self.municipalities(),
            geometry=self.geometry(),
        )
        return payload

    @lru_cache(maxsize=1)
    def fne(self):
        payload = self.metadata("fne.json")
        payload["rows"] = self._financial_rows("fne_verde_pi.csv", ints=("year", "month", "sourceRow"))
        payload["ufRows"] = self._financial_rows("fne_verde_ufs.csv", ints=("year", "lines"))
        return payload

    @lru_cache(maxsize=1)
    def atlas(self):
        payload = self.metadata("atlas.json")
        cities = self.municipalities()
        activities = self.read_csv("atividades_ibge.csv")
        years = payload["years"]
        size = len(cities) * len(years)
        indexed = {a["id"]: a for a in activities}
        city_index = {c["id"]: i for i, c in enumerate(cities)}
        year_index = {str(year): i for i, year in enumerate(years)}
        for activity in activities:
            activity.update(v=[None] * size, s=[None] * size)
        observed = set()
        for row in self.read_csv("producao_municipal.csv"):
            offset = year_index[row["ano"]] * len(cities) + city_index[row["codigo_ibge"]]
            key = (row["atividade_id"], offset)
            if key in observed:
                raise DataError(f"Observação produtiva duplicada: {key}")
            observed.add(key)
            activity = indexed[row["atividade_id"]]
            activity["v"][offset] = int(row["valor_mil_reais"]) if row["valor_mil_reais"] else None
            activity["s"][offset] = int(row["status_codigo"]) if row["status_codigo"] else None
        if len(observed) != len(activities) * size:
            raise DataError("A matriz de produção está incompleta.")
        payload.update(cities=cities, activities=activities, geometry=self.geometry())
        return payload

    def internal_projects(self):
        private = self.data_dir / "private" / "projetos_internos.csv"
        if private.exists():
            with private.open(encoding="utf-8-sig", newline="") as handle:
                return list(csv.DictReader(handle))
        return self.read_csv("projetos_internos.csv", template=True)

    def internal_period(self):
        return self.metadata("internal_period.json")
