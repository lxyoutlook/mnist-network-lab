"""Extract the Excel model and its saved calculation fixture, without executing VBA.

Usage: python tools/extract_model.py path/to/MNIST_Dashboard.xlsm
"""
import argparse
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def column(n):
    label = ''
    while n:
        n, remainder = divmod(n - 1, 26)
        label = chr(65 + remainder) + label
    return label


def extract(source: Path, destination: Path = ROOT / 'data'):
    with zipfile.ZipFile(source) as archive:
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        rels = {r.get('Id'): r.get('Target') for r in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        sheets = {}
        formulas = {}
        for sheet in workbook.find('s:sheets', NS):
            rid = sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            target = rels[rid]
            target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            root = ET.fromstring(archive.read(target))
            values, cell_formulas = {}, {}
            for cell in root.findall('.//s:sheetData/s:row/s:c', NS):
                value = cell.find('s:v', NS)
                formula = cell.find('s:f', NS)
                if value is not None and cell.get('t') not in ('s', 'str', 'e'):
                    values[cell.get('r')] = float(value.text)
                if formula is not None:
                    cell_formulas[cell.get('r')] = formula.text
            sheets[sheet.get('name')] = values
            formulas[sheet.get('name')] = cell_formulas
    # Fail visibly if this is a different workbook architecture.
    if formulas['ReLU']['C155'] != 'MAX(0, SUMPRODUCT(Table2[n_01],Table3[Input])+Table5[b1])':
        raise ValueError('The workbook is not the expected ReLU model')
    if formulas['Softmax']['C142'] != 'EXP(Table11[]-MAX(Table11[]))/SUM(EXP(Table11[]-MAX(Table11[])))':
        raise ValueError('The workbook is not the expected Softmax model')
    model = {
        'metadata': {
            'source_file': source.name,
            'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'architecture': [144, 128, 10], 'activation': ['relu', 'softmax'],
            'parameter_count': 19850, 'training_provenance': 'unknown',
            'ranges': {'input': 'Board!B2:M13', 'w1': 'ReLU!C4:DZ147',
                       'b1': 'ReLU!C151:DZ151', 'w2': 'Softmax!C4:L131', 'b2': 'Softmax!C135:L135'},
        },
        'w1': [[sheets['ReLU'][f'{column(c)}{r}'] for c in range(3,131)] for r in range(4,148)],
        'b1': [sheets['ReLU'][f'{column(c)}151'] for c in range(3,131)],
        'w2': [[sheets['Softmax'][f'{column(c)}{r}'] for c in range(3,13)] for r in range(4,132)],
        'b2': [sheets['Softmax'][f'{column(c)}135'] for c in range(3,13)],
    }
    fixture = {
        'source': 'Excel saved values; not recalculated by this extractor',
        'pixels': [sheets['Board'][f'{column(c)}{r}'] for r in range(2,14) for c in range(2,14)],
        'hidden': [sheets['ReLU'][f'{column(c)}155'] for c in range(3,131)],
        'logits': [sheets['Softmax'][f'{column(c)}139'] for c in range(3,13)],
        'probabilities': [sheets['Softmax'][f'{column(c)}142'] for c in range(3,13)],
        'prediction': int(sheets['Board']['O3']),
    }
    destination.mkdir(parents=True, exist_ok=True)
    (destination / 'model.json').write_text(json.dumps(model, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    (destination / 'excel_reference.json').write_text(json.dumps(fixture, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Extracted 19,850 parameters to {destination}; source SHA-256: {model["metadata"]["source_sha256"]}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    arguments = parser.parse_args()
    extract(arguments.source)
