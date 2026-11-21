#!/usr/bin/env python3
"""Replace RustDesk's company placeholder ("Purslane ...") with the build's company name.

Usage (from the rustdesk checkout root):
    COMPNAME="Minha Empresa Ltda." python compname.py <file> [<file> ...]

- Covers every placeholder spelling RustDesk has used ("Purslane Tech Pte. Ltd.",
  "Purslane Ltd.", "Purslane Ltd", "PURSLANE").
- Files missing in a given RustDesk version are skipped.
- The name is sanitized so it cannot break the files it lands in (.rc, .toml, .py,
  Dart/Rust strings, WiX XML): quotes become typographic quotes, "&" becomes the
  full-width "＆", and \\ $ | < > ` { } are dropped.
- Exits 1 when no listed file changed, so an upstream rename of the placeholder
  fails the build instead of silently shipping "Purslane".
"""
import os
import re
import sys

PATTERNS = [
    "Purslane Tech Pte. Ltd.",
    "Purslane Tech Pte Ltd",
    "Purslane Ltd.",
    "Purslane Ltd",
    "PURSLANE",
]
DEFAULTS = {"", "Purslane Ltd", "Purslane Tech Pte. Ltd."}


def sanitize(s: str) -> str:
    s = " ".join(s.split())  # no newlines/tabs, single spaces
    s = s.replace('"', "”").replace("'", "’").replace("&", "＆")
    s = re.sub(r"[\\$|<>`{}]", "", s)
    return s.strip()[:150]


def read(path):
    raw = open(path, "rb").read()
    if raw[:2] in (b"\xff\xfe", b"\xfe\xff"):
        return raw.decode("utf-16"), "utf-16"
    if raw[:3] == b"\xef\xbb\xbf":
        return raw.decode("utf-8-sig"), "utf-8-sig"
    try:
        return raw.decode("utf-8"), "utf-8"
    except UnicodeDecodeError:
        return raw.decode("cp1252"), "cp1252"


def main() -> int:
    raw_name = os.environ.get("COMPNAME", "")
    name = sanitize(raw_name)
    if raw_name.strip() in DEFAULTS or not name:
        print("compname: nenhum nome de empresa definido, nada a trocar")
        return 0

    changed = 0
    for path in sys.argv[1:]:
        if not os.path.isfile(path):
            print(f"compname: {path} nao existe nesta versao, pulando")
            continue
        text, enc = read(path)
        new = text
        for p in PATTERNS:
            new = new.replace(p, name)
        if new != text:
            with open(path, "wb") as f:
                f.write(new.encode(enc))
            changed += 1
            print(f"compname: {path} atualizado")
        else:
            print(f"::warning::compname: texto da Purslane nao encontrado em {path}")

    if changed == 0:
        print("::error::compname: nenhum arquivo foi alterado. O RustDesk mudou o texto "
              "'Purslane'? Revise .github/patches/compname.py")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
