"use client";

import * as React from "react";
import { Plus } from "lucide-react";

type ContactsWorkspaceSectionProps = {
  count: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  canManageContacts: boolean;
  onAddContact?: () => void;
  table: React.ReactNode;
  WorkspaceSection: React.ComponentType<{ title: string; description: string; children: React.ReactNode }>;
  ModuleToolbar: React.ComponentType<{
    title: string;
    count: number;
    searchValue: string;
    searchPlaceholder?: string;
    onSearchChange: (value: string) => void;
    actionLabel?: string;
    onActionClick?: () => void;
    actionIcon?: React.ComponentType<{ className?: string }>;
  }>;
};

export function ContactsWorkspaceSection({
  count,
  searchValue,
  onSearchChange,
  canManageContacts,
  onAddContact,
  table,
  WorkspaceSection,
  ModuleToolbar,
}: ContactsWorkspaceSectionProps) {
  return (
    <WorkspaceSection title="Contatos" description="Visualizacao em lista dos contatos atendidos pela operacao.">
      <ModuleToolbar
        title="Contatos"
        count={count}
        searchValue={searchValue}
        searchPlaceholder="Pesquisar contato, telefone ou empresa"
        onSearchChange={onSearchChange}
        actionLabel={canManageContacts ? "Adicionar contato" : undefined}
        onActionClick={canManageContacts ? onAddContact : undefined}
        actionIcon={Plus}
      />
      {table}
    </WorkspaceSection>
  );
}
