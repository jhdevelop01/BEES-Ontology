"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";
import {
  getCurrentUser,
  getSettings,
  updateSettings,
  getNotificationChannels,
  updateNotificationChannels,
  sendTestNotification,
  type SystemSettings,
  type NotificationChannelConfig,
} from "@/lib/api";
import { Settings, Building2, Zap, Bell, Loader2, Save, Mail, MessageSquare, Send, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

/* ── 메인 페이지 ── */

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
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

  // 알림 채널 상태
  const [notifConfig, setNotifConfig] = useState<NotificationChannelConfig | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState("");
  const [emailSeverity, setEmailSeverity] = useState("warning");
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [slackWebhook, setSlackWebhook] = useState("");
  const [slackSeverity, setSlackSeverity] = useState("critical");
  const [rateLimitMin, setRateLimitMin] = useState(10);
  const [testingChannel, setTestingChannel] = useState<string | null>(null);

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
        setBuildingName("Samsung GEC Tower B");
        setTimezone("Asia/Seoul");
        setDashboardRefresh(5);
        setEnergyRate(120);
        setFloorArea(60000);
      })
      .finally(() => setLoading(false));

    // 알림 채널 설정 로드
    getNotificationChannels()
      .then((nc) => {
        setNotifConfig(nc);
        setEmailEnabled(nc.email.enabled);
        setEmailRecipients(nc.email.recipients);
        setEmailSeverity(nc.email.min_severity);
        setSlackEnabled(nc.slack.enabled);
        setSlackWebhook(nc.slack.webhook_url);
        setSlackSeverity(nc.slack.min_severity);
        setRateLimitMin(nc.rate_limit_minutes);
      })
      .catch(() => {
        // 기본값 유지
      });
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

      // 알림 채널 설정도 저장
      try {
        const updatedNotif = await updateNotificationChannels({
          email: {
            enabled: emailEnabled,
            recipients: emailRecipients,
            min_severity: emailSeverity,
          },
          slack: {
            enabled: slackEnabled,
            webhook_url: slackWebhook,
            min_severity: slackSeverity,
          },
          rate_limit_minutes: rateLimitMin,
        });
        setNotifConfig(updatedNotif);
      } catch {
        // 알림 설정 저장 실패 시에도 시스템 설정 저장은 성공 처리
      }

      addToast({ title: t("saveSuccess"), variant: "success" });
    } catch (err) {
      addToast({
        title: t("saveFailed"),
        description: err instanceof Error ? err.message : tc("error"),
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  // 알림 테스트 전송
  const handleTestNotif = async (channel: "email" | "slack") => {
    setTestingChannel(channel);
    try {
      const result = await sendTestNotification(channel);
      addToast({ title: result.message || t("testSent"), variant: "success" });
    } catch (err) {
      addToast({
        title: t("testFailed"),
        description: err instanceof Error ? err.message : "",
        variant: "error",
      });
    } finally {
      setTestingChannel(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title={t("title")} description={t("description")} />
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          {tc("loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title={t("title")} description={t("description")} />

      <div className="p-3 md:p-6 space-y-6 max-w-4xl">
        {/* 일반 설정 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {t("general")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("buildingName")}</label>
                <input
                  type="text"
                  value={buildingName}
                  onChange={(e) => setBuildingName(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("timezone")}</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("tempUnit")}</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("dashboardRefresh")}</label>
                <select
                  value={dashboardRefresh}
                  onChange={(e) => setDashboardRefresh(parseInt(e.target.value))}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                >
                  <option value={5}>5s</option>
                  <option value={10}>10s</option>
                  <option value={30}>30s</option>
                  <option value={60}>60s</option>
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
              {t("energySettings")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("energyRate")}</label>
                <input
                  type="number"
                  value={energyRate}
                  onChange={(e) => setEnergyRate(parseFloat(e.target.value) || 0)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("floorArea")}</label>
                <input
                  type="number"
                  value={floorArea}
                  onChange={(e) => setFloorArea(parseFloat(e.target.value) || 0)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">EUI Target</label>
                <div className="px-3 py-2 text-sm text-gray-500 bg-gray-50 rounded-lg">
                  {floorArea > 0 ? `${(energyRate * 8760 / floorArea).toFixed(1)} kWh/m²/yr` : "-"}
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
              {t("alarmSettings")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("tempHigh")}</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("tempLow")}</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("humidityHigh")}</label>
                <input
                  type="number"
                  value={alarmHumidityHigh}
                  onChange={(e) => setAlarmHumidityHigh(parseFloat(e.target.value) || 0)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("humidityLow")}</label>
                <input
                  type="number"
                  value={alarmHumidityLow}
                  onChange={(e) => setAlarmHumidityLow(parseFloat(e.target.value) || 0)}
                  disabled={!isAdmin}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("co2High")}</label>
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

        {/* 알림 채널 설정 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {t("notificationSettings")}
              </CardTitle>
              <Link href="/settings/notifications">
                <Button variant="ghost" size="sm" className="text-xs text-gray-500">
                  {t("notificationLog")} <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Rate Limit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("rateLimit")}
              </label>
              <select
                value={rateLimitMin}
                onChange={(e) => setRateLimitMin(parseInt(e.target.value))}
                disabled={!isAdmin}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              >
                <option value={5}>5 min</option>
                <option value={10}>10 min</option>
                <option value={30}>30 min</option>
                <option value={60}>60 min</option>
              </select>
            </div>

            {/* Email 설정 */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-500" /> Email
                </h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailEnabled}
                    onChange={(e) => setEmailEnabled(e.target.checked)}
                    disabled={!isAdmin}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm">{emailEnabled ? t("emailEnabled") : t("emailChannel")}</span>
                </label>
              </div>
              {emailEnabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("emailRecipients")}</label>
                    <input
                      type="text"
                      value={emailRecipients}
                      onChange={(e) => setEmailRecipients(e.target.value)}
                      disabled={!isAdmin}
                      placeholder="admin@example.com, ops@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("emailSeverity")}</label>
                      <select
                        value={emailSeverity}
                        onChange={(e) => setEmailSeverity(e.target.value)}
                        disabled={!isAdmin}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                      >
                        <option value="info">Info+</option>
                        <option value="warning">Warning+</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <div className="pt-5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestNotif("email")}
                        disabled={testingChannel === "email" || !isAdmin}
                      >
                        {testingChannel === "email" ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Send className="h-3 w-3 mr-1" />
                        )}
                        {t("testNotification")}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Slack 설정 */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-purple-500" /> Slack
                </h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={slackEnabled}
                    onChange={(e) => setSlackEnabled(e.target.checked)}
                    disabled={!isAdmin}
                    className="rounded text-purple-600"
                  />
                  <span className="text-sm">{slackEnabled ? t("slackEnabled") : t("slackChannel")}</span>
                </label>
              </div>
              {slackEnabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("slackWebhook")}</label>
                    <input
                      type="text"
                      value={slackWebhook}
                      onChange={(e) => setSlackWebhook(e.target.value)}
                      disabled={!isAdmin}
                      placeholder="https://hooks.slack.com/services/..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("slackSeverity")}</label>
                      <select
                        value={slackSeverity}
                        onChange={(e) => setSlackSeverity(e.target.value)}
                        disabled={!isAdmin}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-50"
                      >
                        <option value="info">Info+</option>
                        <option value="warning">Warning+</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <div className="pt-5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestNotif("slack")}
                        disabled={testingChannel === "slack" || !isAdmin}
                      >
                        {testingChannel === "slack" ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Send className="h-3 w-3 mr-1" />
                        )}
                        {t("testNotification")}
                      </Button>
                    </div>
                  </div>
                </>
              )}
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
              {tc("save")}
            </Button>
          </div>
        ) : (
          <div className="text-sm text-gray-400 text-center">
            {t("userManagement")}
          </div>
        )}
      </div>
    </div>
  );
}
