"use client";

import * as React from "react";
import { Plus } from "lucide-react";

type SettingsInstancesPanelProps = {
  count: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  canManageInstances: boolean;
  onCreate?: () => void;
  table: React.ReactNode;
  info: React.ReactNode;
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

export function SettingsInstancesPanel({
  count,
  searchValue,
  onSearchChange,
  canManageInstances,
  onCreate,
  table,
  info,
  WorkspaceSection,
  ModuleToolbar,
}: SettingsInstancesPanelProps) {
  return (
    <WorkspaceSection title="Canais e instâncias" description="Gerencie as conexões com a Evolution em um único lugar dentro das configurações.">
      <ModuleToolbar
        title="Conexões"
        count={count}
        searchValue={searchValue}
        searchPlaceholder="Pesquisar instância, telefone ou status"
        onSearchChange={onSearchChange}
        actionLabel={canManageInstances ? "Nova conexão" : undefined}
        onActionClick={canManageInstances ? onCreate : undefined}
        actionIcon={Plus}
      />
      {table}
      {info}
    </WorkspaceSection>
  );
}
