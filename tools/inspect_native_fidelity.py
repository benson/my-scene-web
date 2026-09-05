"""Reproduce the narrow static checks behind research/FIDELITY.md.

Reads the supplied DLL; never executes it. Optional analysis dependencies:
python -m pip install --target .local/research-libs pefile capstone
"""
import hashlib
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.local/research-libs'))
import pefile
import capstone

path = ROOT / '.local/disc/MyScene/MyScene/MyScene.dll'
data = path.read_bytes()
pe = pefile.PE(str(path))
base = pe.OPTIONAL_HEADER.ImageBase
md = capstone.Cs(capstone.CS_ARCH_X86, capstone.CS_MODE_32)
print('SHA256', hashlib.sha256(data).hexdigest())
print('Image base', hex(base))

for address in [0x1006baf0, 0x1006bad8, 0x1006e310, 0x1006bac4,
                0x1006daf0, 0x1006dae0, 0x1006dad0, 0x1006dac0,
                0x1006ba8c, 0x1006ba80, 0x1006ba74,
                0x1006c9b4, 0x1006deac, 0x1006b308]:
    offset = pe.get_offset_from_rva(address - base)
    print(hex(address), data[offset:data.index(b'\0', offset)].decode('ascii'))

for label, start, end in [
    ('Control flag identifier registration', 0x1004b565, 0x1004b575),
    ('DEBUG sequence and Control gate', 0x10007c2e, 0x10007cad),
    ('Music volume and debug map keys', 0x10007d0d, 0x10007db7),
    ('Character, speed, Zine and quiz shortcuts', 0x10043008, 0x100431a6),
    ('Weekend shortcuts', 0x100431cb, 0x10043393),
    ('Separate puzzle answer positions', 0x100029da, 0x10002a58),
    ('Wallet reset to 40', 0x10012870, 0x10012890),
    ('Weekend advance resets wallet', 0x1000f010, 0x1000f035),
    ('Clothing purchase gate overrides cost table', 0x10036d60, 0x10036da0),
    ('Quiz score accumulation and thresholds 5 and 9', 0x10006462, 0x100064ba),
    ('Clothes designer ReturnIntro branch', 0x10024b9b, 0x10024bbf),
    ('Window dresser RtnIntroWork branch', 0x10047bb4, 0x10047bee),
    ('Gift ANSWERS loaded into three candidate boxes', 0x1003c582, 0x1003c5ea),
]:
    offset = pe.get_offset_from_rva(start - base)
    print('\n' + label)
    for instruction in md.disasm(data[offset:offset + end - start], start):
        print(hex(instruction.address), instruction.mnemonic, instruction.op_str)
