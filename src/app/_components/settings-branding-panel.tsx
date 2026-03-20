"use client";

import * as React from "react";

type SettingsBrandingPanelProps = {
  content: React.ReactNode;
  WorkspaceSection: React.ComponentType<{ title: string; description?: string; children: React.ReactNode }>;
};

export function SettingsBrandingPanel({
  content,
  WorkspaceSection,
}: SettingsBrandingPanelProps) {
  return (
    <WorkspaceSection title="Identidade visual" description="Personalize a marca principal exibida no topo do painel.">
      {content}
    </WorkspaceSection>
  );
}
