import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import "./app.css";

function Loader({ text = "Loading..." }) {
  return <div className="loader">{text}</div>;
}

function ErrorBanner({ error }) {
  if (!error) return null;
  return <div className="error">⚠️ {String(error)}</div>;
}

function Table({ columns, rows, keyField }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align || "left", width: c.width }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[keyField]}>
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align || "left" }}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function App() {
  const [top, setTop] = useState({ loading: true, error: null, rows: [] });
  const [selected, setSelected] = useState(null); // earner_id
  const [daily, setDaily] = useState({ loading: false, error: null, rows: [] });
  const [inc, setInc] = useState({ loading: false, error: null, rows: [] });

  // load top earners on mount
  useEffect(() => {
    let isMounted = true;
    api.topEarners(10)
      .then((rows) => isMounted && setTop({ loading: false, error: null, rows }))
      .catch((e) => isMounted && setTop({ loading: false, error: e, rows: [] }));
    return () => (isMounted = false);
  }, []);

  // when selecting an earner, load daily + incentives
  useEffect(() => {
    if (!selected) return;
    let isMounted = true;

    setDaily((s) => ({ ...s, loading: true, error: null }));
    api.earnerDaily(selected, 14)
      .then((rows) => isMounted && setDaily({ loading: false, error: null, rows }))
      .catch((e) => isMounted && setDaily({ loading: false, error: e, rows: [] }));

    setInc((s) => ({ ...s, loading: true, error: null }));
    api.incentives(selected)
      .then((rows) => isMounted && setInc({ loading: false, error: null, rows }))
      .catch((e) => isMounted && setInc({ loading: false, error: e, rows: [] }));

    return () => (isMounted = false);
  }, [selected]);

  const topCols = useMemo(
    () => [
      { key: "earner_id", label: "Earner", width: 140, render: (r) => (
        <button className="link" onClick={() => setSelected(r.earner_id)} title="View details">
          {r.earner_id}
        </button>
      )},
      { key: "net", label: "Total Net", align: "right", width: 120, render: (r) => euro(r.net) },
    ],
    []
  );

  const dailyCols = useMemo(
    () => [
      { key: "date", label: "Date", width: 120 },
      { key: "total_net_earnings", label: "Net", align: "right", width: 100, render: (r) => euro(r.total_net_earnings) },
      { key: "trips_count", label: "Trips", align: "right", width: 80 },
      { key: "orders_count", label: "Orders", align: "right", width: 80 },
    ],
    []
  );

  const incCols = useMemo(
    () => [
      { key: "week", label: "Week", width: 90 },
      { key: "program", label: "Program" },
      { key: "target_jobs", label: "Target", align: "right", width: 80 },
      { key: "completed_jobs", label: "Done", align: "right", width: 80 },
      { key: "achieved", label: "Achieved", align: "center", width: 90, render: (r) => (r.achieved ? "✅" : "—") },
      { key: "bonus_eur", label: "Bonus", align: "right", width: 90, render: (r) => euro(r.bonus_eur) },
    ],
    []
  );

  return (
    <div className="page">
      <header>
        <h1>Smart Earner – Dashboard</h1>
        <div className="sub">API: {import.meta.env.VITE_API_URL || "http://localhost:8000"}</div>
      </header>

      <section>
        <h2>Top Earners</h2>
        {top.loading ? <Loader /> : <ErrorBanner error={top.error} />}
        {!top.loading && !top.error && (
          <Table keyField="earner_id" columns={topCols} rows={top.rows} />
        )}
      </section>

      {selected && (
        <>
          <section>
            <h2>Daily earnings — {selected}</h2>
            {daily.loading ? <Loader /> : <ErrorBanner error={daily.error} />}
            {!daily.loading && !daily.error && (
              <Table keyField="date" columns={dailyCols} rows={daily.rows} />
            )}
          </section>

          <section>
            <h2>Weekly incentives — {selected}</h2>
            {inc.loading ? <Loader /> : <ErrorBanner error={inc.error} />}
            {!inc.loading && !inc.error && (
              <Table keyField="week" columns={incCols} rows={inc.rows} />
            )}
          </section>
        </>
      )}
    </div>
  );
}

function euro(v) {
  if (v == null) return "—";
  try {
    const n = Number(v);
    return n.toLocaleString(undefined, { style: "currency", currency: "EUR" });
  } catch {
    return String(v);
  }
}
