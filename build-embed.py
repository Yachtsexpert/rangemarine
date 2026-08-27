#!/usr/bin/env python3
"""Собирает webasyst-embed.html из index.html.

Разметка берётся из index.html, имена классов получают префикс rm-,
теги, которые чаще всего стилизует тема сайта (header, footer, article),
заменяются на div. Стили и скрипт лежат в embed/head.html и embed/tail.html.

Запуск: python3 build-embed.py
"""
import re
import pathlib

ROOT = pathlib.Path(__file__).parent

RENAMES = {
    'wrap': 'rm-wrap', 'band': 'rm-band', 'band--shoal': 'rm-band--shoal',
    'spine': 'rm-spine', 'rail': 'rm-rail', 'hero': 'rm-hero',
    'eyebrow': 'rm-eyebrow', 'lede': 'rm-lede', 'note': 'rm-note',
    'actions': 'rm-actions', 'btn': 'rm-btn', 'btn--ghost': 'rm-btn--ghost',
    'facts': 'rm-facts', 'cards': 'rm-cards', 'card': 'rm-card',
    'grid-list': 'rm-grid-list', 'steps': 'rm-steps', 'step': 'rm-step',
    'table-scroll': 'rm-table-scroll', 'lanes': 'rm-lanes', 'lane': 'rm-lane',
    'num': 'rm-num', 'faq': 'rm-faq', 'cta': 'rm-cta', 'brand': 'rm-brand',
    'row': 'rm-row', 'shot': 'rm-shot', 'shot--wide': 'rm-shot--wide',
    'shot__label': 'rm-shot__label', 'lane__shot': 'rm-lane__shot',
    'mono': 'rm-mono',
}


def build():
    src = (ROOT / 'index.html').read_text(encoding='utf-8')
    markup = src.split('</style>', 1)[1].split('<script>', 1)[0].strip()

    unknown = set()

    def fix_class(m):
        names = []
        for n in m.group(1).split():
            if n not in RENAMES:
                unknown.add(n)
            names.append(RENAMES.get(n, n))
        return 'class="%s"' % ' '.join(names)

    markup = re.sub(r'class="([^"]*)"', fix_class, markup)
    markup = markup.replace('id="chart"', 'id="rm-chart"')

    markup = markup.replace('<header class="rm-hero">', '<div class="rm-hero">')
    markup = markup.replace('</header>', '</div>')
    markup = re.sub(r'<article class="([^"]*)">', r'<div class="\1">', markup)
    markup = markup.replace('</article>', '</div>')
    markup = markup.replace('<footer>', '<div class="rm-foot">')
    markup = markup.replace('</footer>', '</div>')

    markup = '\n'.join(('  ' + l) if l.strip() else l for l in markup.split('\n'))

    out = (ROOT / 'embed' / 'head.html').read_text(encoding='utf-8')
    out += markup
    out += (ROOT / 'embed' / 'tail.html').read_text(encoding='utf-8')
    (ROOT / 'webasyst-embed.html').write_text(out, encoding='utf-8')

    if unknown:
        print('классы без префикса (проверьте RENAMES):', sorted(unknown))
    print('webasyst-embed.html собран, %d байт' % len(out.encode('utf-8')))


if __name__ == '__main__':
    build()
