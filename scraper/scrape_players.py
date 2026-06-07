#!/usr/bin/env python3
"""
Scrapes per-club career stats from afltables.com game log pages.
Each player appears once per club they played for, with stats for that club only.
Run: python3 scraper/scrape_players.py
Output: backend/data/players.json
Warning: Takes 2-3 hours due to polite delays
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
    "University": "University",
}

def decade_of(years: list[int]) -> str:
    if not years:
        return "2000s"
    mid = years[0] + (years[-1] - years[0]) // 2
    return f"{(mid // 10) * 10}s"

def infer_positions(
    goals_pg: float, hitouts_pg: float, disposals_pg: float,
    marks_pg: float, tackles_pg: float, height_cm: int,
    kicks_pg: float, handballs_pg: float, inside50s_pg: float,
    clearances_pg: float, rebounds_pg: float
) -> tuple[str, str | None]:

    # Old-era detection — missing modern stats
    old_era = (clearances_pg == 0 and rebounds_pg == 0 and
               tackles_pg == 0 and inside50s_pg == 0)

    if old_era:
        if hitouts_pg >= 8:
            return "RK", "MID"
        if goals_pg >= 3.5:
            return "FF", "CHF"
        if goals_pg >= 2.5:
            return "FF", "FP"
        if goals_pg >= 1.8:
            return "FP", "HFF"
        if goals_pg >= 1.2 and height_cm >= 188:
            return "CHF", "FF"
        if goals_pg >= 1.2:
            return "HFF", "WNG"
        if goals_pg >= 0.7:
            return "WNG", "HFF"
        if goals_pg >= 0.4:
            return "MID", "WNG"
        kick_ratio = kicks_pg / disposals_pg if disposals_pg > 0 else 0.5
        if height_cm >= 193:
            return "CHB", "FB"
        if height_cm >= 190:
            return "FB", "CHB"
        if height_cm >= 186:
            return "HBF", "CHB"
        if kick_ratio >= 0.65 and disposals_pg >= 15:
            return "MID", "WNG"
        if height_cm >= 182:
            return "BP", "HBF"
        return "BP", "HBF"

    # Ruck
    if hitouts_pg >= 15:
        return "RK", "CHB" if height_cm >= 198 else "MID"
    if hitouts_pg >= 8 and height_cm >= 195:
        return "RK", "CHB"
    if hitouts_pg >= 5 and height_cm >= 200:
        return "RK", "MID"

    # Full Forward
    if goals_pg >= 4.0:
        return "FF", "CHF"
    if goals_pg >= 3.0 and height_cm >= 188:
        return "FF", "CHF"
    if goals_pg >= 3.0 and marks_pg >= 5:
        return "FF", "FP"
    if goals_pg >= 2.5 and marks_pg >= 6 and height_cm >= 190:
        return "FF", "CHF"

    # Forward Pocket
    if goals_pg >= 2.5 and height_cm < 185:
        return "FP", "HFF"
    if goals_pg >= 2.0 and height_cm < 183:
        return "FP", "FF"
    if goals_pg >= 2.0 and inside50s_pg >= 4 and height_cm < 187:
        return "FP", "HFF"

    # Centre Half Forward
    if goals_pg >= 1.5 and height_cm >= 192 and marks_pg >= 6:
        return "CHF", "FF"
    if goals_pg >= 1.2 and height_cm >= 190 and marks_pg >= 5:
        return "CHF", "HFF"
    if goals_pg >= 1.0 and height_cm >= 193 and inside50s_pg >= 4:
        return "CHF", "FF"
    if goals_pg >= 1.0 and height_cm >= 190 and marks_pg >= 7:
        return "CHF", "FF"

    # Half Forward Flank
    if goals_pg >= 1.0 and disposals_pg >= 18 and inside50s_pg >= 3:
        return "HFF", "WNG"
    if goals_pg >= 0.8 and height_cm >= 185 and marks_pg >= 4:
        return "HFF", "CHF"
    if goals_pg >= 0.7 and kicks_pg >= 12 and inside50s_pg >= 3:
        return "HFF", "WNG"
    if goals_pg >= 0.6 and inside50s_pg >= 4 and disposals_pg >= 16:
        return "HFF", "WNG"

    # Wing
    if disposals_pg >= 22 and goals_pg >= 0.4 and inside50s_pg >= 3 and tackles_pg < 5:
        return "WNG", "HFF"
    if kicks_pg >= 14 and disposals_pg >= 22 and goals_pg < 1.0:
        return "WNG", "MID"
    if disposals_pg >= 20 and goals_pg >= 0.3 and rebounds_pg < 2 and inside50s_pg >= 2:
        return "WNG", "HFF"
    if kicks_pg >= 13 and handballs_pg < 8 and goals_pg < 0.8 and disposals_pg >= 18:
        return "WNG", "HFF"

    # Midfielder
    if clearances_pg >= 6 and tackles_pg >= 5 and disposals_pg >= 22:
        return "MID", "WNG"
    if clearances_pg >= 5 and tackles_pg >= 4 and disposals_pg >= 20:
        return "MID", "WNG"
    if disposals_pg >= 26 and tackles_pg >= 3:
        return "MID", "WNG"
    if disposals_pg >= 22 and tackles_pg >= 5:
        return "MID", "HBF"
    if disposals_pg >= 20 and clearances_pg >= 4:
        return "MID", "WNG"
    if handballs_pg >= 10 and tackles_pg >= 4 and clearances_pg >= 3:
        return "MID", "HFF"
    if tackles_pg >= 6 and disposals_pg >= 18:
        return "MID", "HBF"

    # Full Back
    if rebounds_pg >= 5 and height_cm >= 190 and goals_pg < 0.5:
        return "FB", "CHB"
    if height_cm >= 192 and goals_pg < 0.3 and marks_pg >= 5 and rebounds_pg >= 3:
        return "FB", "CHB"
    if height_cm >= 194 and goals_pg < 0.4 and marks_pg >= 6:
        return "FB", "CHB"

    # Centre Half Back
    if height_cm >= 192 and marks_pg >= 6 and goals_pg < 0.6 and rebounds_pg >= 2:
        return "CHB", "FB"
    if height_cm >= 190 and marks_pg >= 5 and disposals_pg >= 16 and goals_pg < 0.8:
        return "CHB", "HBF"
    if height_cm >= 188 and marks_pg >= 7 and goals_pg < 0.7:
        return "CHB", "FB"
    if height_cm >= 190 and marks_pg >= 5 and goals_pg < 0.5:
        return "CHB", "HBF"

    # Half Back Flank
    if rebounds_pg >= 3 and disposals_pg >= 18 and goals_pg < 0.6:
        return "HBF", "MID"
    if height_cm >= 184 and marks_pg >= 4 and goals_pg < 0.5 and disposals_pg >= 15:
        return "HBF", "CHB"
    if kicks_pg >= 10 and rebounds_pg >= 2 and goals_pg < 0.5:
        return "HBF", "WNG"
    if disposals_pg >= 16 and rebounds_pg >= 2 and goals_pg < 0.5:
        return "HBF", "MID"
    if marks_pg >= 4 and goals_pg < 0.4 and height_cm >= 182 and disposals_pg >= 14:
        return "HBF", "CHB"

    # Back Pocket
    if rebounds_pg >= 2 and goals_pg < 0.4 and height_cm < 185:
        return "BP", "HBF"
    if goals_pg < 0.3 and height_cm < 183 and tackles_pg >= 3:
        return "BP", "HBF"
    if goals_pg < 0.3 and rebounds_pg >= 1 and disposals_pg >= 12:
        return "BP", "HBF"

    # Fallbacks
    if goals_pg >= 1.5:
        return ("CHF", "HFF") if height_cm >= 190 else ("FP", "HFF")
    if goals_pg >= 0.8:
        return ("CHF", "HFF") if height_cm >= 190 else ("HFF", "WNG")
    if goals_pg >= 0.4:
        return "WNG", "HFF"
    if height_cm >= 196:
        return "CHB", "FB"
    if height_cm >= 191:
        return "FB", "CHB"
    if height_cm >= 186:
        return "HBF", "CHB"
    if height_cm >= 182:
        return "BP", "HBF"
    return "BP", "HBF"


def get_player_list(slug: str) -> list[tuple[str, str, int]]:
    """Returns list of (name, game_log_url, games) from alltime page."""
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

            games_str = cells[6].get_text(strip=True)
            games_m = re.match(r'(\d+)', games_str)
            games = int(games_m.group(1)) if games_m else 0
            if games < 30:
                continue

            # Convert stats page URL to game log URL
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


def scrape_player_by_club(name: str, url: str) -> list[dict]:
    try:
        r = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
    except Exception:
        return []

    soup = BeautifulSoup(r.text, "html.parser")

    height_cm = 180
    for tag in soup.find_all(string=re.compile(r'\d{3}cm')):
        m = re.search(r'(\d{3})cm', str(tag))
        if m:
            val = int(m.group(1))
            if 150 <= val <= 220:
                height_cm = val
                break

    tables = soup.find_all("table")
    club_stats: dict[str, dict] = {}

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
                continue  # skip totals/averages rows

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

            # Games played this season = count rows per team per year
            if team not in club_stats:
                club_stats[team] = {
                    "years": [], "gp": 0,
                    "ki": 0.0, "mk": 0.0, "hb": 0.0, "di": 0.0,
                    "gl": 0.0, "ho": 0.0, "ta": 0.0, "cl": 0.0,
                    "i50": 0.0, "rb": 0.0,
                }

            s = club_stats[team]
            s["years"].append(int(year_str))

            # Each row is a season total, not a game — get games from GM column
            idx_gm = col_idx(["GM"])
            season_games = fval(idx_gm) if idx_gm else 1
            s["gp"] += int(season_games) if season_games > 0 else 1

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

        break  # only need first matching table

    players = []
    for club, s in club_stats.items():
        gp = s["gp"]
        if gp < 30:
            continue

        def avg(total):
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
            height_cm, kicks_pg, handballs_pg, inside50s_pg,
            clearances_pg, rebounds_pg
        )

        players.append({
            "name":              name,
            "club":              club,
            "decade":            decade_of(sorted(set(s["years"]))),
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
    seen: set[tuple[str, str]] = set()
    failed = 0
    total_processed = 0

    for slug, club_name in CLUBS.items():
        print(f"\n── {club_name} ──")
        player_list = get_player_list(slug)
        print(f"  Found {len(player_list)} players")
        time.sleep(1.0)

        for i, (name, gm_url, _games) in enumerate(player_list):
            records = scrape_player_by_club(name, gm_url)

            for record in records:
                print(f"  {record['name']} @ {record['club']} ({record['games']}g) — goals={record['goals']} disp={record['disposals']} pos={record['position']}")
                key = (name.lower(), record["club"])
                if key not in seen:
                    seen.add(key)
                    all_players.append(record)

            if not records:
                failed += 1

            total_processed += 1
            if (i + 1) % 25 == 0:
                print(f"  {i + 1}/{len(player_list)} ({len(all_players)} records so far)...")

            time.sleep(0.2)

        print(f"  ✓ {club_name} done")

    print(f"\nTotal records: {len(all_players)} ({failed} failed)")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(all_players, f, indent=2)
    print(f"Saved → {OUT}")


if __name__ == "__main__":
    main()