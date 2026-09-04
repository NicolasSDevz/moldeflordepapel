"""
Gera as imagens de capa dos 4 bonus (estilo flat "paper cut", combinando com
o restante do site: cartao branco arredondado, aba colorida no topo, fundo
creme, mesma linguagem visual de step-imprimir.png / step-cortar.png).
Saida: bonus-1-guia-de-cores.png, bonus-2-tabela-de-precos.png,
bonus-3-maneiras-de-conseguir-clientes.png, bonus-4-guia-primeiras-flores.png
todas 480x360 (mesma proporcao 4:3 dos step-*.png).
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math
import os

try:
    FONT_BOLD = ImageFont.truetype("C:\\Windows\\Fonts\\arialbd.ttf", 26)
except Exception:
    FONT_BOLD = ImageFont.load_default()

W, H = 480, 360
BG = (242, 230, 216)            # --cream-2
CARD = (255, 255, 255)
ACCENT = (168, 69, 46)          # --accent
ACCENT_LIGHT = (217, 118, 90)   # --accent-light
PINK = (224, 69, 123)           # --pink
PINK_LIGHT = (242, 160, 188)    # --pink-light
YELLOW = (244, 196, 48)         # --yellow
GREEN = (111, 148, 87)          # --green
LINE = (222, 209, 195)
MUTED = (214, 202, 188)

OUT_DIR = os.path.dirname(os.path.abspath(__file__))


def base_card(tab_color):
    im = Image.new("RGB", (W, H), BG)

    tab_w, tab_h = 128, 46
    tab_x0 = W / 2 - tab_w / 2
    tab_y0 = 10
    d = ImageDraw.Draw(im, "RGBA")
    d.rounded_rectangle([tab_x0, tab_y0, tab_x0 + tab_w, tab_y0 + tab_h], radius=14, fill=tab_color)
    bar_w, bar_h = 60, 10
    d.rounded_rectangle(
        [W / 2 - bar_w / 2, tab_y0 + tab_h / 2 - bar_h / 2, W / 2 + bar_w / 2, tab_y0 + tab_h / 2 + bar_h / 2],
        radius=5, fill=(255, 255, 255),
    )

    card_x0, card_y0, card_x1, card_y1 = 40, 32, W - 40, H - 24

    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([card_x0 + 4, card_y0 + 10, card_x1 + 4, card_y1 + 10], radius=22, fill=(60, 40, 30, 45))
    shadow = shadow.filter(ImageFilter.GaussianBlur(8))
    im.paste(shadow, (0, 0), shadow)

    d = ImageDraw.Draw(im, "RGBA")
    d.rounded_rectangle([card_x0, card_y0, card_x1, card_y1], radius=22, fill=CARD, outline=LINE, width=1)

    lx0, lx1 = card_x0 + 34, card_x1 - 34
    ly = card_y0 + 34
    for i, wfrac in enumerate([1.0, 0.92, 0.7]):
        y = ly + i * 16
        d.rounded_rectangle([lx0, y, lx0 + (lx1 - lx0) * wfrac, y + 6], radius=3, fill=LINE)

    return im, d, (card_x0, card_y0, card_x1, card_y1)


def make_flower(size, petal_color, center_color, n_petals=7):
    """Flor flat, mesmo estilo das gallery-*.png, retorna RGBA size x size."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cx, cy = size / 2, size / 2
    petal_len = size * 0.42
    petal_w = size * 0.30

    petal_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pd = ImageDraw.Draw(petal_img)
    pd.ellipse([cx - petal_w / 2, cy - petal_len, cx + petal_w / 2, cy - petal_len + petal_len * 1.15],
               fill=petal_color + (255,), outline=(255, 255, 255, 160))

    for i in range(n_petals):
        angle = (360 / n_petals) * i
        rotated = petal_img.rotate(angle, resample=Image.BICUBIC, center=(cx, cy))
        canvas = Image.alpha_composite(canvas, rotated)

    d = ImageDraw.Draw(canvas)
    r = size * 0.16
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=center_color + (255,), outline=(255, 255, 255, 200), width=3)
    return canvas


def draw_swatches(im, d, box):
    x0, y0, x1, y1 = box
    cy = (y0 + y1) / 2 + 26
    colors = [ACCENT, ACCENT_LIGHT, PINK, PINK_LIGHT, YELLOW, GREEN]
    n = len(colors)
    r = 28
    gap = r * 1.2
    total_w = (n - 1) * gap
    start_x = (x0 + x1) / 2 - total_w / 2
    for i, c in enumerate(colors):
        cx = start_x + i * gap
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c, outline=(255, 255, 255), width=3)


def draw_price_table(im, d, box):
    x0, y0, x1, y1 = box
    tx0, ty0 = (x0 + x1) / 2 - 92, (y0 + y1) / 2 - 6
    tx1, ty1 = (x0 + x1) / 2 + 92, (y0 + y1) / 2 + 76
    d.rounded_rectangle([tx0, ty0, tx1, ty1], radius=10, fill=(250, 243, 234), outline=LINE, width=2)
    rows = 3
    row_h = (ty1 - ty0) / rows
    col_x = tx0 + 108
    for i in range(1, rows):
        y = ty0 + i * row_h
        d.line([(tx0 + 10, y), (tx1 - 10, y)], fill=LINE, width=2)
    d.line([(col_x, ty0 + 8), (col_x, ty1 - 8)], fill=LINE, width=2)
    label_colors = [ACCENT, PINK, GREEN]
    for i in range(rows):
        rcy = ty0 + row_h * i + row_h / 2
        d.rounded_rectangle([tx0 + 16, rcy - 6, col_x - 14, rcy + 6], radius=4, fill=MUTED)
        d.rounded_rectangle([col_x + 14, rcy - 6, tx1 - 16, rcy + 6], radius=4, fill=label_colors[i])
    tagx, tagy = tx1 - 4, ty0 - 4
    d.ellipse([tagx - 24, tagy - 24, tagx + 24, tagy + 24], fill=YELLOW, outline=(255, 255, 255), width=3)


def draw_clients(im, d, box):
    x0, y0, x1, y1 = box
    cx0 = (x0 + x1) / 2
    base_y = (y0 + y1) / 2 + 62
    people = [(-72, GREEN, 30), (0, ACCENT, 38), (72, PINK, 30)]
    for dx, color, r in people:
        cx = cx0 + dx
        head_r = r * 0.42
        head_cy = base_y - r * 1.5
        d.ellipse([cx - head_r, head_cy - head_r, cx + head_r, head_cy + head_r], fill=color)
        d.pieslice([cx - r, base_y - r * 0.9, cx + r, base_y + r * 0.9], 180, 360, fill=color)
    ax0, ay0 = cx0 - 96, base_y - r * 1.9
    pts = [(ax0, ay0 + 30), (ax0 + 55, ay0 - 4), (ax0 + 115, ay0 + 8), (ax0 + 175, ay0 - 28)]
    d.line(pts, fill=ACCENT, width=5, joint="curve")
    d.polygon([(ax0 + 172, ay0 - 44), (ax0 + 190, ay0 - 30), (ax0 + 168, ay0 - 16)], fill=ACCENT)


def draw_flower_start(im, d, box):
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2 + 20
    flower = make_flower(150, ACCENT_LIGHT, YELLOW, n_petals=7)
    im.paste(flower, (int(cx - 75), int(cy - 75)), flower)
    d = ImageDraw.Draw(im, "RGBA")
    bx, by = cx + 66, cy - 60
    d.ellipse([bx - 22, by - 22, bx + 22, by + 22], fill=GREEN, outline=(255, 255, 255), width=4)
    txt = "1"
    tb = d.textbbox((0, 0), txt, font=FONT_BOLD)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    d.text((bx - tw / 2 - tb[0], by - th / 2 - tb[1]), txt, font=FONT_BOLD, fill=(255, 255, 255))


def draw_catalog(im, d, box):
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2 + 20
    book_w, book_h = 190, 118
    bx0, by0 = cx - book_w / 2, cy - book_h / 2
    bx1, by1 = cx + book_w / 2, cy + book_h / 2
    d.rounded_rectangle([bx0, by0, bx1, by1], radius=10, fill=(250, 243, 234), outline=LINE, width=2)
    d.line([(cx, by0 + 6), (cx, by1 - 6)], fill=LINE, width=2)

    thumbs = [
        (bx0 + book_w * 0.27, by0 + book_h * 0.32, ACCENT_LIGHT, YELLOW),
        (bx0 + book_w * 0.27, by0 + book_h * 0.72, PINK, YELLOW),
        (bx0 + book_w * 0.73, by0 + book_h * 0.32, PINK_LIGHT, ACCENT),
        (bx0 + book_w * 0.73, by0 + book_h * 0.72, GREEN, YELLOW),
    ]
    for tx, ty, petal_c, center_c in thumbs:
        flower = make_flower(56, petal_c, center_c, n_petals=6)
        im.paste(flower, (int(tx - 28), int(ty - 28)), flower)
    d = ImageDraw.Draw(im, "RGBA")

    # marcador/bookmark no canto
    rx = bx1 - 30
    d.polygon([(rx, by0 - 14), (rx + 22, by0 - 14), (rx + 22, by0 + 20), (rx + 11, by0 + 8), (rx, by0 + 20)], fill=ACCENT)


images = [
    ("bonus-1-guia-de-cores.png", draw_swatches, ACCENT),
    ("bonus-2-tabela-de-precos.png", draw_price_table, PINK),
    ("bonus-3-maneiras-de-conseguir-clientes.png", draw_clients, GREEN),
    ("bonus-catalogo-flores.png", draw_catalog, PINK_LIGHT),
    ("bonus-4-guia-primeiras-flores.png", draw_flower_start, ACCENT_LIGHT),
]

for filename, fn, tab_color in images:
    img, draw, box = base_card(tab_color)
    fn(img, draw, box)
    img.save(os.path.join(OUT_DIR, filename))
    print("saved", filename)
