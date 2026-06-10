#!/usr/bin/env python3
"""
Scrapes per-club career stats from afltables.com
- Only players from 1970s onwards
- Broad position(s) fetched from footywire profile page (supports dual positions)
- Height + weight fetched from footywire for forward pocket classification
- Specific position inferred from comprehensive stat ratios
- Players appear once per club per decade they played for
Run: python3 scraper/scrape_players.py
Output: backend/data/players.json
"""

import json, time, re
import requests
from bs4 import BeautifulSoup
from pathlib import Path

BASE       = "https://afltables.com/afl"
FW_BASE    = "https://www.footywire.com/afl/footy"
OUT        = Path(__file__).parent.parent / "backend" / "data" / "players.json"
FW_CACHE_F = Path(__file__).parent.parent / "backend" / "data" / "fw_position_cache.json"
PROGRESS_F = Path(__file__).parent.parent / "backend" / "data" / "scrape_progress.json"

def load_fw_cache() -> dict:
    if FW_CACHE_F.exists():
        with open(FW_CACHE_F) as f:
            return json.load(f)
    return {}

def save_fw_cache(cache: dict) -> None:
    FW_CACHE_F.parent.mkdir(parents=True, exist_ok=True)
    with open(FW_CACHE_F, "w") as f:
        json.dump(cache, f)

def load_progress() -> dict:
    if PROGRESS_F.exists():
        with open(PROGRESS_F) as f:
            return json.load(f)
    return {"done_clubs": [], "players": []}

def save_progress(progress: dict) -> None:
    PROGRESS_F.parent.mkdir(parents=True, exist_ok=True)
    with open(PROGRESS_F, "w") as f:
        json.dump(progress, f)

CLUBS = {
    "adelaide":    "Adelaide",
    "brisbaneb":   "Brisbane Bears",
    "brisbanel":   "Brisbane Lions",
    "carlton":     "Carlton",
    "collingwood": "Collingwood",
    "essendon":    "Essendon",
    "fitzroy":     "Fitzroy",
    "fremantle":   "Fremantle",
    "geelong":     "Geelong",
    "goldcoast":   "Gold Coast",
    "gws":         "GWS Giants",
    "hawthorn":    "Hawthorn",
    "melbourne":   "Melbourne",
    "kangaroos":   "North Melbourne",
    "padelaide":   "Port Adelaide",
    "richmond":    "Richmond",
    "stkilda":     "St Kilda",
    "swans":       "Sydney",
    "westcoast":   "West Coast",
    "bullldogs":   "Western Bulldogs",
}

TEAM_NAME_MAP = {
    "Adelaide": "Adelaide",
    "Brisbane Bears": "Brisbane Bears",
    "Brisbane Lions": "Brisbane Lions",
    "Carlton": "Carlton",
    "Collingwood": "Collingwood",
    "Essendon": "Essendon",
    "Fitzroy": "Fitzroy",
    "Fremantle": "Fremantle",
    "Geelong": "Geelong",
    "Gold Coast": "Gold Coast",
    "Gws": "GWS Giants",
    "GWS": "GWS Giants",
    "Greater Western Sydney": "GWS Giants",
    "Hawthorn": "Hawthorn",
    "Melbourne": "Melbourne",
    "Kangaroos": "North Melbourne",
    "North Melbourne": "North Melbourne",
    "Port Adelaide": "Port Adelaide",
    "Richmond": "Richmond",
    "St Kilda": "St Kilda",
    "Sydney": "Sydney",
    "West Coast": "West Coast",
    "Western Bulldogs": "Western Bulldogs",
    "Footscray": "Western Bulldogs",
}

FW_CLUB_SLUG = {
    "Adelaide":          "adelaide-crows",
    "Brisbane Bears":    "brisbane-bears",
    "Brisbane Lions":    "brisbane-lions",
    "Carlton":           "carlton-blues",
    "Collingwood":       "collingwood-magpies",
    "Essendon":          "essendon-bombers",
    "Fitzroy":           "fitzroy-lions",
    "Fremantle":         "fremantle-dockers",
    "Geelong":           "geelong-cats",
    "Gold Coast":        "gold-coast-suns",
    "GWS Giants":        "greater-western-sydney-giants",
    "Hawthorn":          "hawthorn-hawks",
    "Melbourne":         "melbourne-demons",
    "North Melbourne":   "kangaroos",
    "Port Adelaide":     "port-adelaide-power",
    "Richmond":          "richmond-tigers",
    "St Kilda":          "st-kilda-saints",
    "Sydney":            "sydney-swans",
    "West Coast":        "west-coast-eagles",
    "Western Bulldogs":  "western-bulldogs",
}

MIN_YEAR            = 1970
MIN_GAMES_PER_STINT = 20

FW_BROAD_MAP = {
    "midfielder": "MID",
    "midfield":   "MID",
    "forward":    "FWD",
    "ruck":       "RUC",
    "defender":   "DEF",
    "defence":    "DEF",
}

def _parse_fw_positions(raw: str) -> list[str]:
    raw = raw.strip().lower()
    raw = re.sub(r"\s*[/,]\s*", "/", raw)
    parts = [p.strip() for p in raw.split("/")]
    broads = []
    for p in parts:
        code = FW_BROAD_MAP.get(p)
        if code and code not in broads:
            broads.append(code)
    return broads

def _name_to_fw_slug(name: str) -> str:
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9 ]", "", slug)
    return slug.strip().replace(" ", "-")

def fetch_fw_profile(name: str, clubs: list[str], fw_cache: dict) -> dict:
    """
    Returns dict: { broads: list[str], height_cm: int|None, weight_kg: int|None }
    Cached per player name. "MISS" sentinel means already tried, got nothing.
    """
    cache_key = name.lower()
    if cache_key in fw_cache:
        val = fw_cache[cache_key]
        if val == "MISS" or not isinstance(val, dict):
            return {"broads": [], "height_cm": None, "weight_kg": None}
        return val

    result = None
    for i, club in enumerate(clubs):
        fw_club = FW_CLUB_SLUG.get(club)
        if not fw_club:
            continue
        url = f"{FW_BASE}/pp-{fw_club}--{_name_to_fw_slug(name)}"
        try:
            r = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
            if r.status_code != 200:
                continue
        except Exception:
            continue

        soup = BeautifulSoup(r.text, "html.parser")
        profile_div = soup.find(id="playerProfileData2")
        if not profile_div:
            continue
        text = profile_div.get_text(" ", strip=True)

        broads = []
        pos_m = re.search(r"Position[:\s]+([A-Za-z/,\s]+?)(?:\s+Height|\s+Weight|\s+Draft|$)", text, re.IGNORECASE)
        if pos_m:
            broads = _parse_fw_positions(pos_m.group(1))

        height_cm = None
        h_m = re.search(r"Height[:\s]+(\d{2,3})\s*cm", text, re.IGNORECASE)
        if h_m:
            height_cm = int(h_m.group(1))

        weight_kg = None
        w_m = re.search(r"Weight[:\s]+(\d{2,3})\s*kg", text, re.IGNORECASE)
        if w_m:
            weight_kg = int(w_m.group(1))

        if broads or height_cm:
            result = {"broads": broads, "height_cm": height_cm, "weight_kg": weight_kg}
            break

        if i < len(clubs) - 1:
            time.sleep(0.15)

    fw_cache[cache_key] = result if result is not None else "MISS"
    return result if result is not None else {"broads": [], "height_cm": None, "weight_kg": None}


# ── Position inference ──────────────────────────────────────────────────────

def _r(a: float, b: float) -> float:
    """Safe ratio."""
    return a / b if b > 0 else 0.0

def infer_specific_position(
    broad: str,
    goals: float, hitouts: float, disposals: float,
    marks: float, tackles: float, kicks: float,
    handballs: float, inside50s: float,
    clearances: float, rebounds: float,
    height_cm: int | None = None,
    weight_kg: int | None = None,
) -> tuple[str, str | None]:
    kick_ratio     = _r(kicks, disposals)
    handball_ratio = _r(handballs, disposals)
    td_ratio       = _r(tackles, disposals)
    gd_ratio       = _r(goals, disposals)
    hd_ratio       = _r(hitouts, disposals)
    md_ratio       = _r(marks, disposals)
    rd_ratio       = _r(rebounds, disposals)
    i50d_ratio     = _r(inside50s, disposals)

    short_fwd = height_cm is not None and height_cm < 190
    light_fwd = weight_kg is not None and weight_kg < 82
    tall_fwd  = height_cm is not None and height_cm >= 190
    heavy_fwd = weight_kg is not None and weight_kg >= 95

    # ── RUC ────────────────────────────────────────────────────────────────
    if broad == "RUC":
        if hd_ratio >= 1.5 or hitouts >= 20:
            return "RUC", None
        if hitouts >= 8 and (clearances >= 3 or disposals >= 15 or handball_ratio >= 0.40):
            return "RUC", "MID"
        if hitouts >= 8 and (marks >= 4 or md_ratio >= 0.25):
            return "RUC", "CHB"
        if md_ratio >= 0.25 or marks >= 4:
            return "RUC", "CHB"
        return "RUC", None

    # ── FWD ────────────────────────────────────────────────────────────────
    if broad == "FWD":
        if short_fwd or light_fwd:
            if gd_ratio >= 0.12 or goals >= 1.5:
                return "FP", "HFF"
            return "FP", None

        if tall_fwd or heavy_fwd:
            if gd_ratio >= 0.18 or goals >= 2.5:
                return "FF", None
            if goals >= 1.5 and (marks >= 5 or md_ratio >= 0.30):
                return "FF", "CHF"
            if md_ratio >= 0.35 or marks >= 6:
                return "CHF", "FF"
            return "CHF", None

        if gd_ratio >= 0.20 and md_ratio >= 0.20:
            return "FF", None
        if goals >= 3.5 and marks >= 4:
            return "FF", None
        if goals >= 3.5:
            return "FF", "CHF"
        if goals >= 2.8 and (marks >= 4 or md_ratio >= 0.25):
            return "FF", "CHF"
        if goals >= 2.5:
            return "FF", "FP"
        if goals >= 2.0 and kick_ratio < 0.60 and handball_ratio >= 0.40:
            return "FP", "HFF"
        if goals >= 1.8 and disposals < 16:
            return "FP", None
        if goals >= 1.5 and (marks >= 6 or md_ratio >= 0.35):
            return "CHF", None
        if goals >= 1.5 and marks >= 5:
            return "CHF", "FF"
        if goals >= 1.2 and marks >= 5 and i50d_ratio >= 0.18:
            return "CHF", "HFF"
        if goals >= 1.0 and (marks >= 6 or md_ratio >= 0.35):
            return "CHF", "HFF"
        if i50d_ratio >= 0.20 and kick_ratio >= 0.55 and goals >= 0.8:
            return "HFF", "WNG"
        if goals >= 0.7 and marks >= 4 and disposals >= 14:
            return "HFF", "CHF"
        if i50d_ratio >= 0.18 and goals >= 0.6:
            return "HFF", None
        if marks >= 4 or md_ratio >= 0.25:
            return "CHF", None
        return "FP", None

    # ── MID ────────────────────────────────────────────────────────────────
    if broad == "MID":
        if clearances >= 6 and tackles >= 5:
            return "MID", None
        if clearances >= 5 and td_ratio >= 0.18:
            return "MID", "WNG"
        if clearances >= 5 and tackles >= 4:
            return "MID", "WNG"
        if clearances >= 4 and disposals >= 20:
            return "MID", "WNG"
        if td_ratio >= 0.22 and disposals >= 18:
            return "MID", "HBF"
        if handball_ratio >= 0.45 and tackles >= 4 and clearances >= 3:
            return "MID", "WNG"
        if disposals >= 22 and td_ratio >= 0.12:
            return "MID", "WNG"
        if kick_ratio >= 0.65 and i50d_ratio >= 0.18 and clearances < 3:
            return "WNG", None
        if kick_ratio >= 0.62 and i50d_ratio >= 0.15 and gd_ratio >= 0.03:
            return "WNG", "MID"
        if disposals >= 18 and kick_ratio >= 0.55 and rd_ratio < 0.08:
            return "WNG", "MID"
        if td_ratio >= 0.18 and clearances >= 2 and rd_ratio >= 0.06:
            return "MID", "HBF"
        return "MID", None

    # ── DEF ────────────────────────────────────────────────────────────────
    if broad == "DEF":
        if rd_ratio >= 0.25 and goals < 0.2:
            return "FB", None
        if rebounds >= 5 and goals < 0.2:
            return "FB", None
        if rebounds >= 4 and goals < 0.4:
            return "FB", "CHB"
        if rd_ratio >= 0.15 and goals < 0.2 and md_ratio >= 0.20:
            return "FB", "CHB"
        if md_ratio >= 0.40 and goals < 0.4:
            return "CHB", None
        if marks >= 7 and goals < 0.4:
            return "CHB", None
        if marks >= 6 and goals < 0.5 and rd_ratio >= 0.08:
            return "CHB", "FB"
        if md_ratio >= 0.30 and goals < 0.6 and disposals >= 15:
            return "CHB", "HBF"
        if rd_ratio >= 0.10 and md_ratio >= 0.22 and goals < 0.5:
            return "CHB", "HBF"
        if rd_ratio >= 0.10 and goals < 0.5 and disposals >= 14:
            return "HBF", "MID"
        if kick_ratio >= 0.58 and goals < 0.4 and md_ratio >= 0.18:
            return "HBF", "CHB"
        if goals < 0.4 and disposals >= 16 and td_ratio >= 0.15:
            return "HBF", None
        if goals < 0.3 and rd_ratio >= 0.06 and md_ratio >= 0.15:
            return "BP", "HBF"
        if goals < 0.25 and disposals >= 12:
            return "BP", None
        return "HBF", None

    return "MID", None


def infer_positions_fallback(
    goals: float, hitouts: float, disposals: float,
    marks: float, tackles: float, kicks: float,
    handballs: float, inside50s: float,
    clearances: float, rebounds: float,
    height_cm: int | None = None,
    weight_kg: int | None = None,
) -> tuple[str, str | None]:
    """Full ratio fallback when footywire lookup fails — infers broad AND specific."""
    kick_ratio     = _r(kicks, disposals)
    handball_ratio = _r(handballs, disposals)
    td_ratio       = _r(tackles, disposals)
    gd_ratio       = _r(goals, disposals)
    hd_ratio       = _r(hitouts, disposals)
    md_ratio       = _r(marks, disposals)
    rd_ratio       = _r(rebounds, disposals)
    i50d_ratio     = _r(inside50s, disposals)

    short_fwd = height_cm is not None and height_cm < 190
    light_fwd = weight_kg is not None and weight_kg < 82
    tall_fwd  = height_cm is not None and height_cm >= 190
    heavy_fwd = weight_kg is not None and weight_kg >= 95

    if hd_ratio >= 1.5 or hitouts >= 20:                                    return "RUC", None
    if hitouts >= 8 and (clearances >= 3 or handball_ratio >= 0.40):        return "RUC", "MID"
    if hitouts >= 8 and (md_ratio >= 0.25 or marks >= 4):                   return "RUC", "CHB"
    if hitouts >= 4 and hd_ratio >= 0.30:                                   return "RUC", None

    if short_fwd or light_fwd:
        if gd_ratio >= 0.12 or goals >= 1.5:                                return "FP", "HFF"
        if goals >= 0.5:                                                     return "FP", None
    if tall_fwd or heavy_fwd:
        if gd_ratio >= 0.18 or goals >= 2.5:                                return "FF", None
        if goals >= 1.5 and (md_ratio >= 0.30 or marks >= 5):               return "FF", "CHF"
        if md_ratio >= 0.35 and goals >= 0.8:                               return "CHF", "FF"

    if gd_ratio >= 0.20 and md_ratio >= 0.20:                               return "FF", None
    if goals >= 3.5 and marks >= 4:                                         return "FF", None
    if goals >= 3.5:                                                         return "FF", "CHF"
    if goals >= 2.8 and md_ratio >= 0.25:                                   return "FF", "CHF"
    if goals >= 2.5 and i50d_ratio >= 0.20:                                 return "FF", "FP"
    if goals >= 2.0 and kick_ratio < 0.60 and handball_ratio >= 0.40:       return "FP", "HFF"
    if goals >= 1.8 and disposals < 16:                                     return "FP", None
    if goals >= 1.5 and (md_ratio >= 0.35 or marks >= 6):                   return "CHF", None
    if goals >= 1.5 and marks >= 5:                                         return "CHF", "FF"
    if goals >= 1.2 and marks >= 5 and i50d_ratio >= 0.18:                  return "CHF", "HFF"
    if goals >= 1.0 and (md_ratio >= 0.35 or marks >= 6):                   return "CHF", "HFF"
    if i50d_ratio >= 0.20 and kick_ratio >= 0.55 and goals >= 0.8:          return "HFF", "WNG"
    if goals >= 0.7 and md_ratio >= 0.22 and disposals >= 14:               return "HFF", "CHF"
    if i50d_ratio >= 0.18 and goals >= 0.6:                                 return "HFF", None
    if kick_ratio >= 0.65 and i50d_ratio >= 0.18 and clearances < 3:        return "WNG", None
    if kick_ratio >= 0.62 and i50d_ratio >= 0.15 and td_ratio < 0.15:       return "WNG", "HFF"
    if disposals >= 18 and kick_ratio >= 0.55 and goals < 0.8 and rd_ratio < 0.08: return "WNG", "MID"
    if clearances >= 6 and tackles >= 5:                                    return "MID", None
    if clearances >= 5 and td_ratio >= 0.18:                                return "MID", "WNG"
    if clearances >= 4 and disposals >= 20:                                 return "MID", "WNG"
    if td_ratio >= 0.22 and disposals >= 18:                                return "MID", "HBF"
    if handball_ratio >= 0.45 and tackles >= 4 and clearances >= 3:         return "MID", "WNG"
    if disposals >= 22 and td_ratio >= 0.12:                                return "MID", "WNG"
    if rd_ratio >= 0.25 and goals < 0.2:                                    return "FB", None
    if rebounds >= 5 and goals < 0.2:                                       return "FB", None
    if rebounds >= 4 and goals < 0.4:                                       return "FB", "CHB"
    if rd_ratio >= 0.15 and goals < 0.2 and md_ratio >= 0.20:               return "FB", "CHB"
    if md_ratio >= 0.40 and goals < 0.4:                                    return "CHB", None
    if marks >= 7 and goals < 0.4:                                          return "CHB", None
    if marks >= 6 and goals < 0.5 and rd_ratio >= 0.08:                     return "CHB", "FB"
    if md_ratio >= 0.30 and goals < 0.6 and disposals >= 15:                return "CHB", "HBF"
    if rd_ratio >= 0.10 and md_ratio >= 0.22 and goals < 0.5:               return "CHB", "HBF"
    if rd_ratio >= 0.10 and goals < 0.5 and disposals >= 14:                return "HBF", "MID"
    if kick_ratio >= 0.58 and goals < 0.4 and md_ratio >= 0.18:             return "HBF", "CHB"
    if goals < 0.4 and disposals >= 16 and td_ratio >= 0.15:                return "HBF", None
    if goals < 0.3 and rd_ratio >= 0.06 and md_ratio >= 0.15:               return "BP", "HBF"
    if goals < 0.25 and disposals >= 12:                                    return "BP", None
    if goals >= 1.0:                                                         return "HFF", None
    if goals >= 0.5:                                                         return "WNG", None
    if goals >= 0.3:                                                         return "MID", None
    if md_ratio >= 0.25:                                                     return "CHB", None
    if disposals >= 15:                                                      return "HBF", None
    return "BP", None


# ── afltables scraping ──────────────────────────────────────────────────────

def get_player_list(slug: str) -> list[tuple[str, str, int]]:
    url = f"{BASE}/stats/alltime/{slug}.html"
    try:
        r = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
    except Exception as e:
        print(f"  SKIP {slug}: {e}")
        return []

    soup = BeautifulSoup(r.text, "html.parser")
    table = soup.find("table")
    if not table:
        return []

    results = []
    for row in table.find_all("tr"):
        cells = row.find_all("td")
        if len(cells) < 9:
            continue
        try:
            name_cell = cells[2]
            link = name_cell.find("a")
            if not link:
                continue
            href = link.get("href", "")
            if not href:
                continue

            name = name_cell.get_text(strip=True)
            if "," in name:
                parts = name.split(",", 1)
                name = f"{parts[1].strip()} {parts[0].strip()}"

            seasons_str = cells[8].get_text(strip=True)
            years = [int(y) for y in re.findall(r'\d{4}', seasons_str)]
            if not years or max(years) < MIN_YEAR:
                continue

            games_str = cells[6].get_text(strip=True)
            games_m = re.match(r'(\d+)', games_str)
            games = int(games_m.group(1)) if games_m else 0
            if games < MIN_GAMES_PER_STINT:
                continue

            if href.startswith("../../"):
                href = "https://afltables.com/afl/" + href.replace("../../", "")
            elif href.startswith("../"):
                href = "https://afltables.com/afl/stats/" + href.replace("../", "")
            elif href.startswith("/"):
                href = f"https://afltables.com{href}"
            elif not href.startswith("http"):
                href = f"https://afltables.com/afl/stats/{href}"

            results.append((name, href, games))
        except Exception:
            continue

    return results


def resolve_primary_broad(broads: list[str], stat_args: tuple) -> str:
    """
    When footywire lists multiple broad positions, use stats to determine
    which broad is actually primary.
    """
    if len(broads) == 1:
        return broads[0]

    (goals_pg, hitouts_pg, disposals_pg, marks_pg, tackles_pg,
     kicks_pg, handballs_pg, inside50s_pg, clearances_pg, rebounds_pg,
     height_cm, weight_kg) = stat_args

    b = set(broads)

    # RUC/FWD — only treat as RUC if genuine ruck
    if "RUC" in b and "FWD" in b:
        return "RUC" if hitouts_pg >= 15 else "FWD"

    # RUC/MID — hitouts decide
    if "RUC" in b and "MID" in b:
        return "RUC" if hitouts_pg >= 8 else "MID"

    # MID/FWD or FWD/MID
    if "MID" in b and "FWD" in b:
        mid_score = clearances_pg * 2 + tackles_pg
        fwd_score = goals_pg * 3 + inside50s_pg
        return "MID" if mid_score >= fwd_score else "FWD"

    # DEF/MID or MID/DEF
    if "DEF" in b and "MID" in b:
        def_score = rebounds_pg * 2 + marks_pg
        mid_score = clearances_pg * 2 + tackles_pg + disposals_pg * 0.3
        return "DEF" if def_score >= mid_score else "MID"

    # DEF/FWD — rare, use goals vs rebounds
    if "DEF" in b and "FWD" in b:
        return "FWD" if goals_pg >= 0.8 else "DEF"

    # fallback to first listed
    return broads[0]


def get_secondary_broad(broads: list[str], primary: str) -> str | None:
    others = [b for b in broads if b != primary]
    return others[0] if others else None


def scrape_player_by_club_and_decade(name: str, url: str, fw_cache: dict) -> list[dict]:
    try:
        r = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
    except Exception:
        return []

    soup = BeautifulSoup(r.text, "html.parser")
    tables = soup.find_all("table")
    club_decade_stats: dict[str, dict[str, dict]] = {}

    for table in tables:
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue

        header = rows[0].find_all(["th", "td"])
        cols = [h.get_text(strip=True).upper() for h in header]

        if "KI" not in cols and "DI" not in cols:
            continue

        def col_idx(names):
            for n in names:
                for i, c in enumerate(cols):
                    if c == n:
                        return i
            return None

        idx_team = col_idx(["TEAM"])
        idx_year = col_idx(["YEAR"])
        idx_gm   = col_idx(["GM"])
        idx_ki   = col_idx(["KI"])
        idx_mk   = col_idx(["MK"])
        idx_hb   = col_idx(["HB"])
        idx_di   = col_idx(["DI"])
        idx_gl   = col_idx(["GL"])
        idx_ho   = col_idx(["HO"])
        idx_ta   = col_idx(["TK", "TA"])
        idx_cl   = col_idx(["CL"])
        idx_i50  = col_idx(["IF"])
        idx_rb   = col_idx(["RB"])

        if idx_team is None or idx_year is None:
            continue

        for row in rows[1:]:
            cells = row.find_all("td")
            if not cells:
                continue

            def cell(idx):
                if idx is None or idx >= len(cells):
                    return ""
                return cells[idx].get_text(strip=True)

            year_str = cell(idx_year)
            if not re.match(r'^\d{4}$', year_str):
                continue
            year = int(year_str)
            if year < MIN_YEAR:
                continue

            decade = f"{(year // 10) * 10}s"
            team_raw = cell(idx_team)
            team = TEAM_NAME_MAP.get(team_raw, team_raw)
            if team not in CLUBS.values():
                continue

            def fval(idx):
                v = cell(idx)
                try:
                    return float(v.replace(",", ""))
                except:
                    return 0.0

            season_games = int(fval(idx_gm)) if idx_gm is not None else 1
            if season_games <= 0:
                season_games = 1

            if team not in club_decade_stats:
                club_decade_stats[team] = {}
            if decade not in club_decade_stats[team]:
                club_decade_stats[team][decade] = {
                    "gp": 0, "ki": 0.0, "mk": 0.0, "hb": 0.0, "di": 0.0,
                    "gl": 0.0, "ho": 0.0, "ta": 0.0, "cl": 0.0,
                    "i50": 0.0, "rb": 0.0,
                }

            s = club_decade_stats[team][decade]
            s["gp"]  += season_games
            s["ki"]  += fval(idx_ki)
            s["mk"]  += fval(idx_mk)
            s["hb"]  += fval(idx_hb)
            s["di"]  += fval(idx_di) or (fval(idx_ki) + fval(idx_hb))
            s["gl"]  += fval(idx_gl)
            s["ho"]  += fval(idx_ho)
            s["ta"]  += fval(idx_ta)
            s["cl"]  += fval(idx_cl)
            s["i50"] += fval(idx_i50)
            s["rb"]  += fval(idx_rb)

        break

    # Footywire profile — position + height + weight
    all_clubs = list(club_decade_stats.keys())
    profile = fetch_fw_profile(name, all_clubs, fw_cache)
    fw_broads  = profile["broads"]
    height_cm  = profile["height_cm"]
    weight_kg  = profile["weight_kg"]

    players = []
    for club, decades in club_decade_stats.items():
        for decade, s in decades.items():
            gp = s["gp"]
            if gp < MIN_GAMES_PER_STINT:
                continue

            def avg(total: float) -> float:
                return round(total / gp, 2) if gp > 0 else 0.0

            goals_pg      = avg(s["gl"])
            disposals_pg  = avg(s["di"])
            marks_pg      = avg(s["mk"])
            tackles_pg    = avg(s["ta"])
            hitouts_pg    = avg(s["ho"])
            clearances_pg = avg(s["cl"])
            inside50s_pg  = avg(s["i50"])
            kicks_pg      = avg(s["ki"])
            handballs_pg  = avg(s["hb"])
            rebounds_pg   = avg(s["rb"])

            stat_args = (
                goals_pg, hitouts_pg, disposals_pg, marks_pg, tackles_pg,
                kicks_pg, handballs_pg, inside50s_pg, clearances_pg, rebounds_pg,
                height_cm, weight_kg,
            )

            if fw_broads:
                primary_broad = resolve_primary_broad(fw_broads, stat_args)
                position, secondary = infer_specific_position(primary_broad, *stat_args)
                broad_position = primary_broad

                # If no secondary from specific inference, derive from second broad
                if secondary is None:
                    sec_broad = get_secondary_broad(fw_broads, primary_broad)
                    if sec_broad:
                        sec_pos, _ = infer_specific_position(sec_broad, *stat_args)
                        secondary = sec_pos
            else:
                # Full fallback
                position, secondary = infer_positions_fallback(*stat_args)
                FWD_SPECIFICS = {"FF", "FP", "CHF", "HFF"}
                DEF_SPECIFICS = {"FB", "BP", "CHB", "HBF"}
                if position in FWD_SPECIFICS:
                    broad_position = "FWD"
                elif position in DEF_SPECIFICS:
                    broad_position = "DEF"
                elif position == "RUC":
                    broad_position = "RUC"
                else:
                    broad_position = "MID"

            players.append({
                "name":              name,
                "club":              club,
                "decade":            decade,
                "games":             gp,
                "goals":             goals_pg,
                "disposals":         disposals_pg,
                "marks":             marks_pg,
                "tackles":           tackles_pg,
                "hitouts":           hitouts_pg,
                "clearances":        clearances_pg,
                "inside50s":         inside50s_pg,
                "kicks":             kicks_pg,
                "handballs":         handballs_pg,
                "rebounds":          rebounds_pg,
                "broadPosition":     broad_position,
                "position":          position,
                "secondaryPosition": secondary,
            })

    return players


def main():
    fw_cache = load_fw_cache()
    progress = load_progress()

    done_clubs  = set(progress["done_clubs"])
    all_players = progress["players"]
    seen: set[tuple[str, str, str]] = {
        (p["name"].lower(), p["club"], p["decade"]) for p in all_players
    }
    failed = 0

    if done_clubs:
        print(f"Resuming — {len(done_clubs)} clubs already done, "
              f"{len(all_players)} records loaded, "
              f"{len(fw_cache)} players in fw cache")

    for slug, club_name in CLUBS.items():
        if slug in done_clubs:
            print(f"  SKIP {club_name} (already done)")
            continue

        print(f"\n── {club_name} ──")
        player_list = get_player_list(slug)
        print(f"  Found {len(player_list)} players (1970s+)")
        time.sleep(0.05)

        for i, (name, url, _) in enumerate(player_list):
            cached = name.lower() in fw_cache
            records = scrape_player_by_club_and_decade(name, url, fw_cache)

            added = 0
            for record in records:
                key = (name.lower(), record["club"], record["decade"])
                if key not in seen:
                    seen.add(key)
                    all_players.append(record)
                    added += 1

            if not records:
                failed += 1

            if (i + 1) % 25 == 0:
                print(f"  {i + 1}/{len(player_list)} "
                      f"({len(all_players)} records, "
                      f"{len(fw_cache)} fw cached)...")
                save_fw_cache(fw_cache)

            if not cached:
                time.sleep(0.05)
            else:
                time.sleep(0.02)

        done_clubs.add(slug)
        progress["done_clubs"] = list(done_clubs)
        progress["players"] = all_players
        save_progress(progress)
        save_fw_cache(fw_cache)
        print(f"  ✓ {club_name} done")

    print(f"\nTotal: {len(all_players)} records ({failed} failed)")
    print(f"  Footywire cache size: {len(fw_cache)} players")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(all_players, f, indent=2)
    print(f"Saved → {OUT}")

    if PROGRESS_F.exists():
        PROGRESS_F.unlink()
        print("Progress file cleaned up.")


if __name__ == "__main__":
    main()