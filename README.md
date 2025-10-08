## 🧠 One-Command Setup  

1️⃣ **Make sure you have Python installed.**  
If not, download it from [python.org/downloads](https://www.python.org/downloads/)  
👉 On Windows, remember to check **“Add Python to PATH”** during installation.

2️⃣ **Open a terminal in the project folder and run:**

```bash
python setup_and_run.py
```

✅ Works on **Windows**, **macOS** and **Linux**.
<br><br>
 💡 Tip: If you encounter any issues during setup, you can rebuild everything automatically by running:  
 ```bash
 python setup_and_run.py --rebuild
 ```
<br><br>
 ## 🧩 Alternative Manual Setup

If you prefer setting things up manually or encounter issues with the automatic script,  
follow the steps below depending on your operating system.


### 1️⃣ Create a virtual environment
```bash
python -m venv .venv
```

### 2️⃣ Activate the environment
**Mac/Linux:**
```bash
source .venv/bin/activate
```

**Windows:**
```bash
.venv\Scripts\activate
```

### 3️⃣ Install dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4️⃣ Initialize the database
```bash
python scripts/load_from_excel.py
sqlite3 db/uber_hackathon_v2.db
python scripts/synthesize_rides.py --target 30000 --write-db
python scripts/aggregate_trips.py
python scripts/init_db.py
python scripts/create_new_tables.py
```

### 5️⃣ Start the backend server
```bash
python -m uvicorn backend.api:app --reload --port 8000
```

### 6️⃣ Start the frontend
```bash
cd frontend
npm install
npm run dev
```

Then open the app at 👉 [http://localhost:5173](http://localhost:5173)