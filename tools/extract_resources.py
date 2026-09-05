"""Extract indexed My Scene RES archives, preserving original resource identities.

Usage: python tools/extract_resources.py <extracted-disc> <output-directory>
Only reads data; never loads or executes the original game binaries.
"""
from pathlib import Path, PureWindowsPath
from collections import Counter
import argparse
import hashlib
import io
import json
import struct
from PIL import Image


def entries(path):
    data = path.read_bytes()
    if len(data) < 68 or struct.unpack_from('<I', data)[0] != 3:
        raise ValueError(f'Unsupported RES header: {path}')
    index, size = struct.unpack_from('<II', data, 20)
    metadata, metadata_size = struct.unpack_from('<II', data, 60)
    if size % 8 or size != metadata_size or max(index + size, metadata + size) > len(data):
        raise ValueError(f'Invalid RES index: {path}')
    for resource_id in range(1, size // 8):
        offset, length = struct.unpack_from('<II', data, index + resource_id * 8)
        meta_offset, meta_length = struct.unpack_from('<II', data, metadata + resource_id * 8)
        if offset + length > index or meta_offset + meta_length > metadata:
            raise ValueError(f'Out-of-bounds resource: {path}:{resource_id}')
        meta = data[meta_offset:meta_offset + meta_length]
        stored_id, stored_length, timestamp, kind, name_length = struct.unpack_from('<IIIII', meta)
        # Metadata records the pre-import source length; transformed RCB records
        # can be two bytes shorter in the archive. The payload index is authoritative.
        if stored_id != resource_id or 20 + name_length > len(meta):
            raise ValueError(f'Inconsistent metadata: {path}:{resource_id}')
        original = meta[20:20 + name_length].rstrip(b'\0').decode('cp1252')
        yield dict(archive=path.stem, id=resource_id, offset=offset, size=length, source_size=stored_length,
                   kind=kind, original=original, name=PureWindowsPath(original).name), data[offset:offset + length]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('disc', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    manifest, counts = [], Counter()
    for archive in sorted(args.disc.rglob('*.res')):
        for entry, payload in entries(archive):
            name = entry['name']
            if not name or name in ('.', '..') or any(c in name for c in '/\\:'):
                raise ValueError(f'Unsafe resource name: {name!r}')
            relative = Path('raw') / entry['archive'] / f"{entry['id']:05d}_{name}"
            output = args.output / relative
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(payload)
            entry['raw'] = relative.as_posix()
            entry['sha256'] = hashlib.sha256(payload).hexdigest()
            counts[Path(name).suffix.lower()] += 1
            if payload.startswith(b'BM'):
                image = Image.open(io.BytesIO(payload)).convert('RGB')
                png = Path('images') / entry['archive'] / f"{entry['id']:05d}_{Path(name).stem}.png"
                (args.output / png).parent.mkdir(parents=True, exist_ok=True)
                image.save(args.output / png)
                entry.update(image=png.as_posix(), width=image.width, height=image.height)
            manifest.append(entry)
    (args.output / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print(json.dumps(dict(resources=len(manifest), extensions=counts, images=sum('image' in r for r in manifest)), indent=2))


if __name__ == '__main__':
    main()
