"use client";

import * as React from "react";

type SimpleWorkspaceViewProps = {
  children: React.ReactNode;
};

export function SimpleWorkspaceView({ children }: SimpleWorkspaceViewProps) {
  return <div className="flex h-full flex-col gap-4 p-6">{children}</div>;
}
