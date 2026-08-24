/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_AUDIT_HISTORY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
