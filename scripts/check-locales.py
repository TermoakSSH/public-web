#!/usr/bin/env python3
"""Checks the translation files of a folder against English (en.json): valid
JSON, no keys that English does not have and the same %{placeholders}.
Missing keys are only reported: they fall back to English.

Usage: scripts/check-locales.py [folder...]   (site/locales by default)
"""
import json
import re
import sys
from pathlib import Path

PLURAL = re.compile(r'_(zero|one|two|few|many|other)$')
errors = 0
for folder in sys.argv[1:] or ['site/locales']:
    files = {p.stem: p for p in sorted(Path(folder).glob('*.json'))}
    if 'en' not in files:
        sys.exit(f'{folder}: en.json is missing')
    data = {}
    for code, p in files.items():
        try:
            data[code] = json.loads(p.read_text())
        except ValueError as e:
            print(f'{p}: invalid JSON: {e}')
            errors += 1
    en = data.get('en', {})
    en_base = {PLURAL.sub('', k) for k in en}
    for code, d in data.items():
        if code == 'en':
            continue
        extra = [k for k in d if k not in en and PLURAL.sub('', k) not in en_base]
        missing = [k for k in en if k not in d and not (PLURAL.search(k) and any(PLURAL.sub('', x) == PLURAL.sub('', k) for x in d))]
        for k in extra:
            print(f'{folder}/{code}.json: key not in English: {k}')
        errors += len(extra)
        for k, v in d.items():
            ref = en.get(k) or en.get(PLURAL.sub('', k) + '_other')
            if isinstance(v, str) and isinstance(ref, str):
                if set(re.findall(r'%\{(\w+)\}', v)) != set(re.findall(r'%\{(\w+)\}', ref)):
                    print(f'{folder}/{code}.json: {k}: placeholders differ from English')
                    errors += 1
        if missing:
            print(f'{folder}/{code}.json: {len(missing)} keys not translated yet (English is shown)')
    print(f'{folder}: {", ".join(sorted(data))}')
sys.exit(1 if errors else 0)
