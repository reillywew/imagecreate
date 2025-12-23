"use client";

import React, { useRef, useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import EditorToolbar from './EditorToolbar';

// Default test image
const DEFAULT_IMAGE = '/annotation/ChatGPT Image Nov 24, 2025, 03_40_33 PM.jpeg';

// Photopea config - dark theme to match our UI
const photopeaConfig = {
  environment: {
    theme: 2, // Dark theme
    vmode: 1, // Single view
  }
};

const photopeaUrl = `https://www.photopea.com#${encodeURIComponent(JSON.stringify(photopeaConfig))}`;

function EditorContent() {
  const searchParams = useSearchParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = useState(false); // Iframe loaded
  const [photopeaReady, setPhotopeaReady] = useState(false); // Photopea app ready
  const [imageData, setImageData] = useState<ArrayBuffer | null>(null);
  const [imageSent, setImageSent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get image from URL param or use default
  const imagePath = searchParams.get('image') || DEFAULT_IMAGE;

  // 1. Fetch image immediately on mount
  useEffect(() => {
    let active = true;
    const fetchImage = async () => {
      try {
        const response = await fetch(imagePath);
        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        if (active) setImageData(buffer);
      } catch (err) {
        console.error('Failed to load image:', err);
      }
    };
    fetchImage();
    return () => { active = false; };
  }, [imagePath]);

  // 2. Listen for messages from Photopea
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.source === iframeRef.current?.contentWindow) {
        if (e.data instanceof ArrayBuffer) {
          // This is image data - could save it
          const blob = new Blob([e.data], { type: 'image/png' });
          const url = URL.createObjectURL(blob);
          
          // Auto-download
          const link = document.createElement('a');
          link.href = url;
          link.download = 'edited-image.png';
          link.click();
          URL.revokeObjectURL(url);
        } else if (typeof e.data === 'string') {
          if (e.data === 'done') {
            console.log('Photopea: Ready');
            setPhotopeaReady(true);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // 3. Send image when both Photopea is ready AND Image Data is loaded
  useEffect(() => {
    if (photopeaReady && imageData && !imageSent && iframeRef.current?.contentWindow) {
      // Send to Photopea
      iframeRef.current.contentWindow.postMessage(imageData, '*');
      setImageSent(true);
    }
  }, [photopeaReady, imageData, imageSent]);

  // Send new file (upload) to Photopea
  const sendImageToPhotopea = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(arrayBuffer, '*');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // Request export from Photopea
  const exportImage = useCallback((format: 'png' | 'jpg' | 'psd' = 'png') => {
    if (!iframeRef.current?.contentWindow) return;
    
    const script = format === 'psd' 
      ? 'app.activeDocument.saveToOE("psd");'
      : `app.activeDocument.saveToOE("${format}");`;
    
    iframeRef.current.contentWindow.postMessage(script, '*');
  }, []);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      sendImageToPhotopea(file);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-neutral-900">
      <EditorToolbar
        fileInputRef={fileInputRef}
        onOpenClick={() => fileInputRef.current?.click()}
        onFileChange={handleFileUpload}
        onExportPng={() => exportImage('png')}
      />

      {/* Photopea Iframe */}
      <div className="flex-1 relative">
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
              <span className="text-sm text-white/50">Loading editor...</span>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={photopeaUrl}
          className="w-full h-full border-0"
          onLoad={() => setIsLoaded(true)}
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}

function EditorFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-neutral-900">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
        <span className="text-sm text-white/50">Loading...</span>
      </div>
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<EditorFallback />}>
      <EditorContent />
    </Suspense>
  );
}
