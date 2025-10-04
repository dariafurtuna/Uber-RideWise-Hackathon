import { HashRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./LandingPage";
import Dashboard from "./Dashboard";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
