"""Render BizProof's original, silent, seamless credential-network film.

Requires Python + Pillow + NumPy and ffmpeg on PATH. No stock footage, fonts,
logos or third-party media are used. Assets are served locally by the app.
Run: python scripts/render-welcome-motion.py
"""
from pathlib import Path
import math
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "media"
OUT.mkdir(parents=True, exist_ok=True)
WIDTH, HEIGHT, FPS, SECONDS = 1280, 720, 24, 12
TAU = math.tau
rng = np.random.default_rng(42)
stars = rng.random((52, 4))
yy, xx = np.mgrid[0:180, 0:320]


def frame(t):
    phase = TAU * t / SECONDS
    # Soft moving light fields, with quiet negative space behind the headline.
    bg = np.zeros((180, 320, 3), dtype=np.float64) + [246, 249, 255]
    for cx, cy, spread, color in [
        (238 + 24 * math.sin(phase), 66, 78, [-54, -60, 0]),
        (220, 132 + 22 * math.cos(phase), 65, [-70, -11, -25]),
        (296, 21 + 15 * math.sin(phase), 56, [-30, -40, -8]),
    ]:
        weight = np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (spread ** 2))
        bg += weight[:, :, None] * color
    canvas = Image.fromarray(np.uint8(np.clip(bg, 0, 255))).resize((WIDTH, HEIGHT), Image.Resampling.BICUBIC).convert("RGBA")
    lines = Image.new("RGBA", (WIDTH, HEIGHT))
    d = ImageDraw.Draw(lines)
    # Perspective floor represents independent organizations in a shared network.
    horizon = 368
    for x in range(-1200, 2700, 160):
        d.line([(846 + (x - 846) * .12, horizon), (x, 770)], fill=(72, 115, 190, 21), width=1)
    for y in [390, 415, 448, 493, 551, 626, 719]:
        d.line([(400, y), (1280, y)], fill=(72, 115, 190, 23), width=1)
    # Orbital ribbons rotate about the credential, all motions close every 12 s.
    for band in range(5):
        pts = []
        a = phase * (1 if band % 2 else -1) + band * .7
        for n in range(241):
            u = TAU * n / 240
            radius = 212 + band * 20
            x, y, z = radius * math.cos(u), radius * .52 * math.sin(u), radius * .72 * math.sin(u)
            ry = y * math.cos(a) - z * math.sin(a)
            rz = y * math.sin(a) + z * math.cos(a)
            pts.append((878 + x + rz * .22, 325 + ry))
        color = (50, 88, 228, 52) if band % 2 else (17, 154, 154, 58)
        d.line(pts, fill=color, width=2)
        for offset in [0, 80, 160]:
            at = int((t / SECONDS * 240 + offset + band * 19) % 240)
            x, y = pts[at]
            d.ellipse((x - 4, y - 4, x + 4, y + 4), fill=(*color[:3], 190))
    # A source fans into two destinations; flowing particles suggest reuse.
    for branch in [-1, 1]:
        path = []
        for n in range(121):
            u = n / 120
            path.append((520 + u * 700, 370 + branch * 180 * u * u + 25 * math.sin(u * TAU + phase)))
        d.line(path, fill=(40, 105, 210, 64), width=2)
        for k in range(6):
            at = int((t / SECONDS * 120 + k * 20) % 120)
            x, y = path[at]
            d.rounded_rectangle((x - 5, y - 3, x + 5, y + 3), radius=2, fill=(22, 141, 178, 170))
    positions = []
    for sx, sy, size, offset in stars:
        x = 420 + sx * 850 + 9 * math.sin(phase + offset * TAU)
        y = 35 + sy * 620 + 12 * math.cos(phase + offset * TAU)
        positions.append((x, y))
        r = 1 + size * 2
        d.ellipse((x-r, y-r, x+r, y+r), fill=(51, 104, 172, int(60 + 70 * (.5 + .5 * math.sin(phase + offset * TAU)))))
    for i, p in enumerate(positions):
        for q in positions[i+1:]:
            if math.dist(p, q) < 92:
                d.line([p, q], fill=(46, 116, 173, 25), width=1)
    glow = lines.filter(ImageFilter.GaussianBlur(5))
    return Image.alpha_composite(Image.alpha_composite(canvas, glow), lines).convert("RGB")


frame(0).save(OUT / "credential-network-poster.webp", quality=88)
movie = OUT / "credential-network.mp4"
command = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-vcodec", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(movie)]
process = subprocess.Popen(command, stdin=subprocess.PIPE)
try:
    for index in range(FPS * SECONDS):
        process.stdin.write(frame(index / FPS).tobytes())
        if index % FPS == 0:
            print(f"Rendering {index // FPS + 1}/{SECONDS}s", flush=True)
finally:
    process.stdin.close()
if process.wait() != 0:
    raise RuntimeError("Video encoding failed")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(movie), "-vf", "scale=768:432", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(OUT / "credential-network-mobile.mp4")], check=True)
for asset in sorted(OUT.glob("credential-network*")):
    print(f"{asset.name}: {asset.stat().st_size:,} bytes")
