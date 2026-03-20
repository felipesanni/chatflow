"use client";

import * as React from "react";

type AutomationsWorkspacePanelProps = {
  section: React.ReactNode;
  SimpleWorkspaceView: React.ComponentType<{ children: React.ReactNode }>;
};

export function AutomationsWorkspacePanel({
  section,
  SimpleWorkspaceView,
}: AutomationsWorkspacePanelProps) {
  return <SimpleWorkspaceView>{section}</SimpleWorkspaceView>;
}
