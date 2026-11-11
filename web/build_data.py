"""Читает ../data.xlsx (лист «Данные», строки 2–16) и пишет public/data.json.

Запуск: python web/build_data.py
Падает с понятной ошибкой, если данные не проходят проверку.
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

import openpyxl

HERE = Path(__file__).resolve().parent
XLSX = HERE.parent / "data.xlsx"
OUT = HERE / "public" / "data.json"

CITIES = ("Москва", "Сочи", "Новосибирск")
VERIFICATION = {"✅": "ok", "🟡": "partial", "⚠️": "warn"}


def fail(msg):
    sys.exit(f"build_data: ошибка — {msg}")


def verification(status, row):
    for mark, code in VERIFICATION.items():
        if str(status).startswith(mark):
            return code
    fail(f"строка {row}: неизвестный статус проверки «{status}»")


def main():
    if not XLSX.exists():
        fail(f"не найден {XLSX}")
    ws = openpyxl.load_workbook(XLSX, read_only=True)["Данные"]
    items = []
    for row, r in enumerate(ws.iter_rows(min_row=2, max_row=16, max_col=11, values_only=True), start=2):
        city, name, dev, district, cls, price, delivery, src, src2, status, note = r
        if city not in CITIES:
            fail(f"строка {row}: город «{city}» не из списка {CITIES}")
        if cls not in ("бизнес", "премиум"):
            fail(f"строка {row}: класс «{cls}» — ожидается «бизнес» или «премиум»")
        if not isinstance(price, (int, float)) or price <= 0:
            fail(f"строка {row}: цена за м² должна быть числом > 0, а не «{price}»")
        for label, url in (("H", src), ("I", src2)):
            if not str(url or "").startswith("https://"):
                fail(f"строка {row}, колонка {label}: ссылка должна начинаться с https://, а не «{url}»")
        if not name or not dev or not district or not delivery:
            fail(f"строка {row}: пустое обязательное поле")
        items.append({
            "city": city,
            "name": str(name).strip(),
            "developer": str(dev).strip(),
            "district": str(district).strip(),
            "class": cls,
            "pricePerM2": round(price),
            "delivery": str(delivery).strip(),
            "sourceUrl": src,
            "source2Url": src2,
            "verification": verification(status, row),
            "note": str(note or "").strip(),
            # С заглавной — так в K помечены именно апартаменты; «квартиры и апартаменты» (Unity Center) не в счёт.
            "isApartments": "Апартаменты" in str(note or ""),
        })

    per_city = Counter(i["city"] for i in items)
    if len(items) != 15 or any(per_city[c] != 5 for c in CITIES):
        fail(f"ожидается 15 строк, по 5 на город; получено {len(items)}: {dict(per_city)}")

    # Дата съёмки — из примечаний под таблицей («Данные сняты 11.11.2026»).
    notes = " ".join(str(r[0]) for r in ws.iter_rows(min_row=18, max_col=1, values_only=True) if r[0])
    m = re.search(r"сняты (\d{2}\.\d{2}\.\d{4})", notes)
    if not m:
        fail("в примечаниях не найдена дата «Данные сняты ДД.ММ.ГГГГ»")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"date": m.group(1), "items": items}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"build_data: {len(items)} ЖК → {OUT}")


if __name__ == "__main__":
    main()
