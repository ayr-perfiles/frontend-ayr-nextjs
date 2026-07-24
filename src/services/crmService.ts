import { algoliaClient, ALGOLIA_INDICES } from "@/lib/algoliaClient";
import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  updateDoc,
  documentId,
  endBefore,
  getCountFromServer,
  limit,
  limitToLast,
  startAfter,
  addDoc,
  arrayRemove,
  arrayUnion,
  deleteDoc,
} from "firebase/firestore";

// 1. OBTENER TODOS LOS CLIENTES (Para la tabla principal)
export interface FetchCustomersParams {
  pageSize: number;
  searchTerm: string;
  direction?: "first" | "next" | "prev";
  cursorDoc?: any;
  page?: number;
}

export const fetchCustomersPaginated = async (params: FetchCustomersParams) => {
  const {
    pageSize,
    searchTerm,
    direction = "first",
    cursorDoc,
    page = 0,
  } = params;

  // ==========================================
  // MOTOR 1: ALGOLIA (Búsqueda ultrarrápida por Nombre o RUC)
  // ==========================================
  if (searchTerm && searchTerm.trim().length > 0) {
    const {
      hits,
      nbPages,
      page: currentPage,
      nbHits,
    } = await algoliaClient.searchSingleIndex({
      indexName: ALGOLIA_INDICES.CUSTOMERS || "customers_index",
      searchParams: { query: searchTerm, hitsPerPage: pageSize, page },
    });

    const hitIds = hits.map((h: any) => h.objectID);
    let customers: any[] = [];

    if (hitIds.length > 0) {
      const qDocs = query(
        collection(db, "customers"),
        where(documentId(), "in", hitIds),
      );
      const snap = await getDocs(qDocs);
      const firestoreDocs = snap.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,

      }));

      // Reordenar según relevancia de Algolia
      customers = hitIds
        .map((id) => firestoreDocs.find((d) => d.id === id))
        .filter(Boolean);
    }

    return {
      customers,
      isAlgolia: true,
      algoliaData: { totalPages: nbPages, currentPage, nbHits },
      firstDoc: null,
      lastDoc: null,
      totalCount: nbHits,
    };
  }

  // ==========================================
  // MOTOR 2: FIRESTORE (Navegación normal)
  // ==========================================
  const collRef = collection(db, "customers");

  const countSnapshot = await getCountFromServer(collRef);
  const totalCount = countSnapshot.data().count;

  // Firebase no permite ordenar por defecto sin un campo específico,
  // usaremos el documentId (RUC) para mantener un orden consistente en la paginación.
  let paginationConstraints: any[] = [orderBy(documentId(), "asc")];

  if (direction === "next" && cursorDoc) {
    paginationConstraints.push(startAfter(cursorDoc));
    paginationConstraints.push(limit(pageSize));
  } else if (direction === "prev" && cursorDoc) {
    paginationConstraints.push(endBefore(cursorDoc));
    paginationConstraints.push(limitToLast(pageSize));
  } else {
    paginationConstraints.push(limit(pageSize));
  }

  const finalQuery = query(collRef, ...paginationConstraints);
  const snapshot = await getDocs(finalQuery);

  const customers = snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,

  }));

  return {
    customers,
    isAlgolia: false,
    firstDoc: snapshot.docs.length > 0 ? snapshot.docs[0] : null,
    lastDoc:
      snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
    totalCount,
  };
};

// 2. OBTENER EL PERFIL COMPLETO DEL CLIENTE (Datos, Contactos e Historial)
export interface CustomerProfile {
  customerData: {
    id: string;
    name: string;
    address?: string;
    [key: string]: any;
  };
  contacts: any[];
  salesHistory: any[];
}

export const getCustomerProfile = async (documentNumber: string): Promise<CustomerProfile | null> => {
  try {
    const customerRef = doc(db, "customers", documentNumber);
    const customerSnap = await getDoc(customerRef);
    if (!customerSnap.exists()) throw new Error("Cliente no encontrado");
    
    const data = customerSnap.data();
    const customerData = { 
      id: customerSnap.id, 
      name: data.name || "SIN NOMBRE",
      address: data.address || "",
      ...data 
    };

    const contactsQuery = query(
      collection(db, "contacts"),
      where("associatedCompanyIds", "array-contains", documentNumber),
    );
    const contactsSnap = await getDocs(contactsQuery);
    const contacts = contactsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // 🔥 MEJORA ENTERPRISE: Solo traemos las últimas 50 operaciones
    // DOS mundos coexisten en 'sales' (ver CLAUDE.md v6.27, refactor de processSale/createQuotation):
    // - LEGACY: el RUC vive en documentNumber (ventas POS creadas antes del refactor).
    // - NUEVO: el RUC vive en customerDocument, documentNumber queda "" (post-refactor).
    // Firestore no tiene OR entre campos distintos -> 2 queries, unidas y dedupeadas por id.
    // Retirar la query legacy solo cuando corra el backfill que migre documentNumber -> customerDocument.
    const trimmedDoc = String(documentNumber).trim();
    const [legacySnap, newSnap] = await Promise.all([
      getDocs(query(
        collection(db, "sales"),
        where("documentNumber", "==", trimmedDoc),
        orderBy("timestamp", "desc"),
        limit(50),
      )),
      getDocs(query(
        collection(db, "sales"),
        where("customerDocument", "==", trimmedDoc),
        orderBy("timestamp", "desc"), // Requiere índice compuesto sales(customerDocument ASC, timestamp DESC) — NO desplegado aún
        limit(50),
      )),
    ]);

    const salesById = new Map<string, any>();
    for (const d of [...legacySnap.docs, ...newSnap.docs]) {
      salesById.set(d.id, { id: d.id, ...d.data() });
    }

    const toMillis = (ts: any) => ts?.toMillis?.() ?? (ts instanceof Date ? ts.getTime() : 0);
    const salesHistory = Array.from(salesById.values())
      .sort((a, b) => toMillis(b.timestamp) - toMillis(a.timestamp))
      .slice(0, 50);

    return { customerData, contacts, salesHistory };
  } catch (error) {
    console.error("Error obteniendo perfil:", error);
    return null;
  }
};


// 3. ACTUALIZAR ESTADO DE PAGO (Cuentas por Cobrar)
export const updatePaymentStatus = async (
  saleId: string,
  status: "PAID" | "PENDING",
) => {
  try {
    const saleRef = doc(db, "sales", saleId);
    await updateDoc(saleRef, { paymentStatus: status });
    return { success: true };
  } catch (error) {
    console.error("Error actualizando pago:", error);
    throw new Error("No se pudo actualizar el estado de pago.");
  }
};

// 4. GUARDAR CONTACTO (Crea o Edita y lo enlaza a la empresa)
export const saveContact = async (
  contactId: string | null,
  contactData: { name: string; phone: string; email: string; role?: string },
  companyId: string,
) => {
  try {
    if (contactId) {
      // EDITAR CONTACTO EXISTENTE
      const contactRef = doc(db, "contacts", contactId);
      await updateDoc(contactRef, {
        ...contactData,
        // Nos aseguramos que la empresa siga en su array por seguridad
        associatedCompanyIds: arrayUnion(companyId),
      });
      return { success: true, id: contactId };
    } else {
      // CREAR NUEVO CONTACTO
      const newContactRef = await addDoc(collection(db, "contacts"), {
        ...contactData,
        associatedCompanyIds: [companyId], // Lo enlazamos desde el nacimiento
        createdAt: new Date(),
      });
      return { success: true, id: newContactRef.id };
    }
  } catch (error) {
    console.error("Error guardando contacto:", error);
    throw new Error("No se pudo guardar el contacto.");
  }
};

// 5. DESENLAZAR CONTACTO DE UNA EMPRESA
export const unlinkContact = async (contactId: string, companyId: string) => {
  try {
    const contactRef = doc(db, "contacts", contactId);
    const contactSnap = await getDoc(contactRef);

    if (!contactSnap.exists()) throw new Error("Contacto no encontrado");

    const contactData = contactSnap.data();
    const companies = contactData.associatedCompanyIds || [];

    // Si solo pertenece a esta empresa, lo borramos de la base de datos para no dejar "basura"
    if (companies.length <= 1 && companies.includes(companyId)) {
      await deleteDoc(contactRef);
    } else {
      // Si pertenece a múltiples empresas, solo le quitamos esta empresa de su array
      await updateDoc(contactRef, {
        associatedCompanyIds: arrayRemove(companyId),
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Error desenlazando contacto:", error);
    throw new Error("No se pudo remover el contacto.");
  }
};

export const linkExistingContact = async (
  contactId: string,
  companyId: string,
) => {
  try {
    const contactRef = doc(db, "contacts", contactId);
    await updateDoc(contactRef, {
      associatedCompanyIds: arrayUnion(companyId),
    });
    return { success: true };
  } catch (error) {
    console.error("Error enlazando contacto:", error);
    throw new Error("No se pudo enlazar el contacto.");
  }
};
