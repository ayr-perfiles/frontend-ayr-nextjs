"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { BulkUploadCoils } from "@/core/coils/components/BulkUploadCoils";

export default function BulkImportPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || role === "OPERATOR")) {
      router.push("/admin/coils");
    }
  }, [user, role, loading, router]);

  if (loading || !user || role === "OPERATOR") {
    return <div className="p-8 text-center text-gray-500">Verificando permisos...</div>;
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* El breadcrumb y el título son manejados por AdminShell, pero podemos añadir un header local si es necesario */}
      <BulkUploadCoils />
    </div>
  );
}
