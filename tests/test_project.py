import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from backend import create_app
from backend.domain import climate, fne
from backend.domain.internal import referral_indicator
from backend.repositories.csv_repository import CsvRepository, DataError, fixed_units
from backend.services.offline import offline_html
from scripts.build_static import build
from scripts.export_indicators import export
from scripts.validate_data import validate

ROOT = Path(__file__).resolve().parents[1]


class ProjectTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.repo = CsvRepository(ROOT / "data")
        cls.app = create_app()
        cls.client = cls.app.test_client()

    def test_export_matches_original_snapshot(self):
        reference = json.loads((ROOT / "tests/reference.json").read_text())
        datasets = {
            "atlas": self.repo.atlas(),
            "finance_rows": self.repo.finance()["rows"],
            "fne": self.repo.fne(),
        }
        for name, value in datasets.items():
            with self.subTest(dataset=name):
                digest = hashlib.sha256(
                    json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
                ).hexdigest()
                self.assertEqual(digest, reference[name + "_sha"])

    def test_all_fne_filters_reconcile(self):
        result = validate(self.repo)
        self.assertEqual(result["combinacoes_reconciliadas"], 48)
        self.assertEqual(result["indicador_interno"], "pending")

    def test_known_2025_fne(self):
        result = fne.summary(self.repo.fne())
        self.assertEqual(result["value_cents"], 46969726861)
        self.assertEqual(result["aggregated_lines"], 458)
        self.assertEqual(result["quantity_units_1e4"], 4680000)
        self.assertEqual(result["municipalities_with_lines"], 68)
        self.assertAlmostEqual(result["pi_share"], 0.13548830505164874)
        self.assertEqual(fne.summary(self.repo.fne(), "2023")["partial_years"], [2023])

    def test_climate_union_avoids_double_counting(self):
        payload = self.repo.finance()
        for sector in ("todos", "agro", "energia"):
            result = climate.summary(payload, sector=sector)
            self.assertEqual(result["value_cents"], 15000000000)
            self.assertEqual(result["automatic_records"], 1)
        self.assertEqual(climate.summary(payload, sector="logistica")["value_cents"], 0)
        interstate = [r for r in payload["rows"] if r["piMention"] and r["uf"] != "PI"]
        self.assertEqual(len({r["operation"] for r in interstate}), 2)
        self.assertEqual(sum(r["cents"] for r in interstate), 70000000000)

    def test_decimal_precision(self):
        self.assertEqual(fixed_units("469697268.61", 2), 46969726861)
        self.assertEqual(fixed_units("468.0000", 4), 4680000)
        for value in ("0.001", "NaN", "Infinity", "invalid"):
            with self.subTest(value=value), self.assertRaises(DataError):
                fixed_units(value, 2)

    def test_null_and_zero_stay_distinct(self):
        values = [v for a in self.repo.atlas()["activities"] for v in a["v"]]
        self.assertIn(None, values)
        self.assertIn(0, values)

    def test_api_contract_and_validation(self):
        self.assertEqual(self.client.get("/api/v1/fne/summary").json["value_cents"], 46969726861)
        for url in (
            "/api/v1/fne/summary?year=2026",
            "/api/v1/fne/summary?comparison=BR",
            "/api/v1/fne/records?municipality=9999999",
            "/api/v1/fne/records?page=-1",
            "/api/v1/fne/records?per_page=501",
            "/api/v1/clima/summary?sector=outro",
        ):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 400)
        records = self.client.get("/api/v1/fne/records?per_page=1&page=2").json
        self.assertEqual(records["total"], 458)
        self.assertEqual(len(records["items"]), 1)
        self.assertEqual(self.client.get("/api/v1/datasets/missing").status_code, 404)
        self.assertIsNone(self.client.get("/api/v1/internal/indicator").json["rate"])
        self.assertEqual(self.client.get("/api/v1/datasets/atlas").json, self.repo.atlas())

    def test_routes_and_assets(self):
        for path in (
            "/",
            "/contexto.html",
            "/assets/js/bootstrap.js",
            "/assets/css/base.css",
            "/assets/images/investe-piaui-horizontal.svg",
            "/assets/css/esg.css",
            "/assets/js/finance/esg.js",
            "/offline.html",
            "/contexto-offline.html",
        ):
            with self.subTest(path=path):
                with self.client.get(path) as response:
                    self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get("/assets/../../data/private/projetos_internos.csv").status_code, 404)

    def test_static_and_analytical_builds(self):
        with tempfile.TemporaryDirectory() as folder:
            destination = build(Path(folder) / "static")
            index = (destination / "index.html").read_text()
            self.assertIn('data-runtime="static"', index)
            self.assertIn('id="esgPane"', index)
            self.assertTrue((destination / "assets/js/finance/esg.js").is_file())
            self.assertTrue((destination / "assets/css/esg.css").is_file())
            self.assertEqual(json.loads((destination / "data/fne.json").read_text()), self.repo.fne())
            self.assertEqual(
                json.loads((destination / "data/internal.json").read_text())["status"], "pending"
            )
            self.assertTrue((destination / ".nojekyll").exists())
            html = (destination / "offline.html").read_text()
            self.assertIn('id="esgPane"', html)
            self.assertIn('SIMULAÇÃO · TODOS OS DADOS SÃO FICTÍCIOS', html)
            self.assertNotIn('<script src=', html)
            self.assertNotIn('<link rel="stylesheet"', html)
            self.assertNotIn('url("../images', html)
            self.assertIn("window.FIN_CONTEXT_OFFLINE=", html)
            self.assertIn("data:image/svg+xml;base64,", html)
            report = export(Path(folder) / "reports")
            self.assertTrue((report / "indicadores_fne.csv").is_file())
            self.assertTrue((report / "indicadores_fundo_clima.csv").is_file())


class InternalIndicatorTests(unittest.TestCase):
    # Isolated test fixtures only. No fictional observations enter the datasets.
    period = dict(start="2025-01-01", end="2025-01-31", cutoff="2025-02-28")

    def rows(self):
        return [
            dict(projeto_id="test-a", data_demanda="2025-01-02", encaminhado="sim", data_envio="2025-02-01"),
            dict(projeto_id="test-b", data_demanda="2025-01-04", encaminhado="não", data_envio=""),
            dict(projeto_id="test-c", data_demanda="2025-02-03", encaminhado="sim", data_envio="2025-02-04"),
            dict(projeto_id="test-d", data_demanda="2025-01-05", encaminhado="sim", data_envio="2025-03-01"),
        ]

    def test_same_cohort_and_cutoff(self):
        result = referral_indicator(self.rows(), **self.period)
        self.assertEqual(result["denominator"], 3)
        self.assertEqual(result["numerator"], 1)
        self.assertEqual(result["rate"], 1 / 3)

    def test_missing_inputs_are_not_zero(self):
        self.assertIsNone(referral_indicator([])["rate"])
        self.assertEqual(referral_indicator(self.rows())["status"], "invalid")
        self.assertEqual(
            referral_indicator(self.rows(), start="2025-03-01", end="2025-04-01", cutoff="2025-03-02")[
                "status"
            ],
            "invalid",
        )

    def test_invalid_dates_duplicates_and_flags(self):
        for field, value in (
            ("projeto_id", "test-b"),
            ("data_envio", "2024-01-01"),
            ("data_envio", ""),
            ("encaminhado", "talvez"),
        ):
            records = copy.deepcopy(self.rows())
            records[0][field] = value
            with self.subTest(field=field, value=value):
                result = referral_indicator(records, **self.period)
                self.assertEqual(result["status"], "invalid")
                self.assertIsNone(result["rate"])


if __name__ == "__main__":
    unittest.main()
