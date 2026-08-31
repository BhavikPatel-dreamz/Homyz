"use client";

import React from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  id?: string;
  type?: ToastType;
  title?: string;
  duration?: number;
  dismissible?: boolean;
}

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  title?: string;
  duration: number;
  createdAt: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();
  private recentMessages: Map<string, number> = new Map();

  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener(this.toasts);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  public show(message: string, options: ToastOptions = {}): string {
    if (!message) return "";
    const type = options.type || "info";
    const duration = options.duration ?? (type === "error" ? 6000 : 4000);
    const now = Date.now();

    // Prevent duplicate identical toast within 500ms
    const msgKey = `${type}:${message}`;
    const lastTime = this.recentMessages.get(msgKey);
    if (lastTime && now - lastTime < 500) {
      return "";
    }
    this.recentMessages.set(msgKey, now);

    const id = options.id || Math.random().toString(36).substring(2, 9);
    
    // Clean technical Prisma / DB traces for public display
    let displayMessage = message;
    if (typeof message === "string" && (message.includes("PrismaClient") || message.includes("Invalid `prisma.") || message.includes("db error"))) {
      displayMessage = "An unexpected database error occurred. Please try again.";
      console.error("[Database Error Trace]:", message);
    }

    const existingIdx = this.toasts.findIndex((t) => t.id === id);
    const item: ToastItem = { id, message: displayMessage, type, title: options.title, duration, createdAt: now };

    if (existingIdx >= 0) {
      this.toasts[existingIdx] = item;
    } else {
      if (this.toasts.length >= 5) {
        this.toasts.shift();
      }
      this.toasts.push(item);
    }

    this.notify();
    return id;
  }

  public dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  public clear() {
    this.toasts = [];
    this.notify();
  }

  public success(message: string, options?: Omit<ToastOptions, "type">) {
    return this.show(message, { ...options, type: "success" });
  }

  public error(message: string, options?: Omit<ToastOptions, "type">) {
    return this.show(message, { ...options, type: "error" });
  }

  public warning(message: string, options?: Omit<ToastOptions, "type">) {
    return this.show(message, { ...options, type: "warning" });
  }

  public info(message: string, options?: Omit<ToastOptions, "type">) {
    return this.show(message, { ...options, type: "info" });
  }
}

export const toastManager = new ToastManager();

export const toast = Object.assign(
  (message: string, options?: ToastOptions) => toastManager.show(message, options),
  {
    success: (message: string, options?: Omit<ToastOptions, "type">) => toastManager.success(message, options),
    error: (message: string, options?: Omit<ToastOptions, "type">) => toastManager.error(message, options),
    warning: (message: string, options?: Omit<ToastOptions, "type">) => toastManager.warning(message, options),
    info: (message: string, options?: Omit<ToastOptions, "type">) => toastManager.info(message, options),
    dismiss: (id: string) => toastManager.dismiss(id),
    clear: () => toastManager.clear(),
  }
);
