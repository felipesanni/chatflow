"use client";

import * as React from "react";

type ContactsWorkspaceViewProps = {
  section: React.ReactNode;
};

export function ContactsWorkspaceView({ section }: ContactsWorkspaceViewProps) {
  return <div className="flex h-full flex-col gap-4 p-6">{section}</div>;
}
