"use client";
import { Provider } from "@/context";
import { Toaster } from "react-hot-toast";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { background: "#1d1e20", color: "#fff", border: "1px solid #35373a" },
          error: { duration: 5000 },
        }}
      />
    </Provider>
  );
}
