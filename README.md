# 23-0 — AFL Fantasy Draft Game

Build the greatest AFL team of all time. Go undefeated. 23-0.

## Folder Structure

```
23-0/
├── backend/
│   ├── src/
│   │   ├── index.ts          # Express server
│   │   ├── db.ts             # SQLite setup
│   │   ├── routes/
│   │   │   ├── spin.ts       # Club/decade spin endpoint
│   │   │   └── players.ts    # Player candidate endpoint
│   │   └── simulation.ts     # Season simulation engine
│   ├── data/
│   │   └── players.json      # Seeded player data
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── StartScreen.tsx
│   │   │   ├── SpinningScreen.tsx
│   │   │   ├── PickingScreen.tsx
│   │   │   ├── PlayerCard.tsx
│   │   │   ├── SlotDisplay.tsx
│   │   │   ├── RosterPanel.tsx
│   │   │   └── ResultScreen.tsx
│   │   ├── hooks/
│   │   │   └── useGameState.ts
│   │   ├── lib/
│   │   │   └── api.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
└── scraper/
    └── scrape_players.py     # One-time AFLTables scraper
```

## Setup

### Prerequisites
- Node 18+
- Python 3.8+ (for scraper only)

### Backend
```bash
cd backend
npm install
npm run seed    # Seeds SQLite from players.json
npm run dev     # Starts on port 3001
```

### Frontend
```bash
cd frontend
npm install
npm run dev     # Starts on port 5173
```

### Scraper (optional — game works without it)
```bash
pip install requests beautifulsoup4
python scraper/scrape_players.py
# Saves to backend/data/players_scraped.json
# Then re-run: cd backend && npm run seed
```

## How to Play
1. Draft 18 players across all positions
2. Each round: spin lands on a Club + Decade
3. Choose 1 of 3 candidate players
4. Use your Club Skip or Decade Skip wisely
5. After 18 picks, simulate your season
6. Can you go 23-0?
