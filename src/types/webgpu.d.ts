// WebGPU type declarations for TypeScript
// These are minimal declarations needed for WebGPU detection

interface GPURequestAdapterOptions {
    powerPreference?: "low-power" | "high-performance";
}

interface GPUAdapter {
    readonly name: string;
    requestDevice(): Promise<GPUDevice>;
}

interface GPUDevice {
    readonly lost: Promise<GPUDeviceLostInfo>;
}

interface GPUDeviceLostInfo {
    readonly message: string;
    readonly reason: "destroyed" | undefined;
}

interface GPU {
    requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
}

interface Navigator {
    gpu?: GPU;
}

// next-pwa register module declaration
declare module "next-pwa" {
    import type { NextConfig } from "next";
    interface PWAConfig {
        dest?: string;
        register?: boolean;
        skipWaiting?: boolean;
        disable?: boolean;
        runtimeCaching?: Array<{
            urlPattern: RegExp;
            handler: string;
            options?: Record<string, unknown>;
        }>;
    }
    export default function withPWA(config: PWAConfig): (nextConfig: NextConfig) => NextConfig;
}
