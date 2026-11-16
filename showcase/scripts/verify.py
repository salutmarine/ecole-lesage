#!/usr/bin/env python3
"""Check every local page/asset reference in the deployable static showcase."""
import json
import os
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[1] / '.site-build'
BASE = os.environ.get('PAGES_BASE_PATH', '/ecole-lesage').rstrip('/')
errors = set()
checked = set()

def check(value, source):
    if not value or value.startswith(('data:', '#', 'mailto:', 'tel:', 'javascript:')): return
    url = urlsplit(urljoin('https://static.invalid' + BASE + '/' + source.relative_to(ROOT).as_posix(), value))
    if url.netloc != 'static.invalid': return
    pathname = unquote(url.path)
    if BASE:
        if not pathname.startswith(BASE + '/'):
            errors.add((source.relative_to(ROOT).as_posix(), value)); return
        pathname = pathname[len(BASE):]
    target = ROOT / pathname.lstrip('/')
    if target.is_dir(): target /= 'index.html'
    checked.add(pathname)
    if not target.is_file(): errors.add((source.relative_to(ROOT).as_posix(), value))

class Links(HTMLParser):
    def __init__(self, source): super().__init__(); self.source = source
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ('href', 'src', 'poster'):
            check(attrs.get(key), self.source)
        if attrs.get('srcset') and not attrs['srcset'].startswith('data:'):
            for candidate in attrs['srcset'].split(','):
                if candidate.strip(): check(candidate.strip().split()[0], self.source)

pages = list((ROOT / 'showcase').rglob('*.html'))
for page in pages:
    text = page.read_text()
    Links(page).feed(text)
    if re.search(r'<a\b[^>]*data-lang=["\'](?:en|ja)', text): errors.add((str(page), 'Non-French navigation'))
    if '/cdn-cgi/' in text: errors.add((str(page), 'Source hosting script'))
for source in (ROOT / 'showcase/assets').rglob('*'):
    if source.suffix in ('.mjs', '.js'):
        for match in re.finditer(r'''(?:from\s*|import\s*\(|import\s*)["']((?:\./|\.\./)[^"']+)["']''', source.read_text()):
            check(match[1], source)
    if source.suffix == '.css':
        for match in re.finditer(r'''url\(\s*["']?([^\s)'";]+)''', source.read_text()): check(match[1], source)
for excluded in ('espace', 'account'):
    if (ROOT / 'showcase' / excluded).exists(): errors.add(('showcase', 'Excluded section: ' + excluded))
if (ROOT / 'showcase/fr').exists(): errors.add(('showcase/fr', 'Unexpected language directory'))
if (ROOT / 'showcase/wp-content').exists(): errors.add(('showcase/wp-content', 'Unexpected WordPress directory'))
catalog_file = ROOT / 'showcase/assets/platform/catalog.json'
def check_catalog(value):
    if isinstance(value, dict):
        for item in value.values(): check_catalog(item)
    elif isinstance(value, list):
        for item in value: check_catalog(item)
    elif isinstance(value, str):
        if value.startswith(BASE + '/'): check(value, catalog_file)
        elif '<' in value: Links(catalog_file).feed(value)
check_catalog(json.loads(catalog_file.read_text()))
print(json.dumps({'pages': len(pages), 'localTargets': len(checked), 'errors': sorted(errors)}, ensure_ascii=False, indent=2))
raise SystemExit(bool(errors))
