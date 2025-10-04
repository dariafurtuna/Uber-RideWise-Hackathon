import sqlite3
from pathlib import Path
import pandas as pd
from geopy.geocoders import Nominatim
import time
import ssl
import certifi
import geopy.geocoders
geopy.geocoders.options.default_ssl_context = ssl.create_default_context(cafile=certifi.where())


EXCEL = Path("data/uber_hackathon_v2_mock_data.xlsx")
DB    = Path("db/uber_hackathon_v2.db")
SCHEMA= Path("db/schema.sql")

geolocator = Nominatim(user_agent="smart-earner")

def get_city_name(lat, lon):
    try:
        location = geolocator.reverse((lat, lon), exactly_one=True, language="en")
        if location and "address" in location.raw:
            addr = location.raw["address"]
            return addr.get("city") or addr.get("town") or addr.get("village") or addr.get("county")
    except Exception as e:
        print("Geocode error:", e)
    return None

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

    df_rides = pd.read_excel(xls, sheet_name="rides_trips")

    city_samples = (
        df_rides.groupby("city_id")
        .first()[["pickup_lat", "pickup_lon"]]
        .reset_index()
    )

    cities = []
    for _, row in city_samples.iterrows():
        cid, lat, lon = row["city_id"], row["pickup_lat"], row["pickup_lon"]
        name = get_city_name(lat, lon) or f"City {cid}"
        cities.append({"city_id": cid, "city_name": name})
        print(f"Resolved {cid} → {name}")
        time.sleep(1)  # avoid hitting API limits

    cur.execute("DROP TABLE IF EXISTS cities;")
    cur.execute("CREATE TABLE cities (city_id INTEGER PRIMARY KEY, city_name TEXT);")
    cur.executemany("INSERT INTO cities (city_id, city_name) VALUES (?, ?);",
                    [(c["city_id"], c["city_name"]) for c in cities])
    conn.commit()

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
