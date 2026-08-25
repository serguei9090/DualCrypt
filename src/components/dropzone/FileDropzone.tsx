import { open } from "@tauri-apps/plugin-dialog";
import { File, FolderOpen, UploadCloud } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { isTauriEnvironment } from "../../lib/tauri";
import { cn, formatBytes } from "../../lib/utils";

interface FileDropzoneProps {
  onFileSelected: (path: string, name: string, size?: number, rawFile?: File) => void;
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
          onFileSelected(file.name, file.name, file.size, file);
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
      const input = document.createElement("input");
      input.type = "file";
      input.webkitdirectory = true;
      input.onchange = (ev) => {
        const files = (ev.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          const folderName = files[0].webkitRelativePath?.split("/")[0] || "Folder_Archive";
          let totalSize = 0;
          for (let i = 0; i < files.length; i++) totalSize += files[i].size;
          onFileSelected(
            folderName,
            `📁 ${folderName} (${files.length} files)`,
            totalSize,
            files[0],
          );
        }
      };
      input.click();
    }
  };

  return (
    <section
      aria-label="File Selection Dropzone"
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
          onFileSelected(file.name, file.name, file.size, file);
        }
      }}
      className={cn(
        "group relative w-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300",
        isDragging
          ? "border-cyan-400 bg-cyan-950/30 shadow-[0_0_30px_rgba(6,182,212,0.2)]"
          : selectedFileName
            ? "border-emerald-500/50 bg-emerald-950/10"
            : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60",
      )}
    >
      <div
        className={cn(
          "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border transition-all duration-300",
          selectedFileName
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
            : "border-slate-700 bg-slate-800 text-slate-400 group-hover:border-cyan-500/50 group-hover:bg-cyan-500/10 group-hover:text-cyan-400",
        )}
      >
        {selectedFileName ? <File className="h-7 w-7" /> : <UploadCloud className="h-7 w-7" />}
      </div>

      {selectedFileName ? (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono text-sm font-semibold text-slate-100">
              {selectedFileName}
            </span>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 font-mono text-xs text-emerald-300">
              {selectedFileSize ? formatBytes(selectedFileSize) : "Ready"}
            </span>
          </div>
          <button
            type="button"
            onClick={handlePickFile}
            className="text-xs text-cyan-400 hover:text-cyan-300 underline font-semibold cursor-pointer focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none rounded px-2 py-1"
          >
            Choose a different target file
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-200">
            {acceptDencOnly
              ? "Drag and drop your encrypted .denc file here"
              : "Drag and drop any payload file or directory to encrypt"}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handlePickFile}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer focus-visible:ring-1 focus-visible:ring-cyan-500 focus-visible:outline-none"
            >
              <FolderOpen className="h-3.5 w-3.5 text-cyan-400" />
              <span>Browse File</span>
            </button>
            {!acceptDencOnly && (
              <button
                type="button"
                onClick={handlePickFolder}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-600/40 bg-teal-950/40 hover:bg-teal-900/60 text-xs font-semibold text-teal-300 hover:text-teal-100 transition-all cursor-pointer focus-visible:ring-1 focus-visible:ring-teal-500 focus-visible:outline-none"
              >
                <FolderOpen className="h-3.5 w-3.5 text-teal-400" />
                <span>Select Folder</span>
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
