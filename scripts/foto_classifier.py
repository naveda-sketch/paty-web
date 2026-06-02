#!/usr/bin/env python3
"""Foto Classifier Tier 4 — Panaderia Paty. Gemini Vision."""
import os, sys, json, shutil, base64, argparse, hashlib, re
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent.parent
MENU_DIR = BASE_DIR / "images" / "menu"
SOURCE_DIR = MENU_DIR / "La Madre"
FEED_OUTPUT = BASE_DIR / "data" / "foto_feed_a1.json"
REPORT_OUTPUT = BASE_DIR / "data" / "clasificacion_report.json"

CATEGORIES = {
    "hogaza-natural": "Hogaza natural", "hogaza-semillas": "Hogaza de semillas",
    "hogaza-datil-nuez": "Hogaza datil y nuez", "pan-caja-natural": "Pan de caja natural",
    "pan-caja-semillas": "Pan de caja con semillas", "galleta-ny": "Galleta NY masa madre",
    "galleta-oreo": "Galleta NY oreo", "galleta-nuez-choco": "Galletas NY nuez y chocolate",
    "crookie": "Crookie", "trenza-nutella": "Trenza de nutella",
    "pizza-jitomate": "Pizza base jitomate", "pizza-queso": "Pizza base queso",
    "pizza-hawaiana": "Pizza pina y jamon", "pizza-pepperoni": "Pizza pepperoni",
    "pizza-atelier": "Pizza atelier", "pay-manzana": "Pay manzana",
    "jugos": "Jugos", "preparaciones": "Preparaciones",
    "masa-madre-general": "Masa madre (general)", "ambiente-panaderia": "Ambiente panaderia",
    "no-clasificable": "No clasificable",
}

FOLDER_MAP = {
    "Hogaza natural": "hogaza-natural", "Hogaza de semillas": "hogaza-semillas",
    "Galleta NY oreo": "galleta-oreo", "Galletas NY nuez y chocolate": "galleta-nuez-choco",
    "Crookie": "crookie", "Trenza de nutella": "trenza-nutella",
    "Pay manzana": "pay-manzana", "Jugos": "jugos", "Preparaciones": "preparaciones",
}
SLUG_TO_FOLDER = {v: k for k, v in FOLDER_MAP.items()}
for slug, display in CATEGORIES.items():
    if slug not in SLUG_TO_FOLDER:
        SLUG_TO_FOLDER[slug] = display


def get_key():
    key = os.environ.get("GEMINI_API_KEY", "")
    if key: return key
    for p in [BASE_DIR / ".env", BASE_DIR.parent / "paty-backend" / ".env"]:
        if p.exists():
            for line in p.read_text().splitlines():
                if line.startswith("GEMINI_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"')
    return ""


def encode_img(path, max_px=800):
    try:
        from PIL import Image
        import io
        img = Image.open(path)
        img.thumbnail((max_px, max_px), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=80)
        return base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return base64.b64encode(path.read_bytes()).decode()


def parse_json_response(text):
    """Extract JSON from Gemini response, handling markdown wrapping and thinking."""
    text = text.strip()
    # Remove thinking blocks
    text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
    # Remove markdown code fences
    m = re.search(r'```(?:json)?\s*\n?(.*?)```', text, re.DOTALL)
    if m:
        text = m.group(1).strip()
    # Try parsing
    return json.loads(text)


def classify(img_path, api_key):
    import urllib.request
    b64 = encode_img(img_path)
    cats = ", ".join(CATEGORIES.keys())

    prompt = f"""Analiza esta foto de Panaderia Paty (Guadalajara, Mexico).
Responde SOLO con JSON valido. Categorias: {cats}

{{"category_slug":"slug","confidence":0.9,"quality_score":8,"menu_ready":true,"caption_ig":"caption instagram con emojis max 120 chars","caption_wa":"texto WhatsApp max 80 chars","description":"descripcion 50 chars","tags":["tag1"],"composition":"close-up|full|lifestyle|flat-lay|process","best_for":"menu|instagram|whatsapp|hero"}}"""

    payload = {
        "contents": [{"parts": [
            {"text": prompt},
            {"inline_data": {"mime_type": "image/jpeg", "data": b64}}
        ]}],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 2048}
    }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            result = json.loads(resp.read().decode())
            parts = result.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            text = ""
            for part in parts:
                if "text" in part:
                    text += part["text"]
            return parse_json_response(text)
    except Exception as e:
        return {"category_slug": "no-clasificable", "confidence": 0, "quality_score": 0,
                "menu_ready": False, "caption_ig": "", "caption_wa": "",
                "description": "", "tags": [], "error": str(e)[:200]}


def process(args):
    api_key = get_key()
    if not api_key:
        print("ERROR: GEMINI_API_KEY no encontrada. export GEMINI_API_KEY=tu_key"); sys.exit(1)

    exts = {".jpg", ".jpeg", ".png", ".heic", ".JPG", ".JPEG", ".PNG"}
    if args.file:
        files = [SOURCE_DIR / args.file]
    else:
        files = sorted([f for f in SOURCE_DIR.iterdir() if f.suffix in exts and not f.name.startswith(".")])
    if args.limit > 0: files = files[:args.limit]
    total = len(files)
    if not total: print("Sin fotos."); return

    print(f"\n{'='*55}\n  Foto Classifier Tier 4 - Panaderia Paty\n{'='*55}")
    print(f"  Fuente:  {SOURCE_DIR}\n  Fotos:   {total}")
    print(f"  Modo:    {'PREVIEW' if args.preview else 'EJECUCION'}\n{'='*55}\n")

    results, stats, scores = [], {}, []

    for i, fp in enumerate(files, 1):
        print(f"[{i}/{total}] {fp.name}...", end=" ", flush=True)
        r = classify(fp, api_key)
        r["filename"] = fp.name
        r["file_hash"] = hashlib.sha256(fp.read_bytes()).hexdigest()[:12]
        r["processed_at"] = datetime.now().isoformat()

        slug = r.get("category_slug", "no-clasificable")
        if slug not in CATEGORIES: slug = "no-clasificable"; r["category_slug"] = slug
        score = r.get("quality_score", 0)
        scores.append(score)
        stats[slug] = stats.get(slug, 0) + 1
        menu_tag = "MENU" if r.get("menu_ready") else ""
        err = " ERR" if r.get("error") else ""

        print(f"-> {CATEGORIES.get(slug,'?'):28s} Q:{score:2d}/10 {menu_tag}{err}")

        if r.get("caption_wa"):
            print(f"       WA: {r['caption_wa'][:70]}")

        if not args.preview and not r.get("error"):
            folder = SLUG_TO_FOLDER.get(slug, slug)
            target = MENU_DIR / folder
            target.mkdir(parents=True, exist_ok=True)
            dest = target / fp.name
            if dest.exists(): dest = target / f"{fp.stem}_{r['file_hash']}{fp.suffix}"
            shutil.copy2(fp, dest)
            r["moved_to"] = str(dest)

        results.append(r)

    avg = sum(scores) / len(scores) if scores else 0
    mr = sum(1 for r in results if r.get("menu_ready"))
    sr = sum(1 for s in scores if s >= 7)

    print(f"\n{'='*55}\n  RESUMEN\n{'='*55}")
    for s, c in sorted(stats.items(), key=lambda x: -x[1]):
        print(f"  {CATEGORIES.get(s,s):35s} {c:3d}")
    print(f"\n  Calidad promedio:  {avg:.1f}/10\n  Menu ready:        {mr}/{total}\n  Social ready:      {sr}/{total}")

    REPORT_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    REPORT_OUTPUT.write_text(json.dumps({"timestamp": datetime.now().isoformat(), "total": total,
        "avg_quality": round(avg, 1), "menu_ready": mr, "social_ready": sr,
        "by_category": dict(sorted(stats.items(), key=lambda x: -x[1])),
        "items": results}, indent=2, ensure_ascii=False))
    print(f"\n  Reporte: {REPORT_OUTPUT}")


def export_feed(args):
    if not REPORT_OUTPUT.exists(): print("No hay reporte."); sys.exit(1)
    report = json.loads(REPORT_OUTPUT.read_text())
    items = [{"product": CATEGORIES.get(i["category_slug"], "?"), "slug": i["category_slug"],
              "filename": i["filename"], "quality": i["quality_score"],
              "menu_ready": i.get("menu_ready", False), "caption_ig": i.get("caption_ig", ""),
              "caption_wa": i.get("caption_wa", ""), "tags": i.get("tags", []),
              "best_for": i.get("best_for", "")}
             for i in report.get("items", []) if i.get("quality_score", 0) >= 7]
    feed = {"agent": "A1_MARKETING", "tenant": "panaderia-paty",
            "generated_at": datetime.now().isoformat(), "total": len(items), "items": items}
    FEED_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    FEED_OUTPUT.write_text(json.dumps(feed, indent=2, ensure_ascii=False))
    print(f"Feed A1: {FEED_OUTPUT} ({len(items)} assets)")


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Foto Classifier Tier 4")
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--preview", action="store_true")
    g.add_argument("--execute", action="store_true")
    g.add_argument("--export-feed", action="store_true")
    p.add_argument("--file", type=str)
    p.add_argument("--limit", type=int, default=0)
    a = p.parse_args()
    if a.export_feed: export_feed(a)
    else: process(a)
