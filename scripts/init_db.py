import sqlite3, os
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "db", "uber_hackathon_v2.db")

conn = sqlite3.connect(DB_PATH)
conn.execute("""
CREATE TABLE IF NOT EXISTS live_aggregates (
    day TEXT NOT NULL,
    earner_id TEXT NOT NULL,
    earn_eur REAL NOT NULL DEFAULT 0,
    minutes REAL NOT NULL DEFAULT 0,
    rides INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, earner_id)
);
""")
conn.commit()
conn.close()
print("✅ live_aggregates table ensured at", DB_PATH)
