import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import "./app.css";

import LandingPage from "./LandingPage";

function App() {
  return (
    <div>
      <LandingPage />
    </div>
  );
}

export default App;