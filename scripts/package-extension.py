#!/usr/bin/env python3
"""Package only the files required by the Chrome extension."""

from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
extension = root / 'extension'
output = root / 'BiblioColeta-Chrome.zip'
allowed = {'.json', '.html', '.css', '.js', '.png', '.svg'}
files = sorted(path for path in extension.rglob('*') if path.is_file() and path.suffix in allowed)
if not (extension / 'manifest.json').is_file():
    raise SystemExit('Manifesto da extensão ausente.')
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    for path in files:
        archive.write(path, path.relative_to(extension))
print(f'Pacote pronto: {output} ({len(files)} arquivos)')
