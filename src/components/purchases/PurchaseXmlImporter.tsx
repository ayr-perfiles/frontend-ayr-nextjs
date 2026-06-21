import React, { useState, useRef } from "react";
import { Upload, FileCode2, Loader2, FileArchive, X } from "lucide-react";
import { functions } from "@/lib/firebase/clientApp";
import { httpsCallable } from "firebase/functions";
import toast from "react-hot-toast";
import { PurchaseStagingReview } from "./PurchaseStagingReview";

export function PurchaseXmlImporter() {
  const [loading, setLoading] = useState(false);
  const [stagedPurchases, setStagedPurchases] = useState<any[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    const parseFn = httpsCallable(functions, "parsePurchaseXml");
    
    try {
      const file = files[0];
      const isZip = file.name.toLowerCase().endsWith(".zip");
      
      let payload: any = {};
      if (isZip) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.readAsDataURL(file);
        });
        payload = { zipBase64: base64 };
      } else {
        const text = await file.text();
        payload = { xmlStrings: [text] };
      }

      const result: any = await parseFn(payload);
      if (result.data.success && result.data.purchases.length > 0) {
        setStagedPurchases(result.data.purchases);
        toast.success(`${result.data.purchases.length} comprobante(s) detectado(s).`);
      } else {
        toast.error("No se detectaron facturas válidas en el archivo.");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Error al procesar el archivo.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (stagedPurchases) {
    return <PurchaseStagingReview initialPurchases={stagedPurchases} onFinished={() => setStagedPurchases(null)} />;
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 flex flex-col items-center justify-center text-center space-y-4 hover:border-blue-300 transition-colors group">
      <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
        {loading ? <Loader2 size={32} className="animate-spin" /> : <FileCode2 size={32} />}
      </div>
      
      <div>
        <h3 className="text-lg font-black text-slate-800">Carga Masiva de Facturas XML</h3>
        <p className="text-sm text-slate-500 max-w-xs mx-auto">
          Sube un archivo <span className="font-bold">.xml</span> o un <span className="font-bold">.zip</span> con múltiples facturas de proveedores.
        </p>
      </div>

      <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-black text-sm transition shadow-lg shadow-blue-100 flex items-center gap-2">
        <Upload size={18} />
        SELECCIONAR ARCHIVOS
        <input 
          type="file" 
          accept=".xml,.zip" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileUpload}
          disabled={loading}
        />
      </label>
      
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Formatos soportados: XML (UBL 2.1), ZIP</p>
    </div>
  );
}
