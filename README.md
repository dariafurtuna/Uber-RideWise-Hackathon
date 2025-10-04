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
python -m uvicorn backend.api:app --reload --port 8000