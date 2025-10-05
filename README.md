python -m venv .venv
# Mac/Linux
source .venv/bin/activate
# Windows
.venv\Scripts\activate

pip install --upgrade pip
pip install -r requirements.txt

python scripts/load_from_excel.py

sqlite3 db/uber_hackathon_v2.db

### Start server
python scripts\synthesize_rides.py --target 30000 --write-db
python scripts\aggregate_trips.py
python scripts/init_db.py
python scripts/create_new_tables.py


python -m uvicorn backend.api:app --reload --port 8000