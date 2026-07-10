"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Network, Layers } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useSSE } from "@/lib/sse";
import { CsCanvas } from "@/components/topology/cs-canvas";
import { BrickTopologyLiveCanvas } from "@/components/topology/brick-topology-live-canvas";

type TabKey = "topology" | "cross-section";

export default function TopologyPage() {
  const t = useTranslations("topology");
  const [activeTab, setActiveTab] = useState<TabKey>("topology");
  const { points, devices, connected } = useSSE();

  /* Device status map: bldg:Name → boolean + shortName → boolean */
  const deviceStatusMap: Record<string, boolean> = {};
  for (const [key, dev] of Object.entries(devices)) {
    deviceStatusMap[key] = dev.is_active;
    deviceStatusMap[key.replace("bldg:", "")] = dev.is_active;
  }

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "topology", label: t("tabTopology"), icon: <Network className="h-4 w-4" /> },
    { key: "cross-section", label: t("tabCrossSection"), icon: <Layers className="h-4 w-4" /> },
  ];

  return (
    <div>
      <Header title={t("title")} description={t("description")} connected={connected} />

      {/* Tab navigation */}
      <div className="px-3 md:px-6 pt-4">
        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-800/50 backdrop-blur border border-slate-700/50 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "text-cyan-400 bg-slate-700/60 border-b-2 border-cyan-400"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-700/30"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "topology" ? (
        <BrickTopologyLiveCanvas />
      ) : (
        <CsCanvas
          points={points}
          devices={devices}
          deviceStatusMap={deviceStatusMap}
          connected={connected}
        />
      )}
    </div>
  );
}
