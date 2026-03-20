"use client";

import * as React from "react";

type CalendarWorkspacePanelProps = {
  section: React.ReactNode;
  SimpleWorkspaceView: React.ComponentType<{ children: React.ReactNode }>;
};

export function CalendarWorkspacePanel({
  section,
  SimpleWorkspaceView,
}: CalendarWorkspacePanelProps) {
  return <SimpleWorkspaceView>{section}</SimpleWorkspaceView>;
}
