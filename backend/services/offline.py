"""Generate self-contained copies from the canonical CSV repository and UI."""

import base64
import json
import mimetypes
import re
from backend.domain.internal import referral_indicator


def js_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def offline_html(repository, frontend, page="finance"):
    filename = "contexto.html" if page == "context" else "index.html"
    html = (frontend / filename).read_text(encoding="utf-8")

    def image_uri(path):
        mime = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()

    def style(match):
        path = frontend / match[1]
        css = path.read_text(encoding="utf-8")

        def asset(item):
            relative = item[1].strip("\"'")
            if relative.startswith(("data:", "http:", "https:", "#")):
                return item[0]
            return f'url("{image_uri((path.parent / relative).resolve())}")'

        css = re.sub(r"url\(([^)]+)\)", asset, css)
        return "<style>\n" + css + "\n</style>"

    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', style, html)
    html = html.replace(
        'href="assets/images/favicon-investe.svg"',
        f'href="{image_uri(frontend / "assets/images/favicon-investe.svg")}"',
    )
    if page == "context":
        scripts = [("ATLAS_DATA", repository.atlas())]
        paths = ["context/atlas.js"]
        html = html.replace(
            'href="index.html"',
            'href="#" onclick="if(window.opener){window.close()}else{history.back()}return false"',
        )
    else:
        scripts = [
            ("FINANCE_DATA", repository.finance()),
            ("FNE_DATA", repository.fne()),
            (
                "INTERNAL_INDICATOR",
                referral_indicator(repository.internal_projects(), **repository.internal_period()),
            ),
            ("FIN_CONTEXT_OFFLINE", offline_html(repository, frontend, "context")),
        ]
        paths = [
            "finance/fne-math.js",
            "finance/fne.js",
            "finance/esg.js",
            "finance/dashboard.js",
            "finance/internal.js",
        ]
        html = html.replace('class="brand" href="index.html"', 'class="brand" href="#"')
    code = "\n".join(f"window.{name}={js_json(value)};" for name, value in scripts)
    for path in paths:
        code += "\n" + (frontend / "assets/js" / path).read_text(encoding="utf-8").replace(
            "</script", "<\\/script"
        )
    code += "\ndocument.documentElement.dataset.ready='true';"
    html = re.sub(
        r'<script src="assets/js/bootstrap.js" defer data-page="[^"]+"></script>',
        lambda _: "<script>\n" + code + "\n</script>",
        html,
    )
    html = re.sub(
        r'<a href="(?:contexto-)?offline.html" download="[^"]+">Baixar versão offline</a>',
        '<span>Versão offline · dados incorporados</span>',
        html,
    )
    return html.replace('data-runtime="api"', 'data-runtime="offline"')
