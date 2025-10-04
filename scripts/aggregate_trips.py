import sqlite3
from pathlib import Path
import pandas as pd
import h3

DB = Path("db/uber_hackathon_v2.db")
H3_RES = 8

# prefer full timestamps that include hours
TS_CANDIDATES = ["start_time", "end_time", "pickup_time", "requested_at", "created_at", "datetime", "date"]  # 'date' last

def choose_ts_column(conn: sqlite3.Connection) -> str:
    cols = {row[1] for row in conn.execute("PRAGMA table_info(rides_trips)").fetchall()}
    for c in TS_CANDIDATES:
        if c in cols:
            return c
    raise RuntimeError("No timestamp-like column found in rides_trips")

def main():
    conn = sqlite3.connect(DB)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS agg_h3_dow_hr(
            h3   TEXT,
            dow  INT,   -- 0=Sun..6=Sat (SQLite strftime('%w'))
            hour INT,   -- 0..23
            cnt  INT,
            earn REAL,
            surge REAL,
            PRIMARY KEY(h3, dow, hour)
        )
    """)
    conn.execute("DELETE FROM agg_h3_dow_hr")

    ts_col = choose_ts_column(conn)
    print(f"[aggregate_trips] Using timestamp column: {ts_col}")

    # Use SQLite datetime() wrapper so it parses ISO strings like "YYYY-MM-DD HH:MM:SS"
    sql = f"""
        SELECT
            pickup_lat AS lat,
            pickup_lon AS lon,
            CAST(STRFTIME('%w', datetime({ts_col})) AS INT) AS dow,   -- 0=Sun..6=Sat
            CAST(STRFTIME('%H', datetime({ts_col})) AS INT) AS hour,  -- 0..23
            net_earnings AS earn,
            surge_multiplier AS surge
        FROM rides_trips
        WHERE pickup_lat IS NOT NULL AND pickup_lon IS NOT NULL
          AND {ts_col} IS NOT NULL
    """

    df = pd.read_sql_query(sql, conn)
    if df.empty:
        raise RuntimeError("No rows selected. Check timestamp column content.")

    # map to H3
    df["h3"] = df.apply(lambda r: h3.latlng_to_cell(float(r["lat"]), float(r["lon"]), H3_RES), axis=1)

    # aggregate
    grp = df.groupby(["h3", "dow", "hour"]).agg(
        cnt=("h3", "count"),
        earn=("earn", "sum"),
        surge=("surge", "mean"),
    ).reset_index()

    # upsert
    cur = conn.cursor()
    for _, r in grp.iterrows():
        cur.execute("""
            INSERT INTO agg_h3_dow_hr(h3, dow, hour, cnt, earn, surge)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(h3, dow, hour) DO UPDATE SET
              cnt=excluded.cnt, earn=excluded.earn, surge=excluded.surge
        """, (r["h3"], int(r["dow"]), int(r["hour"]),
              int(r["cnt"]), float(r["earn"] or 0), float(r["surge"] or 0)))
    conn.commit()

    # diagnostics: verify hours are spread
    total = conn.execute("SELECT COUNT(*) FROM agg_h3_dow_hr").fetchone()[0]
    by_hour = conn.execute("SELECT hour, COUNT(*) FROM agg_h3_dow_hr GROUP BY hour ORDER BY hour").fetchall()
    by_dow  = conn.execute("SELECT dow, COUNT(*)  FROM agg_h3_dow_hr GROUP BY dow  ORDER BY dow").fetchall()
    print(f"[aggregate_trips] rows: {total}")
    print(f"[aggregate_trips] hours: {by_hour}")
    print(f"[aggregate_trips] dows : {by_dow}")

    conn.close()
    print("[aggregate_trips] Done.")

if __name__ == "__main__":
    main()
