// BEES Platform — InfluxDB 다운샘플링 태스크
// raw_7d(7일, 원시) → aggregated_30d(30일, 1시간 평균) → aggregated_365d(365일, 1일 평균)
//
// 등록 방법 (InfluxDB CLI 또는 API):
//   influx task create --file downsample.flux --org samsung-gec
//
// 참고: 이 파일은 두 개의 태스크 정의를 포함한다.
//       각각 별도로 등록해야 한다.

// ─── 태스크 1: raw_7d → aggregated_30d (1시간 평균, 매시 정각) ───
// option task = {
//   name: "downsample_hourly",
//   every: 1h,
//   offset: 5m
// }
//
// from(bucket: "raw_7d")
//   |> range(start: -1h)
//   |> filter(fn: (r) => r._measurement == "sensor_data")
//   |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
//   |> set(key: "_measurement", value: "sensor_data")
//   |> to(bucket: "aggregated_30d", org: "samsung-gec")


// ─── 태스크 2: aggregated_30d → aggregated_365d (1일 평균, 매일 자정) ───
// option task = {
//   name: "downsample_daily",
//   every: 1d,
//   offset: 10m
// }
//
// from(bucket: "aggregated_30d")
//   |> range(start: -1d)
//   |> filter(fn: (r) => r._measurement == "sensor_data")
//   |> aggregateWindow(every: 1d, fn: mean, createEmpty: false)
//   |> set(key: "_measurement", value: "sensor_data")
//   |> to(bucket: "aggregated_365d", org: "samsung-gec")
