"""Convert extracted original assets into data for the native browser remake.

python tools/build_assets.py
Requires Pillow and ffmpeg. Generated assets contain no Windows executables.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
import io
import json
import re
import shutil
import struct
import subprocess
from PIL import Image
from decode_bap import decode

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / '.local/resources'
OUT = ROOT / 'web/assets'
MANIFEST = json.loads((RES / 'manifest.json').read_text())
INDEX = {(e['archive'], e['id']): e for e in MANIFEST}


def raw(archive, rid):
    return (RES / INDEX[archive, rid]['raw']).read_bytes()


def sequence(data):
    version, count, part_count, max_parts, delay = struct.unpack_from('<5H', data)
    if version != 3 or len(data) != 10 + count * 4 + part_count * 6:
        raise ValueError(f'Unsupported SEB structure {version}/{len(data)}')
    parts = list(struct.iter_unpack('<Hhh', data[10 + count * 4:]))
    frames = []
    for offset, size in struct.iter_unpack('<HH', data[10:10 + count * 4]):
        if offset + size > len(parts):
            raise ValueError('Out of bounds SEB frame')
        frames.append(parts[offset:offset + size])
    return dict(delay=delay, frames=frames)


def export_image(entry):
    output = OUT / f"images/{entry['archive']}-{entry['id']}.webp"
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        return entry['archive'], entry['id'], dict(src=f"assets/images/{output.name}", width=entry['width'], height=entry['height'])
    im = Image.open(RES / entry['image']).convert('RGBA')
    # Sprite sheets use a magenta color key. Backgrounds retain every pixel.
    if not entry['name'].lower().startswith('bkg'):
        pixels = im.getdata()
        im.putdata([(r, g, b, 0 if (r, g, b) == (255, 0, 255) else a) for r, g, b, a in pixels])
    im.save(output, lossless=True, method=2)
    return entry['archive'], entry['id'], dict(src=f"assets/images/{output.name}", width=im.width, height=im.height)


def export_audio(entry):
    output = OUT / f"audio/{entry['archive']}-{entry['id']}.mp3"
    output.parent.mkdir(parents=True, exist_ok=True)
    source = RES / entry['raw']
    if not output.exists():
        proc = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', str(source),
                               '-map', '0:a:0', '-codec:a', 'libmp3lame', '-b:a', '96k', str(output)],
                              capture_output=True, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        if proc.returncode:
            raise ValueError(f"Audio conversion failed {entry['name']}: {proc.stderr.decode(errors='replace')}")
    return f"{entry['archive']}:{entry['id']}", f"assets/audio/{output.name}"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    data = dict(images={}, audio={}, sprites={}, scenes={}, dictionaries={}, blobs={})
    with ThreadPoolExecutor(max_workers=4) as pool:
        for archive, rid, image in pool.map(export_image, (e for e in MANIFEST if 'image' in e)):
            data['images'][f'{archive}:{rid}'] = image
    print(f"Converted {len(data['images'])} images", flush=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        for key, source in pool.map(export_audio, (e for e in MANIFEST if e['name'].lower().endswith('.wav'))):
            data['audio'][key] = source
    print(f"Converted {len(data['audio'])} audio resources", flush=True)
    for archive, source in [('MyScene', ROOT / '.local/disc/MyScene/Resource/MyScene.bap'),
                            ('MyScene_HD', ROOT / '.local/disc/MyScene/MyScene/MyScene_HD.bap'),
                            ('SignInMS', ROOT / '.local/disc/MyScene/Resource/SignInMS.bap')]:
        for node in decode(source.read_bytes()):
            props = node['properties']
            name = props.get('NAME', '')
            if node['type'] == 'SCENE':
                data['scenes'][name] = dict(archive=archive, **props)
            elif node['type'] == 'BLOB':
                data['blobs'][name] = dict(archive=archive, **props)
            elif node['type'] == 'SPRITE':
                sprite = dict(archive=archive, properties=props, effects={})
                for child in node['children']:
                    fx = child['properties']
                    effect = dict(properties=fx)
                    if 'ANIM' in fx and 'RECTLIST' in fx and 'SEQUENCE' in fx:
                        rects = list(struct.iter_unpack('<HHHH', raw(archive, fx['RECTLIST'])))
                        seq = sequence(raw(archive, fx['SEQUENCE']))
                        img = data['images'][f"{archive}:{fx['ANIM']}"]
                        for frame in seq['frames']:
                            for rect, x, y in frame:
                                if rect >= len(rects):
                                    if (archive, name, fx['NAME']) == ('SignInMS', 'AniSiDeleteName', 'Highlight'):
                                        effect['unavailable'] = True
                                        continue
                                    raise ValueError(f'Invalid rectangle index {name}/{fx["NAME"]}: {rect}')
                                l, t, r, b = rects[rect]
                                if not (0 <= l <= r <= img['width'] and 0 <= t <= b <= img['height']):
                                    if INDEX[archive, fx['ANIM']]['name'].lower().endswith('.amp'):
                                        effect['dynamic'] = True
                                    elif 0 <= l <= r <= img['width'] + 4 and 0 <= t <= b <= img['height'] + 4:
                                        # A shipped window overlay rectangle extends two pixels
                                        # past its bitmap. Clip to the real stored image bounds.
                                        rects[rect] = (l, t, min(r, img['width']), min(b, img['height']))
                                    else:
                                        raise ValueError(f'Invalid rectangle {name}/{fx["NAME"]}')
                        effect.update(image=f"{archive}:{fx['ANIM']}", rects=rects, **seq)
                    if 'SOUND' in fx:
                        effect['sound'] = f"{archive}:{fx['SOUND']}"
                    if 'ANIM' in fx and 'image' not in effect:
                        key = f"{archive}:{fx['ANIM']}"
                        if key in data['images']:
                            im = data['images'][key]
                            effect.update(image=key, rects=[(0, 0, im['width'], im['height'])], frames=[[(0, 0, 0)]], delay=100)
                    sprite['effects'][fx.get('NAME', '')] = effect
                data['sprites'][name] = sprite
            elif node['type'] == 'DATADICT':
                for d in decode(raw(archive, props['BAP'])):
                    # Several shipped files retain a copied internal NAME
                    # (notably the makeup dictionaries for the three girls).
                    # Runtime references use the main BAP's declared name.
                    key = f'{archive}:{name}' if name in data['dictionaries'] else name
                    data['dictionaries'][key] = dict(d['properties'], NAME=name)
    # Weekend four's list and Zine explicitly send the player to the Village
    # for the top and Digs for the skirt. The two unused lookup fields were
    # swapped on the disc; align them with its tasks and actual inventory.
    week4 = data['dictionaries']['DctTaskWk04']
    week4['CLOTHING_STORE_TOP'] = 'DctClClothingVil'
    week4['CLOTHING_STORE_BOTTOM'] = 'DctClClothingDt'
    (OUT / 'game-data.json').write_text(json.dumps(data, separators=(',', ':')), encoding='utf-8')
    print(json.dumps({k:len(v) for k,v in data.items()}), flush=True)


if __name__ == '__main__':
    main()
