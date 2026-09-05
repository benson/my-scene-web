"""Convert the supplied disc's Smacker movies for browser playback."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess

root = Path(__file__).resolve().parents[1]
source = root / '.local/disc/MyScene/Resource/Movies'
output = root / 'web/assets/movies'
output.mkdir(parents=True, exist_ok=True)

def convert(path):
    target = output / (path.stem + '.mp4')
    if target.exists():
        return
    result = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', str(path),
        '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-crf', '22',
        '-preset', 'fast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k',
        '-movflags', '+faststart', str(target)], capture_output=True,
        creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    if result.returncode:
        raise RuntimeError(f'{path.name}: {result.stderr.decode(errors="replace")}')
    print(path.name, flush=True)

with ThreadPoolExecutor(max_workers=3) as pool:
    list(pool.map(convert, source.glob('*.smk')))
