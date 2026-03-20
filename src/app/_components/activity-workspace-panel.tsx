"use client";

import * as React from "react";

type ActivityWorkspacePanelProps = {
  section: React.ReactNode;
  SimpleWorkspaceView: React.ComponentType<{ children: React.ReactNode }>;
};

export function ActivityWorkspacePanel({
  section,
  SimpleWorkspaceView,
}: ActivityWorkspacePanelProps) {
  return <SimpleWorkspaceView>{section}</SimpleWorkspaceView>;
}
