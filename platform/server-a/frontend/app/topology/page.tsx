"use client";

import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { useSSE } from "@/lib/sse";
import { CsCanvas } from "@/components/topology/cs-canvas";

export default function TopologyPage() {
  const t = useTranslations("topology");
  const { points, devices, connected } = useSSE();

  /* Device status map: bldg:Name → boolean + shortName → boolean */
  const deviceStatusMap: Record<string, boolean> = {};
  for (const [key, dev] of Object.entries(devices)) {
    deviceStatusMap[key] = dev.is_active;
    deviceStatusMap[key.replace("bldg:", "")] = dev.is_active;
  }

  return (
    <div>
      <Header
        title={t("title")}
        description={t("description")}
        connected={connected}
      />
      <CsCanvas
        points={points}
        devices={devices}
        deviceStatusMap={deviceStatusMap}
        connected={connected}
      />
    </div>
  );
}
