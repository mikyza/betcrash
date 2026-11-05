"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "./api";

export interface Limits {
  MIN_DEPOSIT: number;
  MAX_DEPOSIT: number;
  MIN_WITHDRAWAL: number;
  MAX_WITHDRAWAL: number;
  MAX_PENDING_WITHDRAWALS: number;
}

// Fallback used until (or if) the server answers. The server is the source of truth: GET /api/v1/payments/limits
export const DEFAULT_LIMITS: Limits = {
  MIN_DEPOSIT: 10,
  MAX_DEPOSIT: 500000,
  MIN_WITHDRAWAL: 100,
  MAX_WITHDRAWAL: 500000,
  MAX_PENDING_WITHDRAWALS: 3,
};

let cache: Limits | null = null;

export function useLimits(): Limits {
  const [limits, setLimits] = useState<Limits>(cache ?? DEFAULT_LIMITS);
  useEffect(() => {
    if (cache) return;
    apiRequest<Limits>("/payments/limits", { auth: false })
      .then((l) => { cache = l; setLimits(l); })
      .catch(() => { /* keep fallback */ });
  }, []);
  return limits;
}
