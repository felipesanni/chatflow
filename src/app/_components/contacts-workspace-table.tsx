"use client";

import * as React from "react";

type ContactsWorkspaceTableProps = {
  canManageContacts: boolean;
  empty: boolean;
  rows: React.ReactNode;
  DataTable: React.ComponentType<{
    columns: string[];
    emptyMessage: string;
    children: React.ReactNode;
    compact?: boolean;
  }>;
};

export function ContactsWorkspaceTable({
  canManageContacts,
  empty,
  rows,
  DataTable,
}: ContactsWorkspaceTableProps) {
  return (
    <DataTable
      columns={
        canManageContacts
          ? ["Nome", "Telefone", "E-mail", "Empresa", "Ultimo ticket", "Atualizado em", "Ações"]
          : ["Nome", "Telefone", "E-mail", "Empresa", "Ultimo ticket", "Atualizado em"]
      }
      emptyMessage="Nenhum contato encontrado."
    >
      {empty ? (
        <tr>
          <td colSpan={canManageContacts ? 7 : 6} className="px-5 py-8 text-sm text-slate-500">
            Nenhum contato encontrado.
          </td>
        </tr>
      ) : (
        rows
      )}
    </DataTable>
  );
}
