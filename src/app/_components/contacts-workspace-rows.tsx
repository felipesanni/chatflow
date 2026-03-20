"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";

type ContactRowItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  companyName: string | null;
  updatedAtLabel: string;
  lastTicket: {
    statusLabel: string;
    queueName: string | null;
  } | null;
};

type ContactsWorkspaceRowsProps = {
  customers: ContactRowItem[];
  canManageContacts: boolean;
  onEditCustomer: (customerId: string) => void;
  onDeleteCustomer: (customerId: string) => void | Promise<void>;
  DataRow: React.ComponentType<{ children: React.ReactNode }>;
  DataCell: React.ComponentType<{ children: React.ReactNode; subtle?: boolean }>;
};

export function ContactsWorkspaceRows({
  customers,
  canManageContacts,
  onEditCustomer,
  onDeleteCustomer,
  DataRow,
  DataCell,
}: ContactsWorkspaceRowsProps) {
  return (
    <>
      {customers.map((customer) => (
        <DataRow key={customer.id}>
          <DataCell>
            {canManageContacts ? (
              <button
                type="button"
                onClick={() => onEditCustomer(customer.id)}
                className="text-left font-medium text-slate-900 transition hover:text-[#1A1C32]"
              >
                {customer.name}
              </button>
            ) : (
              customer.name
            )}
          </DataCell>
          <DataCell subtle>{customer.phone ?? "Sem telefone"}</DataCell>
          <DataCell subtle>{customer.email ?? "Sem e-mail"}</DataCell>
          <DataCell subtle>{customer.companyName ?? "Sem empresa"}</DataCell>
          <DataCell subtle>
            {customer.lastTicket ? (
              <div className="space-y-1">
                <div>{customer.lastTicket.statusLabel}</div>
                <div className="text-xs text-slate-400">{customer.lastTicket.queueName ?? "Sem fila"}</div>
              </div>
            ) : (
              "Sem historico"
            )}
          </DataCell>
          <DataCell subtle>{customer.updatedAtLabel}</DataCell>
          {canManageContacts ? (
            <DataCell>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => onEditCustomer(customer.id)} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900">
                  <Pencil className="h-4 w-4" />
                  Editar
                </button>
                <button type="button" onClick={() => void onDeleteCustomer(customer.id)} className="inline-flex items-center gap-2 text-sm font-medium text-rose-600 transition hover:text-rose-700">
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </button>
              </div>
            </DataCell>
          ) : null}
        </DataRow>
      ))}
    </>
  );
}
