-- hourly expectation by city and day of week
DROP VIEW IF EXISTS v_city_hour_forecast;
CREATE VIEW v_city_hour_forecast AS
SELECT
  city_id,
  CAST(strftime('%H', start_time) AS INTEGER) AS hour,
  CAST(strftime('%w', start_time) AS INTEGER) AS dow,
  COUNT(*) AS trips,
  AVG(net_earnings) AS avg_net_per_trip,
  CASE WHEN SUM(duration_mins) > 0
       THEN SUM(net_earnings) / (SUM(duration_mins)/60.0)
       ELSE 0 END AS eph
FROM rides_trips
GROUP BY city_id, dow, hour;