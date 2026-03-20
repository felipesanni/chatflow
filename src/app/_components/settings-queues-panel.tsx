"use client";

import * as React from "react";
import { Workflow } from "lucide-react";

type SettingsQueuesPanelProps = {
  count: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  canManageQueues: boolean;
  onCreate?: () => void;
  table: React.ReactNode;
  editors: React.ReactNode;
  WorkspaceSection: React.ComponentType<{ title: string; description: string; children: React.ReactNode }>;
  ModuleToolbar: React.ComponentType<{
    title: string;
    count: number;
    searchValue: string;
    searchPlaceholder: string;
    onSearchChange: (value: string) => void;
    actionLabel?: string;
    onActionClick?: () => void;
    actionIcon?: React.ComponentType<{ className?: string }>;
  }>;
};

export function SettingsQueuesPanel({
  count,
  searchValue,
  onSearchChange,
  canManageQueues,
  onCreate,
  table,
  editors,
  WorkspaceSection,
  ModuleToolbar,
}: SettingsQueuesPanelProps) {
  return (
    <WorkspaceSection title="Filas e membros" description="Distribuição de agentes e leitura do volume atual.">
      <ModuleToolbar
        title="Filas"
        count={count}
        searchValue={searchValue}
        searchPlaceholder="Pesquisar fila ou membro"
        onSearchChange={onSearchChange}
        actionLabel={canManageQueues ? "Adicionar fila" : undefined}
        onActionClick={canManageQueues ? onCreate : undefined}
        actionIcon={Workflow}
      />
      {table}
      {editors}
    </WorkspaceSection>
  );
}
