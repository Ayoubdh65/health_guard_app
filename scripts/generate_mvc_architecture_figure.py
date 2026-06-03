from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


OUT_DIR = Path(r"C:\Users\Ayoub\OneDrive\Desktop\healthguard\docs\pfe\figures")
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_PATH = OUT_DIR / "mvc_architecture_healthguard.png"

W, H = 1700, 980
img = Image.new("RGB", (W, H), "white")
draw = ImageDraw.Draw(img)

BORDER = "#555555"
TEXT = "#222222"
BLUE = "#1976D2"
GREEN = "#2E7D32"
ORANGE = "#EF6C00"
LIGHT_BLUE = "#EAF4FF"
LIGHT_GREEN = "#EDF8EE"
LIGHT_ORANGE = "#FFF3E8"
LIGHT_GRAY = "#FAFAFA"


def font(size, bold=False):
    candidates = []
    if bold:
        candidates += [r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\calibrib.ttf"]
    candidates += [r"C:\Windows\Fonts\arial.ttf", r"C:\Windows\Fonts\calibri.ttf", r"C:\Windows\Fonts\segoeui.ttf"]
    for p in candidates:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


F_TITLE = font(34, True)
F_HEAD = font(28, True)
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
    draw.multiline_text(((x1 + x2 - tw) / 2, (y1 + y2 - th) / 2), text, font=ft, fill=fill, spacing=4, align="center")


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
        ly = (y1 + y2 - th) / 2 - 18
        rect(lx - 8, ly - 4, lx + tw + 8, ly + th + 4, fill="white", width=0, radius=8)
        draw.text((lx, ly), label, font=F_SMALL, fill=color)


def stack_box(x, y, w, h, title, items, fill):
    rect(x, y, x + w, y + h, fill=fill, width=3)
    rect(x, y, x + w, y + 54, fill="#FFFFFF", width=2)
    centered_text(x, y, x + w, y + 54, title, F_HEAD)
    iy = y + 75
    for item in items:
        rect(x + 22, iy, x + w - 22, iy + 58, fill="#FFFFFF", width=2, radius=12)
        centered_text(x + 22, iy, x + w - 22, iy + 58, item, F_TEXT)
        iy += 74


# Frame
draw.rectangle((20, 20, W - 20, H - 20), outline=BORDER, width=3)
draw.rectangle((20, 20, W - 20, 75), outline=BORDER, width=2, fill=LIGHT_GRAY)
centered_text(20, 20, W - 20, 75, "Architecture MVC de la plateforme HealthGuard", F_TITLE)

# Main MVC columns
stack_box(90, 140, 420, 650, "Vue (View)", [
    "Interface React",
    "Dashboard local",
    "Graphiques des signes vitaux",
    "Panneau des alertes",
    "Notifications de rendez-vous",
    "Accès via téléphone / navigateur",
], LIGHT_BLUE)

stack_box(640, 140, 420, 650, "Contrôleur (Controller)", [
    "FastAPI",
    "Routes API",
    "Authentification JWT",
    "SensorManager",
    "AlertEngine",
    "Service de synchronisation",
], LIGHT_GREEN)

stack_box(1190, 140, 420, 650, "Modèle (Model)", [
    "Modèles SQLAlchemy",
    "Patient / User",
    "VitalReading / Alert",
    "Appointment / SyncLog",
    "SQLite locale",
    "Données synchronisées vers Supabase",
], LIGHT_ORANGE)

# Central arrows
arrow(510, 360, 640, 360, "HTTP / JSON", BLUE)
arrow(640, 430, 510, 430, "Réponses API", BLUE)
arrow(1060, 360, 1190, 360, "Lecture / écriture", GREEN)
arrow(1190, 430, 1060, 430, "Données métier", GREEN)

# External access note
rect(90, 90, 260, 125, fill="#FFFFFF", width=2, radius=10)
centered_text(90, 90, 260, 125, "Utilisateur", F_SMALL)
arrow(220, 125, 220, 140, color=BLUE)

# Sync note on model side
rect(1310, 820, 1530, 900, fill="#FFFFFF", width=2, radius=12)
centered_text(1315, 825, 1525, 895, "Synchronisation périodique\navec Supabase", F_SMALL)
arrow(1420, 790, 1420, 820, color=ORANGE)

img.save(OUT_PATH, quality=95)
print(OUT_PATH)
