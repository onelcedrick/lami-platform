"""
Moteur de compatibilite materielle pour le configurateur PC L'AMI (v2).

Regles verifiees :
  R1 socket CPU == socket carte mere
  R2 generation RAM == generation supportee par la carte mere
  R3 wattage PSU >= max((tdp_cpu + tdp_gpu + 100) * 1.35, palier GPU)
  R4 le boitier est un vrai boitier (tags case)
  R5 le disque systeme est interne (NVMe de preference)
  R6 total <= budget

v2 :
  - DDR deduite de attributes.max_memory pour LGA1700 (128=DDR4, 192=DDR5)
  - ordre de priorite : plateforme > RAM > stockage > PSU > boitier
    (le boitier ne bloque plus l'achat du CPU)
  - passe d'upgrade : le budget restant est reinvesti (GPU, plateforme, RAM...)
"""
from __future__ import annotations

import logging
import math
import re
from typing import Any, Optional

from app.infrastructure.catalog_cache import _norm, _price, _rating, _stock

logger = logging.getLogger("ia.compat")

PROFILES: dict[str, dict[str, float]] = {
    "gaming": {"GPU": 0.32, "CPU": 0.20, "Carte mere": 0.12, "RAM": 0.10,
               "Stockage": 0.09, "Alimentation": 0.09, "Boitier": 0.08},
    "bureautique": {"CPU": 0.28, "Carte mere": 0.18, "Stockage": 0.16,
                    "RAM": 0.14, "Alimentation": 0.13, "Boitier": 0.11},
    "creation": {"GPU": 0.26, "CPU": 0.24, "RAM": 0.14, "Stockage": 0.12,
                 "Carte mere": 0.12, "Alimentation": 0.08, "Boitier": 0.04},
    "streaming": {"CPU": 0.26, "GPU": 0.24, "RAM": 0.12, "Carte mere": 0.12,
                  "Stockage": 0.11, "Alimentation": 0.09, "Boitier": 0.06},
}

SOCKETS = ("AM4", "AM5", "LGA1700", "LGA1851", "LGA1200", "LGA1151")

GPU_SPECS: list[tuple[str, int, int]] = [
    ("rtx 5090", 575, 1000), ("rtx 5080", 360, 850),
    ("rtx 4090", 450, 850), ("rtx 4080", 320, 750),
    ("rtx 4070 ti", 285, 750), ("rtx 4070", 220, 650),
    ("rtx 4060 ti", 165, 600), ("rtx 4060", 115, 550),
    ("rtx 3090", 350, 750), ("rtx 3080", 320, 750),
    ("rtx 3070", 220, 650), ("rtx 3060", 170, 550), ("rtx 3050", 130, 450),
    ("gtx 1660", 125, 450), ("gtx 1650", 100, 400), ("gtx 1050", 75, 350),
    ("rx 7900 xtx", 355, 800), ("rx 7900", 315, 750),
    ("rx 7800", 263, 700), ("rx 7700", 245, 650), ("rx 7600", 190, 550),
    ("rx 6900", 300, 750), ("rx 6800", 250, 650), ("rx 6700", 230, 600),
    ("rx 6600", 132, 500), ("rx 6500", 107, 400), ("rx 6400", 53, 350),
    ("rx 580", 185, 500), ("rx 570", 150, 450), ("rx 550", 50, 350),
    ("arc a770", 225, 600), ("arc a750", 225, 600),
]


# ---------------- accesseurs ----------------
def _attrs(p: dict) -> dict:
    a = p.get("attributes")
    return a if isinstance(a, dict) else {}


def _tags(p: dict) -> set[str]:
    t = p.get("tags")
    return {_norm(x) for x in t if isinstance(x, str)} if isinstance(t, list) else set()


def _nums(v: Any) -> list[int]:
    return [int(x) for x in re.findall(r"\d+", str(v if v is not None else ""))]


def _active(p: dict) -> bool:
    return (not p.get("status")) or p.get("status") == "active"


def _clean(p: dict) -> dict:
    return {k: v for k, v in p.items() if not k.startswith("_")}


# ---------------- R1 sockets ----------------
def _clean_socket(v: Any) -> str:
    s = re.sub(r"[^A-Z0-9]", "", str(v or "").upper())
    return s if s in SOCKETS else ""


def cpu_socket(p: dict) -> str:
    s = _clean_socket(_attrs(p).get("socket"))
    if s:
        return s
    n = _norm(p.get("name"))
    m = re.search(r"ryzen\s+\d\s+(\d{4})", n)
    if m:
        return "AM5" if int(m.group(1)) >= 7000 else "AM4"
    m = re.search(r"\bi[3579]\s+(\d{4,5})", n)
    if m:
        d = m.group(1)
        gen = int(d[:2]) if len(d) == 5 else int(d[0])
        if gen >= 15:
            return "LGA1851"
        if gen >= 12:
            return "LGA1700"
        if gen >= 10:
            return "LGA1200"
        return "LGA1151"
    if "pentium gold" in n or "celeron g6" in n:
        return "LGA1700"
    return ""


def mb_socket(p: dict) -> str:
    s = _clean_socket(_attrs(p).get("socket"))
    if s:
        return s
    n = _norm(p.get("name"))
    if re.search(r"\b(b650|x670|a620|b840|x870)\b", n):
        return "AM5"
    if re.search(r"\b(b550|x570|b450|x470|a520|a320)\b", n):
        return "AM4"
    if re.search(r"\b(z890|b860)\b", n):
        return "LGA1851"
    if re.search(r"\b(z790|b760|h770|z690|b660|h610)\b", n):
        return "LGA1700"
    return ""


# ---------------- R2 DDR ----------------
def mb_ddr(p: dict) -> str:
    hay = _norm(p.get("name")) + " " + " ".join(_tags(p))
    if "ddr5" in hay:
        return "DDR5"
    if "ddr4" in hay or re.search(r"\bd4\b", hay):
        return "DDR4"
    s = mb_socket(p)
    if s in ("AM5", "LGA1851"):
        return "DDR5"
    if s in ("AM4", "LGA1200", "LGA1151"):
        return "DDR4"
    if s == "LGA1700":
        # max_memory 128 Go => DDR4 ; 192 Go => DDR5 (4x48)
        mm = _nums(_attrs(p).get("max_memory"))
        if mm:
            return "DDR5" if mm[0] >= 192 else "DDR4"
        return "DDR4"
    return ""


def ram_ddr(p: dict) -> str:
    hay = _norm(p.get("name")) + " " + " ".join(_tags(p))
    if "ddr5" in hay:
        return "DDR5"
    if "ddr4" in hay:
        return "DDR4"
    nums = _nums(_attrs(p).get("speed"))
    if nums:
        f = nums[0]
        if f in (3, 4, 5):
            return f"DDR{f}"
        if f >= 4800:
            return "DDR5"
        if f >= 1333:
            return "DDR4"
    return ""


def ram_gb(p: dict) -> int:
    nums = _nums(_attrs(p).get("modules"))
    if len(nums) >= 2 and 1 <= nums[0] <= 8 and 1 <= nums[1] <= 128:
        return nums[0] * nums[1]
    for src in (_attrs(p).get("capacity"), p.get("name")):
        m = re.search(r"(\d+)\s*gb", _norm(src))
        if m:
            return int(m.group(1))
    return 0


# ---------------- R3 consommation ----------------
def cpu_tdp(p: Optional[dict]) -> int:
    if not p:
        return 65
    try:
        t = int(float(_attrs(p).get("tdp")))
        if 15 <= t <= 350:
            return t
    except (TypeError, ValueError):
        pass
    n = _norm(p.get("name"))
    if "x3d" in n:
        return 120
    if re.search(r"\d{4,5}k\b", n):
        return 125
    return 65


def gpu_specs(p: Optional[dict]) -> tuple[int, int]:
    if not p:
        return 0, 0
    hay = _norm(_attrs(p).get("chipset")) + " " + _norm(p.get("name"))
    for key, tdp, psu in GPU_SPECS:
        if key in hay:
            return tdp, psu
    return 150, 500


def psu_wattage(p: dict) -> int:
    try:
        return int(float(_attrs(p).get("wattage") or 0))
    except (TypeError, ValueError):
        return 0


def required_wattage(cpu: Optional[dict], gpu: Optional[dict]) -> int:
    g_tdp, g_floor = gpu_specs(gpu)
    total = cpu_tdp(cpu) + g_tdp + 100
    computed = int(math.ceil(total * 1.35 / 50.0) * 50)
    return max(computed, g_floor, 400)


# ---------------- R4 / R5 ----------------
def is_real_case(p: dict) -> bool:
    t = _tags(p)
    if "case" in t:
        return True
    if any("accessory" in x or "fan" in x for x in t):
        return False
    sku = str(p.get("sku") or "").upper()
    return sku.startswith("CASE-") and not sku.startswith(("CASE-ACCESSORY", "CASE-FAN"))


def storage_rank(p: dict) -> int:
    t = _tags(p)
    if any("external" in x for x in t):
        return -1
    a = _attrs(p)
    iface = _norm(a.get("interface"))
    form = _norm(a.get("form_factor"))
    hay = _norm(p.get("name")) + " " + " ".join(t) + " " + iface
    if "nvme" in hay or "nvm" in t or "pcie" in iface or "m 2" in form:
        return 3
    if "ssd" in hay:
        return 2
    if "sata" in iface:
        return 1
    return 0


def storage_gb(p: dict) -> int:
    cap = _attrs(p).get("capacity")
    if isinstance(cap, (int, float)) and cap >= 100:
        return int(cap)
    for src in (cap, p.get("name")):
        n = _norm(src)
        m = re.search(r"(\d+)\s*tb", n)
        if m:
            return int(m.group(1)) * 1000
        m = re.search(r"(\d+)\s*gb", n)
        if m:
            return int(m.group(1))
    return 0


# ---------------- selections ----------------
def _pool(cache, cat: str, cap: float) -> list[dict]:
    if cap <= 0:
        return []
    out = []
    for p in cache.by_category(cat):
        if not _active(p) or not (0 < _price(p) <= cap):
            continue
        if cat == "Boitier" and not is_real_case(p):
            continue
        if cat == "Stockage" and storage_rank(p) < 0:
            continue
        out.append(p)
    return out


def _floor(cache, cat: str) -> float:
    return min((_price(p) for p in _pool(cache, cat, 1e12)), default=0.0)


def _cores(cpu: dict) -> int:
    n = _nums(_attrs(cpu).get("core_count")) or _nums(_attrs(cpu).get("cores"))
    return n[0] if n else 4


def _pick_platform(cache, cpu_cap, mb_cap, hard_cap,
                   socket: str = "", ddr: str = ""):
    cpus = _pool(cache, "CPU", cpu_cap)
    mbs = _pool(cache, "Carte mere", mb_cap)
    best = None
    for mb in mbs:
        s = mb_socket(mb)
        if not s or (socket and s != socket):
            continue
        if ddr and mb_ddr(mb) and mb_ddr(mb) != ddr:
            continue
        for cpu in cpus:
            if cpu_socket(cpu) != s:
                continue
            tot = _price(cpu) + _price(mb)
            if tot > hard_cap:
                continue
            score = _cores(cpu) * 1e9 + tot + _rating(cpu) * 1000
            if best is None or score > best[0]:
                best = (score, cpu, mb)
    return (best[1], best[2]) if best else (None, None)


def _pick_ram(cache, ddr, cap, target_gb):
    pool = [p for p in _pool(cache, "RAM", cap)
            if not ddr or not ram_ddr(p) or ram_ddr(p) == ddr]
    if not pool:
        return None
    pool.sort(key=lambda p: (0 if ram_gb(p) >= target_gb else 1,
                             -ram_gb(p), -_price(p)))
    return pool[0]


def _pick_ram_cheap(cache, ddr, cap):
    pool = [p for p in _pool(cache, "RAM", cap)
            if not ddr or not ram_ddr(p) or ram_ddr(p) == ddr]
    if not pool:
        return None
    pool.sort(key=lambda p: (0 if ram_gb(p) >= 8 else 1, _price(p)))
    return pool[0]


def _pick_storage(cache, cap):
    pool = _pool(cache, "Stockage", cap)
    if not pool:
        return None
    pool.sort(key=lambda p: (-storage_rank(p),
                             0 if storage_gb(p) >= 480 else 1, -_price(p)))
    return pool[0]


def _pick_gpu(cache, cap):
    pool = _pool(cache, "GPU", cap)
    if not pool:
        return None
    pool.sort(key=lambda p: (-_price(p), -_stock(p), -_rating(p)))
    return pool[0]


def _pick_psu(cache, need_w, cap):
    pool = [p for p in _pool(cache, "Alimentation", cap) if psu_wattage(p) >= need_w]
    if not pool:
        return None
    eff = {"platinum": 3, "titanium": 4, "gold": 2, "bronze": 1, "plus": 0}
    pool.sort(key=lambda p: (_price(p), -eff.get(_norm(_attrs(p).get("efficiency")), 0)))
    return pool[0]


def _psu_floor(cache, need_w) -> float:
    pool = [p for p in _pool(cache, "Alimentation", 1e12) if psu_wattage(p) >= need_w]
    return min((_price(p) for p in pool), default=0.0)


def _pick_case(cache, cap):
    pool = _pool(cache, "Boitier", cap)
    if not pool:
        return None
    pool.sort(key=lambda p: (_price(p), -_rating(p)))
    return pool[0]


# ---------------- assemblage ----------------
def assemble_build(cache, usage: str, budget: float) -> dict:
    usage = (usage or "bureautique").lower()
    weights = PROFILES.get(usage, PROFILES["bureautique"])
    cats = [c for c in weights if cache.by_category(c)]
    warnings: list[str] = []

    def _empty(err: str, minimum: float = 0.0) -> dict:
        return {"usage": usage, "budget": budget, "total": 0.0,
                "estimated_total": 0.0, "within_budget": budget > 0,
                "build": [], "count": 0, "slots_filled": 0, "slots": {},
                "missing_slots": cats, "remaining_budget": budget,
                "error": err, "minimum_budget": minimum,
                "compatibility": {"ok": False, "checks": []},
                "warnings": [err]}

    if budget <= 0 or not cats:
        return _empty("budget ou catalogue invalide")

    has_gpu = "GPU" in cats
    target_gb = 32 if usage in ("creation", "streaming") else 16
    f_ram, f_sto = _floor(cache, "RAM"), _floor(cache, "Stockage")
    f_cpu, f_mb = _floor(cache, "CPU"), _floor(cache, "Carte mere")
    f_platform = f_cpu + f_mb
    build: dict[str, dict] = {}

    def spent() -> float:
        return sum(_price(p) for p in build.values())

    def cap_for(c: str) -> float:
        return budget * weights.get(c, 0.1) * 1.35

    # ---- 1. GPU (profils gaming / creation / streaming) ----
    if has_gpu:
        probe = _pick_gpu(cache, cap_for("GPU"))
        reserve = f_platform + f_ram + f_sto + _psu_floor(cache, required_wattage(None, probe))
        g = _pick_gpu(cache, max(min(cap_for("GPU"), budget - reserve), 0))
        if g is not None:
            build["GPU"] = g
        else:
            warnings.append("Aucun GPU abordable : slot retire (budget serre).")

    psu_f = _psu_floor(cache, required_wattage(None, build.get("GPU")))

    # ---- 2. Plateforme CPU + carte mere (prioritaire, R1) ----
    if "CPU" in cats and "Carte mere" in cats:
        cpu = mb = None
        for reserve in (f_ram + f_sto + psu_f, f_ram + f_sto, f_ram, 0.0):
            hard = max(budget - spent() - reserve, 0)
            cpu, mb = _pick_platform(cache, cap_for("CPU"), cap_for("Carte mere"), hard)
            if cpu is None:
                cpu, mb = _pick_platform(cache, 1e12, 1e12, hard)
            if cpu is not None:
                break
        if cpu is None:
            minimum = f_platform + f_ram + f_sto + psu_f
            return _empty(
                f"Budget insuffisant : aucun couple CPU/carte mere compatible. "
                f"Budget minimum conseille : {minimum:,.0f} Ar.".replace(",", " "),
                minimum,
            )
        build["CPU"], build["Carte mere"] = cpu, mb

    cpu, mb = build.get("CPU"), build.get("Carte mere")
    socket = mb_socket(mb) if mb else (cpu_socket(cpu) if cpu else "")
    ddr = mb_ddr(mb) if mb else ""

    # ---- 3. RAM (R2) ----
    if "RAM" in cats:
        ram = None
        for reserve in (f_sto + psu_f, f_sto, 0.0):
            room = max(budget - spent() - reserve, 0)
            ram = _pick_ram(cache, ddr, min(max(cap_for("RAM"), room), room), target_gb)
            if ram is None:
                ram = _pick_ram_cheap(cache, ddr, room)
            if ram is not None:
                break
        if ram is not None:
            build["RAM"] = ram
        else:
            warnings.append(f"Aucune barrette {ddr or 'compatible'} abordable.")

    # ---- 4. Stockage systeme (R5) ----
    if "Stockage" in cats:
        sto = None
        for reserve in (psu_f, 0.0):
            room = max(budget - spent() - reserve, 0)
            sto = _pick_storage(cache, min(max(cap_for("Stockage"), room), room))
            if sto is not None:
                break
        if sto is not None:
            build["Stockage"] = sto
        else:
            warnings.append("Aucun disque interne abordable.")

    # ---- 5. Alimentation (R3) ----
    need_w = required_wattage(cpu, build.get("GPU"))
    psu = _pick_psu(cache, need_w, max(budget - spent(), 0))
    if psu is not None:
        build["Alimentation"] = psu
    elif "Alimentation" in cats:
        warnings.append(f"Aucune alimentation >= {need_w} W dans le budget restant.")

    # ---- 6. Boitier (R4, optionnel : prend le reliquat) ----
    if "Boitier" in cats:
        case = _pick_case(cache, max(budget - spent(), 0))
        if case is not None:
            build["Boitier"] = case
        else:
            warnings.append("Boitier non inclus : budget epuise par les composants essentiels.")

    # ---- 7. Passe d'upgrade : reinvestir le budget restant ----
    for _ in range(6):
        left = budget - spent()
        if left < max(20000.0, budget * 0.02):
            break
        moved = False
        order = (["GPU"] if has_gpu else []) + ["PLATFORM", "RAM", "Stockage", "Boitier"]
        for slot in order:
            left = budget - spent()
            if left < 20000:
                break
            if slot == "GPU":
                cur = build.get("GPU")
                cand = _pick_gpu(cache, (_price(cur) if cur else 0) + left)
                if cand is None or (cur and _price(cand) <= _price(cur)):
                    continue
                delta = _price(cand) - (_price(cur) if cur else 0)
                need = required_wattage(build.get("CPU"), cand)
                p0 = build.get("Alimentation")
                newp, extra = None, 0.0
                if p0 is None or psu_wattage(p0) < need:
                    newp = _pick_psu(cache, need, (_price(p0) if p0 else 0) + left - delta)
                    if newp is None:
                        continue
                    extra = _price(newp) - (_price(p0) if p0 else 0)
                if delta + extra > left + 1:
                    continue
                build["GPU"] = cand
                if newp is not None:
                    build["Alimentation"] = newp
                moved = True
                break
            if slot == "PLATFORM" and "CPU" in build and "Carte mere" in build:
                c0, m0 = build["CPU"], build["Carte mere"]
                base = _price(c0) + _price(m0)
                nc, nm = _pick_platform(cache, 1e12, 1e12, base + left,
                                        socket=mb_socket(m0), ddr=mb_ddr(m0))
                if nc is None or _price(nc) + _price(nm) <= base:
                    continue
                delta = _price(nc) + _price(nm) - base
                need = required_wattage(nc, build.get("GPU"))
                p0 = build.get("Alimentation")
                newp, extra = None, 0.0
                if p0 is not None and psu_wattage(p0) < need:
                    newp = _pick_psu(cache, need, _price(p0) + left - delta)
                    if newp is None:
                        continue
                    extra = _price(newp) - _price(p0)
                if delta + extra > left + 1:
                    continue
                build["CPU"], build["Carte mere"] = nc, nm
                if newp is not None:
                    build["Alimentation"] = newp
                moved = True
                break
            if slot == "RAM" and "RAM" in build:
                r0 = build["RAM"]
                cand = _pick_ram(cache, ddr, _price(r0) + left, max(target_gb, ram_gb(r0)))
                if cand is None or _price(cand) <= _price(r0):
                    continue
                if ram_gb(cand) < ram_gb(r0):
                    continue
                build["RAM"] = cand
                moved = True
                break
            if slot == "Stockage" and "Stockage" in build:
                s0 = build["Stockage"]
                cand = _pick_storage(cache, _price(s0) + left)
                if cand is None or _price(cand) <= _price(s0):
                    continue
                if (storage_rank(cand), storage_gb(cand)) < (storage_rank(s0), storage_gb(s0)):
                    continue
                build["Stockage"] = cand
                moved = True
                break
            if slot == "Boitier" and "Boitier" not in build:
                cand = _pick_case(cache, left)
                if cand is not None:
                    build["Boitier"] = cand
                    moved = True
                    break
        if not moved:
            break

    # ---- rapport de compatibilite ----
    cpu, mb = build.get("CPU"), build.get("Carte mere")
    ram, psu = build.get("RAM"), build.get("Alimentation")
    gpu = build.get("GPU")
    socket = mb_socket(mb) if mb else (cpu_socket(cpu) if cpu else "")
    ddr = mb_ddr(mb) if mb else ""
    need_w = required_wattage(cpu, gpu)
    total = spent()
    checks: list[dict] = []
    ok = True

    if cpu is not None and mb is not None:
        good = cpu_socket(cpu) == mb_socket(mb)
        ok &= good
        checks.append({"rule": "R1 socket CPU/carte mere", "ok": good,
                       "detail": f"{cpu_socket(cpu)} vs {mb_socket(mb)}"})
    else:
        ok = False
        checks.append({"rule": "R1 plateforme complete", "ok": False,
                       "detail": "CPU ou carte mere manquant"})
    if ram is not None and mb is not None:
        rd, md = ram_ddr(ram), mb_ddr(mb)
        good = (not rd) or (not md) or rd == md
        ok &= good
        checks.append({"rule": "R2 generation RAM", "ok": good,
                       "detail": f"{rd or '?'} vs {md or '?'}"})
    if psu is not None:
        good = psu_wattage(psu) >= need_w
        ok &= good
        checks.append({"rule": "R3 puissance PSU", "ok": good,
                       "detail": f"{psu_wattage(psu)}W >= {need_w}W"})
    if build.get("Boitier") is not None:
        good = is_real_case(build["Boitier"])
        ok &= good
        checks.append({"rule": "R4 boitier reel", "ok": good,
                       "detail": str(build["Boitier"].get("name"))})
    if build.get("Stockage") is not None:
        good = storage_rank(build["Stockage"]) > 0
        ok &= good
        checks.append({"rule": "R5 disque interne", "ok": good,
                       "detail": str(build["Stockage"].get("name"))})
    good = total <= budget
    ok &= good
    checks.append({"rule": "R6 budget", "ok": good,
                   "detail": f"{total:.0f} <= {budget:.0f}"})

    ordered = [c for c in ["CPU", "Carte mere", "RAM", "GPU", "Stockage",
                           "Alimentation", "Boitier"] if c in build]
    items = [_clean(build[c]) for c in ordered]
    return {
        "usage": usage, "budget": budget,
        "total": round(total, 2), "estimated_total": round(total, 2),
        "within_budget": total <= budget,
        "build": items, "count": len(items), "slots_filled": len(items),
        "slots": {c: str(build[c].get("name") or "") for c in ordered},
        "missing_slots": [c for c in cats if c not in build],
        "remaining_budget": round(budget - total, 2),
        "budget_used_pct": round(100.0 * total / budget, 1) if budget else 0.0,
        "compatibility": {"ok": bool(ok), "socket": socket, "memory": ddr,
                          "ram_gb": ram_gb(ram) if ram else 0,
                          "psu_wattage": psu_wattage(psu) if psu else 0,
                          "psu_required_w": need_w, "checks": checks},
        "warnings": warnings,
    }
