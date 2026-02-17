"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getScenarios,
  getActiveScenario,
  loadScenario,
  getFaultTypes,
  getActiveFaults,
  injectFault,
  clearFault,
  getEmulatorDevices,
  type ScenarioInfo,
  type FaultTypeInfo,
  type ActiveFault,
} from "@/lib/api";
import {
  Play,
  Loader2,
  AlertTriangle,
  Trash2,
  Zap,
  CheckCircle,
  RefreshCw,
  Info,
} from "lucide-react";

export default function ScenariosPage() {
  // ── 시나리오 상태 ──
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [activeScenario, setActiveScenario] = useState<ScenarioInfo | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(true);
  const [loadingScenario, setLoadingScenario] = useState<string | null>(null);

  // ── 고장 주입 상태 ──
  const [faultTypes, setFaultTypes] = useState<FaultTypeInfo[]>([]);
  const [activeFaults, setActiveFaults] = useState<ActiveFault[]>([]);
  const [devices, setDevices] = useState<Array<{ device_id: string; name?: string }>>([]);
  const [faultLoading, setFaultLoading] = useState(true);
  const [injectingFault, setInjectingFault] = useState(false);
  const [clearingFault, setClearingFault] = useState<string | null>(null);

  // ── 고장 주입 폼 ──
  const [selectedFaultType, setSelectedFaultType] = useState("");
  const [selectedDevice, setSelectedDevice] = useState("");

  // ── 알림 ──
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // ── 데이터 로딩 ──
  const fetchScenarioData = useCallback(async () => {
    setScenarioLoading(true);
    try {
      const [scenarioList, active] = await Promise.all([
        getScenarios(),
        getActiveScenario(),
      ]);
      setScenarios(Array.isArray(scenarioList) ? scenarioList : []);
      setActiveScenario(active);
    } catch (e) {
      console.error("시나리오 로딩 실패:", e);
    } finally {
      setScenarioLoading(false);
    }
  }, []);

  const fetchFaultData = useCallback(async () => {
    setFaultLoading(true);
    try {
      const [types, active, deviceList] = await Promise.all([
        getFaultTypes(),
        getActiveFaults(),
        getEmulatorDevices(),
      ]);
      setFaultTypes(Array.isArray(types) ? types : []);
      setActiveFaults(Array.isArray(active) ? active : []);
      const devArr = Array.isArray(deviceList) ? deviceList : [];
      setDevices(devArr);
      if (devArr.length > 0 && !selectedDevice) {
        setSelectedDevice(devArr[0].device_id);
      }
    } catch (e) {
      console.error("고장 데이터 로딩 실패:", e);
    } finally {
      setFaultLoading(false);
    }
  }, [selectedDevice]);

  useEffect(() => {
    fetchScenarioData();
    fetchFaultData();
  }, [fetchScenarioData, fetchFaultData]);

  // ── 시나리오 로드 ──
  const handleLoadScenario = async (name: string) => {
    setLoadingScenario(name);
    try {
      const result = await loadScenario(name);
      if (result.success) {
        showToast("success", `시나리오 "${name}" 적용 완료`);
        await fetchScenarioData();
      } else {
        showToast("error", result.message || "시나리오 적용 실패");
      }
    } catch (e) {
      showToast("error", `시나리오 적용 오류: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingScenario(null);
    }
  };

  // ── 고장 주입 ──
  const handleInjectFault = async () => {
    if (!selectedFaultType || !selectedDevice) return;
    setInjectingFault(true);
    try {
      const result = await injectFault({
        fault_type: selectedFaultType,
        target_id: selectedDevice,
      });
      if (result.success) {
        showToast("success", `고장 주입 완료 (ID: ${result.fault_id})`);
        await fetchFaultData();
      } else {
        showToast("error", result.error || "고장 주입 실패");
      }
    } catch (e) {
      showToast("error", `고장 주입 오류: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setInjectingFault(false);
    }
  };

  // ── 고장 해제 ──
  const handleClearFault = async (faultId: string) => {
    setClearingFault(faultId);
    try {
      const result = await clearFault(faultId);
      if (result.success) {
        showToast("success", "고장 해제 완료");
        await fetchFaultData();
      } else {
        showToast("error", "고장 해제 실패");
      }
    } catch (e) {
      showToast("error", `고장 해제 오류: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setClearingFault(null);
    }
  };

  return (
    <div className="min-h-screen">
      <Header title="시나리오 관리" description="시뮬레이션 시나리오 및 고장 주입 관리" />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="p-3 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── 시나리오 섹션 ── */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Play className="h-4 w-4 text-blue-500" />
                    시나리오 목록
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchScenarioData}
                    disabled={scenarioLoading}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${scenarioLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {scenarioLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  </div>
                ) : scenarios.length > 0 ? (
                  <div className="space-y-3">
                    {scenarios.map((scenario) => {
                      const isActive = activeScenario?.name === scenario.name;
                      return (
                        <div
                          key={scenario.name}
                          className={`flex items-start justify-between p-4 rounded-lg border transition-colors ${
                            isActive
                              ? "bg-blue-50 border-blue-200"
                              : "bg-white border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex-1 min-w-0 mr-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">
                                {scenario.display_name || scenario.name}
                              </span>
                              {isActive && (
                                <Badge variant="success">활성</Badge>
                              )}
                            </div>
                            {scenario.description && (
                              <p className="text-xs text-gray-500 mb-2">
                                {scenario.description}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 text-[10px] text-gray-400">
                              {scenario.occupancy !== undefined && (
                                <span>재실률: {(scenario.occupancy * 100).toFixed(0)}%</span>
                              )}
                              {scenario.hvac_mode && (
                                <span>HVAC: {scenario.hvac_mode}</span>
                              )}
                              {scenario.outdoor_temp_min !== undefined &&
                                scenario.outdoor_temp_max !== undefined && (
                                  <span>
                                    외기온: {scenario.outdoor_temp_min}~{scenario.outdoor_temp_max}°C
                                  </span>
                                )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={isActive ? "outline" : "default"}
                            disabled={isActive || loadingScenario === scenario.name}
                            onClick={() => handleLoadScenario(scenario.name)}
                          >
                            {loadingScenario === scenario.name ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isActive ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    <Info className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p>시나리오를 불러올 수 없습니다</p>
                    <p className="text-xs mt-1">Server C 연결을 확인하세요</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 현재 활성 시나리오 상세 */}
            {activeScenario && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    현재 활성 시나리오
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">이름:</span>
                      <span className="ml-2 font-medium">
                        {activeScenario.display_name || activeScenario.name}
                      </span>
                    </div>
                    {activeScenario.hvac_mode && (
                      <div>
                        <span className="text-gray-500">HVAC 모드:</span>
                        <span className="ml-2">{activeScenario.hvac_mode}</span>
                      </div>
                    )}
                    {activeScenario.occupancy !== undefined && (
                      <div>
                        <span className="text-gray-500">재실률:</span>
                        <span className="ml-2">
                          {(activeScenario.occupancy * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                    {activeScenario.solar_factor !== undefined && (
                      <div>
                        <span className="text-gray-500">태양 복사:</span>
                        <span className="ml-2">x{activeScenario.solar_factor}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── 고장 주입 섹션 ── */}
          <div className="space-y-4">
            {/* 고장 주입 폼 */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-orange-500" />
                    고장 주입
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchFaultData}
                    disabled={faultLoading}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${faultLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {faultLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 고장 유형 선택 */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-2">
                        고장 유형
                      </label>
                      <select
                        value={selectedFaultType}
                        onChange={(e) => setSelectedFaultType(e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">선택...</option>
                        {faultTypes.map((ft) => (
                          <option key={ft.id || ft.name} value={ft.id || ft.name}>
                            {ft.name} — {ft.description}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 대상 장비 선택 */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-2">
                        대상 장비
                      </label>
                      <select
                        value={selectedDevice}
                        onChange={(e) => setSelectedDevice(e.target.value)}
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        {devices.map((d) => (
                          <option key={d.device_id} value={d.device_id}>
                            {d.name || d.device_id}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 주입 버튼 */}
                    <Button
                      className="w-full"
                      variant="destructive"
                      disabled={!selectedFaultType || !selectedDevice || injectingFault}
                      onClick={handleInjectFault}
                    >
                      {injectingFault ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Zap className="h-4 w-4 mr-2" />
                      )}
                      고장 주입
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 활성 고장 목록 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  활성 고장 ({activeFaults.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeFaults.length > 0 ? (
                  <div className="space-y-2">
                    {activeFaults.map((fault) => (
                      <div
                        key={fault.fault_id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-red-50 border-red-200"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{fault.fault_type}</span>
                            <Badge variant="danger">활성</Badge>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            대상: {fault.target_id}
                          </p>
                          {fault.injected_at && (
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              주입: {new Date(fault.injected_at).toLocaleString("ko-KR")}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={clearingFault === fault.fault_id}
                          onClick={() => handleClearFault(fault.fault_id)}
                        >
                          {clearingFault === fault.fault_id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    <CheckCircle className="h-6 w-6 mx-auto mb-2 opacity-30" />
                    <p>활성 고장 없음</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 고장 유형 참조 */}
            {faultTypes.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Info className="h-4 w-4 text-gray-400" />
                    고장 유형 가이드
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {faultTypes.map((ft) => (
                      <div
                        key={ft.id || ft.name}
                        className="flex items-start gap-2 text-xs p-2 rounded bg-gray-50"
                      >
                        <Badge variant="outline" className="flex-shrink-0 mt-0.5">
                          {ft.id || ft.name}
                        </Badge>
                        <span className="text-gray-600">{ft.description}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
