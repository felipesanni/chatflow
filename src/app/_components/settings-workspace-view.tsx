"use client";

import * as React from "react";

type SettingsWorkspaceViewProps = {
  tabs: React.ReactNode;
  content: React.ReactNode;
};

export function SettingsWorkspaceView({ tabs, content }: SettingsWorkspaceViewProps) {
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex flex-wrap gap-2">{tabs}</div>
      {content}
    </div>
  );
}
