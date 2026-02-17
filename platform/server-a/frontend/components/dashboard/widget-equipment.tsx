"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Power, PowerOff } from "lucide-react";

interface DeviceItem {
  device_id: string;
  is_active: boolean;
}

interface WidgetEquipmentProps {
  devices: DeviceItem[];
}

export function WidgetEquipment({ devices }: WidgetEquipmentProps) {
  const t = useTranslations("dashboard");
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-base">{t("equipmentStatus")}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        {devices.length > 0 ? (
          <div className="space-y-3">
            {devices.map((device) => (
              <div
                key={device.device_id}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-2">
                  {device.is_active ? (
                    <Power className="h-4 w-4 text-green-500" />
                  ) : (
                    <PowerOff className="h-4 w-4 text-gray-300" />
                  )}
                  <Link
                    href={`/monitoring/${encodeURIComponent(device.device_id)}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {device.device_id}
                  </Link>
                </div>
                <Badge variant={device.is_active ? "success" : "secondary"}>
                  {device.is_active ? "ON" : "OFF"}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 text-sm">
            <PowerOff className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>{t("noEquipmentData")}</p>
            <p className="text-xs mt-1">{t("noEquipmentHint")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
