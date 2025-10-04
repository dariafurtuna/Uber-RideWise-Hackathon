import sqlite3
from pathlib import Path
import pandas as pd

EXCEL = Path("data/uber_hackathon_v2_mock_data.xlsx")
DB    = Path("db/uber_hackathon_v2.db")
SCHEMA= Path("db/schema.sql")

def isoify_times(df):
    for col in df.columns:
        name = col.lower()
        if "time" in name or name == "date":
            try:
                s = pd.to_datetime(df[col], errors="coerce")
                df[col] = s.dt.strftime("%Y-%m-%d %H:%M:%S")
            except Exception:
                pass
    return df

def main():
    # Ensure DB directory exists before connecting
    DB.parent.mkdir(parents=True, exist_ok=True)
    if DB.exists():
        DB.unlink()
    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    # Create schema (tables + indexes)
    if SCHEMA.exists():
        cur.executescript(SCHEMA.read_text())

    xls = pd.ExcelFile(EXCEL)
    exclude = {"README"}
    for sheet in xls.sheet_names:
        if sheet in exclude:
            continue
        df = pd.read_excel(xls, sheet_name=sheet)
        df = isoify_times(df)
        df.to_sql(sheet, conn, if_exists="replace", index=False)
        print(f"Loaded {sheet}: {len(df)} rows")

    # Recreate helpful indexes after load (in case to_sql replaced tables)
    try:
        cur.executescript("""
        CREATE INDEX IF NOT EXISTS idx_rides_driver ON rides_trips(driver_id);
        CREATE INDEX IF NOT EXISTS idx_rides_date   ON rides_trips(date);
        CREATE INDEX IF NOT EXISTS idx_earn_day     ON earnings_daily(earner_id, date);
        CREATE INDEX IF NOT EXISTS idx_incent_week  ON incentives_weekly(earner_id, week);
        """)
    except Exception:
        pass

    conn.commit()
    conn.close()
    print(f"Done. DB at {DB}")

if __name__ == "__main__":
    main()
