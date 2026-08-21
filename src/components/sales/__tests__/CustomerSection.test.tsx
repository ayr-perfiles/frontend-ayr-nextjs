import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { CustomerSection, type SaleContact } from "../CustomerSection";

/**
 * `CustomerSection` no tenía tests (deuda: 1 solo consumidor y cero red). E3 lo reusa tal
 * cual en la página de edición, así que se cubre lo mínimo que un segundo consumidor
 * necesita poder confiar: que renderiza los valores que le pasan, que propaga los setters,
 * y que muestra los errores de validación.
 */

const contact = (o: Partial<SaleContact> = {}): SaleContact =>
  ({ id: "c1", name: "JUAN PEREZ", phone: "999111222", email: "juan@x.com", ...o }) as SaleContact;

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    searchTerm: "20512345678",
    setSearchTerm: vi.fn(),
    searchInputRef: createRef<HTMLDivElement>(),
    suggestedCustomers: [],
    isSearchingClient: false,
    showSuggestions: false,
    setShowSuggestions: vi.fn(),
    onSelectSuggested: vi.fn(),
    onDeepSearch: vi.fn(),
    customerName: "CONSTRUCTORA X SAC",
    setCustomerName: vi.fn(),
    customerAddress: "AV OBRA 123",
    setCustomerAddress: vi.fn(),
    contacts: [contact()],
    selectedContactId: "c1",
    setSelectedContactId: vi.fn(),
    onAddContact: vi.fn(),
    onContactNameChange: vi.fn(),
    onUpdateContact: vi.fn(),
    globalContacts: [],
    ...overrides,
  };
}

/** Busca un input por su value actual (el componente no usa labels asociadas). */
const inputByValue = (v: string) =>
  Array.from(document.querySelectorAll("input")).find((i) => i.value === v);

describe("CustomerSection", () => {
  it("renderiza los valores que recibe (nombre, direccion, documento)", () => {
    render(<CustomerSection {...makeProps()} />);
    expect(inputByValue("CONSTRUCTORA X SAC")).toBeTruthy();
    expect(inputByValue("AV OBRA 123")).toBeTruthy();
    expect(inputByValue("20512345678")).toBeTruthy();
  });

  it("editar el nombre propaga setCustomerName", () => {
    const setCustomerName = vi.fn();
    render(<CustomerSection {...makeProps({ setCustomerName })} />);
    fireEvent.change(inputByValue("CONSTRUCTORA X SAC")!, { target: { value: "NUEVO NOMBRE" } });
    expect(setCustomerName).toHaveBeenCalledWith("NUEVO NOMBRE");
  });

  it("editar la direccion propaga setCustomerAddress", () => {
    const setCustomerAddress = vi.fn();
    render(<CustomerSection {...makeProps({ setCustomerAddress })} />);
    fireEvent.change(inputByValue("AV OBRA 123")!, { target: { value: "OTRA DIRECCION" } });
    expect(setCustomerAddress).toHaveBeenCalledWith("OTRA DIRECCION");
  });

  it("muestra los errores de validacion cuando vienen en fieldErrors", () => {
    render(
      <CustomerSection
        {...makeProps({
          fieldErrors: {
            customerName: "El nombre del cliente es obligatorio",
            documentNumber: "El documento debe tener 8 (DNI) u 11 (RUC) dígitos",
          },
        })}
      />,
    );
    expect(screen.getByText("El nombre del cliente es obligatorio")).toBeTruthy();
    expect(screen.getByText(/El documento debe tener 8/)).toBeTruthy();
  });

  it("sin fieldErrors no muestra mensajes de error", () => {
    render(<CustomerSection {...makeProps()} />);
    expect(screen.queryByText("El nombre del cliente es obligatorio")).toBeNull();
  });

  it("renderiza el contacto que recibe", () => {
    render(<CustomerSection {...makeProps()} />);
    expect(inputByValue("JUAN PEREZ")).toBeTruthy();
  });

  it("sin contactos no rompe", () => {
    expect(() =>
      render(<CustomerSection {...makeProps({ contacts: [], selectedContactId: "" })} />),
    ).not.toThrow();
  });
});
