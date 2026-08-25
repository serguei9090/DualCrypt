import { open } from "@tauri-apps/plugin-dialog";
import { File, FolderOpen, Loader2, UploadCloud } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { isTauriEnvironment } from "../../lib/tauri";
import { cn, formatBytes } from "../../lib/utils";

interface FileDropzoneProps {
  onFileSelected: (path: string, name: string, size?: number, rawFile?: File) => void;
  selectedFileName?: string | null;
  selectedFileSize?: number | null;
  acceptDencOnly?: boolean;
}

interface WebkitFileEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file: (success: (file: File) => void, error?: () => void) => void;
  createReader: () => {
    readEntries: (success: (entries: WebkitFileEntry[]) => void, error?: () => void) => void;
  };
}

interface FileWithPath extends File {
  path?: string;
}

async function scanEntryRecursive(
  entry: WebkitFileEntry | null | undefined,
  path = "",
): Promise<{ file: File; relativePath: string }[]> {
  if (!entry) return [];
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file(
        (f: File) => resolve([{ file: f, relativePath: path + f.name }]),
        () => resolve([]),
      );
    });
  }
  if (entry.isDirectory) {
    const dirReader = entry.createReader();
    const readAllEntries = async (): Promise<WebkitFileEntry[]> => {
      const all: WebkitFileEntry[] = [];
      let batch: WebkitFileEntry[];
      do {
        batch = await new Promise((resolve) => {
          dirReader.readEntries(resolve, () => resolve([]));
        });
        if (batch && batch.length > 0) all.push(...batch);
      } while (batch && batch.length > 0);
      return all;
    };

    const children = await readAllEntries();
    const results: { file: File; relativePath: string }[] = [];
    for (const child of children) {
      const childResults = await scanEntryRecursive(child, `${path + entry.name}/`);
      results.push(...childResults);
    }
    return results;
  }
  return [];
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFileSelected,
  selectedFileName,
  selectedFileSize,
  acceptDencOnly = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isPackagingFolder, setIsPackagingFolder] = useState(false);

  // Tauri v2 drag-and-drop listener
  useEffect(() => {
    if (!isTauriEnvironment()) return;
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/webview")
      .then(({ getCurrentWebview }) => {
        return getCurrentWebview().onDragDropEvent((event) => {
          if (event.payload.type === "over" || event.payload.type === "enter") {
            setIsDragging(true);
          } else if (event.payload.type === "leave") {
            setIsDragging(false);
          } else if (event.payload.type === "drop") {
            setIsDragging(false);
            if (event.payload.paths && event.payload.paths.length > 0) {
              const droppedPath = event.payload.paths[0];
              const name = droppedPath.split(/[\\/]/).pop() || droppedPath;
              onFileSelected(droppedPath, name);
            }
          }
        });
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});

    return () => {
      if (unlisten) unlisten();
    };
  }, [onFileSelected]);

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
      input.onchange = async (ev) => {
        const fileList = (ev.target as HTMLInputElement).files;
        if (fileList && fileList.length > 0) {
          setIsPackagingFolder(true);
          try {
            const folderName = fileList[0].webkitRelativePath?.split("/")[0] || "Folder_Archive";
            const files: { file: globalThis.File; relativePath: string }[] = [];
            for (let i = 0; i < fileList.length; i++) {
              files.push({
                file: fileList[i],
                relativePath: fileList[i].webkitRelativePath || fileList[i].name,
              });
            }

            const { packTarWeb } = await import("../../lib/webCrypto");
            const entries = await Promise.all(
              files.map(async (item) => {
                const buffer = await item.file.arrayBuffer();
                return {
                  name: item.relativePath,
                  data: new Uint8Array(buffer),
                  mtime: item.file.lastModified,
                };
              }),
            );
            const totalSize = files.reduce((acc, f) => acc + f.file.size, 0);
            const tarBytes = packTarWeb(entries);
            const tarBlob = new Blob([tarBytes as unknown as BlobPart], {
              type: "application/x-tar",
            });
            const tarFile = new globalThis.File([tarBlob], `${folderName}.tar`, {
              type: "application/x-tar",
              lastModified: Date.now(),
            });

            onFileSelected(
              folderName,
              `📁 ${folderName} (${files.length} files)`,
              totalSize,
              tarFile,
            );
          } finally {
            setIsPackagingFolder(false);
          }
        }
      };
      input.click();
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(false);

    // 1. Check for Tauri dropped path first
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const firstFile = files[0] as FileWithPath;
      const filePath = firstFile.path;
      if (isTauriEnvironment() && filePath) {
        const name = filePath.split(/[\\/]/).pop() || filePath;
        onFileSelected(filePath, name, firstFile.size);
        return;
      }
    }

    // 2. Check for Web directory items
    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const firstItem = items[0];
      const entry = (
        firstItem as unknown as { webkitGetAsEntry?: () => WebkitFileEntry | null }
      ).webkitGetAsEntry?.();
      if (entry?.isDirectory) {
        setIsPackagingFolder(true);
        try {
          const folderName = entry.name || "Folder_Archive";
          const scannedFiles = await scanEntryRecursive(entry, `${folderName}/`);
          if (scannedFiles.length > 0) {
            const { packTarWeb } = await import("../../lib/webCrypto");
            const entries = await Promise.all(
              scannedFiles.map(async (item) => {
                const buffer = await item.file.arrayBuffer();
                return {
                  name: item.relativePath,
                  data: new Uint8Array(buffer),
                  mtime: item.file.lastModified,
                };
              }),
            );
            const totalSize = scannedFiles.reduce((acc, f) => acc + f.file.size, 0);
            const tarBytes = packTarWeb(entries);
            const tarBlob = new Blob([tarBytes as unknown as BlobPart], {
              type: "application/x-tar",
            });
            const tarFile = new globalThis.File([tarBlob], `${folderName}.tar`, {
              type: "application/x-tar",
              lastModified: Date.now(),
            });

            onFileSelected(
              folderName,
              `📁 ${folderName} (${scannedFiles.length} files)`,
              totalSize,
              tarFile,
            );
            return;
          }
        } finally {
          setIsPackagingFolder(false);
        }
      }
    }

    // 3. Fallback to standard file drop
    if (files && files.length > 0) {
      const file = files[0] as FileWithPath;
      const path = file.path || file.name;
      onFileSelected(path, file.name, file.size, file);
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
      onDrop={handleDrop}
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
          isPackagingFolder
            ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-400 animate-spin"
            : selectedFileName
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : "border-slate-700 bg-slate-800 text-slate-400 group-hover:border-cyan-500/50 group-hover:bg-cyan-500/10 group-hover:text-cyan-400",
        )}
      >
        {isPackagingFolder ? (
          <Loader2 className="h-7 w-7" />
        ) : selectedFileName ? (
          <File className="h-7 w-7" />
        ) : (
          <UploadCloud className="h-7 w-7" />
        )}
      </div>

      {isPackagingFolder ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-cyan-300">
            Archiving folder hierarchy into TAR stream...
          </p>
          <p className="text-xs text-slate-400">
            Packaging files for zero-knowledge threshold encryption
          </p>
        </div>
      ) : selectedFileName ? (
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
