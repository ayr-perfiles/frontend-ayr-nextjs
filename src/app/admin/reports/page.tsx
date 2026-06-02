"use client";

import { useState } from "react";
import { ReportHub } from "@/core/reports/components/ReportHub";
import { ReportRunner } from "@/core/reports/components/ReportRunner";
import { ReportDefinition } from "@/core/reports/types";

export default function MasterReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportDefinition | null>(null);

  if (selectedReport) {
    return (
      <div className="pb-20">
        <ReportRunner 
          report={selectedReport} 
          onBack={() => setSelectedReport(null)} 
        />
      </div>
    );
  }

  return (
    <div className="pb-20">
      <ReportHub onSelect={setSelectedReport} />
    </div>
  );
}
