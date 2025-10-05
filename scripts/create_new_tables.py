"""
Script to create new backend tables required for real-time driver stats aggregation.
Run this script once to ensure your database schema is up to date.
"""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "db" / "uber_hackathon_v2.db"

CREATE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS live_aggregates (
    day TEXT NOT NULL,
    earner_id TEXT NOT NULL,
    earn_eur REAL NOT NULL DEFAULT 0,
    minutes REAL NOT NULL DEFAULT 0,
    rides INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, earner_id)
);
"""

def main():
    conn = sqlite3.connect(str(DB_PATH))
    try:
        conn.executescript(CREATE_TABLES_SQL)
        conn.commit()
        print("✅ Tables created/verified successfully.")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
