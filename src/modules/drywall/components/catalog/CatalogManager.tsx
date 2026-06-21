import { useState, useEffect } from "react";
import {
  ProductConfig,
  getCatalog,
  saveProduct,
  deleteProduct,
} from "@/modules/drywall/services/catalogService";
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  UploadCloud,
} from "lucide-react";
import { PRODUCT_CATALOG } from "@/config/products";
import toast from "react-hot-toast";
import { DataTable, ColumnDef } from "@/components/ui/DataTable";
import { RowActionsMenu, RowAction } from "@/components/ui/RowActionsMenu";
import { TableFilters } from "@/components/ui/TableFilters";
import { TablePagination } from "@/components/ui/TablePagination";
import { useTableData } from "@/hooks/useTableData";
import { useConfirm } from "@/context/ConfirmContext";

export function CatalogManager() {
  const confirm = useConfirm();
  const [products, setProducts] = useState<ProductConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductConfig | null>(
    null,
  );

  const {
    pageItems,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    searchValue,
    setSearchValue,
    totalFiltered,
  } = useTableData<ProductConfig>({
    data: products,
    searchFields: ["sku", "name"],
    pageSize: 50,
  });

  const loadProducts = async () => {
    setIsLoading(true);
    const data = await getCatalog();
    setProducts(data.sort((a, b) => a.sku.localeCompare(b.sku)));
    setIsLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleMigrateOldCatalog = async () => {
    if (
      !(await confirm({
        title: "Migrar Catálogo",
        message: "¿Deseas importar los productos de tu archivo local a la base de datos?",
        variant: "warning",
      }))
    )
      return;
    setIsLoading(true);
    try {
      for (const [sku, data] of Object.entries(PRODUCT_CATALOG)) {
        await saveProduct({
          sku,
          name: data.name,
          stripWidth: data.stripWidth || 0,
          standardWeight: data.standardWeight || 0,
          lengthMeters: 3.0,
          isActive: true,
        });
      }
      await loadProducts();
      toast.success("Catálogo migrado exitosamente.");
    } catch {
      toast.error("Error en la migración.");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    if (editingProduct.standardWeight <= 0) {
      toast.error(
        "¡ALERTA! El Peso Estándar debe ser mayor a 0. Es obligatorio para calcular mermas.",
      );
      return;
    }

    if (!editingProduct.lengthMeters || editingProduct.lengthMeters <= 0) {
      toast.error(
        "¡ALERTA! El Largo del producto debe ser mayor a 0 para el cálculo matemático de densidad.",
      );
      return;
    }

    setIsSaving(true);
    try {
      await saveProduct(editingProduct);
      await loadProducts();
      setEditingProduct(null);
      toast.success(`Perfil ${editingProduct.sku} guardado correctamente.`);
    } catch {
      toast.error("Error al guardar el perfil.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (sku: string) => {
    if (
      !(await confirm({
        title: "Eliminar Producto",
        message: `¿Estás seguro de eliminar permanentemente el SKU: ${sku}?`,
        variant: "danger",
        confirmLabel: "Eliminar",
      }))
    )
      return;
    try {
      await deleteProduct(sku);
      await loadProducts();
      toast.success("Producto eliminado del catálogo.");
    } catch {
      toast.error("Error al eliminar.");
    }
  };

  const openNewForm = () =>
    setEditingProduct({
      sku: "",
      name: "",
      stripWidth: 0,
      standardWeight: 0,
      lengthMeters: 3.0,
      isActive: true,
    });

  const columns: ColumnDef<ProductConfig>[] = [
    {
      key: "sku",
      header: "SKU",
      render: (p) => (
        <span
          className={`font-black font-mono text-sm ${p.isActive ? "text-gray-900" : "text-gray-400"}`}
        >
          {p.sku}
        </span>
      ),
    },
    {
      key: "name",
      header: "Descripción",
      render: (p) => (
        <span className="font-bold text-gray-600 uppercase">{p.name}</span>
      ),
    },
    {
      key: "dimensions",
      header: "Dimensiones (A x L)",
      align: "center",
      render: (p) => (
        <span className="font-mono font-bold text-gray-500">
          {p.stripWidth} mm x {(p.lengthMeters || 3).toFixed(2)} m
        </span>
      ),
    },
    {
      key: "weight",
      header: "Peso (kg)",
      align: "right",
      render: (p) => (
        <span className="font-mono font-bold text-gray-500">
          {p.standardWeight.toFixed(3)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      align: "center",
      render: (p) => (
        <span
          className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${p.isActive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}
        >
          {p.isActive ? "Activo" : "Inactivo"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      width: "w-24",
      render: (p) => {
        const actions: RowAction[] = [
          {
            id: "edit",
            label: "Editar",
            icon: <Edit2 size={16} />,
            onClick: () => setEditingProduct(p),
          },
          {
            id: "delete",
            label: "Eliminar",
            icon: <Trash2 size={16} />,
            variant: "danger",
            onClick: () => handleDelete(p.sku),
          },
        ];
        return <RowActionsMenu items={actions} />;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <BookOpen className="text-blue-500" size={24} /> Gestión de Catálogo
          </h2>
          <p className="text-gray-500 text-sm font-medium">
            Controla los perfiles, largos de corte y pesos logísticos.
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

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
                Ancho (mm)
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
              <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-1">
                Largo (mts) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                min="0.1"
                value={editingProduct.lengthMeters || ""}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    lengthMeters: Number(e.target.value),
                  })
                }
                className="w-full p-2.5 rounded-lg border border-emerald-200 bg-emerald-50 outline-none focus:border-emerald-500 font-bold font-mono text-emerald-700"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-orange-500 uppercase tracking-widest block mb-1">
                Peso (kg) *
              </label>
              <input
                type="number"
                step="0.001" // 🚀 PERMITIR 3 DECIMALES
                required
                min="0.001" // 🚀 MÍNIMO 3 DECIMALES
                value={editingProduct.standardWeight}
                onChange={(e) =>
                  setEditingProduct({
                    ...editingProduct,
                    standardWeight: Number(e.target.value),
                  })
                }
                className="w-full p-2.5 rounded-lg border border-orange-200 bg-orange-50 outline-none focus:border-orange-500 font-bold font-mono text-orange-700"
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

      {/* FILTROS Y TABLA */}
      <div className="space-y-4">
        <TableFilters
          search={{
            value: searchValue,
            onChange: setSearchValue,
            placeholder: "Buscar por SKU o descripción...",
            isSearching: isLoading && !!searchValue,
          }}
        />

        <DataTable
          columns={columns}
          data={pageItems}
          getRowKey={(p) => p.sku}
          isLoading={isLoading}
          currentPage={currentPage}
          pageSize={pageSize}
          showRowNumber={true}
          getRowClassName={(p) =>
            `group transition-colors ${!p.isActive ? "opacity-50" : "hover:bg-blue-50/20"}`
          }
          emptyState={{
            icon: "BookOpen",
            title: "No hay productos",
            description: "No se encontraron perfiles. Haz clic en Migrar Catálogo.",
          }}
        />

        <TablePagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={totalFiltered}
          onPageChange={setCurrentPage}
          pageSizeOptions={[15, 30, 50, 100]}
          onPageSizeChange={setPageSize}
          totalLabel="Perfiles"
        />
      </div>
    </div>
  );
}
