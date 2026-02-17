"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  getCurrentUser,
  getSettings,
  updateSettings,
  type SystemSettings,
} from "@/lib/api";
import { Settings, Building2, Zap, Bell, Loader2, Save } from "lucide-react";

/* ── 메인 페이지 ── */

export default function SettingsPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  // 설정값
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 편집 폼 상태
  const [buildingName, setBuildingName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [tempUnit, setTempUnit] = useState("°C");
  const [dashboardRefresh, setDashboardRefresh] = useState(5);
  const [energyRate, setEnergyRate] = useState(0);
  const [floorArea, setFloorArea] = useState(0);
  const [alarmTempHigh, setAlarmTempHigh] = useState(28);
  const [alarmTempLow, setAlarmTempLow] = useState(18);
  const [alarmHumidityHigh, setAlarmHumidityHigh] = useState(70);
  const [alarmHumidityLow, setAlarmHumidityLow] = useState(30);
  const [alarmCo2High, setAlarmCo2High] = useState(1000);

  // 설정 로드
  useEffect(() => {
    setLoading(true);
    getSettings()
      .then((data) => {
        setSettings(data);
        setBuildingName(data.building_name);
        setTimezone(data.timezone);
        setTempUnit(data.units?.temperature || "°C");
        setDashboardRefresh(data.dashboard_refresh);
        setEnergyRate(data.energy_rate);
        setFloorArea(data.floor_area);
        setAlarmTempHigh(data.alarm_config?.temperature_high ?? 28);
        setAlarmTempLow(data.alarm_config?.temperature_low ?? 18);
        setAlarmHumidityHigh(data.alarm_config?.humidity_high ?? 70);
        setAlarmHumidityLow(data.alarm_config?.humidity_low ?? 30);
        setAlarmCo2High(data.alarm_config?.co2_high ?? 1000);
      })
      .catch(() => {
        // 기본값
        setBuildingName("삼성물산 GEC B동");
        setTimezone("Asia/Seoul");
        setDashboardRefresh(5);
        setEnergyRate(120);
        setFloorArea(60000);
      })
      .finally(() => setLoading(false));
  }, []);

  // 저장
  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateSettings({
        building_name: buildingName,
        timezone,
        units: { temperature: tempUnit },
        dashboard_refresh: dashboardRefresh,
        energy_rate: energyRate,
        floor_area: floorArea,
        alarm_config: {
          temperature_high: alarmTempHigh,
          temperature_low: alarmTempLow,
          humidity_high: alarmHumidityHigh,
          humidity_low: alarmHumidityLow,
          co2_high: alarmCo2High,
        },
      });
      setSettings(updated);
      addToast({ title: "설정이 저장되었습니다", variant: "success" });
    } catch (err) {
      addToast({
        title: "설정 저장 실패",
        description: err instanceof Error ? err.message : "오류 발생",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="설정" description="시스템 설정 관리" />
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          설정 로딩 중...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="설정" description="시스템 설정 관리" />

      <div className="p-3 md:p-6 space-y-6 max-w-4xl">
        {/* 일반 설정 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              일반 설정
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">건물 이름</label>
                <input
                  type="text"
                  value={buildingName}
                  onChange={(e) => setBuildingName(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">타임존</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                >
                  <option value="Asia/Seoul">Asia/Seoul (KST)</option>
                  <option value="UTC">UTC</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">온도 단위</label>
                <div className="flex gap-3">
                  {["°C", "°F"].map((unit) => (
                    <label key={unit} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="tempUnit"
                        value={unit}
                        checked={tempUnit === unit}
                        onChange={(e) => setTempUnit(e.target.value)}
                        disabled={!isAdmin}
                        className="text-blue-600"
                      />
                      <span className="text-sm">{unit}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">대시보드 새로고침 주기</label>
                <select
                  value={dashboardRefresh}
                  onChange={(e) => setDashboardRefresh(parseInt(e.target.value))}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                >
                  <option value={5}>5초</option>
                  <option value={10}>10초</option>
                  <option value={30}>30초</option>
                  <option value={60}>60초</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 에너지 설정 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" />
              에너지 설정
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">전기 요금 (원/kWh)</label>
                <input
                  type="number"
                  value={energyRate}
                  onChange={(e) => setEnergyRate(parseFloat(e.target.value) || 0)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">건물 면적 (m²)</label>
                <input
                  type="number"
                  value={floorArea}
                  onChange={(e) => setFloorArea(parseFloat(e.target.value) || 0)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">EUI 목표</label>
                <div className="px-3 py-2 text-sm text-gray-500 bg-gray-50 rounded-lg">
                  {floorArea > 0 ? `${(energyRate * 8760 / floorArea).toFixed(1)} kWh/m²/년` : "-"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 알람 설정 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              알람 임계값
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">온도 상한 (°C)</label>
                <input
                  type="number"
                  step="0.5"
                  value={alarmTempHigh}
                  onChange={(e) => setAlarmTempHigh(parseFloat(e.target.value) || 0)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">온도 하한 (°C)</label>
                <input
                  type="number"
                  step="0.5"
                  value={alarmTempLow}
                  onChange={(e) => setAlarmTempLow(parseFloat(e.target.value) || 0)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">습도 상한 (%)</label>
                <input
                  type="number"
                  value={alarmHumidityHigh}
                  onChange={(e) => setAlarmHumidityHigh(parseFloat(e.target.value) || 0)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">습도 하한 (%)</label>
                <input
                  type="number"
                  value={alarmHumidityLow}
                  onChange={(e) => setAlarmHumidityLow(parseFloat(e.target.value) || 0)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CO2 상한 (ppm)</label>
                <input
                  type="number"
                  value={alarmCo2High}
                  onChange={(e) => setAlarmCo2High(parseFloat(e.target.value) || 0)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 저장 버튼 */}
        {isAdmin ? (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              저장
            </Button>
          </div>
        ) : (
          <div className="text-sm text-gray-400 text-center">
            설정 변경은 관리자 권한이 필요합니다.
          </div>
        )}
      </div>
    </div>
  );
}
