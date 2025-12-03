"use client";

import React, { useRef, useState, useEffect, useCallback, Suspense } from 'react';
import { Download, FolderOpen } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

// Default test image
const DEFAULT_IMAGE = '/annotation/ChatGPT Image Nov 24, 2025, 03_40_33 PM.jpeg';

function EditorContent() {
  const searchParams = useSearchParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get image from URL param or use default
  const imagePath = searchParams.get('image') || DEFAULT_IMAGE;

  // Listen for messages from Photopea
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      // Photopea sends back data as ArrayBuffer or string
      if (e.source === iframeRef.current?.contentWindow) {
        // Handle response from Photopea
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
            console.log('Photopea: Operation complete');
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Auto-load image when Photopea is ready
  useEffect(() => {
    if (!isLoaded || imageLoaded) return;

    const loadImage = async () => {
      try {
        // Fetch the image
        const response = await fetch(imagePath);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        
        // Send to Photopea
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(arrayBuffer, '*');
          setImageLoaded(true);
        }
      } catch (err) {
        console.error('Failed to load image:', err);
      }
    };

    // Small delay to ensure Photopea is fully initialized
    const timer = setTimeout(loadImage, 500);
    return () => clearTimeout(timer);
  }, [isLoaded, imageLoaded, imagePath]);

  // Send image to Photopea
  const sendImageToPhotopea = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      if (iframeRef.current?.contentWindow) {
        // Open the file in Photopea
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

  // Photopea config - dark theme to match our UI
  const photopeaConfig = {
    environment: {
      theme: 2, // Dark theme
      vmode: 1, // Single view
    }
  };
  
  const photopeaUrl = `https://www.photopea.com#${encodeURIComponent(JSON.stringify(photopeaConfig))}`;

  return (
    <div className="flex flex-col h-screen w-full bg-neutral-900">
      {/* Top Toolbar */}
      <header className="h-12 border-b border-neutral-800 flex items-center justify-between px-4 bg-neutral-900 flex-shrink-0">
        <div className="flex items-center gap-2">
        </div>
        
        <div className="flex items-center gap-2">
          {/* Open Image */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-white/80 hover:text-white hover:bg-white/10 rounded transition"
          >
            <FolderOpen size={14} />
            Open
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.psd,.ai,.pdf,.svg"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          <div className="w-px h-4 bg-white/20" />
          
          {/* Export Options */}
          <button
            onClick={() => exportImage('png')}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-white text-black hover:bg-white/90 rounded transition font-medium"
          >
            <Download size={14} />
            Export PNG
          </button>
        </div>
      </header>

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
