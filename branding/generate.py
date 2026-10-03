#!/usr/bin/env python3
"""Generate Rocket's app icon and tray icons from one shared mark.

The mark is an ascent arc — a launch trajectory, vertical at lift-off and
pitching over — ending in the vehicle. The same shape is drawn in the
recording overlay (src/overlay/RecordingOverlay.tsx) and the settings UI
(src/components/icons/RocketMark.tsx); keep them in sync.

Usage (from the repo root):
    python3 branding/generate.py
    bun tauri icon branding/out/app-icon.png   # fans the app icon out to every size
    rm -rf src-tauri/icons/android/mipmap-anydpi-v26 src-tauri/icons/android/values

Requires `rsvg-convert` (brew install librsvg).
"""

import random
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "branding" / "out"
RESOURCES = ROOT / "src-tauri" / "resources"

# Palette (keep in sync with src/styles/theme.css and RecordingOverlay.css)
PLUME = "#f26b3a"
HULL_TOP = "#1a1d25"
HULL_BOTTOM = "#0e1015"
INK = "#eceef2"

# ---------------------------------------------------------------------------
# The mark, in a 16x16 box (same numbers as the overlay's SVG).
# ---------------------------------------------------------------------------
ARC = "M3 15.2C3 9.6 6.3 5.2 11.4 4.3"
DOT = (12.6, 4.1, 2.2)
MARK_CENTER = (8.4, 9.6)  # optical centre of arc + dot (for the app icon)
MARK_BOX_CENTER = (8.43, 8.98)  # true bounding-box centre (for tight canvases)


def mark_transform(cx, cy, scale, center=MARK_CENTER):
    mx, my = center
    return f"translate({cx} {cy}) scale({scale}) translate({-mx} {-my})"


def svg(size, body):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
        f'viewBox="0 0 {size} {size}">{body}</svg>'
    )


def arc_gradient(gid, color, tail_opacity):
    # userSpaceOnUse in mark units, from the tail (3,15.2) to the head (11.4,4.3)
    return (
        f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" '
        f'x1="3" y1="15.2" x2="11.4" y2="4.3">'
        f'<stop offset="0" stop-color="{color}" stop-opacity="{tail_opacity}"/>'
        f'<stop offset="1" stop-color="{color}" stop-opacity="1"/></linearGradient>'
    )


def mark(transform, arc_color, dot_color, stroke, tail_opacity, gid="arc", dot_scale=1.0):
    dx, dy, dr = DOT
    dr *= dot_scale
    return f"""
    <defs>{arc_gradient(gid, arc_color, tail_opacity)}</defs>
    <g transform="{transform}">
      <path d="{ARC}" fill="none" stroke="url(#{gid})" stroke-width="{stroke}"
            stroke-linecap="round"/>
      <circle cx="{dx}" cy="{dy}" r="{dr}" fill="{dot_color}"/>
    </g>"""


def dithered_gradient(path, top, bottom, size=1024):
    """Vertical gradient with per-pixel noise before rounding, so the shallow
    dark ramp has no visible 8-bit bands (an SVG gradient bands and tints)."""
    rng = random.Random(7)
    t_rgb = [int(top[i : i + 2], 16) for i in (1, 3, 5)]
    b_rgb = [int(bottom[i : i + 2], 16) for i in (1, 3, 5)]
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        base = [t_rgb[c] + (b_rgb[c] - t_rgb[c]) * t for c in range(3)]
        for x in range(size):
            n = rng.random() - 0.5  # one shared offset keeps the noise neutral
            px[x, y] = tuple(max(0, min(255, round(v + n * 1.6))) for v in base)
    img.save(path)


# ---------------------------------------------------------------------------
# App icon (1024x1024, macOS grid: 824pt rounded square inset 100pt)
# ---------------------------------------------------------------------------
def app_icon():
    body = f"""
    <defs>
      <clipPath id="tile"><rect x="100" y="100" width="824" height="824" rx="185"/></clipPath>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="125%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="14"/>
        <feOffset dy="10"/>
        <feComponentTransfer><feFuncA type="linear" slope="0.35"/></feComponentTransfer>
        <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <g filter="url(#shadow)">
      <rect x="100" y="100" width="824" height="824" rx="185" fill="{HULL_BOTTOM}"/>
    </g>
    <image href="hull.png" x="100" y="100" width="824" height="824"
           preserveAspectRatio="none" clip-path="url(#tile)"/>
    <rect x="101.5" y="101.5" width="821" height="821" rx="183.5" fill="none"
          stroke="#ffffff" stroke-opacity="0.08" stroke-width="3"/>
    {mark(mark_transform(512, 512, 37), INK, PLUME, 1.45, 0.1, dot_scale=0.88)}"""
    return svg(1024, body)


# ---------------------------------------------------------------------------
# Tray icons (64x64). macOS draws them as template images, so only alpha
# matters there; Linux uses the coloured variants.
# ---------------------------------------------------------------------------
TRAY_MARK = mark_transform(32, 32, 4.0, MARK_BOX_CENTER)
BADGE = (47, 47, 13)


def tray_idle(color, warning=False):
    body = mark(TRAY_MARK, color, color, 1.75, 0.5)
    if not warning:
        return svg(64, body)
    bx, by, br = BADGE
    return svg(64, f"""
    <defs><mask id="m"><rect width="64" height="64" fill="#fff"/>
      <circle cx="{bx}" cy="{by}" r="{br + 4}" fill="#000"/></mask>
      <mask id="bang"><rect width="64" height="64" fill="#fff"/>
      <rect x="{bx - 2.5}" y="{by - 8}" width="5" height="10" rx="2.5" fill="#000"/>
      <circle cx="{bx}" cy="{by + 6}" r="2.7" fill="#000"/></mask></defs>
    <g mask="url(#m)">{body}</g>
    <circle cx="{bx}" cy="{by}" r="{br}" fill="{color}" mask="url(#bang)"/>""")


def tray_disc(color, knockout):
    return svg(64, f"""
    <defs><mask id="k"><rect width="64" height="64" fill="#fff"/>{knockout}</mask></defs>
    <circle cx="32" cy="32" r="30" fill="{color}" mask="url(#k)"/>""")


def tray_recording(color):
    dx, dy, dr = DOT
    knock = f"""<g transform="{mark_transform(32, 32, 2.75, MARK_BOX_CENTER)}">
      <path d="{ARC}" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="{dx}" cy="{dy}" r="{dr + 0.2}" fill="#000"/></g>"""
    return tray_disc(color, knock)


def tray_transcribing(color):
    # A comet: three dots growing toward the head, like the overlay's progress.
    knock = "".join(
        f'<circle cx="{x}" cy="{y}" r="{r}" fill="#000"/>'
        for x, y, r in ((17, 40, 3.2), (28, 34, 4.4), (42, 26, 6.6))
    )
    return tray_disc(color, knock)


def render(svg_text, png_path):
    svg_path = OUT / (Path(png_path).stem + ".svg")
    svg_path.write_text(svg_text)
    subprocess.run(["rsvg-convert", str(svg_path), "-o", str(png_path)], check=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    dithered_gradient(OUT / "hull.png", HULL_TOP, HULL_BOTTOM, size=824)
    render(app_icon(), OUT / "app-icon.png")

    for suffix, color in (("", "#ffffff"), ("_dark", "#000000")):
        render(tray_idle(color), RESOURCES / f"tray_idle{suffix}.png")
        render(tray_idle(color, warning=True), RESOURCES / f"tray_idle_warning{suffix}.png")
        render(tray_recording(color), RESOURCES / f"tray_recording{suffix}.png")
        render(tray_transcribing(color), RESOURCES / f"tray_transcribing{suffix}.png")

    # Coloured variants (Linux tray). File names are referenced from tray.rs.
    render(tray_idle(PLUME), RESOURCES / "handy.png")
    render(tray_idle(PLUME, warning=True), RESOURCES / "handy_warning.png")
    render(tray_recording(PLUME), RESOURCES / "recording.png")
    render(tray_transcribing(PLUME), RESOURCES / "transcribing.png")
    print(f"Wrote icons to {OUT} and {RESOURCES}")


if __name__ == "__main__":
    main()
