/**
 * AdminImageUpload — drag-drop + file-picker image uploader for admin forms.
 *
 * Props:
 *   currentUrl  {string}   — existing image URL (shown as preview)
 *   onUpload    {fn}       — called with public URL string after successful upload
 *   token       {string}   — admin Bearer token
 *   bucket      {string}   — Supabase storage bucket (default: 'assets')
 *   path        {string}   — storage path without extension (e.g. 'entities/badge-veterans')
 *   label       {string}   — optional label above the widget
 *   size        {number}   — preview size in px (default: 80)
 *   accept      {string}   — MIME types (default: 'image/png,image/jpeg,image/webp')
 */

import { useState, useRef } from 'react';

const GOLD = '#D4AF37';

export default function AdminImageUpload({
  currentUrl,
  onUpload,
  token,
  bucket = 'assets',
  path,
  label,
  size = 80,
  accept = 'image/png,image/jpeg,image/webp',
}) {
  const [preview, setPreview] = useState(currentUrl || null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    if (!path) { setErr('path prop is required'); return; }

    setBusy(true);
    setErr('');

    // Local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('bucket', bucket);
      form.append('path', path);

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setPreview(data.url);
      onUpload(data.url);
    } catch (e) {
      setErr(e.message);
      setPreview(currentUrl || null);
    } finally {
      setBusy(false);
    }
  };

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setErr('Please select an image file');
      return;
    }
    if (file.size > 512 * 1024) {
      setErr('File too large (max 512 KB)');
      return;
    }
    upload(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const containerStyle = {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  };

  const dropZoneStyle = {
    width: size,
    height: size,
    borderRadius: 10,
    border: `2px dashed ${dragging ? GOLD : (err ? '#ef4444' : '#333')}`,
    background: dragging ? 'rgba(212,175,55,0.08)' : '#0f0f0f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: busy ? 'not-allowed' : 'pointer',
    overflow: 'hidden',
    position: 'relative',
    transition: 'border-color .15s, background .15s',
  };

  const overlayStyle = {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: busy ? 1 : 0,
    transition: 'opacity .15s',
  };

  return (
    <div style={containerStyle}>
      {label && (
        <div style={{ fontSize: 9, color: '#6a6078', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', alignSelf: 'flex-start' }}>
          {label}
        </div>
      )}

      <div
        style={dropZoneStyle}
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        title="Click or drag an image to upload"
      >
        {preview ? (
          <img
            src={preview}
            alt="preview"
            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }}
          />
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 2 }}>🖼</div>
            <div style={{ fontSize: 8, color: '#555', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>
              {dragging ? 'DROP' : 'UPLOAD'}
            </div>
          </div>
        )}

        {/* Busy overlay */}
        <div style={overlayStyle}>
          <div className="spin" style={{ width: 20, height: 20, border: `2px solid ${GOLD}`, borderTopColor: 'transparent', borderRadius: '50%' }} />
        </div>
      </div>

      {err && (
        <div style={{ fontSize: 9, color: '#ef4444', fontFamily: "'Barlow Condensed',sans-serif", maxWidth: size, textAlign: 'center' }}>
          {err}
        </div>
      )}

      {!busy && preview && preview !== currentUrl && (
        <div style={{ fontSize: 8, color: '#4ade80', fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>
          ✓ SAVED
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files[0])}
      />
    </div>
  );
}
