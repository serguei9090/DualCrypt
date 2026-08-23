import type React from "react";
import { type AuthMethod, CustodianCard } from "./CustodianCard";

export interface CustodianState {
  custodianId: number;
  label: string;
  authType: AuthMethod;
  isVerified: boolean;
  passphrase?: string;
  shareDataJson?: string;
}

interface CustodianGridProps {
  custodians: CustodianState[];
  mode: "encrypt_setup" | "decrypt_unlock";
  onCredentialSubmit: (data: {
    custodianId: number;
    passphrase?: string;
    keyFileContent?: string;
    authType: AuthMethod;
    label?: string;
  }) => void;
  onUpdateSetup?: (
    custodianId: number,
    data: { label: string; authType: AuthMethod; passphrase?: string },
  ) => void;
}

export const CustodianGrid: React.FC<CustodianGridProps> = ({
  custodians,
  mode,
  onCredentialSubmit,
  onUpdateSetup,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {custodians.map((c) => (
        <CustodianCard
          key={c.custodianId}
          custodianId={c.custodianId}
          label={c.label}
          authType={c.authType}
          isVerified={c.isVerified}
          mode={mode}
          onCredentialSubmit={onCredentialSubmit}
          onUpdateSetup={(data) => onUpdateSetup?.(c.custodianId, data)}
        />
      ))}
    </div>
  );
};
