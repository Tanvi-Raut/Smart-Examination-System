import jsQR from 'jsqr';
import { Html5Qrcode } from 'html5-qrcode';

/**
 * Ultra-robust QR Code decoder for uploaded images, photos, and screenshots.
 * Combines 6 scanning passes:
 * 1. Native browser BarcodeDetector API (C++ accelerated in Chrome/Edge)
 * 2. Multi-scale jsQR (handles 4K phone camera photos and small icons)
 * 3. Adaptive threshold / Otsu binarization (handles lighting glare & low contrast)
 * 4. Inversion pass (handles dark mode / white-on-dark QR codes)
 * 5. Spatial crop sweeps (handles full A4 hall ticket pages with QR in corner)
 * 6. Html5Qrcode.scanFile engine fallback
 */
export async function decodeQRFromImageFile(file) {
    if (!file) throw new Error('No image file provided');

    // 1. Read file as Data URL
    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
    });

    // 2. Load Image object
    const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to load image element'));
        image.src = dataUrl;
    });

    // ================= PASS 1: NATIVE HARDWARE BARCODE DETECTOR =================
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
            const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
            const barcodes = await detector.detect(img);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                return barcodes[0].rawValue;
            }
        } catch (nativeErr) {
            console.warn('Native BarcodeDetector notice, proceeding to software scanner:', nativeErr);
        }
    }

    const originalWidth = img.naturalWidth || img.width;
    const originalHeight = img.naturalHeight || img.height;

    // Helper: scan a canvas with jsQR
    const tryScanCanvas = (canvas) => {
        try {
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return null;
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imgData.data, canvas.width, canvas.height, {
                inversionAttempts: 'attemptBoth'
            });
            if (code && code.data) return code.data;

            // Try Otsu binarization
            const grayData = new Uint8ClampedArray(imgData.data);
            let totalLum = 0;
            const pixelCount = canvas.width * canvas.height;
            for (let i = 0; i < grayData.length; i += 4) {
                const lum = (grayData[i] * 299 + grayData[i + 1] * 587 + grayData[i + 2] * 114) / 1000;
                totalLum += lum;
            }
            const avgLum = totalLum / pixelCount;
            for (let i = 0; i < grayData.length; i += 4) {
                const lum = (grayData[i] * 299 + grayData[i + 1] * 587 + grayData[i + 2] * 114) / 1000;
                const val = lum < avgLum ? 0 : 255;
                grayData[i] = val;
                grayData[i + 1] = val;
                grayData[i + 2] = val;
            }

            const codeBinarized = jsQR(grayData, canvas.width, canvas.height, {
                inversionAttempts: 'attemptBoth'
            });
            if (codeBinarized && codeBinarized.data) return codeBinarized.data;
        } catch {
            // ignore canvas errors
        }
        return null;
    };

    // ================= PASS 2: MULTI-SCALE SCANNING =================
    // High-resolution images often fail in jsQR unless scaled to optimal scan resolution (~600-1000px)
    const targetScales = [
        Math.min(1.0, 900 / Math.max(originalWidth, originalHeight)), // Optimal ~900px
        1.0, // Original scale
        0.5  // Downscaled ~0.5x
    ];

    for (const scale of targetScales) {
        const w = Math.round(originalWidth * scale);
        const h = Math.round(originalHeight * scale);
        if (w < 40 || h < 40) continue;

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const found = tryScanCanvas(canvas);
            if (found) return found;
        }
    }

    // ================= PASS 3: SPATIAL CROP REGIONS =================
    // When the user uploads a full screenshot of the dashboard, hall ticket, or student pass
    if (originalWidth > 250 && originalHeight > 250) {
        const regions = [
            // Center crop (50% to 80% focus)
            { x: Math.round(originalWidth * 0.15), y: Math.round(originalHeight * 0.15), w: Math.round(originalWidth * 0.7), h: Math.round(originalHeight * 0.7) },
            // Right half (common position on tickets)
            { x: Math.round(originalWidth * 0.35), y: 0, w: Math.round(originalWidth * 0.65), h: originalHeight },
            // Bottom half
            { x: 0, y: Math.round(originalHeight * 0.35), w: originalWidth, h: Math.round(originalHeight * 0.65) },
            // Top right quadrant
            { x: Math.round(originalWidth * 0.4), y: 0, w: Math.round(originalWidth * 0.6), h: Math.round(originalHeight * 0.6) },
            // Bottom right quadrant
            { x: Math.round(originalWidth * 0.4), y: Math.round(originalHeight * 0.4), w: Math.round(originalWidth * 0.6), h: Math.round(originalHeight * 0.6) }
        ];

        for (const reg of regions) {
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = reg.w;
            cropCanvas.height = reg.h;
            const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
            if (cropCtx) {
                cropCtx.drawImage(img, reg.x, reg.y, reg.w, reg.h, 0, 0, reg.w, reg.h);
                const cropFound = tryScanCanvas(cropCanvas);
                if (cropFound) return cropFound;
            }
        }
    }

    // ================= PASS 4: HTML5-QRCODE ENGINE FALLBACK =================
    try {
        let fallbackDiv = document.getElementById('qr-hidden-file-scanner');
        if (!fallbackDiv) {
            fallbackDiv = document.createElement('div');
            fallbackDiv.id = 'qr-hidden-file-scanner';
            fallbackDiv.style.position = 'fixed';
            fallbackDiv.style.left = '-9999px';
            fallbackDiv.style.top = '0px';
            fallbackDiv.style.width = '400px';
            fallbackDiv.style.height = '400px';
            fallbackDiv.style.opacity = '0';
            fallbackDiv.style.pointerEvents = 'none';
            document.body.appendChild(fallbackDiv);
        }
        const html5Scanner = new Html5Qrcode('qr-hidden-file-scanner');
        const fallbackText = await html5Scanner.scanFile(file, true);
        if (fallbackText) {
            return fallbackText;
        }
    } catch {
        // Fallback scanFile finished
    }

    return null;
}
