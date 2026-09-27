"use client";

import { useInvoices } from "@/lib/invoices-store";
import { CheckCircleIcon, CloseIcon, FileIcon, Spinner, XCircleIcon } from "@/components/icons";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A fixed corner panel that shows what's uploading right now — visible on every page,
 * since upload can be triggered from the sidebar as well as the dashboard's drop zone. */
export default function UploadToast() {
  const { uploading, uploadProgress, uploadFiles, uploadError, dismissUpload } = useInvoices();
  if (uploadFiles.length === 0) return null;

  const doneCount = uploadFiles.filter((f) => f.status === "done").length;
  const title = uploading
    ? `Uploading ${uploadFiles.length} file${uploadFiles.length > 1 ? "s" : ""}…`
    : uploadError
      ? "Upload failed"
      : `${doneCount} file${doneCount > 1 ? "s" : ""} uploaded`;

  return (
    <div className="upload-toast" role="status">
      <div className="upload-toast-head">
        <span>{title}</span>
        <button className="upload-toast-close" onClick={dismissUpload} aria-label="Dismiss">
          <CloseIcon size={14} />
        </button>
      </div>

      {uploading && (
        <div className="upload-toast-bar">
          <div className="upload-toast-bar-fill" style={{ width: `${Math.round(uploadProgress * 100)}%` }} />
        </div>
      )}

      <ul className="upload-toast-list">
        {uploadFiles.map((f) => (
          <li key={f.id}>
            <FileIcon size={16} className="upload-toast-file-icon" />
            <span className="upload-toast-name" title={f.name}>
              {f.name}
            </span>
            <span className="upload-toast-size">{formatSize(f.size)}</span>
            {f.status === "uploading" && <Spinner size={15} className="upload-toast-status uploading" />}
            {f.status === "done" && <CheckCircleIcon size={16} className="upload-toast-status done" />}
            {f.status === "error" && <XCircleIcon size={16} className="upload-toast-status error" />}
          </li>
        ))}
      </ul>

      {uploadError && <p className="upload-toast-error">{uploadError}</p>}
    </div>
  );
}
