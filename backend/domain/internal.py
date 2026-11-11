"""Cohort-based referral indicator; no simulated project records."""

from datetime import date


def referral_indicator(projects, start=None, end=None, cutoff=None):
    unavailable = {
        "status": "pending",
        "label": "Aguardando dados internos",
        "denominator": None,
        "numerator": None,
        "rate": None,
    }
    if not projects:
        return unavailable
    try:
        start, end, cutoff = [date.fromisoformat(str(v)) for v in (start, end, cutoff)]
        if not start <= end <= cutoff:
            raise ValueError
    except (TypeError, ValueError):
        return dict(unavailable, status="invalid", label="Defina datas válidas para a coorte e o corte.")
    seen, errors, clean = set(), [], []
    for i, row in enumerate(projects, 1):
        identifier = row.get("projeto_id", "").strip()
        if not identifier or identifier in seen:
            errors.append(f"Linha {i}: identificador ausente ou duplicado.")
        seen.add(identifier)
        try:
            demand = date.fromisoformat(row.get("data_demanda", ""))
            flag = row.get("encaminhado", "").strip().casefold()
            if flag not in ("sim", "não", "nao"):
                raise ValueError
            sent_raw = row.get("data_envio", "").strip()
            sent = date.fromisoformat(sent_raw) if sent_raw else None
            if flag == "sim" and (not sent or sent < demand):
                raise ValueError
            if flag != "sim" and sent:
                raise ValueError
            clean.append((demand, sent))
        except (TypeError, ValueError):
            errors.append(f"Linha {i}: confira demanda, encaminhamento e data de envio.")
    if errors:
        return dict(unavailable, status="invalid", label="Revise os registros internos.", errors=errors)
    cohort = [(d, s) for d, s in clean if start <= d <= end]
    denominator = len(cohort)
    numerator = sum(1 for _d, sent in cohort if sent and sent <= cutoff)
    return {
        "status": "ready" if denominator else "empty_cohort",
        "label": "Indicador calculado" if denominator else "Sem projetos na coorte informada",
        "denominator": denominator,
        "numerator": numerator,
        "rate": numerator / denominator if denominator else None,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "cutoff": cutoff.isoformat(),
    }
