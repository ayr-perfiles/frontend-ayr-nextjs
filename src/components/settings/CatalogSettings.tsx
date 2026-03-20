import { useState, useEffect } from "react";
import {
  ProductConfig,
  getCatalog,
  saveProduct,
  deleteProduct,
} from "@/services/catalogService";
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  AlertTriangle,
  UploadCloud,
} from "lucide-react";
import { PRODUCT_CATALOG } from "@/config/products";

export function CatalogSettings() {
  const [products, setProducts] = useState<ProductConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Estado para el formulario de Agregar/Editar
  const [editingProduct, setEditingProduct] = useState<ProductConfig | null>(
    null,
  );

  // Cargar productos al iniciar
  const loadProducts = async () => {
    setIsLoading(true);
    const data = await getCatalog();
    setProducts(data.sort((a, b) => a.sku.localeCompare(b.sku))); // Ordenados alfabéticamente
    setIsLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // --- BOTÓN MÁGICO DE MIGRACIÓN ---
  const handleMigrateOldCatalog = async () => {
    if (
      !confirm(
        "¿Deseas importar los productos de tu archivo local a la base de datos?",
      )
    )
      return;
    setIsLoading(true);
    try {
      for (const [sku, data] of Object.entries(PRODUCT_CATALOG)) {
        await saveProduct({
          sku,
          name: (data as any).name,
          stripWidth: (data as any).stripWidth || 0,
          standardWeight:
            (data as any).standardWeight || (data as any).weight || 0,
          isActive: true,
        });
      }
      await loadProducts();
      alert("✅ Catálogo migrado exitosamente.");
    } catch (error) {
      alert("❌ Error en la migración.");
    }
  };

  // --- ACCIONES DEL FORMULARIO ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    setIsSaving(true);
    try {
      await saveProduct(editingProduct);
      await loadProducts();
      setEditingProduct(null); // Cerrar formulario
    } catch (error) {
      alert("Error al guardar.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (sku: string) => {
    if (!confirm(`¿Estás seguro de eliminar permanentemente el SKU: ${sku}?`))
      return;
    try {
      await deleteProduct(sku);
      await loadProducts();
    } catch (error) {
      alert("Error al eliminar.");
    }
  };

  const openNewForm = () =>
    setEditingProduct({
      sku: "",
      name: "",
      stripWidth: 0,
      standardWeight: 0,
      isActive: true,
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <BookOpen className="text-blue-500" size={24} /> Gestión de Catálogo
          </h2>
          <p className="text-gray-500 text-sm font-medium">
            Controla los perfiles, pesos logísticos y anchos de banda.
          </p>
        </div>
        <div className="flex gap-3">
          {products.length === 0 && !isLoading && (
            <button
              onClick={handleMigrateOldCatalog}
              className="bg-orange-100 text-orange-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-200 transition"
            >
              <UploadCloud size={18} /> Migrar Catálogo Antiguo
            </button>
          )}
          <button
            onClick={openNewForm}
            className="bg-gray-900 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition shadow-lg shadow-gray-900/20 active:scale-95"
          >
            <Plus size={18} /> Nuevo Perfil
          </button>
        </div>
      </div>

      {/* FORMULARIO DE EDICIÓN / CREACIÓN */}
      {editingProduct && (
        <form
          onSubmit={handleSave}
          className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex justify-between items-center mb-4 border-b border-blue-100 pb-3">
            <h3 className="font-black text-blue-900">
              {editingProduct.sku === ""
                ? "Crear Nuevo Perfil"
                : `Editando: ${editingProduct.sku}`}
            </h3>
            <button
              type="button"
              onClick={() => setEditingProduct(null)}
              className="text-gray-400 hover:text-red-500"
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">
                SKU *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: P64"
                value={editingProduct.sku}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    sku: e.target.value.toUpperCase(),
                  })
                }
                disabled={
                  products.some((p) => p.sku === editingProduct.sku) &&
                  editingProduct.sku !== ""
                }
                className="w-full p-2.5 rounded-lg border border-blue-200 outline-none focus:border-blue-500 font-bold disabled:bg-gray-100"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">
                Nombre Descriptivo *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Parante 64"
                value={editingProduct.name}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, name: e.target.value })
                }
                className="w-full p-2.5 rounded-lg border border-blue-200 outline-none focus:border-blue-500 font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">
                Ancho Banda (mm)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={editingProduct.stripWidth}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    stripWidth: Number(e.target.value),
                  })
                }
                className="w-full p-2.5 rounded-lg border border-blue-200 outline-none focus:border-blue-500 font-bold font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-1">
                Peso Estándar (kg)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={editingProduct.standardWeight}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    standardWeight: Number(e.target.value),
                  })
                }
                className="w-full p-2.5 rounded-lg border border-blue-200 outline-none focus:border-blue-500 font-bold font-mono"
              />
            </div>
          </div>

          <div className="flex justify-between items-center mt-6 pt-4 border-t border-blue-100">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editingProduct.isActive}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    isActive: e.target.checked,
                  })
                }
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm font-bold text-gray-700">
                Producto Activo (Visible en ventas)
              </span>
            </label>
            <button
              type="submit"
              disabled={isSaving}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}{" "}
              Guardar
            </button>
          </div>
        </form>
      )}

      {/* TABLA DE PRODUCTOS */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 size={32} className="animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="p-4 pl-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    SKU
                  </th>
                  <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Descripción
                  </th>
                  <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                    Ancho Banda
                  </th>
                  <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                    Peso (kg)
                  </th>
                  <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                    Estado
                  </th>
                  <th className="p-4 pr-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-8 text-center text-gray-400 font-bold"
                    >
                      No hay productos. Haz clic en Migrar Catálogo.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => (
                    <tr
                      key={p.sku}
                      className={`hover:bg-gray-50/50 transition ${!p.isActive ? "opacity-50" : ""}`}
                    >
                      <td className="p-4 pl-6 font-black text-gray-900">
                        {p.sku}
                      </td>
                      <td className="p-4 font-bold text-gray-600 uppercase">
                        {p.name}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-gray-500">
                        {p.stripWidth} mm
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-gray-500">
                        {p.standardWeight.toFixed(2)} kg
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${p.isActive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}
                        >
                          {p.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingProduct(p)}
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(p.sku)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
