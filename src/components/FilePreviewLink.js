/**
 * FilePreviewLink.js  —  Sam Cafe Admin Panel
 * Drop-in replacement for a plain `<a href={dataUrl} download>` file link.
 * Clicking it opens a preview modal first (image shown inline; PDF shown
 * via the browser's own built-in viewer, which renders the first page by
 * default; any other file type falls back to a "no preview available"
 * message) with an explicit Download button inside — so the person can
 * see what they're about to download before committing to it.
 *
 * Usage (mirrors the old anchor's props):
 *   <FilePreviewLink href={doc.fileData} download={doc.fileName} label={doc.fileName || "Download file"} />
 *
 * `href` is expected to be a `data:<mime>;base64,...` URL (the convention
 * already used everywhere in this app for uploaded files), but a normal
 * URL works too — mime sniffing falls back to the file extension in that
 * case since there's no data: prefix to read.
 */

import React, { useMemo } from "react";
import closeIcon from "../icon/close-icon.png";
import Button3D from "./Button3D";
import useAnimatedModal from "../hooks/useAnimatedModal";

function sniffMime(href) {
  if (!href) return "";
  const match = /^data:([^;,]+)[;,]/.exec(href);
  if (match) return match[1];
  const ext = href.split(".").pop().split("?")[0].toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return `image/${ext === "jpg" ? "jpeg" : ext}`;
  if (ext === "pdf") return "application/pdf";
  return "";
}

let filePreviewInstanceCounter = 0;

const FilePreviewLink = ({ href, download, label, className = "clickable" }) => {
  // Each FilePreviewLink instance gets its own modal id (rather than
  // sharing one global slot from ModalContext) since a single page can
  // render many of these at once — e.g. one per row in a documents/file
  // table — and each needs to open/close independently.
  const modalId = useMemo(() => `file-preview-${++filePreviewInstanceCounter}`, []);
  const modal = useAnimatedModal(modalId);

  if (!href) return null;

  const mime = sniffMime(href);
  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";
  const fileName = typeof download === "string" ? download : "document";

  return (
    <>
      <a
        href={href}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          modal.open();
        }}
      >
        {label}
      </a>

      {modal.shouldRender && (
        <div className={`modal-overlay ${modal.overlayClass}`} onClick={() => modal.close()}>
          <div
            className={`admin-modal file-preview-modal ${modal.modalClass}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div>
                <h3>{fileName}</h3>
                <span className="sc-modal-sub">Preview</span>
              </div>
              <Button3D variant="cancel" iconOnly onClick={() => modal.close()}>
                <img src={closeIcon} alt="Close" />
              </Button3D>
            </div>

            <div className="admin-modal-body file-preview-body">
              {isImage ? (
                <img src={href} alt={fileName} className="file-preview-image" />
              ) : isPdf ? (
                <iframe src={href} title={fileName} className="file-preview-pdf" />
              ) : (
                <div className="file-preview-fallback">
                  No preview available for this file type.
                </div>
              )}
            </div>

            <div className="admin-modal-footer">
              <Button3D
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = href;
                  link.download = fileName;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                Download ↓
              </Button3D>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FilePreviewLink;