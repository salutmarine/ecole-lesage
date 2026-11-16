#!/usr/bin/env python3
"""Mirror the public French showcase, never the private ESPACE pages."""
import concurrent.futures
import hashlib
import json
import re
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ORIGIN = 'https://ecole-lesage-refonte.mothzer.chatgpt.site'
ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = re.compile(r'^/fr/(?:espace|account|mon-compte|administration|professeur|panier|commande)(?:/|$)')
TEXT_EXTENSIONS = {'.css', '.js', '.mjs', '.json', '.svg', '.html'}
records = {}
failures = {}
seen = set()

class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ('src', 'href', 'poster', 'data-src'):
            if attrs.get(key):
                self.links.append(attrs[key])
        for key in ('srcset', 'data-srcset'):
            for candidate in attrs.get(key, '').split(','):
                if candidate.strip(): self.links.append(candidate.strip().split()[0])

def acceptable(path):
    return (path.startswith('/fr/') and not EXCLUDED.match(path)) or path.startswith(('/assets/', '/wp-content/'))

def canonical(value, parent):
    if not value.startswith(('/', './', '../', ORIGIN)) or re.search(r'''[\s<>"'\\]|\$\{''', value): return None
    url = urllib.parse.urlsplit(urllib.parse.urljoin(ORIGIN + parent, value.replace('&amp;', '&')))
    if url.netloc != urllib.parse.urlsplit(ORIGIN).netloc or not acceptable(url.path): return None
    # Public catalogue query parameters are rendered locally from catalog.json.
    return urllib.parse.unquote(url.path)

def destination(path):
    result = ROOT / path.lstrip('/')
    if path.endswith('/'): result /= 'index.html'
    return result

def dependencies(text, path):
    values = []
    if path.endswith('/') or path.endswith('.html'):
        doc = Document(); doc.feed(text); values.extend(doc.links)
    values.extend(re.findall(r'''url\(\s*["']?([^\s)'";]+)''', text))
    values.extend(re.findall(r'''(?:from\s*|import\s*\(|import\s*)["']([^"']+)["']''', text))
    values.extend(re.findall(r'''["'` ]((?:/assets/|/wp-content/)[^\s"'`<>)}]+)''', text))
    if path.endswith('.json'):
        def walk(value):
            if isinstance(value, dict):
                for item in value.values(): walk(item)
            elif isinstance(value, list):
                for item in value: walk(item)
            elif isinstance(value, str):
                values.append(value)
                if '<' in value:
                    doc = Document(); doc.feed(value); values.extend(doc.links)
        try: walk(json.loads(text))
        except ValueError: pass
    return {result for value in values if (result := canonical(value, path))}

def retrieve(path):
    target = destination(path)
    if target.exists():
        data = target.read_bytes()
    else:
        request = urllib.request.Request(ORIGIN + urllib.parse.quote(path, safe='/'), headers={'User-Agent': 'LesageShowcaseStaticMirror/1.0'})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(request, timeout=90) as response:
                    data = response.read()
                    if response.headers.get('Content-Type', '').startswith('text/html') and not path.startswith('/fr/'):
                        raise ValueError('Unexpected HTML instead of asset')
                break
            except Exception:
                if attempt == 2: raise
                time.sleep(1)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    record = {'path': path, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    suffix = Path(path).suffix
    text = data.decode('utf-8', errors='replace') if path.endswith('/') or suffix in TEXT_EXTENSIONS else ''
    return record, dependencies(text, path) if text else set()

def main():
    pending = {'/fr/'}
    # Portal entry is shared by the public catalogue. Do not crawl the private application.
    while pending:
        batch = sorted(pending - seen)
        if not batch: break
        seen.update(batch); pending = set()
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            futures = {pool.submit(retrieve, path): path for path in batch}
            for future in concurrent.futures.as_completed(futures):
                path = futures[future]
                try:
                    record, links = future.result(); records[path] = record
                    pending.update(links - seen)
                except Exception as error:
                    failures[path] = str(error)
        print(json.dumps({'downloaded': len(records), 'queued': len(pending), 'failures': len(failures)}), flush=True)
    report = {'source': ORIGIN + '/fr/', 'language': 'fr', 'excluded': ['ESPACE', 'other languages', 'checkout'], 'files': sorted(records.values(), key=lambda item: item['path']), 'failures': failures}
    (ROOT / 'source-manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'files': len(records), 'bytes': sum(item['bytes'] for item in records.values()), 'failures': failures}, ensure_ascii=False), flush=True)

if __name__ == '__main__': main()
