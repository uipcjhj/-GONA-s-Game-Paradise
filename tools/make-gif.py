#!/usr/bin/env python3
"""프레임 폴더 → GIF (PIL). python3 tools/make-gif.py <frames-dir> <out.gif> [scale=0.75]"""
import os, sys
from PIL import Image
d, out = sys.argv[1], sys.argv[2]
scale = float(sys.argv[3]) if len(sys.argv) > 3 else 0.75
fs = sorted(f for f in os.listdir(d) if f.endswith('.png'))
ims = []
for f in fs:
    im = Image.open(os.path.join(d, f)).convert('RGB')
    im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    ims.append(im.convert('P', palette=Image.ADAPTIVE, colors=128))
ims[0].save(out, save_all=True, append_images=ims[1:], duration=140, loop=0, optimize=True)
print(out, len(ims), os.path.getsize(out) // 1024, 'KB')
