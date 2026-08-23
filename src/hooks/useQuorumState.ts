import { useMemo, useState } from "react";
import type { AuthMethod } from "../components/quorum/CustodianCard";
import type { CustodianState } from "../components/quorum/CustodianGrid";

export function useQuorumState(initialK = 2, initialN = 2) {
  const [thresholdK, setThresholdK] = useState(initialK);
  const [totalN, setTotalN] = useState(initialN);
  const [cipher, setCipher] = useState<string>("aes-256-gcm");

  const [custodians, setCustodians] = useState<CustodianState[]>(() => {
    return Array.from({ length: initialN }, (_, i) => ({
      custodianId: i + 1,
      label: `Custodian ${i + 1}`,
      authType: (i === 0 ? "passphrase" : "keyfile") as AuthMethod,
      isVerified: false,
    }));
  });

  const handleThresholdChange = (k: number, n: number) => {
    setThresholdK(k);
    setTotalN(n);
    setCustodians((prev) => {
      return Array.from({ length: n }, (_, i) => {
        const existing = prev.find((p) => p.custodianId === i + 1);
        if (existing) return existing;
        return {
          custodianId: i + 1,
          label: `Custodian ${i + 1}`,
          authType: (i === 0 ? "passphrase" : "keyfile") as AuthMethod,
          isVerified: false,
        };
      });
    });
  };

  const handleUpdateSetup = (
    custodianId: number,
    data: {
      label: string;
      authType: AuthMethod;
      passphrase?: string;
      publicKeyBase64?: string;
    },
  ) => {
    setCustodians((prev) =>
      prev.map((c) =>
        c.custodianId === custodianId
          ? {
              ...c,
              label: data.label,
              authType: data.authType,
              passphrase: data.passphrase,
              publicKeyBase64: data.publicKeyBase64,
            }
          : c,
      ),
    );
  };

  const handleCredentialSubmit = (data: {
    custodianId: number;
    passphrase?: string;
    keyFileContent?: string;
    pqcPrivateKeyBase64?: string;
    publicKeyBase64?: string;
    authType: AuthMethod;
    label?: string;
  }) => {
    setCustodians((prev) =>
      prev.map((c) =>
        c.custodianId === data.custodianId
          ? {
              ...c,
              isVerified: true,
              passphrase: data.passphrase,
              shareDataJson: data.keyFileContent,
              publicKeyBase64: data.publicKeyBase64,
              pqcPrivateKeyBase64: data.pqcPrivateKeyBase64,
              label: data.label || c.label,
              authType: data.authType,
            }
          : c,
      ),
    );
  };

  const verifiedCount = useMemo(() => {
    return custodians.filter((c) => c.isVerified).length;
  }, [custodians]);

  const isQuorumMet = useMemo(() => {
    return verifiedCount >= thresholdK;
  }, [verifiedCount, thresholdK]);

  const resetVerification = () => {
    setCustodians((prev) =>
      prev.map((c) => ({
        ...c,
        isVerified: false,
        passphrase: undefined,
        shareDataJson: undefined,
      })),
    );
  };

  const setFromHeaderCustodians = (
    k: number,
    n: number,
    cipherSuite: string,
    items: Array<{ custodian_id: number; label: string; auth_type: AuthMethod }>,
  ) => {
    setThresholdK(k);
    setTotalN(n);
    setCipher(cipherSuite);
    setCustodians(
      items.map((it) => ({
        custodianId: it.custodian_id,
        label: it.label,
        authType: it.auth_type,
        isVerified: false,
      })),
    );
  };

  return {
    thresholdK,
    totalN,
    cipher,
    custodians,
    verifiedCount,
    isQuorumMet,
    setCipher,
    handleThresholdChange,
    handleUpdateSetup,
    handleCredentialSubmit,
    resetVerification,
    setFromHeaderCustodians,
  };
}
