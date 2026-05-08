"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Insight } from "@/lib/types";
import { TrendingDown, TrendingUp, AlertCircle, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  insights: Insight[];
}

const ICONS = {
  "trending-down": TrendingDown,
  "trending-up": TrendingUp,
  alert: AlertCircle,
  pie: PieChart,
};

const COLORS = {
  warning: { bg: "bg-rose-50", text: "text-rose-600", title: "text-rose-700" },
  success: { bg: "bg-emerald-50", text: "text-emerald-600", title: "text-emerald-700" },
  info: { bg: "bg-amber-50", text: "text-amber-600", title: "text-amber-700" },
};

export function InsightsPanel({ insights }: Props) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Insights Clave</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {insights.length === 0 && (
          <p className="text-sm text-slate-500">Sin insights para el período seleccionado.</p>
        )}
        {insights.map((insight, idx) => {
          const Icon = ICONS[insight.icon];
          const color = COLORS[insight.type];
          return (
            <div key={idx} className="flex gap-3">
              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", color.bg, color.text)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className={cn("text-sm font-semibold", color.title)}>{insight.title}</div>
                <div className="mt-0.5 text-xs leading-relaxed text-slate-600">
                  {insight.description}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
