import { HashRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./LandingPage";
import Dashboard from "./Dashboard";
import DriveStats from "./DriveStats";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/drive-stats" element={<DriveStats />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
