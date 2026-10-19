function oklabToRgb(l, a, bVal, alpha = 1) {
    let lNum = typeof l === 'string' && l.endsWith('%') ? parseFloat(l) / 100 : parseFloat(l);
    let aNum = parseFloat(a) || 0;
    let bNum = parseFloat(bVal) || 0;
    let alphaNum = 1;

    if (alpha !== undefined && alpha !== null) {
        alphaNum = typeof alpha === 'string' && alpha.endsWith('%') ? parseFloat(alpha) / 100 : parseFloat(alpha);
        if (isNaN(alphaNum)) alphaNum = 1;
    }

    const l_ = lNum + 0.3963377774 * aNum + 0.2158037573 * bNum;
    const m_ = lNum - 0.1055613458 * aNum - 0.0638541728 * bNum;
    const s_ = lNum - 0.0894841775 * aNum - 1.2914855480 * bNum;

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

    if (alphaNum >= 1) {
        return `rgb(${r}, ${g}, ${b})`;
    } else {
        return `rgba(${r}, ${g}, ${b}, ${Math.round(alphaNum * 100) / 100})`;
    }
}

console.log('Oklab test:', oklabToRgb('0.208', '-0.01', '-0.04'));
