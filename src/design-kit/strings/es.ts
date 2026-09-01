/**
 * GSM Design Kit — textos de UI genéricos (es).
 *
 * Solo cadenas que sirven en cualquier producto: acciones, estados, mensajes de
 * error/carga/vacío, validación y textos de tema y conexión. Nada de inventario,
 * empresas, planes ni roles: eso vive en el diccionario de la app.
 *
 * Para adaptarlos (otro idioma, otro tono) usa `configureStrings()` en el
 * arranque de la app; los componentes del kit leen siempre `getStrings()`.
 */

export type UiStrings = {
  common: {
    loading: string;
    save: string;
    saving: string;
    cancel: string;
    delete: string;
    edit: string;
    create: string;
    new: string;
    search: string;
    searchPlaceholder: string;
    filter: string;
    clearFilters: string;
    actions: string;
    confirm: string;
    back: string;
    next: string;
    previous: string;
    close: string;
    yes: string;
    no: string;
    all: string;
    none: string;
    active: string;
    inactive: string;
    status: string;
    date: string;
    name: string;
    description: string;
    notes: string;
    email: string;
    phone: string;
    address: string;
    optional: string;
    selectOption: string;
    noResults: string;
    showing: string;
    of: string;
    page: string;
    exportCsv: string;
    download: string;
    copy: string;
    copied: string;
    retry: string;
    details: string;
    viewAll: string;
    created: string;
    updated: string;
    confirmDeleteTitle: string;
    confirmDeleteDescription: string;
    successSaved: string;
    successDeleted: string;
    errorGeneric: string;
    errorNetwork: string;
    theme: string;
    themeLight: string;
    themeDark: string;
    themeSystem: string;
    offlineBanner: string;
    offlineBannerDescription: string;
    onlineBanner: string;
  };
  validation: {
    required: string;
    invalidEmail: string;
    minLength: (n: number) => string;
    maxLength: (n: number) => string;
    positiveNumber: string;
    nonNegativeNumber: string;
    invalidNumber: string;
    invalidDate: string;
    invalidFile: string;
  };
  errors: {
    notFoundTitle: string;
    notFoundDescription: string;
    errorTitle: string;
    errorDescription: string;
    tryAgain: string;
    forbiddenTitle: string;
    forbiddenDescription: string;
    emptyTitle: string;
    emptyDescription: string;
  };
};

export const es: UiStrings = {
  common: {
    loading: "Cargando…",
    save: "Guardar",
    saving: "Guardando…",
    cancel: "Cancelar",
    delete: "Eliminar",
    edit: "Editar",
    create: "Crear",
    new: "Nuevo",
    search: "Buscar",
    searchPlaceholder: "Buscar…",
    filter: "Filtrar",
    clearFilters: "Limpiar filtros",
    actions: "Acciones",
    confirm: "Confirmar",
    back: "Volver",
    next: "Siguiente",
    previous: "Anterior",
    close: "Cerrar",
    yes: "Sí",
    no: "No",
    all: "Todos",
    none: "Ninguno",
    active: "Activo",
    inactive: "Inactivo",
    status: "Estado",
    date: "Fecha",
    name: "Nombre",
    description: "Descripción",
    notes: "Notas",
    email: "Correo electrónico",
    phone: "Teléfono",
    address: "Dirección",
    optional: "opcional",
    selectOption: "Selecciona una opción",
    noResults: "No se encontraron resultados",
    showing: "Mostrando",
    of: "de",
    page: "Página",
    exportCsv: "Exportar CSV",
    download: "Descargar",
    copy: "Copiar",
    copied: "Copiado al portapapeles",
    retry: "Reintentar",
    details: "Detalles",
    viewAll: "Ver todo",
    created: "Creado",
    updated: "Actualizado",
    confirmDeleteTitle: "¿Eliminar este registro?",
    confirmDeleteDescription: "Esta acción no se puede deshacer.",
    successSaved: "Guardado correctamente",
    successDeleted: "Eliminado correctamente",
    errorGeneric: "Ocurrió un error inesperado. Inténtalo de nuevo.",
    errorNetwork: "No se pudo conectar con el servidor. Revisa tu conexión.",
    theme: "Tema",
    themeLight: "Claro",
    themeDark: "Oscuro",
    themeSystem: "Sistema",
    offlineBanner: "Sin conexión",
    offlineBannerDescription: "Los datos pueden no estar actualizados.",
    onlineBanner: "Conexión restablecida",
  },
  validation: {
    required: "Este campo es obligatorio",
    invalidEmail: "Ingresa un correo válido",
    minLength: (n) => `Debe tener al menos ${n} caracteres`,
    maxLength: (n) => `Debe tener como máximo ${n} caracteres`,
    positiveNumber: "Debe ser un número mayor a 0",
    nonNegativeNumber: "Debe ser un número mayor o igual a 0",
    invalidNumber: "Ingresa un número válido",
    invalidDate: "Fecha inválida",
    invalidFile: "Archivo inválido",
  },
  errors: {
    notFoundTitle: "Página no encontrada",
    notFoundDescription: "La página que buscas no existe o fue movida.",
    errorTitle: "Algo salió mal",
    errorDescription: "Ocurrió un error inesperado. Puedes intentar recargar la página.",
    tryAgain: "Intentar de nuevo",
    forbiddenTitle: "Acceso denegado",
    forbiddenDescription: "No tienes permisos para ver esta página.",
    emptyTitle: "Aún no hay nada por aquí",
    emptyDescription: "Cuando existan registros, aparecerán en esta lista.",
  },
};

type UiStringsOverride = {
  [K in keyof UiStrings]?: Partial<UiStrings[K]>;
};

let current: UiStrings = es;

/**
 * Sobreescribe cadenas del kit. Se fusiona por sección, así que basta con pasar
 * las claves que cambian. Llamar una sola vez, al arrancar la app (en Next, en
 * un módulo que importe el layout raíz).
 */
export function configureStrings(overrides: UiStringsOverride): void {
  current = {
    common: { ...current.common, ...overrides.common },
    validation: { ...current.validation, ...overrides.validation },
    errors: { ...current.errors, ...overrides.errors },
  };
}

/** Restaura el diccionario original del kit. Pensado para tests. */
export function resetStrings(): void {
  current = es;
}

/** Diccionario vigente. Todos los componentes del kit lo leen en cada render. */
export function getStrings(): UiStrings {
  return current;
}
