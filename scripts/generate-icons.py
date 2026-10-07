"""Génère les icônes PNG de la PWA (sans dépendance) à partir du même dessin que favicon.svg."""
import struct
import zlib
from pathlib import Path

BG = (28, 28, 26)
GREEN = (60, 196, 164)
INDIGO = (141, 151, 255)
# Le logo : 3 semaines en entreprise, 1 à l’école. Grille 64×64 : (x, y, largeur, hauteur, couleur)
BARS = [(11, 16, 9, 32, GREEN), (22, 16, 9, 32, GREEN), (33, 16, 9, 32, GREEN), (44, 16, 9, 32, INDIGO)]


def inside_round_rect(px, py, x, y, w, h, r):
    if not (x <= px <= x + w and y <= py <= y + h):
        return False
    cx = min(max(px, x + r), x + w - r)
    cy = min(max(py, y + r), y + h - r)
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r


def render(size, maskable=False, ss=4):
    # Version « maskable » : fond plein et logo réduit dans la zone sûre (80 %).
    scale = 0.72 if maskable else 1.0
    offset = (1 - scale) * 32
    rows = []
    for j in range(size):
        row = bytearray([0])
        for i in range(size):
            acc = [0, 0, 0, 0]
            for sj in range(ss):
                for si in range(ss):
                    u = (i + (si + 0.5) / ss) / size * 64
                    v = (j + (sj + 0.5) / ss) / size * 64
                    color = None
                    if maskable or inside_round_rect(u, v, 0, 0, 64, 64, 14):
                        color = BG
                        lu, lv = (u - offset) / scale, (v - offset) / scale
                        for (x, y, w, h, c) in BARS:
                            if inside_round_rect(lu, lv, x, y, w, h, 3):
                                color = c
                    if color:
                        acc[0] += color[0]; acc[1] += color[1]; acc[2] += color[2]; acc[3] += 255
            n = ss * ss
            row += bytes([acc[0] // n, acc[1] // n, acc[2] // n, acc[3] // n]) if acc[3] else bytes(4)
            if acc[3]:
                a = acc[3] / n
                k = 255 / a if a else 0
                row[-4:-1] = bytes([min(255, int(acc[0] / n * k)), min(255, int(acc[1] / n * k)), min(255, int(acc[2] / n * k))])
        rows.append(bytes(row))
    return png(size, b''.join(rows))


def png(size, raw):
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
    header = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


out = Path(__file__).resolve().parent.parent / 'public'
for name, size, maskable in [
    ('pwa-192.png', 192, False),
    ('pwa-512.png', 512, False),
    ('pwa-maskable-512.png', 512, True),
    ('apple-touch-icon.png', 180, True),
]:
    (out / name).write_bytes(render(size, maskable))
    print('écrit', name)
