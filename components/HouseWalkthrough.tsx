"use client";

import React, { useEffect, useRef, useCallback } from "react";

const TOTAL_FRAMES = 70;

export default function HouseWalkthrough() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // In-memory array of preloaded images
  const imagesRef = useRef<(HTMLImageElement | null)[]>(new Array(TOTAL_FRAMES).fill(null));
  const currentRenderedFrameRef = useRef<number>(1);
  const targetFrameRef = useRef<number>(1);
  const isTickingRef = useRef<boolean>(false);

  // Helper to format frame path
  const getFramePath = useCallback((frameIndex: number) => {
    const padded = String(frameIndex).padStart(2, "0");
    return `/houseWalkthrough/${padded}.webp`;
  }, []);

  // Canvas drawing function
  const renderFrame = useCallback((frameIdx: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Find requested frame or closest available frame
    let img: HTMLImageElement | null = imagesRef.current[frameIdx - 1];
    if (!img || !img.complete || img.naturalWidth === 0) {
      for (let delta = 1; delta < TOTAL_FRAMES; delta++) {
        const prev = imagesRef.current[frameIdx - 1 - delta];
        if (prev && prev.complete && prev.naturalWidth > 0) {
          img = prev;
          break;
        }
        const next = imagesRef.current[frameIdx - 1 + delta];
        if (next && next.complete && next.naturalWidth > 0) {
          img = next;
          break;
        }
      }
    }

    if (!img || !img.complete || img.naturalWidth === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;

    // Ensure canvas backing store matches retina display resolution
    if (canvas.width !== Math.floor(displayWidth * dpr) || canvas.height !== Math.floor(displayHeight * dpr)) {
      canvas.width = Math.floor(displayWidth * dpr);
      canvas.height = Math.floor(displayHeight * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Object-fit: cover logic
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    const scale = Math.max(displayWidth / naturalW, displayHeight / naturalH);
    const drawW = naturalW * scale;
    const drawH = naturalH * scale;
    const offsetX = (displayWidth - drawW) / 2;
    const offsetY = (displayHeight - drawH) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    ctx.restore();

    currentRenderedFrameRef.current = frameIdx;
  }, []);

  // Preload all frames immediately
  useEffect(() => {
    let isCancelled = false;

    // Load first frame immediately
    const img1 = new Image();
    img1.src = getFramePath(1);
    img1.onload = () => {
      if (isCancelled) return;
      imagesRef.current[0] = img1;
      renderFrame(1);
    };

    // Load all other frames in parallel
    for (let i = 2; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = getFramePath(i);
      img.onload = () => {
        if (isCancelled) return;
        imagesRef.current[i - 1] = img;
        // If this newly loaded frame is what we are currently waiting for, render it
        if (i === targetFrameRef.current) {
          renderFrame(i);
        }
      };
    }

    return () => {
      isCancelled = true;
    };
  }, [getFramePath, renderFrame]);

  // Window resize listener
  useEffect(() => {
    const handleResize = () => {
      renderFrame(targetFrameRef.current);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderFrame]);

  // Scroll listener with requestAnimationFrame
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;

      const scrollY = window.scrollY;
      const maxScroll = containerRef.current.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? Math.max(0, Math.min(1, scrollY / maxScroll)) : 0;

      const target = Math.min(
        TOTAL_FRAMES,
        Math.max(1, Math.round(progress * (TOTAL_FRAMES - 1)) + 1)
      );

      targetFrameRef.current = target;

      if (!isTickingRef.current) {
        isTickingRef.current = true;
        requestAnimationFrame(() => {
          renderFrame(targetFrameRef.current);
          isTickingRef.current = false;
        });
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Initial call
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, [renderFrame]);

  return (
    <div ref={containerRef} className="relative w-full min-h-[400vh] bg-black">
      {/* Pinned Fullscreen Canvas */}
      <div className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none select-none">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </div>
  );
}
