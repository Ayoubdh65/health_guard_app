from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


OUT_DIR = Path(r"C:\Users\Ayoub\OneDrive\Desktop\healthguard\docs\pfe\figures")
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_PATH = OUT_DIR / "iot_architecture_healthguard.png"

W, H = 1800, 1100
BG = "white"
BORDER = "#555555"
TEXT = "#222222"
BLUE = "#1E88E5"
LIGHT_BLUE = "#EAF4FF"
LIGHT_GRAY = "#F6F6F6"
LIGHT_GREEN = "#EAF7EA"
LIGHT_ORANGE = "#FFF3E0"
LIGHT_PURPLE = "#F4EEFF"
RED = "#C62828"

img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)


def font(size, bold=False):
    candidates = []
    if bold:
        candidates += [
            r"C:\Windows\Fonts\arialbd.ttf",
            r"C:\Windows\Fonts\calibrib.ttf",
        ]
    candidates += [
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\calibri.ttf",
        r"C:\Windows\Fonts\segoeui.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


F_TITLE = font(36, bold=True)
F_HEAD = font(28, bold=True)
F_TEXT = font(22)
F_SMALL = font(18)


def rect(x1, y1, x2, y2, fill=None, width=3, radius=0):
    if radius:
        draw.rounded_rectangle((x1, y1, x2, y2), radius=radius, outline=BORDER, fill=fill, width=width)
    else:
        draw.rectangle((x1, y1, x2, y2), outline=BORDER, fill=fill, width=width)


def centered_text(x1, y1, x2, y2, text, ft, fill=TEXT):
    bbox = draw.multiline_textbbox((0, 0), text, font=ft, spacing=4, align="center")
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.multiline_text(
        ((x1 + x2 - tw) / 2, (y1 + y2 - th) / 2),
        text,
        font=ft,
        fill=fill,
        spacing=4,
        align="center",
    )


def arrow(x1, y1, x2, y2, label=None, color="#333333", width=5):
    draw.line((x1, y1, x2, y2), fill=color, width=width)
    import math
    ang = math.atan2(y2 - y1, x2 - x1)
    size = 14
    p1 = (x2, y2)
    p2 = (x2 - size * math.cos(ang - 0.45), y2 - size * math.sin(ang - 0.45))
    p3 = (x2 - size * math.cos(ang + 0.45), y2 - size * math.sin(ang + 0.45))
    draw.polygon([p1, p2, p3], fill=color)
    if label:
        bbox = draw.textbbox((0, 0), label, font=F_SMALL)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        lx = (x1 + x2 - tw) / 2
        ly = (y1 + y2 - th) / 2 - 20
        rect(lx - 8, ly - 4, lx + tw + 8, ly + th + 4, fill="white", width=0, radius=8)
        draw.text((lx, ly), label, font=F_SMALL, fill=BLUE)


def cloud(cx, cy, scale=1.0, fill="#FFFFFF"):
    r1, r2, r3, r4 = 40 * scale, 55 * scale, 42 * scale, 36 * scale
    draw.ellipse((cx - 95 * scale, cy - 10 * scale, cx - 15 * scale, cy + 60 * scale), fill=fill, outline=BORDER, width=3)
    draw.ellipse((cx - 40 * scale, cy - 45 * scale, cx + 50 * scale, cy + 40 * scale), fill=fill, outline=BORDER, width=3)
    draw.ellipse((cx + 20 * scale, cy - 15 * scale, cx + 100 * scale, cy + 55 * scale), fill=fill, outline=BORDER, width=3)
    draw.ellipse((cx - 120 * scale, cy + 15 * scale, cx + 110 * scale, cy + 85 * scale), fill=fill, outline=BORDER, width=3)


def wifi_icon(cx, cy, color=BORDER):
    for r in [18, 38, 58]:
        draw.arc((cx - r, cy - r, cx + r, cy + r), start=200, end=340, fill=color, width=4)
    draw.ellipse((cx - 5, cy + 5, cx + 5, cy + 15), fill=color)


def router_icon(x, y):
    rect(x, y, x + 150, y + 55, fill="#202020", width=2, radius=10)
    for i in range(4):
        draw.ellipse((x + 25 + i * 22, y + 35, x + 35 + i * 22, y + 45), fill="#4CAF50")
    draw.line((x + 40, y - 40, x + 35, y), fill=BORDER, width=4)
    draw.line((x + 110, y - 40, x + 115, y), fill=BORDER, width=4)


def sensor_box(x, y, label):
    rect(x, y, x + 185, y + 65, fill="#FFFFFF", width=3, radius=10)
    centered_text(x, y, x + 185, y + 65, label, F_TEXT)


def pi_board(x, y):
    rect(x, y, x + 300, y + 250, fill="#FFFFFF", width=3)
    rect(x + 45, y + 45, x + 255, y + 205, fill=LIGHT_GREEN, width=4, radius=16)
    draw.ellipse((x + 110, y + 85, x + 145, y + 120), outline=BLUE, width=5)
    draw.ellipse((x + 155, y + 85, x + 190, y + 120), outline=BLUE, width=5)
    draw.line((x + 145, y + 102, x + 155, y + 102), fill=BLUE, width=5)
    draw.line((x + 127, y + 120, x + 127, y + 145), fill=BLUE, width=5)
    draw.line((x + 172, y + 120, x + 172, y + 145), fill=BLUE, width=5)
    draw.line((x + 127, y + 132, x + 172, y + 132), fill=BLUE, width=5)
    centered_text(x + 70, y + 150, x + 230, y + 195, "Raspberry Pi 4", F_TEXT)
    for i in range(7):
        draw.line((x + 290, y + 20 + i * 28, x + 320, y + 20 + i * 28), fill=BORDER, width=4)
        draw.line((x - 20, y + 20 + i * 28, x + 10, y + 20 + i * 28), fill=BORDER, width=4)


def stack_box(x, y, w, h, title, items, fill):
    rect(x, y, x + w, y + h, fill=fill, width=3)
    rect(x, y, x + w, y + 52, fill="#FFFFFF", width=2)
    centered_text(x, y, x + w, y + 52, title, F_HEAD)
    iy = y + 70
    for item in items:
        rect(x + 25, iy, x + w - 25, iy + 52, fill="#FFFFFF", width=2, radius=10)
        centered_text(x + 25, iy, x + w - 25, iy + 52, item, F_TEXT)
        iy += 68


draw.rectangle((20, 20, W - 20, H - 20), outline=BORDER, width=3)
draw.rectangle((20, 20, W - 20, 75), outline=BORDER, width=2, fill="#FBFBFB")
centered_text(20, 20, W - 20, 75, "Architecture de la solution HealthGuard", F_TITLE)

# Left block: sensors
draw.text((75, 200), "Capteur", font=F_HEAD, fill=TEXT)
sensor_box(70, 245, "MAX30102")
draw.text((95, 330), "Mesures réelles :", font=F_TEXT, fill=TEXT)
draw.text((95, 365), "• Fréquence cardiaque", font=F_TEXT, fill=TEXT)
draw.text((95, 400), "• SpO₂", font=F_TEXT, fill=TEXT)

# Raspberry Pi card
draw.text((450, 125), "Nœud Edge", font=F_HEAD, fill=TEXT)
pi_board(390, 185)
stack_box(340, 470, 410, 340, "HealthGuard Edge", [
    "PPGSensor / I2C",
    "SensorManager",
    "FastAPI + Nginx",
    "SQLite locale",
], LIGHT_BLUE)

# Gateway
stack_box(835, 130, 300, 700, "Passerelle", [], LIGHT_GRAY)
wifi_icon(985, 290)
router_icon(910, 400)
centered_text(850, 475, 1120, 530, "Routeur Wi-Fi", F_TEXT)

# Local mobile access
rect(1215, 170, 1405, 330, fill="#FFFFFF", width=3, radius=16)
draw.rounded_rectangle((1270, 190, 1350, 300), radius=14, outline=BORDER, width=3, fill="#EEF5FF")
draw.rectangle((1288, 212, 1332, 248), outline=BLUE, width=3)
draw.line((1288, 258, 1332, 258), fill=BLUE, width=3)
draw.line((1288, 270, 1322, 270), fill=BLUE, width=3)
centered_text(1218, 330, 1402, 372, "Téléphone mobile", F_TEXT)
centered_text(1185, 380, 1435, 425, "Accès local au dashboard\nmême réseau Wi-Fi", F_SMALL, fill=BLUE)

# Right cloud section
stack_box(1455, 130, 300, 780, "Infrastructure distante", [], LIGHT_ORANGE)

# Doctor interface top
rect(1510, 180, 1700, 300, fill="#FFFFFF", width=3, radius=16)
draw.rounded_rectangle((1565, 195, 1645, 285), radius=12, outline=BORDER, width=3, fill="#EEF5FF")
draw.rectangle((1583, 212, 1617, 240), outline=BLUE, width=3)
draw.line((1583, 248, 1617, 248), fill=BLUE, width=3)
draw.line((1583, 260, 1610, 260), fill=BLUE, width=3)
centered_text(1515, 300, 1695, 335, "Espace médecin", F_TEXT)

# Cloud
cloud(1605, 455, scale=1.05)
centered_text(1510, 425, 1700, 520, "Internet", F_HEAD)

# Supabase bottom
rect(1480, 610, 1730, 820, fill="#FFFFFF", width=3)
rect(1480, 610, 1730, 665, fill="#F9F9F9", width=2)
centered_text(1480, 610, 1730, 665, "Supabase", F_HEAD)
centered_text(1500, 690, 1710, 780, "Patients\nMesures vitales\nAlertes\nRendez-vous", F_TEXT)

# Arrows and labels
arrow(255, 278, 390, 278)
arrow(690, 278, 835, 278)
arrow(1045, 400, 1310, 330, "Wi-Fi")
arrow(1135, 455, 1480, 455, "HTTPS")
arrow(1605, 335, 1605, 390, "HTTPS")
arrow(1605, 532, 1605, 610, "HTTPS")

# Local dashboard callout
rect(330, 850, 430, 930, fill="#FFFFFF", width=2, radius=12)
draw.ellipse((355, 865, 405, 915), outline=BORDER, width=3)
draw.line((368, 882, 392, 882), fill=BORDER, width=3)
draw.line((368, 892, 392, 892), fill=BORDER, width=3)
draw.line((368, 902, 387, 902), fill=BORDER, width=3)
rect(450, 852, 740, 930, fill=LIGHT_PURPLE, width=2, radius=12)
centered_text(460, 860, 730, 922, "Tableau de bord local\nReact + SSE", F_TEXT)
arrow(570, 810, 570, 852, color=BLUE)

# Explanatory notes
draw.text((70, 965), "Acquisition locale", font=F_SMALL, fill=BLUE)
draw.text((515, 965), "Traitement + stockage embarqué", font=F_SMALL, fill=BLUE)
draw.text((930, 965), "Communication réseau", font=F_SMALL, fill=BLUE)
draw.text((1370, 965), "Synchronisation distante + espace médecin", font=F_SMALL, fill=BLUE)

img.save(OUT_PATH, quality=95)
print(OUT_PATH)
