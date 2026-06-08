#!/usr/bin/env python3
"""
Scrapes per-club career stats from afltables.com
- Only players from 1970s onwards
- Position inferred from stat ratios not absolute values
- Players appear once per club per decade they played for
Run: python3 scraper/scrape_players.py
Output: backend/data/players.json
"""

import json, time, re
import requests
from bs4 import BeautifulSoup
from pathlib import Path

BASE = "https://afltables.com/afl"
OUT  = Path(__file__).parent.parent / "backend" / "data" / "players.json"

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

MIN_YEAR = 1970
MIN_GAMES_PER_STINT = 20

def infer_positions(
    goals_pg: float, hitouts_pg: float, disposals_pg: float,
    marks_pg: float, tackles_pg: float, kicks_pg: float,
    handballs_pg: float, inside50s_pg: float,
    clearances_pg: float, rebounds_pg: float
) -> tuple[str, str | None]:
    """
    Position inference based on stat RATIOS rather than absolute values.
    This handles era differences much better.
    """
    gp = disposals_pg if disposals_pg > 0 else 1

    # Key ratios
    goal_rate      = goals_pg                                    # goals per game
    hitout_rate    = hitouts_pg                                  # hitouts per game
    kick_ratio     = kicks_pg / gp if gp > 0 else 0.5          # kicks as proportion of disposals
    handball_ratio = handballs_pg / gp if gp > 0 else 0.5      # handballs as proportion
    mark_rate      = marks_pg                                    # marks per game
    tackle_rate    = tackles_pg                                  # tackles per game
    clearance_rate = clearances_pg                               # clearances per game
    rebound_rate   = rebounds_pg                                 # rebounds per game
    i50_rate       = inside50s_pg                               # inside 50s per game

    # ── Ruck ──────────────────────────────────────────────────────────────
    if hitout_rate >= 15:
        return "RK", "MID"
    if hitout_rate >= 8:
        return "RK", "CHB" if mark_rate >= 4 else "MID"
    if hitout_rate >= 4 and disposals_pg < 15:
        return "RK", "MID"

    # ── Full Forward ───────────────────────────────────────────────────────
    if goal_rate >= 3.5:
        return "FF", "CHF"
    if goal_rate >= 2.8 and mark_rate >= 4:
        return "FF", "CHF"
    if goal_rate >= 2.5 and i50_rate >= 4:
        return "FF", "FP"

    # ── Forward Pocket ─────────────────────────────────────────────────────
    if goal_rate >= 2.0 and kick_ratio < 0.65:
        return "FP", "HFF"
    if goal_rate >= 1.8 and disposals_pg < 16:
        return "FP", "HFF"

    # ── Centre Half Forward ────────────────────────────────────────────────
    if goal_rate >= 1.5 and mark_rate >= 5:
        return "CHF", "FF"
    if goal_rate >= 1.2 and mark_rate >= 5 and i50_rate >= 3:
        return "CHF", "HFF"
    if goal_rate >= 1.0 and mark_rate >= 6:
        return "CHF", "HFF"

    # ── Half Forward Flank ─────────────────────────────────────────────────
    if goal_rate >= 0.8 and i50_rate >= 3 and kick_ratio >= 0.55:
        return "HFF", "WNG"
    if goal_rate >= 0.7 and mark_rate >= 4 and disposals_pg >= 14:
        return "HFF", "CHF"
    if goal_rate >= 0.6 and i50_rate >= 3:
        return "HFF", "WNG"

    # ── Wing ───────────────────────────────────────────────────────────────
    # High kicks, moderate goals, low tackles relative to disposals
    tackle_disp_ratio = tackle_rate / disposals_pg if disposals_pg > 0 else 0
    if kick_ratio >= 0.60 and goal_rate >= 0.3 and tackle_disp_ratio < 0.15 and i50_rate >= 2:
        return "WNG", "HFF"
    if disposals_pg >= 18 and kick_ratio >= 0.55 and goal_rate < 0.8 and rebound_rate < 2:
        return "WNG", "MID"

    # ── Midfielder ─────────────────────────────────────────────────────────
    # High clearances and/or tackles relative to disposals
    if clearance_rate >= 5 and tackle_rate >= 4:
        return "MID", "WNG"
    if clearance_rate >= 4 and disposals_pg >= 20:
        return "MID", "WNG"
    if tackle_disp_ratio >= 0.20 and disposals_pg >= 18:
        return "MID", "HBF"
    if handball_ratio >= 0.45 and tackle_rate >= 4 and clearance_rate >= 3:
        return "MID", "WNG"
    if disposals_pg >= 22 and tackle_rate >= 3:
        return "MID", "WNG"

    # ── Full Back ──────────────────────────────────────────────────────────
    if rebound_rate >= 4 and goal_rate < 0.4:
        return "FB", "CHB"
    if rebound_rate >= 2 and goal_rate < 0.2 and mark_rate >= 4:
        return "FB", "CHB"

    # ── Centre Half Back ───────────────────────────────────────────────────
    if mark_rate >= 6 and goal_rate < 0.5 and rebound_rate >= 1.5:
        return "CHB", "FB"
    if mark_rate >= 5 and goal_rate < 0.6 and disposals_pg >= 15:
        return "CHB", "HBF"
    if rebound_rate >= 2 and mark_rate >= 4 and goal_rate < 0.5:
        return "CHB", "HBF"

    # ── Half Back Flank ────────────────────────────────────────────────────
    if rebound_rate >= 2 and goal_rate < 0.5 and disposals_pg >= 14:
        return "HBF", "MID"
    if kick_ratio >= 0.58 and goal_rate < 0.4 and mark_rate >= 3:
        return "HBF", "CHB"
    if goal_rate < 0.4 and disposals_pg >= 16 and tackle_rate >= 3:
        return "HBF", "MID"

    # ── Back Pocket ────────────────────────────────────────────────────────
    if goal_rate < 0.3 and rebound_rate >= 1 and mark_rate >= 2:
        return "BP", "HBF"
    if goal_rate < 0.25 and disposals_pg >= 12:
        return "BP", "HBF"

    # ── Fallbacks ──────────────────────────────────────────────────────────
    if goal_rate >= 1.0:
        return "HFF", "WNG"
    if goal_rate >= 0.5:
        return "WNG", "HFF"
    if goal_rate >= 0.3:
        return "MID", "WNG"
    if mark_rate >= 4:
        return "CHB", "HBF"
    if disposals_pg >= 15:
        return "HBF", "BP"
    return "BP", "HBF"


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

            # Check seasons string for any year >= MIN_YEAR
            seasons_str = cells[8].get_text(strip=True)
            years = [int(y) for y in re.findall(r'\d{4}', seasons_str)]
            if not years or max(years) < MIN_YEAR:
                continue

            games_str = cells[6].get_text(strip=True)
            games_m = re.match(r'(\d+)', games_str)
            games = int(games_m.group(1)) if games_m else 0
            if games < MIN_GAMES_PER_STINT:
                continue

            # Fix relative URLs
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


def scrape_player_by_club_and_decade(name: str, url: str) -> list[dict]:
    """
    Scrapes the player stats page and returns one entry per club per decade.
    e.g. Nathan Buckley at Collingwood in 1990s AND 2000s = 2 entries.
    """
    try:
        r = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
    except Exception:
        return []

    soup = BeautifulSoup(r.text, "html.parser")

    tables = soup.find_all("table")

    # club_decade_stats[club][decade] = {gp, ki, mk, hb, di, gl, ho, ta, cl, i50, rb}
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

    # Build one record per club per decade
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

            position, secondary = infer_positions(
                goals_pg, hitouts_pg, disposals_pg, marks_pg, tackles_pg,
                kicks_pg, handballs_pg, inside50s_pg, clearances_pg, rebounds_pg
            )

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
                "position":          position,
                "secondaryPosition": secondary,
            })

    return players


def main():
    all_players = []
    seen: set[tuple[str, str, str]] = set()  # (name, club, decade)
    failed = 0

    for slug, club_name in CLUBS.items():
        print(f"\n── {club_name} ──")
        player_list = get_player_list(slug)
        print(f"  Found {len(player_list)} players (1970s+)")
        time.sleep(1.0)

        for i, (name, url, _) in enumerate(player_list):
            records = scrape_player_by_club_and_decade(name, url)

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
                print(f"  {i + 1}/{len(player_list)} ({len(all_players)} records)...")

            time.sleep(0.2)

        print(f"  ✓ {club_name} done")

    print(f"\nTotal: {len(all_players)} records ({failed} failed)")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(all_players, f, indent=2)
    print(f"Saved → {OUT}")


if __name__ == "__main__":
    main()