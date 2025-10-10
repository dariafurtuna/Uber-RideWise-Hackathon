import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getForecast } from "./api";
import { ScheduleBuilderSheet } from "./components/ScheduleBuilderSheet";
import "/styles/LandingPage.css";


const hourLabels = [
  "6AM", "7AM", "8AM", "9AM", "10AM", "11AM", "12PM", "1PM", "2PM", "3PM", "4PM", "5PM", "6PM", "7PM", "8PM"
];
const daysOfWeek = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

export default function LandingPage() {
  const [forecast, setForecast] = useState([]);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [surge, setSurge] = useState(null);
  const navigate = useNavigate();
  const [city, setCity] = useState(1);
  // Demo values for weather
  const weather = { icon: "🌥️", label: "Cloudy", desc: "Medium traffic expected" };
  const WORK_KEY = "workSessionStartedAt"; // ms timestamp

  const [working, setWorking] = useState(() => !!localStorage.getItem(WORK_KEY));
  
  // Schedule builder state
  const [scheduleSheetOpen, setScheduleSheetOpen] = useState(false);
  const [schedulePlan, setSchedulePlan] = useState(null);
  const [acceptedSchedule, setAcceptedSchedule] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

function startWork() {
  const t = Date.now();
  localStorage.setItem(WORK_KEY, String(t));
  setWorking(true);
  window.dispatchEvent(new CustomEvent("workSession", { detail: { active: true, startedAt: t } }));
}

function stopWork() {
  localStorage.removeItem(WORK_KEY);
  setWorking(false);
  window.dispatchEvent(new CustomEvent("workSession", { detail: { active: false } }));
}

// Schedule builder functions
function handleGeneratePlan() {
  // Mock plan generation - in real app this would call an API
  const today = new Date().toISOString().split('T')[0];
  const mockPlan = {
    day: today,
    blocks: [
      {
        type: "drive",
        start: "16:00",
        end: "18:00",
        reason: "dinner pre-peak",
        est_eph: 24.5
      },
      {
        type: "break",
        start: "18:00",
        end: "18:15",
        nearby: [
          { name: "Cafe Azul", dist_km: 0.6 },
          { name: "P+R Centrum", dist_km: 0.9 }
        ]
      },
      {
        type: "drive",
        start: "18:15",
        end: "20:10",  
        reason: "dinner peak",
        est_eph: 29.1
      }
    ]
  };
  setSchedulePlan(mockPlan);
}

function handleAcceptPlan(plan) {
  console.log("Accepted plan:", plan);
  // Update the main schedule plan with the accepted changes
  setSchedulePlan(plan);
  setAcceptedSchedule(plan);
  setHasUnsavedChanges(false);
  setScheduleSheetOpen(false);
}

function handleEditBlock(index, updates) {
  // This function is no longer used since all edits are handled within the working copy
  // in ScheduleBuilderSheet. Edits are only committed when the user accepts/saves.
  console.log("Edit block called (should not be used):", index, updates);
}

function handleRemoveBlock(index) {
  if (!schedulePlan) return;
  const newBlocks = schedulePlan.blocks.filter((_, i) => i !== index);
  setSchedulePlan({ ...schedulePlan, blocks: newBlocks });
  
  // Mark as having unsaved changes if there's an accepted schedule
  if (acceptedSchedule) {
    setHasUnsavedChanges(true);
  }
}

function handleDeleteSchedule() {
  setAcceptedSchedule(null);
  setSchedulePlan(null);
  setHasUnsavedChanges(false);
  setScheduleSheetOpen(false);
  console.log("Schedule deleted");
}


  useEffect(() => {
    async function loadData() {
      try {
        const data = await getForecast(1, selectedDay);
        setForecast(data.forecast || []);
        setSurge(data.current_surge ?? null);
        setCity(data.city_name|| "");
      } catch (e) {
        console.error("Failed to fetch forecast", e);
      }
    }
    loadData();
  }, [selectedDay]);

  // Align forecast data to hourLabels (6AM-8PM)
  const hourRange = Array.from({ length: 15 }, (_, i) => i + 6); // 6 to 20
  const bars = hourRange.map(h => {
    const found = forecast.find(f => Number(f.hour) === h);
    return found || { eph: 0 };
  });
  const maxEph = Math.max(...bars.map(f => f.eph || 0), 1);
  // Dynamically generate y-axis labels based on maxEph
  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks }, (_, i) => Math.round((maxEph / (yTicks - 1)) * (yTicks - 1 - i)));

  return (
    <div className="lp-root">
      {/* Header Bar */}
      <div className="lp-header">
        <div className="lp-header-content">
          <span className="lp-uber-logo">Uber</span>
          {acceptedSchedule ? (
            <div className="lp-schedule-status">
              <span className="lp-schedule-indicator">●</span>
              <div className="lp-schedule-details">
                <span className="lp-schedule-text">Schedule Active</span>
                <span className="lp-schedule-info">
                  {acceptedSchedule.blocks[0]?.start}–{acceptedSchedule.blocks[acceptedSchedule.blocks.length - 1]?.end} • {acceptedSchedule.blocks.length} blocks
                </span>
              </div>
            </div>
          ) : (
            <div className="lp-schedule-status">
              <span className="lp-schedule-indicator lp-schedule-indicator-inactive">●</span>
              <div className="lp-schedule-details">
                <span className="lp-schedule-text">No Active Schedule</span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <h1 className="lp-main-title" style={{
        textAlign: 'center',
        fontWeight: 800,
        fontSize: '2.4rem',
        margin: '24px 0 32px 0',
        letterSpacing: '0.01em',
        color: '#181818'
      }}>RideWise Assistant</h1>
      {/* Day navigation moved under the histogram */}
      <div className="lp-row">
        <div className="lp-card lp-weather">
          <div className="lp-weather-icon">{weather.icon}</div>
          <div className="lp-weather-title">{weather.label}</div>
          <div className="lp-weather-desc">{weather.desc}</div>
        </div>
        <div className="lp-card lp-surge">
          <div className="lp-surge-label">City Surge Level right now</div>
          <div className="lp-surge-value">{surge !== null ? `${Number(surge).toFixed(2)}x` : '--'}</div>
          <div className="lp-surge-bar-bg">
            <div className="lp-surge-bar-fg" style={{ width: `${surge ? Math.min(Number(surge) / 3, 1) * 100 : 0}%` }} />
          </div>
        </div>
      </div>
      <div className="lp-card lp-forecast">
        <div className="lp-forecast-title" style={{ marginBottom: 28, marginTop: -10 }}>Ride Demand Forecast for {city}</div>
        <div className="lp-forecast-chart-wrap">
          <div className="lp-forecast-yaxis">
            {yLabels.map((label, i) => (
              <div key={i}>{label}</div>
            ))}
          </div>
          <div className="lp-forecast-chart">
            {bars.map((f, i) => (
              <div key={i} className="lp-bar-col">
                <div
                  className="lp-bar"
                  style={{ height: `${(f.eph / maxEph) * 180 || 2}px` }}
                />
                <div className="lp-bar-label">{hourLabels[i]}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Day navigation arrows and label under the histogram */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '18px auto 0 auto', gap: 16 }}>
          <button
            aria-label="Previous day"
            className="lp-btn"
            style={{ width: 48, minWidth: 48, padding: 0, margin: 0, fontSize: 28, background: '#eee', color: '#222', borderRadius: 8 }}
            onClick={() => setSelectedDay((prev) => (prev + 6) % 7)}
          >
            &#8592;
          </button>
          <span className="lp-day-label" style={{ fontWeight: 600, fontSize: 22 }}>{daysOfWeek[selectedDay]}</span>
          <button
            aria-label="Next day"
            className="lp-btn"
            style={{ width: 48, minWidth: 48, padding: 0, margin: 0, fontSize: 28, background: '#eee', color: '#222', borderRadius: 8 }}
            onClick={() => setSelectedDay((prev) => (prev + 1) % 7)}
          >
            &#8594;
          </button>
        </div>
      </div>
      <button
        className="lp-btn"
        onClick={() => {
          startWork();
          navigate("/drive-stats");
        }}
      >
        Start Work
      </button>
      
      <button
        className="lp-btn lp-btn-schedule"
        onClick={() => {
          // Only generate a new plan if one doesn't already exist
          if (!schedulePlan) {
            handleGeneratePlan();
          }
          setScheduleSheetOpen(true);
        }}
      >
        {acceptedSchedule ? "My Smart Schedule" : "Build My Smart Schedule"}
      </button>
      
      <ScheduleBuilderSheet
        open={scheduleSheetOpen}
        onOpenChange={setScheduleSheetOpen}
        plan={schedulePlan}
        onAccept={handleAcceptPlan}
        onEdit={handleEditBlock}
        onRemove={handleRemoveBlock}
        onDismiss={() => setScheduleSheetOpen(false)}
        onDeleteSchedule={handleDeleteSchedule}
        onGeneratePlan={handleGeneratePlan}
        hasAcceptedSchedule={!!acceptedSchedule}
        hasUnsavedChanges={hasUnsavedChanges}
      />
    </div>
  );
}