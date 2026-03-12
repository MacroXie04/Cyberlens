import { useCallback, useEffect, useRef, useState } from "react";

import type { CodeScanStreamEvent } from "../../../types";

export interface FileStatus {
  path: string;
  status: "pending" | "scanning" | "done" | "error";
  findingsCount?: number;
}

export function useCodeScanLiveState(streamEvents: CodeScanStreamEvent[]) {
  const [aiOutput, setAiOutput] = useState("");
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [currentFile, setCurrentFile] = useState("");
  const [fileIndex, setFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [filesScanned, setFilesScanned] = useState(0);
  const pendingChunksRef = useRef<string[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const lastProcessedRef = useRef(0);

  const flushChunks = useCallback(() => {
    if (pendingChunksRef.current.length > 0) {
      const text = pendingChunksRef.current.join("");
      pendingChunksRef.current = [];
      setAiOutput((prev) => prev + text);
    }
    rafIdRef.current = null;
  }, []);

  useEffect(() => {
    const newEvents = streamEvents.slice(lastProcessedRef.current);
    lastProcessedRef.current = streamEvents.length;

    for (const event of newEvents) {
      switch (event.type) {
        case "scan_start":
          setTotalFiles(event.total_files ?? 0);
          setAiOutput("");
          setFiles([]);
          setCurrentFile("");
          setFileIndex(0);
          setFilesScanned(0);
          break;
        case "file_start":
          setCurrentFile(event.file_path || "");
          setFileIndex(event.file_index || 0);
          setAiOutput("");
          setFiles((prev) => {
            const exists = prev.find((file) => file.path === event.file_path);
            if (exists) {
              return prev.map((file) =>
                file.path === event.file_path ? { ...file, status: "scanning" as const } : file
              );
            }
            return [...prev, { path: event.file_path || "", status: "scanning" as const }];
          });
          break;
        case "chunk":
          pendingChunksRef.current.push(event.text || "");
          if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(flushChunks);
          }
          break;
        case "file_complete":
          setFiles((prev) =>
            prev.map((file) =>
              file.path === event.file_path
                ? { ...file, status: "done" as const, findingsCount: event.findings_count }
                : file
            )
          );
          break;
        case "file_error":
          setFiles((prev) =>
            prev.map((file) =>
              file.path === event.file_path ? { ...file, status: "error" as const } : file
            )
          );
          break;
        case "token_update":
          setFilesScanned(event.files_scanned ?? 0);
          break;
        case "scan_summary":
          setFilesScanned((prev) => event.files_scanned ?? prev);
          setCurrentFile("");
          break;
      }
    }
  }, [flushChunks, streamEvents]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  return { aiOutput, currentFile, fileIndex, files, filesScanned, totalFiles };
}
