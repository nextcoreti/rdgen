#!/usr/bin/env python3
"""RDGEN "xOffline": show a red X for offline peers instead of the orange dot.

Run from the rustdesk checkout root. Replaces xoffline.diff, which stopped
applying in 1.5.x because the surrounding lines changed. This finds the dot by
its own code, so it works on official RustDesk and on the NextCore fork (where the
online color is NcBrand.online). Cosmetic option: if the code is not found it
prints a warning and leaves the build untouched.
"""
import re
import sys

PATH = "flutter/lib/common/widgets/peer_card.dart"
RX = re.compile(
    r"child: CircleAvatar\(\s*radius: 3,\s*backgroundColor: online \? ([\w.]+) : ([\w.]+)\)\)\);"
)


def main() -> int:
    try:
        src = open(PATH, encoding="utf-8").read()
    except FileNotFoundError:
        print(f"::warning::xoffline: {PATH} nao encontrado; opcao ignorada")
        return 0
    matches = list(RX.finditer(src))
    if len(matches) != 1:
        print(f"::warning::xoffline: esperava 1 bolinha online/offline em {PATH}, "
              f"achei {len(matches)}; opcao ignorada")
        return 0
    m = matches[0]
    new = (
        "child: online\n"
        f"              ? CircleAvatar(radius: 3, backgroundColor: {m.group(1)})\n"
        "              : Icon(Icons.close, color: Colors.red, size: 12.0)));"
    )
    with open(PATH, "w", encoding="utf-8") as f:
        f.write(src[: m.start()] + new + src[m.end():])
    print("xoffline: X vermelho aplicado para dispositivos offline")
    return 0


if __name__ == "__main__":
    sys.exit(main())
