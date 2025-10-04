import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import "./app.css";

import LandingPage from "./LandingPage";
import DriveStats from "./DriveStats";

function App() {
  return (
    <div className="app">
      <DriveStats />
    </div>
  );
}

export default App;