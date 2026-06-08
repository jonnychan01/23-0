#!/usr/bin/env python3
"""
Scrapes per-club career stats from afltables.com
- Only players from 1970s onwards
- Broad position (FWD/MID/DEF/RK) fetched from footywire profile page
- Specific position within that group inferred from stat ratios
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

# ── Persistent footywire position cache ────────────────────────────────────
# Keyed by player name (lowercase). Value is the broad position string or
# the sentinel "MISS" meaning we already tried and got nothing.
# Each unique player is only ever fetched once from footywire,
# even across multiple clubs and across re-runs of the script.

def load_fw_cache() -> dict:
    if FW_CACHE_F.exists():
        with open(FW_CACHE_F) as f:
            return json.load(f)
    return {}

def save_fw_cache(cache: dict) -> None:
    FW_CACHE_F.parent.mkdir(parents=True, exist_ok=True)
    with open(FW_CACHE_F, "w") as f:
        json.dump(cache, f)

# ── Progress checkpoint ─────────────────────────────────────────────────────
# Saves completed club slugs so a re-run skips already-scraped clubs.

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

# Map footywire club slugs used in pp- URLs
# Format: pp-{fw_club_slug}--{player-name-slug}
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

MIN_YEAR             = 1970
MIN_GAMES_PER_STINT  = 20

# ── Footywire position lookup ───────────────────────────────────────────────

# Footywire uses these broad labels in #playerProfileData2
FW_POSITION_MAP = {
    "midfielder":       "MID",
    "midfield":         "MID",
    "forward":          "FWD",
    "ruck":             "RK",
    "defender":         "DEF",
    "defence":          "DEF",
    # hyphenated combos – take primary half
    "midfielder/forward":  "MID",
    "midfielder/defender": "MID",
    "forward/midfielder":  "FWD",
    "forward/defender":    "FWD",
    "ruck/forward":        "RK",
    "ruck/midfielder":     "RK",
    "defender/midfielder": "DEF",
    "defender/forward":    "DEF",
}


def _name_to_fw_slug(name: str) -> str:
    """Convert 'Gary Ablett' -> 'gary-ablett'."""
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9 ]", "", slug)
    slug = slug.strip().replace(" ", "-")
    return slug


def fetch_fw_position(name: str, clubs: list[str], fw_cache: dict) -> str | None:
    """
    Returns the broad position for a player from footywire, using a persistent
    cache so each player is only ever fetched once across all clubs and re-runs.

    fw_cache is mutated in place; caller should save it periodically.
    clubs is a list of clubs to try in order (player may only appear under one).
    """
    cache_key = name.lower()

    # Cache hit — "MISS" sentinel means we already tried and found nothing
    if cache_key in fw_cache:
        val = fw_cache[cache_key]
        return None if val == "MISS" else val

    # Try each club URL until we get a result
    result = None
    for i, club in enumerate(clubs):
        fw_club = FW_CLUB_SLUG.get(club)
        if not fw_club:
            continue

        player_slug = _name_to_fw_slug(name)
        url = f"{FW_BASE}/pp-{fw_club}--{player_slug}"

        try:
            r = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
            if r.status_code != 200:
                continue
        except Exception:
            continue

        soup = BeautifulSoup(r.text, "html.parser")
        profile_div = soup.find(id="playerProfileData2")
        text = profile_div.get_text(" ", strip=True) if profile_div else soup.get_text(" ", strip=True)

        m = re.search(r"Position[:\s]+([A-Za-z/\s]+)", text, re.IGNORECASE)
        if not m:
            continue

        raw = m.group(1).strip().lower()
        raw = re.sub(r"\s*/\s*", "/", raw)
        raw = re.sub(r"\s+", " ", raw).strip()

        pos = FW_POSITION_MAP.get(raw) or FW_POSITION_MAP.get(raw.split()[0] if raw else "")
        if pos:
            result = pos
            break

        # Small delay between club attempts for the same player
        if i < len(clubs) - 1:
            time.sleep(0.15)

    fw_cache[cache_key] = result if result is not None else "MISS"
    return result


# ── Specific position within each broad group ──────────────────────────────

def infer_specific_position(
    broad: str,  # 'FWD', 'MID', 'DEF', 'RK'
    goals_pg: float, hitouts_pg: float, disposals_pg: float,
    marks_pg: float, tackles_pg: float, kicks_pg: float,
    handballs_pg: float, inside50s_pg: float,
    clearances_pg: float, rebounds_pg: float,
) -> tuple[str, str | None]:
    """
    Returns (primary_specific, secondary_specific) within the confirmed broad group.
    The broad group is trusted (from footywire); ratios decide the specific slot.
    """
    gp = disposals_pg if disposals_pg > 0 else 1
    kick_ratio        = kicks_pg / gp
    handball_ratio    = handballs_pg / gp
    tackle_disp_ratio = tackles_pg / disposals_pg if disposals_pg > 0 else 0

    # ── RUCK ────────────────────────────────────────────────────────────────
    if broad == "RK":
        # Pure ruck: dominant hitouts, not much else
        if hitouts_pg >= 20:
            return "RK", None
        # Ruck/mid: meaningful midfield contribution alongside hitouts
        if hitouts_pg >= 8 and (clearances_pg >= 3 or disposals_pg >= 15):
            return "RK", "MID"
        # Ruck/defender: tall marking type who rests in defence
        if hitouts_pg >= 8 and marks_pg >= 4:
            return "RK", "CHB"
        # Part-time ruck — primary role is elsewhere but no hitout data to separate
        if marks_pg >= 4:
            return "RK", "CHB"
        return "RK", None

    # ── FORWARD ─────────────────────────────────────────────────────────────
    if broad == "FWD":
        # Dominant full forward — pure specialist
        if goals_pg >= 3.5 and marks_pg >= 4:
            return "FF", None
        if goals_pg >= 3.5:
            return "FF", "CHF"
        if goals_pg >= 2.8 and marks_pg >= 4:
            return "FF", "CHF"
        if goals_pg >= 2.5:
            return "FF", "FP"
        if goals_pg >= 2.0 and kick_ratio < 0.65:
            return "FP", "HFF"
        if goals_pg >= 1.8 and disposals_pg < 16:
            return "FP", None
        # CHF: tall marking forward who hits up
        if goals_pg >= 1.5 and marks_pg >= 6:
            return "CHF", None
        if goals_pg >= 1.5 and marks_pg >= 5:
            return "CHF", "FF"
        if goals_pg >= 1.2 and marks_pg >= 5 and inside50s_pg >= 3:
            return "CHF", "HFF"
        if goals_pg >= 1.0 and marks_pg >= 6:
            return "CHF", "HFF"
        # HFF: link player between mid and fwd
        if goals_pg >= 0.8 and inside50s_pg >= 3 and kick_ratio >= 0.55:
            return "HFF", "WNG"
        if goals_pg >= 0.7 and marks_pg >= 4 and disposals_pg >= 14:
            return "HFF", "CHF"
        if goals_pg >= 0.6 and inside50s_pg >= 3:
            return "HFF", None
        # Low-scoring forward
        if marks_pg >= 4:
            return "CHF", None
        return "FP", None

    # ── MIDFIELD ────────────────────────────────────────────────────────────
    if broad == "MID":
        # Pure inside mid: high clearances + high tackles
        if clearances_pg >= 6 and tackles_pg >= 5:
            return "MID", None
        if clearances_pg >= 5 and tackles_pg >= 4:
            return "MID", "WNG"
        if clearances_pg >= 4 and disposals_pg >= 20:
            return "MID", "WNG"
        # Contested mid who also provides defensive pressure
        if tackle_disp_ratio >= 0.20 and disposals_pg >= 18:
            return "MID", "HBF"
        if handball_ratio >= 0.45 and tackles_pg >= 4 and clearances_pg >= 3:
            return "MID", "WNG"
        if disposals_pg >= 22 and tackles_pg >= 3:
            return "MID", "WNG"
        # Pure winger: kick-dominant, high i50, low clearances
        if kick_ratio >= 0.65 and inside50s_pg >= 3 and clearances_pg < 3:
            return "WNG", None
        if kick_ratio >= 0.60 and goals_pg >= 0.3 and inside50s_pg >= 2:
            return "WNG", "MID"
        if disposals_pg >= 18 and kick_ratio >= 0.55 and rebounds_pg < 2:
            return "WNG", "MID"
        return "MID", None

    # ── DEFENDER ────────────────────────────────────────────────────────────
    if broad == "DEF":
        # Pure full back: very high rebounds, almost no goals
        if rebounds_pg >= 5 and goals_pg < 0.2:
            return "FB", None
        if rebounds_pg >= 4 and goals_pg < 0.4:
            return "FB", "CHB"
        if rebounds_pg >= 2 and goals_pg < 0.2 and marks_pg >= 4:
            return "FB", "CHB"
        # Pure CHB: dominant marking defender
        if marks_pg >= 7 and goals_pg < 0.4:
            return "CHB", None
        if marks_pg >= 6 and goals_pg < 0.5 and rebounds_pg >= 1.5:
            return "CHB", "FB"
        if marks_pg >= 5 and goals_pg < 0.6 and disposals_pg >= 15:
            return "CHB", "HBF"
        if rebounds_pg >= 2 and marks_pg >= 4 and goals_pg < 0.5:
            return "CHB", "HBF"
        # HBF: running / link defender
        if rebounds_pg >= 2 and goals_pg < 0.5 and disposals_pg >= 14:
            return "HBF", "MID"
        if kick_ratio >= 0.58 and goals_pg < 0.4 and marks_pg >= 3:
            return "HBF", "CHB"
        if goals_pg < 0.4 and disposals_pg >= 16 and tackles_pg >= 3:
            return "HBF", None
        # Back pocket
        if goals_pg < 0.3 and rebounds_pg >= 1 and marks_pg >= 2:
            return "BP", "HBF"
        if goals_pg < 0.25 and disposals_pg >= 12:
            return "BP", None
        return "HBF", None

    # Fallback (shouldn't reach here)
    return "MID", None


# ── Legacy fallback: infer both broad AND specific from ratios alone ────────
# Used when footywire lookup fails (historic players, URL not found, etc.)

def infer_positions_fallback(
    goals_pg: float, hitouts_pg: float, disposals_pg: float,
    marks_pg: float, tackles_pg: float, kicks_pg: float,
    handballs_pg: float, inside50s_pg: float,
    clearances_pg: float, rebounds_pg: float
) -> tuple[str, str | None]:
    """Original full ratio-based position inference (unchanged logic)."""
    gp = disposals_pg if disposals_pg > 0 else 1
    goal_rate         = goals_pg
    hitout_rate       = hitouts_pg
    kick_ratio        = kicks_pg / gp
    handball_ratio    = handballs_pg / gp
    mark_rate         = marks_pg
    tackle_rate       = tackles_pg
    clearance_rate    = clearances_pg
    rebound_rate      = rebounds_pg
    i50_rate          = inside50s_pg
    tackle_disp_ratio = tackle_rate / disposals_pg if disposals_pg > 0 else 0

    # ── Ruck ──
    if hitout_rate >= 20:                              return "RK", None
    if hitout_rate >= 8 and (clearance_rate >= 3 or disposals_pg >= 15):
                                                       return "RK", "MID"
    if hitout_rate >= 8 and mark_rate >= 4:            return "RK", "CHB"
    if hitout_rate >= 4 and disposals_pg < 15:         return "RK", None
    # ── Full Forward ──
    if goal_rate >= 3.5 and mark_rate >= 4:            return "FF", None
    if goal_rate >= 3.5:                               return "FF", "CHF"
    if goal_rate >= 2.8 and mark_rate >= 4:            return "FF", "CHF"
    if goal_rate >= 2.5 and i50_rate >= 4:             return "FF", "FP"
    # ── Forward Pocket ──
    if goal_rate >= 2.0 and kick_ratio < 0.65:         return "FP", "HFF"
    if goal_rate >= 1.8 and disposals_pg < 16:         return "FP", None
    # ── Centre Half Forward ──
    if goal_rate >= 1.5 and mark_rate >= 6:            return "CHF", None
    if goal_rate >= 1.5 and mark_rate >= 5:            return "CHF", "FF"
    if goal_rate >= 1.2 and mark_rate >= 5 and i50_rate >= 3: return "CHF", "HFF"
    if goal_rate >= 1.0 and mark_rate >= 6:            return "CHF", "HFF"
    # ── Half Forward Flank ──
    if goal_rate >= 0.8 and i50_rate >= 3 and kick_ratio >= 0.55: return "HFF", "WNG"
    if goal_rate >= 0.7 and mark_rate >= 4 and disposals_pg >= 14: return "HFF", "CHF"
    if goal_rate >= 0.6 and i50_rate >= 3:             return "HFF", None
    # ── Wing ──
    if kick_ratio >= 0.65 and i50_rate >= 3 and clearance_rate < 3:
                                                       return "WNG", None
    if kick_ratio >= 0.60 and goal_rate >= 0.3 and tackle_disp_ratio < 0.15 and i50_rate >= 2:
                                                       return "WNG", "HFF"
    if disposals_pg >= 18 and kick_ratio >= 0.55 and goal_rate < 0.8 and rebound_rate < 2:
                                                       return "WNG", "MID"
    # ── Midfielder ──
    if clearance_rate >= 6 and tackle_rate >= 5:       return "MID", None
    if clearance_rate >= 5 and tackle_rate >= 4:       return "MID", "WNG"
    if clearance_rate >= 4 and disposals_pg >= 20:     return "MID", "WNG"
    if tackle_disp_ratio >= 0.20 and disposals_pg >= 18: return "MID", "HBF"
    if handball_ratio >= 0.45 and tackle_rate >= 4 and clearance_rate >= 3: return "MID", "WNG"
    if disposals_pg >= 22 and tackle_rate >= 3:        return "MID", "WNG"
    # ── Full Back ──
    if rebound_rate >= 5 and goal_rate < 0.2:          return "FB", None
    if rebound_rate >= 4 and goal_rate < 0.4:          return "FB", "CHB"
    if rebound_rate >= 2 and goal_rate < 0.2 and mark_rate >= 4: return "FB", "CHB"
    # ── Centre Half Back ──
    if mark_rate >= 7 and goal_rate < 0.4:             return "CHB", None
    if mark_rate >= 6 and goal_rate < 0.5 and rebound_rate >= 1.5: return "CHB", "FB"
    if mark_rate >= 5 and goal_rate < 0.6 and disposals_pg >= 15: return "CHB", "HBF"
    if rebound_rate >= 2 and mark_rate >= 4 and goal_rate < 0.5: return "CHB", "HBF"
    # ── Half Back Flank ──
    if rebound_rate >= 2 and goal_rate < 0.5 and disposals_pg >= 14: return "HBF", "MID"
    if kick_ratio >= 0.58 and goal_rate < 0.4 and mark_rate >= 3: return "HBF", "CHB"
    if goal_rate < 0.4 and disposals_pg >= 16 and tackle_rate >= 3: return "HBF", None
    # ── Back Pocket ──
    if goal_rate < 0.3 and rebound_rate >= 1 and mark_rate >= 2: return "BP", "HBF"
    if goal_rate < 0.25 and disposals_pg >= 12:        return "BP", None
    # ── Fallbacks ──
    if goal_rate >= 1.0:                               return "HFF", None
    if goal_rate >= 0.5:                               return "WNG", None
    if goal_rate >= 0.3:                               return "MID", None
    if mark_rate >= 4:                                 return "CHB", None
    if disposals_pg >= 15:                             return "HBF", None
    return "BP", None


# ── afltables scraping (unchanged) ─────────────────────────────────────────

def get_player_list(slug: str) -> list[tuple[str, str, int]]:
    """Returns list of (name, stats_url, total_games) from alltime page."""
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


def scrape_player_by_club_and_decade(name: str, url: str, fw_cache: dict) -> list[dict]:
    """
    Scrapes the player stats page and returns one entry per club per decade.
    Position is resolved in two steps:
      1. Fetch broad group (FWD/MID/DEF/RK) from footywire profile.
      2. Use stat ratios to assign specific position within that group.
    Falls back to pure ratio inference if footywire lookup fails.
    """
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

        break  # only need first matching stats table

    # ── Footywire position lookup ──────────────────────────────────────────
    # Pass all clubs this player appeared at; the cache means only one HTTP
    # request will ever be made per unique player name across the whole run.
    all_clubs = list(club_decade_stats.keys())
    fw_broad = fetch_fw_position(name, all_clubs, fw_cache)

    # Build records
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

            if fw_broad is not None:
                # Two-step: footywire gives broad group, ratios give specific
                position, secondary = infer_specific_position(
                    fw_broad,
                    goals_pg, hitouts_pg, disposals_pg, marks_pg, tackles_pg,
                    kicks_pg, handballs_pg, inside50s_pg, clearances_pg, rebounds_pg,
                )
                broad_position = fw_broad
            else:
                # Fallback: pure ratio inference
                position, secondary = infer_positions_fallback(
                    goals_pg, hitouts_pg, disposals_pg, marks_pg, tackles_pg,
                    kicks_pg, handballs_pg, inside50s_pg, clearances_pg, rebounds_pg,
                )
                # Derive broad from specific
                FWD_SPECIFICS = {"FF", "FP", "CHF", "HFF"}
                DEF_SPECIFICS = {"FB", "BP", "CHB", "HBF"}
                MID_SPECIFICS = {"MID", "WNG"}
                if position in FWD_SPECIFICS:
                    broad_position = "FWD"
                elif position in DEF_SPECIFICS:
                    broad_position = "DEF"
                elif position == "RK":
                    broad_position = "RK"
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
                "broadPosition":     broad_position,   # FWD / MID / DEF / RK
                "position":          position,          # FF, CHF, HFF, WNG, MID, HBF, CHB, FB, etc.
                "secondaryPosition": secondary,
                "positionSource":    "footywire" if fw_broad is not None else "ratio",
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
        time.sleep(0.2)

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
                save_fw_cache(fw_cache)  # checkpoint cache every 25 players

            # Only delay for the footywire HTTP call — skip if already cached
            if not cached:
                time.sleep(0.2)
            else:
                time.sleep(0.1)  # still need a small delay for afltables

        # Mark club as done and checkpoint
        done_clubs.add(slug)
        progress["done_clubs"] = list(done_clubs)
        progress["players"] = all_players
        save_progress(progress)
        save_fw_cache(fw_cache)
        print(f"  ✓ {club_name} done")

    # Summary
    fw_sourced  = sum(1 for p in all_players if p.get("positionSource") == "footywire")
    rat_sourced = sum(1 for p in all_players if p.get("positionSource") == "ratio")
    print(f"\nTotal: {len(all_players)} records ({failed} failed)")
    print(f"  Position source — footywire: {fw_sourced} | ratio fallback: {rat_sourced}")
    print(f"  Footywire cache size: {len(fw_cache)} players")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(all_players, f, indent=2)
    print(f"Saved → {OUT}")

    # Clean up progress file on successful completion
    if PROGRESS_F.exists():
        PROGRESS_F.unlink()
        print("Progress file cleaned up.")


if __name__ == "__main__":
    main()