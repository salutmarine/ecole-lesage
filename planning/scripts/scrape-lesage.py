"""Collecte le catalogue public français et les sections de chaque fiche, sans dépendances."""
import json, re, time
from pathlib import Path
from html.parser import HTMLParser
from urllib.request import Request, urlopen
from urllib.parse import urljoin, urlparse
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://ecolelesage.com'
class Node:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []
    def all(self, predicate):
        result = []
        for child in self.children:
            if isinstance(child, Node):
                if predicate(child): result.append(child)
                result.extend(child.all(predicate))
        return result
    def text(self):
        if self.tag in ('script', 'style', 'noscript'): return ''
        content = ''.join(c.text() if isinstance(c, Node) else c for c in self.children)
        return ('\n' + content + '\n') if self.tag in ('p','div','section','h1','h2','h3','h4','li','br') else content
    def clean(self):
        return '\n'.join(re.sub(r'\s+', ' ', line).strip() for line in self.text().splitlines() if line.strip())
    def has_class(self, cls): return cls in self.attrs.get('class', '').split()
class Document(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node(); self.stack = [self.root]; self.feed(html)
    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.stack[-1]); self.stack[-1].children.append(n)
        if tag not in ('area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'): self.stack.append(n)
    def handle_startendtag(self, tag, attrs): self.handle_starttag(tag, attrs); self.handle_endtag(tag)
    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1, 0, -1):
            if self.stack[i].tag == tag: self.stack = self.stack[:i]; break
    def handle_data(self, text): self.stack[-1].children.append(text)
def fetch(url):
    req = Request(url, headers={'User-Agent': 'LesagePlanningCatalogImport/1.0'})
    for attempt in range(3):
        try:
            with urlopen(req, timeout=40) as response: return Document(response.read().decode('utf-8'))
        except Exception:
            if attempt == 2: raise
            time.sleep(2)
def first(nodes): return nodes[0] if nodes else None

def main():
    output = ROOT / 'data/lesage'; output.mkdir(parents=True, exist_ok=True)
    categories = [('initiation','INITIATION'),('perfectionnement','PERFECTIONNEMENT'),('specialisation','SPECIALISATION')]
    offers = {}
    for slug, level in categories:
        url = f'{BASE}/fr/les-cours/{slug}/'
        doc = fetch(url)
        cards = doc.root.all(lambda n: n.tag == 'a' and n.has_class('col-crs'))
        if not cards: raise ValueError(f'Catalogue vide : {url}')
        for card in cards:
            source = urljoin(BASE, card.attrs['href'])
            title = first(card.all(lambda n: n.tag == 'h4'))
            offers[source] = {'sourceUrl': source, 'name': title.clean(), 'level': level, 'categoryUrl': url, 'catalogImage': (first(card.all(lambda n: n.tag == 'img')) or Node()).attrs.get('src')}
        print(f'{slug}: {len(cards)} fiches', flush=True)
    records = []
    for index, (url, record) in enumerate(offers.items(), 1):
        doc = fetch(url)
        root = doc.root
        main = first(root.all(lambda n: n.tag == 'main')) or root
        get = lambda ident: first(main.all(lambda n: n.attrs.get('id') == ident))
        tariff = first(main.all(lambda n: n.has_class('h-tarif')))
        match = re.search(r'(\d+(?:[,.]\d+)?)\s*heures?\s*\|\s*([\d\s.,]+)\s*€', tariff.clean() if tariff else '')
        if not match: raise ValueError(f'Durée/prix introuvables : {url}')
        total = round(float(match[1].replace(',', '.')) * 60)
        price = round(float(match[2].replace(' ', '').replace(',', '.')) * 100)
        session = re.search(r'(\d+)\s+cours\s+de\s+(\d+(?:[,.]\d+)?)\s*heures?', main.clean(), re.I)
        if not session: raise ValueError(f'Décomposition des séances introuvable : {url}')
        sessions, duration = int(session[1]), round(float(session[2].replace(',', '.'))*60)
        if sessions*duration != total: raise ValueError(f'Durées incohérentes : {url}')
        sections = {key: (get(key).clean() if get(key) else None) for key in ('description','techniques','informations')}
        if not all(sections.values()): raise ValueError(f'Section manquante : {url}')
        productIds = sorted({int(m[1]) for n in main.all(lambda n: n.tag == 'a') if (m := re.search(r'(?:\?|&)add-to-cart=(\d+)', n.attrs.get('href','')))})
        images = list(dict.fromkeys(urljoin(BASE, n.attrs.get('src','')) for n in main.all(lambda n: n.tag == 'img') if '/uploads/' in n.attrs.get('src','')))
        links = list({n.attrs['href']: {'url': urljoin(url, n.attrs['href']), 'label': n.clean()} for n in main.all(lambda n: n.tag == 'a' and n.attrs.get('href') and not n.attrs['href'].startswith('#'))}.values())
        record.update({'totalDurationMinutes':total,'durationMinutes':duration,'sessionsCount':sessions,'priceCents':price,'currency':'EUR','taxIncluded':True, **sections,
            'images':images,'links':links,'wooProductIds':productIds,'imageUrl':record['catalogImage'] or (images[0] if images else None),
            'capacity': 6 if re.search(r'six élèves|6 apprenants', sections['informations']) else None,
            'validityMonths':12 if re.search(r'une année', sections['informations']) else None,
            'scrapedAt':datetime.now(timezone.utc).isoformat()})
        records.append(record)
        print(f'{index}/{len(offers)} {record["name"]}: {total//60} h, {sessions} séances', flush=True)
        time.sleep(0.2)
    seminar = fetch(f'{BASE}/fr/seminaires/')
    main = first(seminar.root.all(lambda n: n.tag == 'main'))
    (output/'seminaires.json').write_text(json.dumps({'sourceUrl':f'{BASE}/fr/seminaires/','content':main.clean() if main else None,'note':'Offre sur demande, sans durée ni tarif publié ; conservée hors catalogue réservable.'}, ensure_ascii=False, indent=2)+'\n')
    (output/'catalogue.json').write_text(json.dumps(records, ensure_ascii=False, indent=2)+'\n')
    print(f'{len(records)} cours exportés dans {output}', flush=True)
if __name__ == '__main__': main()
