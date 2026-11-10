"""Inspect generated OOXML using only the Python standard library (no Office needed)."""
import hashlib
import json
import posixpath
import sys
import xml.etree.ElementTree as ET
import zipfile

ns = {
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}
with zipfile.ZipFile(sys.argv[1]) as archive:
    assert archive.testzip() is None
    names = set(archive.namelist())
    assert {'[Content_Types].xml', '_rels/.rels', 'ppt/presentation.xml'} <= names
    for name in names:
        if name.endswith(('.xml', '.rels')):
            ET.fromstring(archive.read(name))
        if name.endswith('.rels'):
            base = posixpath.dirname(posixpath.dirname(name))
            for rel in ET.fromstring(archive.read(name)):
                assert rel.get('TargetMode') != 'External', 'Export must contain no external links'
                target = rel.get('Target')
                path = target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join(base, target))
                assert path in names, f'Missing relationship target: {path}'
    presentation = ET.fromstring(archive.read('ppt/presentation.xml'))
    size = presentation.find('p:sldSz', ns).attrib
    slides = []
    for index, _ in enumerate(presentation.findall('p:sldIdLst/p:sldId', ns), 1):
        slide = ET.fromstring(archive.read(f'ppt/slides/slide{index}.xml'))
        pictures = slide.findall('p:cSld/p:spTree/p:pic', ns)
        assert len(pictures) == 1
        assert not slide.findall('.//p:sp', ns), 'Image slides must contain no text boxes'
        picture = pictures[0]
        transform = picture.find('p:spPr/a:xfrm', ns)
        rel_id = picture.find('p:blipFill/a:blip', ns).get(f'{{{ns["r"]}}}embed')
        rels = ET.fromstring(archive.read(f'ppt/slides/_rels/slide{index}.xml.rels'))
        image_rel = next(rel for rel in rels if rel.get('Id') == rel_id)
        image_path = posixpath.normpath(posixpath.join('ppt/slides', image_rel.get('Target')))
        image = archive.read(image_path)
        notes = ET.fromstring(archive.read(f'ppt/notesSlides/notesSlide{index}.xml'))
        body = next(shape for shape in notes.findall('.//p:sp', ns)
                    if shape.find('p:nvSpPr/p:nvPr/p:ph', ns).get('type') == 'body')
        paragraphs = [''.join(paragraph.itertext()) for paragraph in body.findall('p:txBody/a:p', ns)]
        slides.append({
            'position': transform.find('a:off', ns).attrib,
            'extent': transform.find('a:ext', ns).attrib,
            'imageBytes': len(image), 'imageSha256': hashlib.sha256(image).hexdigest(),
            'imagePath': image_path, 'notes': '\n'.join(paragraphs),
        })
    print(json.dumps({'size': size, 'slides': slides}, ensure_ascii=False))
