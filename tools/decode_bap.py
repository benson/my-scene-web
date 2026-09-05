"""Read the observed declarative BAP format into JSON (not native gameplay code)."""
from pathlib import Path
import argparse
import json
import struct


def decode(data):
    pos = 0
    blocks = {}
    while struct.unpack_from('<H', data, pos)[0] in (0x30, 0x40, 0x50, 0x60):
        tag, size = struct.unpack_from('<HH', data, pos)
        blocks[tag] = data[pos + 4:pos + 4 + size]
        pos += 4 + size

    def string_table(offset_tag, data_tag):
        offsets = blocks[offset_tag]
        text = blocks[data_tag]
        def decode_string(raw):
            try:
                return raw.decode('utf-8')
            except UnicodeDecodeError:
                return raw.decode('cp1252')
        return [decode_string(text[offset:text.index(b'\0', offset)])
                for (offset,) in struct.iter_unpack('<H', offsets)]

    identifiers = string_table(0x30, 0x40)
    strings = string_table(0x50, 0x60) if 0x50 in blocks else []

    def word():
        nonlocal pos
        value = struct.unpack_from('<H', data, pos)[0]
        pos += 2
        return value

    def value():
        nonlocal pos
        kind = word()
        if kind == 1:
            number = word()
            return number - 65536 if number >= 32768 else number
        if kind == 2:
            return identifiers[word()]
        if kind == 3:
            return strings[word()]
        if kind == 4:
            size = word()
            end = pos + size
            result = []
            while pos < end:
                result.append(value())
            if pos != end:
                raise ValueError('BAP list length mismatch')
            return result
        raise ValueError(f'Unknown BAP value {kind:#x} at {pos - 2:#x}')

    roots, stack = [], []
    while pos < len(data):
        opcode = word()
        if opcode == 0:
            if stack or any(data[pos:]):
                raise ValueError('Unexpected BAP terminator')
            break
        if opcode == 0x12:
            node = dict(type=identifiers[word()], properties={}, children=[])
            (stack[-1]['children'] if stack else roots).append(node)
            stack.append(node)
        elif opcode == 0x22:
            tag = identifiers[word()]
            if not stack or stack.pop()['type'] != tag:
                raise ValueError('BAP scope mismatch')
        elif opcode == 0x76:
            key = identifiers[word()]
            stack[-1]['properties'][key] = value()
        else:
            raise ValueError(f'Unknown BAP opcode {opcode:#x} at {pos - 2:#x}')
    return roots


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    result = decode(args.source.read_bytes())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(f'Decoded {len(result)} top-level objects into {args.output}')
