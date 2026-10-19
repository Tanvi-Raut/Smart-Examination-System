import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Triggers direct browser file download to the user's Downloads folder
 * without opening any print dialogs or external prompts.
 */
export function triggerFileDownload(blobOrDataUrl, filename) {
    if (!blobOrDataUrl) return false;

    let url;
    let shouldRevoke = false;

    if (blobOrDataUrl instanceof Blob) {
        url = URL.createObjectURL(blobOrDataUrl);
        shouldRevoke = true;
    } else {
        url = blobOrDataUrl;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
        try {
            document.body.removeChild(a);
            if (shouldRevoke) {
                URL.revokeObjectURL(url);
            }
        } catch {
            // Ignore cleanup errors
        }
    }, 1500);

    return true;
}

/**
 * Converts OKLCH parameters to sRGB
 */
export function oklchToRgb(l, c, h, a = 1) {
    let lNum = typeof l === 'string' && l.endsWith('%') ? parseFloat(l) / 100 : parseFloat(l);
    let cNum = typeof c === 'string' && c.endsWith('%') ? (parseFloat(c) / 100) * 0.4 : parseFloat(c);
    let hNum = parseFloat(h) || 0;
    let aNum = 1;

    if (a !== undefined && a !== null) {
        aNum = typeof a === 'string' && a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a);
        if (isNaN(aNum)) aNum = 1;
    }

    if (isNaN(lNum)) lNum = 0.5;
    if (isNaN(cNum)) cNum = 0;

    const hRad = (hNum * Math.PI) / 180;
    const aLab = cNum * Math.cos(hRad);
    const bLab = cNum * Math.sin(hRad);

    const l_ = lNum + 0.3963377774 * aLab + 0.2158037573 * bLab;
    const m_ = lNum - 0.1055613458 * aLab - 0.0638541728 * bLab;
    const s_ = lNum - 0.0894841775 * aLab - 1.2914855480 * bLab;

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

    if (aNum >= 1) {
        return `rgb(${r}, ${g}, ${b})`;
    } else {
        return `rgba(${r}, ${g}, ${b}, ${Math.round(aNum * 100) / 100})`;
    }
}

/**
 * Converts OKLAB parameters to sRGB
 */
export function oklabToRgb(l, a, bVal, alpha = 1) {
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

/**
 * Converts any CSS color to RGB using native canvas rasterizer
 */
export function canvasColorToRgba(colorStr) {
    try {
        if (typeof document !== 'undefined') {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
                ctx.clearRect(0, 0, 1, 1);
                ctx.fillStyle = '#000000';
                ctx.fillStyle = colorStr;
                ctx.fillRect(0, 0, 1, 1);
                const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
                return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 100) / 100})`;
            }
        }
    } catch {
        // ignore
    }
    return '#1e293b';
}

/**
 * Safely converts any modern color string (oklch, oklab, lab, lch, color) to standard rgb/rgba
 */
export function convertModernColors(str) {
    if (!str || typeof str !== 'string') return str;
    if (!str.includes('oklch') && !str.includes('oklab') && !str.includes('lab(') && !str.includes('lch(') && !str.includes('color(')) {
        return str;
    }

    let result = str;

    // Convert oklch
    if (result.includes('oklch')) {
        result = result.replace(/oklch\(\s*([^\s/)]+)\s+([^\s/)]+)\s+([^\s/)]+)(?:\s*\/\s*([^\s)]+))?\s*\)/gi, (match, l, c, h, a) => {
            try {
                return oklchToRgb(l, c, h, a !== undefined ? a : 1);
            } catch {
                return '#1e293b';
            }
        });
    }

    // Convert oklab
    if (result.includes('oklab')) {
        result = result.replace(/oklab\(\s*([^\s/)]+)\s+([^\s/)]+)\s+([^\s/)]+)(?:\s*\/\s*([^\s)]+))?\s*\)/gi, (match, l, a, bVal, alpha) => {
            try {
                return oklabToRgb(l, a, bVal, alpha !== undefined ? alpha : 1);
            } catch {
                return '#1e293b';
            }
        });
    }

    // Convert any remaining lab/lch/color
    if (result.includes('lab(') || result.includes('lch(') || result.includes('color(')) {
        result = result.replace(/(?:lab|lch|color)\([^)]+\)/gi, (match) => {
            return canvasColorToRgba(match);
        });
    }

    return result;
}

export const convertOklchColor = convertModernColors;

/**
 * Robust wrapper around html2canvas that thoroughly sanitizes modern CSS colors
 */
export async function safeHtml2Canvas(element, options = {}) {
    if (!element) throw new Error('Target element for canvas generation is null');

    const originalGetComputedStyle = window.getComputedStyle;

    window.getComputedStyle = function (elt, pseudoElt) {
        const style = originalGetComputedStyle.call(this, elt, pseudoElt);
        return new Proxy(style, {
            get(target, prop) {
                const val = target[prop];
                if (typeof val === 'function') {
                    if (prop === 'getPropertyValue') {
                        return function (propertyName) {
                            const orig = target.getPropertyValue(propertyName);
                            return convertModernColors(orig);
                        };
                    }
                    return val.bind(target);
                }
                return convertModernColors(val);
            }
        });
    };

    try {
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            logging: false,
            backgroundColor: '#ffffff',
            imageTimeout: 10000,
            onclone: (clonedDoc, clonedElement) => {
                // 1. Sanitize all style tags in the cloned document
                try {
                    const styleTags = clonedDoc.querySelectorAll('style');
                    styleTags.forEach((tag) => {
                        if (tag.textContent) {
                            tag.textContent = convertModernColors(tag.textContent);
                        }
                    });
                } catch (e) {
                    console.warn('onclone style conversion notice:', e);
                }

                // 2. Explicitly sanitize inline styles on all cloned nodes
                try {
                    const propsToFix = [
                        'color',
                        'backgroundColor',
                        'borderColor',
                        'borderTopColor',
                        'borderBottomColor',
                        'borderLeftColor',
                        'borderRightColor',
                        'outlineColor',
                        'textDecorationColor',
                        'fill',
                        'stroke',
                        'boxShadow'
                    ];

                    const allElts = [clonedElement, ...clonedElement.querySelectorAll('*')];
                    allElts.forEach((el) => {
                        const comp = originalGetComputedStyle.call(window, el);
                        propsToFix.forEach((prop) => {
                            const val = comp[prop];
                            if (val && typeof val === 'string') {
                                el.style[prop] = convertModernColors(val);
                            }
                        });
                    });
                } catch (e) {
                    console.warn('onclone node style normalization notice:', e);
                }

                if (options.onclone) {
                    options.onclone(clonedDoc, clonedElement);
                }
            },
            ...options
        });

        return canvas;
    } finally {
        window.getComputedStyle = originalGetComputedStyle;
    }
}

/**
 * Generates an official vector PDF Hall Ticket directly
 */
export function generateNativeHallTicketPDF(student, allocations = [], filename = 'GCOEA_HallTicket.pdf') {
    if (!student) {
        throw new Error('Student information missing for PDF generation');
    }
    if (!allocations || allocations.length === 0) {
        throw new Error('Hall ticket cannot be generated: Candidate is not enrolled for any examination subjects.');
    }

    const PDFConstructor = typeof jsPDF === 'function' ? jsPDF : (jsPDF.jsPDF || jsPDF.default);
    const pdf = new PDFConstructor('p', 'mm', 'a4');

    const pageWidth = 210;
    const margin = 14;
    const contentWidth = pageWidth - (margin * 2);

    // 1. Header Institute Banner
    pdf.setFillColor(15, 23, 42); // slate-900
    pdf.rect(margin, 12, contentWidth, 24, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('GOVERNMENT COLLEGE OF ENGINEERING, AMRAVATI', margin + (contentWidth / 2), 21, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.text('(An Autonomous Institute of Government of Maharashtra) • Estd. 1964', margin + (contentWidth / 2), 27, { align: 'center' });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text('EXAMINATION ADMISSION CARD / HALL TICKET', margin + (contentWidth / 2), 32, { align: 'center' });

    // 2. Candidate Bio Card
    pdf.setDrawColor(203, 213, 225);
    pdf.setFillColor(248, 250, 252);
    pdf.roundedRect(margin, 40, contentWidth, 38, 2, 2, 'FD');

    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(9);

    pdf.setFont('helvetica', 'bold');
    pdf.text('Candidate Name:', margin + 4, 47);
    pdf.setFont('helvetica', 'normal');
    pdf.text(String(student.name || 'Candidate'), margin + 40, 47);

    pdf.setFont('helvetica', 'bold');
    pdf.text('PRN:', margin + 4, 54);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(30, 58, 138);
    pdf.text(String(student.PRN || ''), margin + 40, 54);
    pdf.setTextColor(15, 23, 42);

    pdf.setFont('helvetica', 'bold');
    pdf.text('Roll No / Div:', margin + 4, 61);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${student.rollNumber || ''} (Div ${student.division || 'A'})`, margin + 40, 61);

    pdf.setFont('helvetica', 'bold');
    pdf.text('Programme / Dept:', margin + 4, 68);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${student.branch?.branchName || student.branch?.branchCode || 'Computer Science & Engineering'} • Sem ${student.semester || 5}`, margin + 40, 68);

    const photoX = margin + contentWidth - 28;
    const photoY = 43;
    const photoW = 24;
    const photoH = 30;

    pdf.setDrawColor(100, 116, 139);
    pdf.setFillColor(241, 245, 249);
    pdf.roundedRect(photoX, photoY, photoW, photoH, 1, 1, 'FD');

    if (student.photo && student.photo.startsWith('data:image')) {
        try {
            pdf.addImage(student.photo, 'JPEG', photoX, photoY, photoW, photoH);
        } catch {
            pdf.setFontSize(7);
            pdf.setTextColor(100, 116, 139);
            pdf.text('Verified Photo', photoX + 12, photoY + 16, { align: 'center' });
        }
    } else {
        pdf.setFontSize(7);
        pdf.setTextColor(100, 116, 139);
        pdf.text('Verified Photo', photoX + 12, photoY + 16, { align: 'center' });
    }

    // 3. Timetable Table
    pdf.setFillColor(30, 41, 59);
    pdf.rect(margin, 82, contentWidth, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);

    pdf.text('Subject / Paper Name', margin + 3, 87.5);
    pdf.text('Date & Session', margin + 115, 87.5);
    pdf.text('Subject QR', margin + contentWidth - 14, 87.5, { align: 'center' });

    let currentY = 90;
    const rowHeight = 22;

    allocations.forEach((item, idx) => {
        if (currentY + rowHeight > 260) {
            pdf.addPage();
            currentY = 20;
        }

        if (idx % 2 === 0) {
            pdf.setFillColor(255, 255, 255);
        } else {
            pdf.setFillColor(248, 250, 252);
        }
        pdf.rect(margin, currentY, contentWidth, rowHeight, 'F');
        pdf.setDrawColor(226, 232, 240);
        pdf.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);

        pdf.setTextColor(15, 23, 42);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        const subCode = item.exam?.subject?.subjectCode || 'EXAM';
        const subName = item.exam?.subject?.subjectName || 'Course Paper';
        pdf.text(`${subCode}`, margin + 3, currentY + 6);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        const splitTitle = pdf.splitTextToSize(subName, 105);
        pdf.text(splitTitle, margin + 3, currentY + 11);

        const examDate = item.exam?.examDate ? new Date(item.exam.examDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }) : 'Scheduled';
        const examTime = item.exam?.startTime ? `${item.exam.startTime} - ${item.exam.endTime || ''}` : '10:00 AM';
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.text(examDate, margin + 115, currentY + 7);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.text(examTime, margin + 115, currentY + 13);

        if (item.qrCode && typeof item.qrCode === 'string' && item.qrCode.startsWith('data:image')) {
            try {
                pdf.addImage(item.qrCode, 'PNG', margin + contentWidth - 22, currentY + 2, 18, 18);
            } catch {
                pdf.setFontSize(6);
                pdf.text('[QR]', margin + contentWidth - 13, currentY + 11, { align: 'center' });
            }
        }

        currentY += rowHeight;
    });

    // 4. Instructions
    const instrY = Math.max(currentY + 6, 210);
    pdf.setDrawColor(203, 213, 225);
    pdf.setFillColor(254, 252, 232);
    pdf.roundedRect(margin, instrY, contentWidth, 34, 2, 2, 'FD');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(146, 64, 14);
    pdf.text('MANDATORY CANDIDATE INSTRUCTIONS (GCOEA AUTONOMOUS EXAMINATIONS):', margin + 4, instrY + 6);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.8);
    pdf.setTextColor(30, 41, 59);
    pdf.text('1. Candidates must carry both this printed admission card and their College Identity Card to the examination hall.', margin + 4, instrY + 12);
    pdf.text('2. Each QR code is uniquely bound to the specific student and subject. Tampering or sharing will result in disciplinary action.', margin + 4, instrY + 17);
    pdf.text('3. Interleaved seating allocation is strictly enforced. Candidates must sit exclusively at the designated desk number.', margin + 4, instrY + 22);
    pdf.text('4. Digital attendance is validated via invigilator scanning. Report to the hall at least 15 minutes before the exam commences.', margin + 4, instrY + 27);

    // 5. Signatures Footer
    const footerY = instrY + 44;
    pdf.setDrawColor(148, 163, 184);
    pdf.line(margin + 10, footerY, margin + 60, footerY);
    pdf.line(margin + contentWidth - 60, footerY, margin + contentWidth - 10, footerY);

    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(71, 85, 105);
    pdf.text("Candidate's Signature", margin + 35, footerY + 5, { align: 'center' });
    pdf.text('Controller of Examinations (GCOEA)', margin + contentWidth - 35, footerY + 5, { align: 'center' });

    const blob = pdf.output('blob');
    triggerFileDownload(blob, filename);
    return true;
}

/**
 * Generates an official Hall Ticket PNG Image using pure 2D Canvas
 * Guaranteed to save to Downloads folder even if html2canvas is bypassed.
 */
export async function generateNativeHallTicketImage(student, allocations = [], filename = 'GCOEA_HallTicket.png') {
    if (typeof document === 'undefined') return false;
    if (!student) {
        throw new Error('Student information missing for Image generation');
    }
    if (!allocations || allocations.length === 0) {
        throw new Error('Hall ticket cannot be generated: Candidate is not enrolled for any examination subjects.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1550;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(40, 40, canvas.width - 80, 100);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GOVERNMENT COLLEGE OF ENGINEERING, AMRAVATI', canvas.width / 2, 85);

    ctx.font = '16px Helvetica, Arial, sans-serif';
    ctx.fillText('(An Autonomous Institute of Government of Maharashtra) • Estd. 1964', canvas.width / 2, 115);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(40, 150, canvas.width - 80, 42);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Helvetica, Arial, sans-serif';
    ctx.fillText('EXAMINATION ADMISSION CARD / HALL TICKET', canvas.width / 2, 177);

    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 205, canvas.width - 80, 140);
    ctx.fillRect(40, 205, canvas.width - 80, 140);

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'left';
    ctx.font = 'bold 18px Helvetica, Arial, sans-serif';
    ctx.fillText(`Candidate: ${student?.name || 'Candidate'}`, 65, 245);
    ctx.fillText(`PRN: ${student?.PRN || ''}`, 65, 280);
    ctx.fillText(`Roll No: ${student?.rollNumber || ''} (Div ${student?.division || 'A'})`, 65, 315);

    ctx.fillText(`Dept: ${student?.branch?.branchName || student?.branch?.branchCode || 'CSE'}`, 550, 245);
    ctx.fillText(`Term: Semester ${student?.semester || 5} • B.Tech`, 550, 280);

    let y = 370;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(40, y, canvas.width - 80, 45);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Helvetica, Arial, sans-serif';
    ctx.fillText('Subject / Paper Name', 60, y + 29);
    ctx.fillText('Date & Session', 600, y + 29);
    ctx.fillText('Subject QR', 1010, y + 29);

    y += 45;
    for (let i = 0; i < allocations.length; i++) {
        const item = allocations[i];
        ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f8fafc';
        ctx.fillRect(40, y, canvas.width - 80, 90);
        ctx.strokeStyle = '#e2e8f0';
        ctx.strokeRect(40, y, canvas.width - 80, 90);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 18px Helvetica, Arial, sans-serif';
        ctx.fillText(item.exam?.subject?.subjectCode || 'EXAM', 60, y + 35);
        ctx.font = '15px Helvetica, Arial, sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText(item.exam?.subject?.subjectName || 'Course Paper', 60, y + 62);

        const examDate = item.exam?.examDate ? new Date(item.exam.examDate).toLocaleDateString() : 'Scheduled';
        const examTime = item.exam?.startTime ? `${item.exam.startTime} - ${item.exam.endTime || ''}` : '10:00 AM';
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 16px Helvetica, Arial, sans-serif';
        ctx.fillText(examDate, 600, y + 35);
        ctx.font = '14px Helvetica, Arial, sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText(examTime, 600, y + 62);

        if (item.qrCode) {
            try {
                const qrImg = new Image();
                qrImg.src = item.qrCode;
                await new Promise((resolve) => {
                    qrImg.onload = () => {
                        ctx.drawImage(qrImg, 1010, y + 10, 70, 70);
                        resolve();
                    };
                    qrImg.onerror = resolve;
                });
            } catch {
                // ignore
            }
        }
        y += 90;
    }

    y = Math.max(y + 30, 980);
    ctx.fillStyle = '#fefce8';
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(40, y, canvas.width - 80, 120);
    ctx.fillRect(40, y, canvas.width - 80, 120);

    ctx.fillStyle = '#92400e';
    ctx.font = 'bold 15px Helvetica, Arial, sans-serif';
    ctx.fillText('MANDATORY CANDIDATE INSTRUCTIONS (GCOEA AUTONOMOUS EXAMINATIONS):', 60, y + 30);
    ctx.fillStyle = '#1e293b';
    ctx.font = '13px Helvetica, Arial, sans-serif';
    ctx.fillText('1. Candidates must carry both this printed admission card and their College Identity Card.', 60, y + 55);
    ctx.fillText('2. Each QR code is uniquely bound to the student and subject. Tampering will result in disciplinary action.', 60, y + 75);
    ctx.fillText('3. Interleaved seating allocation is strictly enforced. Occupy exclusively your designated desk.', 60, y + 95);

    const imgData = canvas.toDataURL('image/png', 1.0);
    triggerFileDownload(imgData, filename);
    return true;
}

/**
 * Downloads an HTML element as an official PDF file directly to Downloads
 */
export async function downloadElementAsPDF(element, filename = 'document.pdf', format = 'a4', fallbackData = null) {
    if (fallbackData && (!fallbackData.allocations || fallbackData.allocations.length === 0)) {
        throw new Error('Hall ticket cannot be generated: Candidate has 0 enrolled examination papers.');
    }
    try {
        if (!element) {
            if (fallbackData && fallbackData.student) {
                return generateNativeHallTicketPDF(fallbackData.student, fallbackData.allocations, filename);
            }
            throw new Error('No target element or fallback data available');
        }

        const canvas = await safeHtml2Canvas(element);
        const imgData = canvas.toDataURL('image/png', 1.0);

        const PDFConstructor = typeof jsPDF === 'function' ? jsPDF : (jsPDF.jsPDF || jsPDF.default);
        const pdf = new PDFConstructor('p', 'mm', format);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        const blob = pdf.output('blob');
        triggerFileDownload(blob, filename);
        return true;
    } catch (err) {
        console.warn('Canvas PDF export notice, using native PDF generator fallback:', err);
        if (fallbackData && fallbackData.student) {
            return generateNativeHallTicketPDF(fallbackData.student, fallbackData.allocations, filename);
        }
        throw err;
    }
}

/**
 * Downloads an HTML element as a high-resolution PNG image directly to Downloads
 */
export async function downloadElementAsImage(element, filename = 'image.png', fallbackData = null) {
    if (fallbackData && (!fallbackData.allocations || fallbackData.allocations.length === 0)) {
        throw new Error('Hall ticket image cannot be generated: Candidate has 0 enrolled examination papers.');
    }
    try {
        if (!element) {
            if (fallbackData && fallbackData.student) {
                return generateNativeHallTicketImage(fallbackData.student, fallbackData.allocations, filename);
            }
            throw new Error('No target element for image generation');
        }
        const canvas = await safeHtml2Canvas(element);
        const imgData = canvas.toDataURL('image/png', 1.0);
        triggerFileDownload(imgData, filename);
        return true;
    } catch (err) {
        console.warn('Canvas Image export notice, using native canvas image generator fallback:', err);
        if (fallbackData && fallbackData.student) {
            return generateNativeHallTicketImage(fallbackData.student, fallbackData.allocations, filename);
        }
        throw err;
    }
}
