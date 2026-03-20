"use client";

import * as React from "react";

type SettingsAdminTabsProps = {
  adminSection: "branding" | "instances" | "agents" | "queues";
  onChange: (section: "branding" | "instances" | "agents" | "queues") => void;
  AdminTab: React.ComponentType<{
    label: string;
    active: boolean;
    onClick: () => void;
  }>;
};

export function SettingsAdminTabs({
  adminSection,
  onChange,
  AdminTab,
}: SettingsAdminTabsProps) {
  return (
    <>
      <AdminTab label="Identidade visual" active={adminSection === "branding"} onClick={() => onChange("branding")} />
      <AdminTab label="Instâncias" active={adminSection === "instances"} onClick={() => onChange("instances")} />
      <AdminTab label="Agentes" active={adminSection === "agents"} onClick={() => onChange("agents")} />
      <AdminTab label="Filas" active={adminSection === "queues"} onClick={() => onChange("queues")} />
    </>
  );
}
