"use client";

import * as React from "react";

type SettingsWorkspaceSectionProps = {
  tabs: React.ReactNode;
  content: React.ReactNode;
  SettingsWorkspaceView: React.ComponentType<{ tabs: React.ReactNode; content: React.ReactNode }>;
};

export function SettingsWorkspaceSection({
  tabs,
  content,
  SettingsWorkspaceView,
}: SettingsWorkspaceSectionProps) {
  return <SettingsWorkspaceView tabs={tabs} content={content} />;
}
