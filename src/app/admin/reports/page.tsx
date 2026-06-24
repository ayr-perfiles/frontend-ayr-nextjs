"use client";

import { useState } from "react";
import { ReportHub } from "@/core/reports/components/ReportHub";
import { ReportRunner } from "@/core/reports/components/ReportRunner";
import { ReportDefinition } from "@/core/reports/types";

export default function MasterReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportDefinition | null>(null);
  const [reportFilters, setReportFilters] = useState<Record<string, any>>({});

  const handleSelectReport = (report: ReportDefinition) => {
    const newFilters: Record<string, any> = {};
    report.filters.forEach((f) => {
      if (reportFilters[f.id] !== undefined) {
        newFilters[f.id] = reportFilters[f.id];
      } else {
        newFilters[f.id] = f.defaultValue;
      }
    });
    // Si el periodo es CUSTOM, conservar también las fechas de inicio/fin si ya existen
    if (newFilters.period === "CUSTOM") {
      newFilters.startDate = reportFilters.startDate || "";
      newFilters.endDate = reportFilters.endDate || "";
    }
    setReportFilters(newFilters);
    setSelectedReport(report);
  };

  if (selectedReport) {
    return (
      <div className="pb-20">
        <ReportRunner
          report={selectedReport}
          filters={reportFilters}
          onFiltersChange={setReportFilters}
          onBack={() => setSelectedReport(null)}
        />
      </div>
    );
  }

  return (
    <div className="pb-20">
      <ReportHub onSelect={handleSelectReport} />
    </div>
  );
}
