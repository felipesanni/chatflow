"use client";

import * as React from "react";

type ApiWorkspacePanelProps = {
  section: React.ReactNode;
  SimpleWorkspaceView: React.ComponentType<{ children: React.ReactNode }>;
};

export function ApiWorkspacePanel({
  section,
  SimpleWorkspaceView,
}: ApiWorkspacePanelProps) {
  return <SimpleWorkspaceView>{section}</SimpleWorkspaceView>;
}
