"use client";

import * as React from "react";

type ProfileWorkspacePanelProps = {
  section: React.ReactNode;
  SimpleWorkspaceView: React.ComponentType<{ children: React.ReactNode }>;
};

export function ProfileWorkspacePanel({
  section,
  SimpleWorkspaceView,
}: ProfileWorkspacePanelProps) {
  return <SimpleWorkspaceView>{section}</SimpleWorkspaceView>;
}
