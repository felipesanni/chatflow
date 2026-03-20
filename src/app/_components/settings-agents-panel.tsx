"use client";

import * as React from "react";
import { UserPlus } from "lucide-react";

type SettingsAgentsPanelProps = {
  count: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  canManageAgents: boolean;
  onCreate?: () => void;
  table: React.ReactNode;
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

export function SettingsAgentsPanel({
  count,
  searchValue,
  onSearchChange,
  canManageAgents,
  onCreate,
  table,
  WorkspaceSection,
  ModuleToolbar,
}: SettingsAgentsPanelProps) {
  return (
    <WorkspaceSection title="Equipe" description="Criação, leitura e distribuição dos agentes do sistema.">
      <ModuleToolbar
        title="Usuários"
        count={count}
        searchValue={searchValue}
        searchPlaceholder="Pesquisar nome, e-mail ou fila"
        onSearchChange={onSearchChange}
        actionLabel={canManageAgents ? "Adicionar usuário" : undefined}
        onActionClick={canManageAgents ? onCreate : undefined}
        actionIcon={UserPlus}
      />
      {table}
    </WorkspaceSection>
  );
}
