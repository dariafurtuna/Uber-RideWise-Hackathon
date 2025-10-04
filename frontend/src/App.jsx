import { HashRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./LandingPage";
import Dashboard from "./Dashboard";
import DriveStats from "./DriveStats";
import RideRating from "./RideRating";
import HeatmapView from "./HeatmapView";

import "/styles/App.css";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/drive-stats" element={<DriveStats />} />
        <Route path="/ride-rating" element={<RideRating />} />
        <Route path="/heatmap" element={<HeatmapView />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
