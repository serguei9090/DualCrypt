import { open } from "@tauri-apps/plugin-dialog";
import { File, FolderOpen, UploadCloud } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { isTauriEnvironment } from "../../lib/tauri";
import { cn, formatBytes } from "../../lib/utils";

interface FileDropzoneProps {
  onFileSelected: (path: string, name: string, size?: number) => void;
  selectedFileName?: string | null;
  selectedFileSize?: number | null;
  acceptDencOnly?: boolean;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFileSelected,
  selectedFileName,
  selectedFileSize,
  acceptDencOnly = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handlePickFile = async () => {
    if (isTauriEnvironment()) {
      const filters = acceptDencOnly
        ? [{ name: "DualCrypt Encrypted Container", extensions: ["denc"] }]
        : [{ name: "All Files", extensions: ["*"] }];

      const selected = await open({
        multiple: false,
        directory: false,
        filters,
      });

      if (selected && typeof selected === "string") {
        const name = selected.split(/[\\/]/).pop() || selected;
        onFileSelected(selected, name);
      }
    } else {
      // Browser fallback file input
      const input = document.createElement("input");
      input.type = "file";
      if (acceptDencOnly) input.accept = ".denc";
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          onFileSelected(`/mock/path/${file.name}`, file.name, file.size);
        }
      };
      input.click();
    }
  };

  const handlePickFolder = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTauriEnvironment()) {
      const selected = await open({
        multiple: false,
        directory: true,
      });

      if (selected && typeof selected === "string") {
        const name = selected.split(/[\\/]/).pop() || selected;
        onFileSelected(selected, `📁 ${name} (Folder Archive)`);
      }
    } else {
      onFileSelected(
        "/mock/path/enterprise-folder",
        "📁 enterprise-folder (Folder Archive)",
        10485760,
      );
    }
  };

  return (
    <button
      type="button"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handlePickFile();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) {
          onFileSelected(`/mock/path/${file.name}`, file.name, file.size);
        }
      }}
      onClick={handlePickFile}
      className={cn(
        "group relative w-full flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300",
        isDragging
          ? "border-cyan-400 bg-cyan-950/30 shadow-[0_0_30px_rgba(6,182,212,0.2)]"
          : selectedFileName
            ? "border-emerald-500/50 bg-emerald-950/10 hover:border-emerald-400"
            : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60",
      )}
    >
      <div
        className={cn(
          "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border transition-all duration-300",
          selectedFileName
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
            : "border-zinc-700 bg-zinc-850 text-zinc-400 group-hover:border-cyan-500/50 group-hover:bg-cyan-500/10 group-hover:text-cyan-400",
        )}
      >
        {selectedFileName ? <File className="h-7 w-7" /> : <UploadCloud className="h-7 w-7" />}
      </div>

      {selectedFileName ? (
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono text-sm font-semibold text-zinc-100">
              {selectedFileName}
            </span>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 font-mono text-xs text-emerald-300">
              {selectedFileSize ? formatBytes(selectedFileSize) : "Ready"}
            </span>
          </div>
          <p className="text-xs text-zinc-400">Click to choose a different target file</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-zinc-200">
            {acceptDencOnly
              ? "Drag and drop your encrypted .denc file here"
              : "Drag and drop any payload file or directory to encrypt"}
          </p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-xs text-zinc-400 flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5 text-cyan-400" /> Click to browse file
            </span>
            {!acceptDencOnly && (
              <>
                <span className="text-zinc-600">•</span>
                <button
                  type="button"
                  onClick={handlePickFolder}
                  className="text-xs text-teal-400 hover:text-teal-300 underline font-semibold flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                >
                  <FolderOpen className="h-3.5 w-3.5" /> Select Whole Folder
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </button>
  );
};
