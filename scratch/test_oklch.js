// Test OKLCH conversion math
function oklchToRgb(l, c, h, a = 1) {
    // Normalize L (0-1 or 0-100%)
    if (typeof l === 'string' && l.endsWith('%')) {
        l = parseFloat(l) / 100;
    } else {
        l = parseFloat(l);
    }

    // Normalize C
    if (typeof c === 'string' && c.endsWith('%')) {
        c = (parseFloat(c) / 100) * 0.4;
    } else {
        c = parseFloat(c);
    }

    // Normalize H (degrees)
    h = parseFloat(h) || 0;

    // Normalize A
    if (typeof a === 'string' && a.endsWith('%')) {
        a = parseFloat(a) / 100;
    } else {
        a = parseFloat(a);
        if (isNaN(a)) a = 1;
    }

    const hRad = (h * Math.PI) / 180;
    const aLab = c * Math.cos(hRad);
    const bLab = c * Math.sin(hRad);

    const l_ = l + 0.3963377774 * aLab + 0.2158037573 * bLab;
    const m_ = l - 0.1055613458 * aLab - 0.0638541728 * bLab;
    const s_ = l - 0.0894841775 * aLab - 1.2914855480 * bLab;

    const lLin = l_ * l_ * l_;
    const mLin = m_ * m_ * m_;
    const sLin = s_ * s_ * s_;

    const rLin = +4.0767416621 * lLin - 3.3077115913 * mLin + 0.2309699292 * sLin;
    const gLin = -1.2684380046 * lLin + 2.6097574011 * mLin - 0.3413193965 * sLin;
    const bLin = -0.0041960863 * lLin - 0.7034186147 * mLin + 1.7076147010 * sLin;

    const transfer = (cVal) => {
        if (cVal <= 0.0031308) {
            return 12.92 * cVal;
        }
        return 1.055 * Math.pow(Math.max(0, cVal), 1 / 2.4) - 0.055;
    };

    const r = Math.min(255, Math.max(0, Math.round(transfer(rLin) * 255)));
    const g = Math.min(255, Math.max(0, Math.round(transfer(gLin) * 255)));
    const b = Math.min(255, Math.max(0, Math.round(transfer(bLin) * 255)));

    if (a >= 1) {
        return `rgb(${r}, ${g}, ${b})`;
    } else {
        return `rgba(${r}, ${g}, ${b}, ${Math.round(a * 100) / 100})`;
    }
}

function convertOklchString(str) {
    if (!str || typeof str !== 'string' || !str.includes('oklch')) return str;

    // Pattern for oklch(L C H [/ A]) or oklch(L C H)
    // Matches e.g. oklch(0.208 0.042 265.755) or oklch(0.6 0.2 240 / 0.8) or oklch(20.8% 0.042 265.755)
    return str.replace(/oklch\(\s*([^\s/)]+)\s+([^\s/)]+)\s+([^\s/)]+)(?:\s*\/\s*([^\s)]+))?\s*\)/gi, (match, l, c, h, a) => {
        try {
            return oklchToRgb(l, c, h, a !== undefined ? a : 1);
        } catch (e) {
            return '#1e293b';
        }
    });
}

// Test cases
console.log('Slate 900 test:', convertOklchString('oklch(0.208 0.042 265.755)'));
console.log('With alpha test:', convertOklchString('oklch(0.627 0.265 303.9 / 0.5)'));
console.log('Inside complex CSS string:', convertOklchString('box-shadow: 0 4px 6px -1px oklch(0.208 0.042 265.755 / 0.1), 0 2px 4px -2px oklch(0.208 0.042 265.755 / 0.1);'));
