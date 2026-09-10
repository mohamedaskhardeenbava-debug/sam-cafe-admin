/**
 * FilePreviewLink.js  —  Sam Cafe Admin Panel
 * Drop-in replacement for a plain `<a href={dataUrl} download>` file link.
 * Renders a thumbnail image right next to the link text — an actual
 * cropped preview for image files, or the server-rendered first-page
 * preview (see server/fileThumbnail.js) for PDF/DOCX files, passed in
 * via the `thumbnail` prop. Falls back to a generic "PDF"/document
 * icon only when no server-rendered thumbnail is available (e.g. a
 * record saved before this feature existed, or rendering failed at
 * upload time). Clicking it opens a full preview modal (image shown
 * inline; PDF shown via the browser's own built-in viewer, which
 * renders the first page by default; any other file type falls back
 * to a "no preview available" message) with an explicit Download
 * button inside — so the person can see what they're about to
 * download before committing to it.
 *
 * Usage (mirrors the old anchor's props):
 *   <FilePreviewLink
 *     href={doc.fileData}
 *     thumbnail={doc.thumbnailData}
 *     download={doc.fileName}
 *     label={doc.fileName || "Download file"}
 *   />
 *
 * `href` is expected to be a `data:<mime>;base64,...` URL (the convention
 * already used everywhere in this app for uploaded files), but a normal
 * URL works too — mime sniffing falls back to the file extension in that
 * case since there's no data: prefix to read. `thumbnail`, when provided,
 * is expected to be a `data:image/jpeg;base64,...` URL — the server never
 * sends one for image files (the image itself already IS its own
 * thumbnail — see `href`), only for rendered PDF/DOCX first pages.
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

/* Lightweight inline-SVG stand-ins used only when no server-rendered
   thumbnail is available for a PDF/DOCX file (see the `thumbnail`
   prop) — mirrors the image thumbnail's footprint without needing new
   binary icon assets. No width/height attributes here — sized
   entirely by the .file-preview-thumb svg CSS rule, so bumping the
   thumbnail size in one place (CSS) is enough; a hardcoded attribute
   here would otherwise need updating to match every time. */
const PdfPlaceholder = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="1.5" width="18" height="21" rx="2" fill="#fde8e8" stroke="#e57373" strokeWidth="1.2" />
    <text x="12" y="15" textAnchor="middle" fontSize="7" fontWeight="700" fill="#c0392b" fontFamily="sans-serif">PDF</text>
  </svg>
);

const GenericFilePlaceholder = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="1.5" width="18" height="21" rx="2" fill="#eef1f5" stroke="#b7bfc9" strokeWidth="1.2" />
    <line x1="7" y1="8" x2="17" y2="8" stroke="#b7bfc9" strokeWidth="1.2" />
    <line x1="7" y1="12" x2="17" y2="12" stroke="#b7bfc9" strokeWidth="1.2" />
    <line x1="7" y1="16" x2="13" y2="16" stroke="#b7bfc9" strokeWidth="1.2" />
  </svg>
);

let filePreviewInstanceCounter = 0;

const FilePreviewLink = ({ href, thumbnail, download, label, className = "clickable" }) => {
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
        className={`file-preview-link ${className}`}
        onClick={(e) => {
          e.preventDefault();
          modal.open();
        }}
      >
        <span className={`file-preview-thumb${isImage ? "" : " file-preview-thumb--document"}`}>
          {isImage ? (
            <img src={href} alt="" />
          ) : thumbnail ? (
            <img src={thumbnail} alt="" />
          ) : isPdf ? (
            <PdfPlaceholder />
          ) : (
            <GenericFilePlaceholder />
          )}
        </span>
        <span className="file-preview-link-label">{label}</span>
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