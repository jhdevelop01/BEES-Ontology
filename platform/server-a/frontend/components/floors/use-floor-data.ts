"use client";

import { useEffect, useState, useMemo } from "react";
import { useSSE } from "@/lib/sse";
import type {
  EquipmentListItem,
  EnergyBreakdown,
  ActiveAlarm,
  FloorDetails,
} from "@/lib/api";
import { getFloorDetails } from "@/lib/api";
import {
  FLOORS,
  ssePointPrefix,
  calculateFloorStatus,
  type FloorData,
  type FloorRoomData,
  type FloorEquipmentData,
} from "./floor-constants";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8010";

export function useFloorData() {
  const { points, devices, alarms: sseAlarms, connected } = useSSE(60);

  const [equipmentList, setEquipmentList] = useState<EquipmentListItem[]>([]);
  const [energyBreakdown, setEnergyBreakdown] = useState<EnergyBreakdown | null>(null);
  const [activeAlarms, setActiveAlarms] = useState<ActiveAlarm[]>([]);
  const [floorDetailsMap, setFloorDetailsMap] = useState<Record<string, FloorDetails>>({});
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  // 스냅샷 데이터 (SSE 연결 전 초기 데이터)
  const [snapshotPoints, setSnapshotPoints] = useState<
    Record<string, { point_id: string; value: number | null; ts: number; unit: string; quality: string }>
  >({});
  const [snapshotDevices, setSnapshotDevices] = useState<
    Record<string, { device_id: string; is_active: boolean; mode: string; ts: number }>
  >({});
  const [snapshotLoaded, setSnapshotLoaded] = useState(false);

  // 초기 로드: 장비 목록 (1회, raw fetch)
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/equipment`);
        if (!res.ok) throw new Error(`equipment ${res.status}`);
        const data = await res.json();
        const items: EquipmentListItem[] = (data.items || []).filter(
          (e: EquipmentListItem) => e.category !== "component"
        );
        setEquipmentList(items);
      } catch (err) {
        console.error("[BEES] 장비 목록 실패:", err);
        setErrors((prev) => [...prev, `장비 목록: ${err}`]);
      }
    };
    load();
  }, []);

  // 초기 로드: Floor Details (18개 층 병렬, 1회)
  useEffect(() => {
    const load = async () => {
      const results = await Promise.allSettled(
        FLOORS.map((f) => getFloorDetails(f.key))
      );
      const map: Record<string, FloorDetails> = {};
      for (const result of results) {
        if (result.status === "fulfilled") {
          map[result.value.floor_key] = result.value;
        }
      }
      setFloorDetailsMap(map);
    };
    load();
  }, []);

  // 스냅샷: 1회 fetch (SSE 전 초기 데이터 확보)
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/stream/snapshot`);
        if (!res.ok) throw new Error(`snapshot ${res.status}`);
        const data = await res.json();

        // points: array → Record<point_id, point>
        if (Array.isArray(data.points)) {
          const ptMap: typeof snapshotPoints = {};
          for (const p of data.points) {
            ptMap[p.point_id] = p;
          }
          setSnapshotPoints(ptMap);
        } else if (data.points && typeof data.points === "object") {
          // already a record
          setSnapshotPoints(data.points);
        }

        // devices: array → Record<device_id, device>
        if (Array.isArray(data.devices)) {
          const devMap: typeof snapshotDevices = {};
          for (const d of data.devices) {
            devMap[d.device_id] = d;
          }
          setSnapshotDevices(devMap);
        } else if (data.devices && typeof data.devices === "object") {
          setSnapshotDevices(data.devices);
        }

        setSnapshotLoaded(true);
      } catch (err) {
        console.error("[BEES] 스냅샷 실패:", err);
        setErrors((prev) => [...prev, `스냅샷: ${err}`]);
      }
    };
    load();
  }, []);

  // 에너지 + 알람: 30초 폴링 (raw fetch)
  useEffect(() => {
    const fetchData = async () => {
      const errs: string[] = [];
      try {
        const [energyRes, alarmsRes] = await Promise.allSettled([
          fetch(`${API_BASE}/api/energy/breakdown`),
          fetch(`${API_BASE}/api/alarms/active`),
        ]);

        if (energyRes.status === "fulfilled" && energyRes.value.ok) {
          const data = await energyRes.value.json();
          setEnergyBreakdown(data);
        } else if (energyRes.status === "rejected") {
          errs.push(`에너지: ${energyRes.reason}`);
        }

        if (alarmsRes.status === "fulfilled" && alarmsRes.value.ok) {
          const data = await alarmsRes.value.json();
          setActiveAlarms(data.alarms || []);
        } else if (alarmsRes.status === "rejected") {
          errs.push(`알람: ${alarmsRes.reason}`);
        }
      } catch (err) {
        console.error("[BEES] 층별 데이터 실패:", err);
        errs.push(`층별 데이터: ${err}`);
      } finally {
        if (errs.length > 0) setErrors((prev) => [...prev, ...errs]);
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // SSE + snapshot 병합
  const mergedPoints = useMemo(() => {
    return { ...snapshotPoints, ...points };
  }, [snapshotPoints, points]);

  const mergedDevices = useMemo(() => {
    return { ...snapshotDevices, ...devices };
  }, [snapshotDevices, devices]);

  // FloorData[] 계산
  const floorData: FloorData[] = useMemo(() => {
    const nonComponent = equipmentList;

    // 층별 장비 매핑
    const floorEquipMap = new Map<string, EquipmentListItem[]>();
    for (const floor of FLOORS) {
      const matched = nonComponent.filter((eq) => {
        if (!eq.location) return false;
        return eq.location === floor.key || eq.location.startsWith(floor.key + "_");
      });
      floorEquipMap.set(floor.key, matched);
    }

    // 장비 → SSE 프리픽스 매핑
    const equipPrefixMap = new Map<string, string>();
    for (const eq of nonComponent) {
      const prefix = ssePointPrefix(eq.id);
      if (prefix) equipPrefixMap.set(eq.id, prefix);
    }

    return FLOORS.map((floor) => {
      const floorEquips = floorEquipMap.get(floor.key) || [];

      // --- 센서 데이터: RAT(온도), RAH(습도), CO2 ---
      const ratValues: number[] = [];
      const rahValues: number[] = [];
      const co2Values: number[] = [];

      // Special case: UFAD AHUs use different point naming (RAT_UFAD_N instead of AHU_N_RAT)
      for (const eq of floorEquips) {
        const name = eq.id.startsWith("bldg:") ? eq.id.slice(5) : eq.id;
        const ufadMatch = name.match(/^AHU_UFAD_(\d+)$/);
        if (ufadMatch) {
          const n = ufadMatch[1];
          const ratPt = mergedPoints[`bldg:RAT_UFAD_${n}`];
          if (ratPt?.value != null) ratValues.push(Number(ratPt.value));
          const rahPt = mergedPoints[`bldg:RAH_UFAD_${n}`];
          if (rahPt?.value != null) rahValues.push(Number(rahPt.value));
          const co2Pt = mergedPoints[`bldg:CO2_UFAD_${n}`];
          if (co2Pt?.value != null) co2Values.push(Number(co2Pt.value));
        }
      }

      for (const eq of floorEquips) {
        const prefix = equipPrefixMap.get(eq.id);
        if (!prefix) continue;

        for (const [pointId, pt] of Object.entries(mergedPoints)) {
          if (!pointId.startsWith(prefix)) continue;
          if (pt.value === null || pt.value === undefined) continue;
          const num = Number(pt.value);
          if (isNaN(num)) continue;

          if (pointId.endsWith("_RAT")) ratValues.push(num);
          else if (pointId.endsWith("_RAH")) rahValues.push(num);
          else if (pointId.endsWith("_CO2")) co2Values.push(num);
        }
      }

      const avg = (arr: number[]) =>
        arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

      const temperature = avg(ratValues);
      const humidity = avg(rahValues);
      const co2 = avg(co2Values);

      // --- 에너지 ---
      const floorSuffix = floor.key.replace(/^B_/, "");
      const powerKw =
        energyBreakdown?.by_floor?.find(
          (f) => f.floor === floor.key || f.floor === floorSuffix
        )?.kw ?? null;

      // --- 장비 상태 ---
      const equipmentByCategory: Record<string, { total: number; active: number }> = {};
      let activeEquipment = 0;

      for (const eq of floorEquips) {
        const cat = eq.subcategory || eq.category || "other";
        if (!equipmentByCategory[cat]) {
          equipmentByCategory[cat] = { total: 0, active: 0 };
        }
        equipmentByCategory[cat].total++;

        const dev = mergedDevices[eq.id];
        if (dev?.is_active) {
          activeEquipment++;
          equipmentByCategory[cat].active++;
        }
      }

      // --- 알람 ---
      const floorEquipIds = new Set(floorEquips.map((eq) => eq.id));
      const floorEquipNames = new Set(
        floorEquips.map((eq) => {
          const name = eq.id.startsWith("bldg:") ? eq.id.slice(5) : eq.id;
          return name;
        })
      );

      let alarmCritical = 0;
      let alarmWarning = 0;
      let alarmInfo = 0;

      for (const alarm of activeAlarms) {
        const eqName = alarm.equipment || "";
        const eqId = eqName.startsWith("bldg:") ? eqName : `bldg:${eqName}`;
        const bareName = eqName.startsWith("bldg:") ? eqName.slice(5) : eqName;

        if (!floorEquipIds.has(eqId) && !floorEquipNames.has(bareName)) continue;

        if (alarm.severity === "critical") alarmCritical++;
        else if (alarm.severity === "warning") alarmWarning++;
        else alarmInfo++;
      }

      // SSE 알람도 확인
      for (const alarm of sseAlarms) {
        const eqName = alarm.equipment || "";
        const eqId = eqName.startsWith("bldg:") ? eqName : `bldg:${eqName}`;
        const bareName = eqName.startsWith("bldg:") ? eqName.slice(5) : eqName;

        if (!floorEquipIds.has(eqId) && !floorEquipNames.has(bareName)) continue;

        if (alarm.severity === "critical") alarmCritical++;
        else if (alarm.severity === "warning") alarmWarning++;
        else alarmInfo++;
      }

      // --- Floor Details (rooms + equipment details) ---
      const floorSuffixForEnergy = floor.key.replace(/^B_/, "");
      const details = floorDetailsMap[floor.key];
      const totalAreaFromApi = details?.total_area_m2 ?? 0;

      // 에너지 kWh (SSE point)
      const energyPointKey = `bldg:Floor_Energy_${floorSuffixForEnergy}_kWh`;
      const energyPt = mergedPoints[energyPointKey];
      const floorEnergyKwh = energyPt?.value != null ? Number(energyPt.value) : null;

      // Rooms
      const rooms: FloorRoomData[] = (details?.rooms ?? []).map((room) => {
        // SSE 센서값 매핑
        const tempId = room.sensor_ids?.temperature;
        const humId = room.sensor_ids?.humidity;
        const co2Id = room.sensor_ids?.co2;

        const tempPt = tempId ? mergedPoints[`bldg:${tempId}`] : undefined;
        const humPt = humId ? mergedPoints[`bldg:${humId}`] : undefined;
        const co2Pt = co2Id ? mergedPoints[`bldg:${co2Id}`] : undefined;

        const roomTemp = tempPt?.value != null ? Number(tempPt.value) : null;
        const roomHum = humPt?.value != null ? Number(humPt.value) : null;
        const roomCo2 = co2Pt?.value != null ? Number(co2Pt.value) : null;

        // 면적 비율 기반 전력/에너지 추정
        const areaRatio = (room.area_m2 && totalAreaFromApi > 0) ? room.area_m2 / totalAreaFromApi : 0;
        const roomPowerKw = powerKw != null ? powerKw * areaRatio : null;
        const roomEnergyKwh = floorEnergyKwh != null ? floorEnergyKwh * areaRatio : null;

        return {
          id: room.id,
          label: room.label,
          spaceType: room.spaceType,
          area_m2: room.area_m2,
          zone_key: room.zone_key,
          temperature: roomTemp,
          humidity: roomHum,
          co2: roomCo2,
          powerKw: roomPowerKw,
          energyKwh: roomEnergyKwh,
        };
      });

      // Equipment details
      const equipDetails: FloorEquipmentData[] = (details?.equipment ?? []).map((eq) => {
        const dev = mergedDevices[`bldg:${eq.id}`] || mergedDevices[eq.id];
        return {
          id: eq.id,
          name: eq.name,
          label: eq.label,
          type: eq.type,
          category: eq.category,
          subcategory: eq.subcategory,
          controllable: eq.controllable,
          location: eq.location,
          is_active: dev?.is_active ?? false,
        };
      });

      // Override floor averages from room zone sensor data (more reliable)
      const roomTemps = rooms.filter(r => r.temperature != null).map(r => r.temperature!);
      const roomHums = rooms.filter(r => r.humidity != null).map(r => r.humidity!);
      const roomCo2s = rooms.filter(r => r.co2 != null).map(r => r.co2!);

      const finalTemperature = roomTemps.length > 0 ? avg(roomTemps) : temperature;
      const finalHumidity = roomHums.length > 0 ? avg(roomHums) : humidity;
      const finalCo2 = roomCo2s.length > 0 ? avg(roomCo2s) : co2;

      // Zone 센서 미시뮬레이션 시 Room에 장비 기반 층 평균 상속
      if (finalTemperature != null || finalHumidity != null || finalCo2 != null) {
        for (const room of rooms) {
          if (room.temperature == null && finalTemperature != null) room.temperature = finalTemperature;
          if (room.humidity == null && finalHumidity != null) room.humidity = finalHumidity;
          if (room.co2 == null && finalCo2 != null) room.co2 = finalCo2;
        }
      }

      // --- 상태 계산 ---
      const partial = {
        key: floor.key,
        label: floor.label,
        type: floor.type,
        temperature: finalTemperature,
        humidity: finalHumidity,
        co2: finalCo2,
        powerKw,
        totalEquipment: floorEquips.length,
        activeEquipment,
        equipmentByCategory,
        alarmCritical,
        alarmWarning,
        alarmInfo,
        rooms,
        equipmentDetails: equipDetails,
        totalArea_m2: totalAreaFromApi,
        energyKwh: floorEnergyKwh,
      };

      const { status, statusReason } = calculateFloorStatus(partial);

      return { ...partial, status, statusReason };
    });
  }, [equipmentList, mergedPoints, mergedDevices, energyBreakdown, activeAlarms, sseAlarms, floorDetailsMap]);

  const isConnected = connected || snapshotLoaded;

  return { floorData, equipmentList, activeAlarms, loading, connected: isConnected, points: mergedPoints, devices: mergedDevices, errors };
}
