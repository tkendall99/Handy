#!/usr/bin/env python3
"""Generate Rocket's app icon and tray icons from one shared rocket geometry.

Usage (from the repo root):
    python3 branding/generate.py          # writes SVGs + PNGs
    bun tauri icon branding/out/app-icon.png   # fans the app icon out to every size

Requires `rsvg-convert` (brew install librsvg).
"""

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "branding" / "out"
RESOURCES = ROOT / "src-tauri" / "resources"

# Brand palette (keep in sync with src/styles/theme.css)
FLAME = "#ff5a2e"
FLAME_DEEP = "#e2401c"
EMBER = "#ffb02e"
SPARK = "#ffe27a"
NIGHT_TOP = "#33297d"
NIGHT_BOTTOM = "#0d0b24"
GLASS = "#2a2f7a"
HULL = "#ffffff"
HULL_SHADE = "#ddd8f0"

# ---------------------------------------------------------------------------
# Rocket geometry, upright, in a 100x100 box (nose at top). Every asset rotates
# this 45deg about PIVOT so the rocket points up and to the right.
# ---------------------------------------------------------------------------
PIVOT = (50, 52)
BODY = "M50 6 C63 15 69 33 66 64 L34 64 C31 33 37 15 50 6 Z"
FIN_L = "M35 46 C25 50 20 58 21 72 L35 64 Z"
FIN_R = "M65 46 C75 50 80 58 79 72 L65 64 Z"
# Single-stroke silhouette (body + fins) for the monochrome outline icons.
OUTLINE = (
    "M50 6 C61 14 67 28 66.5 46 C75 50 80 58 79 72 L66 64 L34 64 L21 72 "
    "C20 58 25 50 33.5 46 C33 28 39 14 50 6 Z"
)
EXHAUST = "M43 64 C43 75 47 81 50 87 C53 81 57 75 57 64"
WINDOW = (50, 34, 8)
NOZZLE = (41, 62, 18, 9)  # x, y, w, h (tucked under the body to avoid seams)
FLAME_OUTER = "M41 69 C41 82 45 89 50 98 C55 89 59 82 59 69 Z"
FLAME_INNER = "M45.5 71 C45.5 79 47.5 84 50 90 C52.5 84 54.5 79 54.5 71 Z"


def rocket_transform(cx, cy, scale):
    px, py = PIVOT
    return f"translate({cx} {cy}) rotate(45) scale({scale}) translate({-px} {-py})"


def sparkle(cx, cy, r, k=0.18):
    c = k * r
    return (
        f"M{cx} {cy - r} Q{cx + c} {cy - c} {cx + r} {cy} "
        f"Q{cx + c} {cy + c} {cx} {cy + r} "
        f"Q{cx - c} {cy + c} {cx - r} {cy} "
        f"Q{cx - c} {cy - c} {cx} {cy - r} Z"
    )


def svg(size, body, view=None):
    view = view or f"0 0 {size} {size}"
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
        f'viewBox="{view}">{body}</svg>'
    )


# ---------------------------------------------------------------------------
# App icon (1024x1024, macOS grid: 824pt rounded square inset 100pt)
# ---------------------------------------------------------------------------
def app_icon():
    stars = [
        (250, 270, 7, 0.9), (330, 190, 4, 0.6), (700, 220, 5, 0.7),
        (800, 330, 4, 0.5), (210, 470, 4, 0.55), (820, 560, 6, 0.8),
        (300, 830, 4, 0.45), (610, 840, 5, 0.6), (770, 760, 3, 0.5),
        (450, 180, 3, 0.5),
    ]
    star_svg = "".join(
        f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff" opacity="{o}"/>'
        for x, y, r, o in stars
    )
    sparkles = (
        f'<path d="{sparkle(745, 410, 26)}" fill="#fff" opacity="0.9"/>'
        f'<path d="{sparkle(285, 360, 16)}" fill="#fff" opacity="0.7"/>'
    )
    nx, ny, nw, nh = NOZZLE
    wx, wy, wr = WINDOW
    rocket = f"""
    <g transform="{rocket_transform(530, 505, 6.4)}">
      <path d="{FLAME_OUTER}" fill="url(#flame)"/>
      <path d="{FLAME_INNER}" fill="{SPARK}"/>
      <path d="{FIN_L}" fill="url(#fin)"/>
      <path d="{FIN_R}" fill="url(#fin)"/>
      <rect x="{nx}" y="{ny}" width="{nw}" height="{nh}" rx="2.5" fill="#b9b3d6"/>
      <path d="{BODY}" fill="url(#hull)"/>
      <circle cx="{wx}" cy="{wy}" r="{wr + 2.2}" fill="{FLAME}"/>
      <circle cx="{wx}" cy="{wy}" r="{wr - 0.6}" fill="{GLASS}"/>
      <path d="M{wx - 4.5} {wy - 1.5} A5 5 0 0 1 {wx + 1} {wy - 5.5}" stroke="#fff"
            stroke-width="2" stroke-linecap="round" fill="none" opacity="0.85"/>
    </g>"""
    defs = f"""
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0" stop-color="{NIGHT_TOP}"/>
        <stop offset="1" stop-color="{NIGHT_BOTTOM}"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.28" cy="0.76" r="0.55">
        <stop offset="0" stop-color="{FLAME}" stop-opacity="0.55"/>
        <stop offset="1" stop-color="{FLAME}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="hull" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0.55" stop-color="{HULL}"/>
        <stop offset="1" stop-color="{HULL_SHADE}"/>
      </linearGradient>
      <linearGradient id="fin" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="{FLAME}"/>
        <stop offset="1" stop-color="{FLAME_DEEP}"/>
      </linearGradient>
      <linearGradient id="flame" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="{EMBER}"/>
        <stop offset="1" stop-color="{FLAME}"/>
      </linearGradient>
      <clipPath id="squircle"><rect x="100" y="100" width="824" height="824" rx="185"/></clipPath>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="125%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="14"/>
        <feOffset dy="10"/>
        <feComponentTransfer><feFuncA type="linear" slope="0.35"/></feComponentTransfer>
        <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>"""
    body = f"""{defs}
    <g filter="url(#shadow)">
      <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bg)"/>
    </g>
    <g clip-path="url(#squircle)">
      <rect x="100" y="100" width="824" height="824" fill="url(#glow)"/>
      {star_svg}{sparkles}
      {rocket}
    </g>"""
    return svg(1024, body)


# ---------------------------------------------------------------------------
# Tray icons (64x64). macOS renders these as template images, so only alpha
# matters there; Linux uses the coloured variants.
# ---------------------------------------------------------------------------
def rocket_outline(color, transform):
    wx, wy, wr = WINDOW
    return f"""
    <g transform="{transform}" fill="none" stroke="{color}" stroke-width="7.5"
       stroke-linejoin="round" stroke-linecap="round">
      <path d="{OUTLINE}"/>
      <path d="{EXHAUST}"/>
      <circle cx="{wx}" cy="{wy}" r="{wr - 1}"/>
    </g>"""


def rocket_silhouette(color, transform, flame=True):
    nx, ny, nw, nh = NOZZLE
    flame_svg = f'<path d="{FLAME_OUTER}"/>' if flame else ""
    return f"""
    <g transform="{transform}" fill="{color}">
      {flame_svg}<path d="{FIN_L}"/><path d="{FIN_R}"/>
      <rect x="{nx}" y="{ny}" width="{nw}" height="{nh}" rx="2"/>
      <path d="{BODY}"/>
    </g>"""


TRAY_ROCKET = rocket_transform(31, 34, 0.6)
BADGE = (47, 47, 13)


def tray_idle(color, warning=False):
    if not warning:
        return svg(64, rocket_outline(color, TRAY_ROCKET))
    bx, by, br = BADGE
    return svg(64, f"""
    <defs><mask id="m"><rect width="64" height="64" fill="#fff"/>
      <circle cx="{bx}" cy="{by}" r="{br + 4}" fill="#000"/></mask>
      <mask id="bang"><rect width="64" height="64" fill="#fff"/>
      <rect x="{bx - 2.5}" y="{by - 8}" width="5" height="10" rx="2.5" fill="#000"/>
      <circle cx="{bx}" cy="{by + 6}" r="2.7" fill="#000"/></mask></defs>
    <g mask="url(#m)">{rocket_outline(color, TRAY_ROCKET)}</g>
    <circle cx="{bx}" cy="{by}" r="{br}" fill="{color}" mask="url(#bang)"/>""")


def tray_disc(color, knockout):
    return svg(64, f"""
    <defs><mask id="k"><rect width="64" height="64" fill="#fff"/>{knockout}</mask></defs>
    <circle cx="32" cy="32" r="30" fill="{color}" mask="url(#k)"/>""")


def tray_recording(color):
    wx, wy, wr = WINDOW
    t = rocket_transform(31, 34, 0.46)
    knock = rocket_silhouette("#000", t) + (
        f'<g transform="{t}"><circle cx="{wx}" cy="{wy}" r="{wr - 1.5}" fill="#fff"/></g>'
    )
    return tray_disc(color, knock)


def tray_transcribing(color):
    knock = (
        f'<path d="{sparkle(28, 35, 15)}" fill="#000"/>'
        f'<path d="{sparkle(43, 20, 7.5)}" fill="#000"/>'
        f'<path d="{sparkle(45, 44, 5)}" fill="#000"/>'
    )
    return tray_disc(color, knock)


def render(svg_text, png_path, size=None):
    svg_path = OUT / (Path(png_path).stem + ".svg")
    svg_path.write_text(svg_text)
    cmd = ["rsvg-convert", str(svg_path), "-o", str(png_path)]
    if size:
        cmd[1:1] = ["-w", str(size), "-h", str(size)]
    subprocess.run(cmd, check=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    render(app_icon(), OUT / "app-icon.png")

    for suffix, color in (("", "#ffffff"), ("_dark", "#000000")):
        render(tray_idle(color), RESOURCES / f"tray_idle{suffix}.png")
        render(tray_idle(color, warning=True), RESOURCES / f"tray_idle_warning{suffix}.png")
        render(tray_recording(color), RESOURCES / f"tray_recording{suffix}.png")
        render(tray_transcribing(color), RESOURCES / f"tray_transcribing{suffix}.png")

    # Coloured variants (Linux tray). File names are referenced from tray.rs.
    render(tray_idle(FLAME), RESOURCES / "handy.png")
    render(tray_idle(FLAME, warning=True), RESOURCES / "handy_warning.png")
    render(tray_recording(FLAME), RESOURCES / "recording.png")
    render(tray_transcribing(FLAME), RESOURCES / "transcribing.png")
    print(f"Wrote icons to {OUT} and {RESOURCES}")


if __name__ == "__main__":
    main()
