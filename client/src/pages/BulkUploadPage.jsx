import React, { useState } from 'react';
import api from '../utils/api';
import * as XLSX from 'xlsx';
import { 
    FileSpreadsheet, 
    Download, 
    Upload, 
    CheckCircle2, 
    AlertTriangle, 
    XCircle, 
    RefreshCw, 
    ShieldCheck, 
    Users, 
    Sparkles, 
    ArrowRight,
    FileText,
    Copy,
    Check
} from 'lucide-react';

const BulkUploadPage = () => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [activeResultTab, setActiveResultTab] = useState('success'); // 'success' | 'duplicates' | 'failed'
    const [copied, setCopied] = useState(false);

    // Download Sample Excel (.xlsx) Template
    const handleDownloadExcelTemplate = () => {
        const sampleData = [
            {
                name: "Aarav Sharma",
                PRN: "24105101",
                rollNumber: "CSE-24-101",
                collegeId: "GCOEA/CS/24105101",
                branch: "CSE",
                semester: 6,
                division: "A",
                email: "aarav.s@gcoea.ac.in",
                photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80"
            },
            {
                name: "Priya Deshmukh",
                PRN: "24105102",
                rollNumber: "CSE-24-102",
                collegeId: "GCOEA/CS/24105102",
                branch: "CSE",
                semester: 6,
                division: "A",
                email: "priya.d@gcoea.ac.in",
                photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
            },
            {
                name: "Rohan Kulkarni",
                PRN: "24106101",
                rollNumber: "IT-24-101",
                collegeId: "GCOEA/IT/24106101",
                branch: "IT",
                semester: 6,
                division: "B",
                email: "rohan.k@gcoea.ac.in",
                photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80"
            },
            {
                name: "Snehal Joshi",
                PRN: "24107101",
                rollNumber: "ENTC-24-101",
                collegeId: "GCOEA/ET/24107101",
                branch: "ENTC",
                semester: 6,
                division: "A",
                email: "snehal.j@gcoea.ac.in",
                photo: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80"
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(sampleData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
        XLSX.writeFile(workbook, "GCOEA_Student_Enrollment_Template.xlsx");
    };

    // Download Sample CSV (.csv) Template
    const handleDownloadCSVTemplate = () => {
        const csvContent = "data:text/csv;charset=utf-8," +
            "name,PRN,rollNumber,collegeId,branch,semester,division,email,photo\n" +
            "Aarav Sharma,24105101,CSE-24-101,GCOEA/CS/24105101,CSE,6,A,aarav.s@gcoea.ac.in,https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80\n" +
            "Priya Deshmukh,24105102,CSE-24-102,GCOEA/CS/24105102,CSE,6,A,priya.d@gcoea.ac.in,https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80\n" +
            "Rohan Kulkarni,24106101,IT-24-101,GCOEA/IT/24106101,IT,6,B,rohan.k@gcoea.ac.in,https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80\n" +
            "Snehal Joshi,24107101,ENTC-24-101,GCOEA/ET/24107101,ENTC,6,A,snehal.j@gcoea.ac.in,https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80";
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "GCOEA_Student_Enrollment_Template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Generate 50-student realistic batch Excel directly in browser and upload
    const handleGenerate50Batch = async () => {
        const firstNames = ["Siddharth", "Aishwarya", "Aditya", "Neha", "Vikas", "Pooja", "Gaurav", "Swati", "Nikhil", "Kavita", "Mayur", "Anjali"];
        const lastNames = ["Kulkarni", "Patil", "Deshmukh", "Jadhav", "Shinde", "Wankhede", "Bhide", "Chavan", "Gaikwad", "More", "Thakare", "Raut"];
        const branchesList = ["CSE", "IT", "ENTC", "MECH", "CIVIL"];

        const generatedList = [];
        const basePrn = 24108000 + Math.floor(Math.random() * 1000);

        for (let i = 0; i < 50; i++) {
            const fn = firstNames[i % firstNames.length];
            const ln = lastNames[(i * 3) % lastNames.length];
            const br = branchesList[i % branchesList.length];
            const prn = `${basePrn + i}`;

            generatedList.push({
                name: `${fn} ${ln}`,
                PRN: prn,
                rollNumber: `${br}-24-${i + 1}`,
                collegeId: `GCOEA/${br}/${prn}`,
                branch: br,
                semester: 6,
                division: i % 2 === 0 ? "A" : "B",
                email: `${fn.toLowerCase()}.${ln.toLowerCase()}@gcoea.ac.in`,
                photo: i % 2 === 0 
                    ? "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80"
                    : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
            });
        }

        // Convert to Excel workbook
        const ws = XLSX.utils.json_to_sheet(generatedList);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Students");
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        const batchFile = new File([blob], `GCOEA_Batch_50_Students_${Date.now()}.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        setFile(batchFile);
        // Automatically submit
        processUploadFile(batchFile);
    };

    // Upload & Process Spreadsheet
    const processUploadFile = async (uploadFile) => {
        const target = uploadFile || file;
        if (!target) {
            alert('Please select an Excel or CSV file.');
            return;
        }

        try {
            setLoading(true);
            setResult(null);

            const formData = new FormData();
            formData.append('file', target);

            const response = await api.post('/students/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setResult(response.data);
            if (response.data.successCount > 0) {
                setActiveResultTab('success');
            } else if (response.data.duplicatesCount > 0) {
                setActiveResultTab('duplicates');
            } else {
                setActiveResultTab('failed');
            }
        } catch (error) {
            alert(error.response?.data?.message || 'Error processing spreadsheet upload');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 pb-16">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
                    <FileSpreadsheet className="w-6 h-6 text-emerald-500" />
                    <span>Bulk Student Upload Center (Excel / CSV)</span>
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                    Onboard hundreds of engineering students at once. Automatically validates PRNs, detects duplicates, matches academic departments, and generates audit reports.
                </p>
            </div>

            {/* Step 1 & Step 2 Containers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* STEP 1: DOWNLOAD TEMPLATE & FORMAT RULES */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                    <div>
                        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold uppercase tracking-wider mb-3">
                            <span>Step 1: Download Official Template</span>
                        </div>
                        <h2 className="text-base font-bold text-white">
                            Standard Student Data Format
                        </h2>
                        <p className="text-xs text-slate-400 mt-1 mb-4 leading-relaxed">
                            Fill your spreadsheet or export directly from your institutional database with the following standard columns:
                        </p>

                        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2 text-xs">
                            <div className="flex justify-between items-center text-slate-300 pb-1 border-b border-slate-700/60 font-semibold">
                                <span>Column Header</span>
                                <span>Requirement / Format</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <code className="text-blue-400 font-bold">name</code>
                                <span>Full Name (e.g. Harshali Villhekar)</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <code className="text-blue-400 font-bold">PRN</code>
                                <span>Unique Permanent Reg. No (e.g. 23005059)</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <code className="text-blue-400 font-bold">rollNumber</code>
                                <span>Class Roll Number (e.g. CSE-23-01)</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <code className="text-blue-400 font-bold">branch</code>
                                <span>Department Code (CSE, IT, ENTC, MECH, CIVIL)</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <code className="text-blue-400 font-bold">semester</code>
                                <span>Semester number (e.g. 6)</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-3">
                        <button
                            onClick={handleDownloadExcelTemplate}
                            className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2"
                        >
                            <Download className="w-4 h-4" />
                            <span>Download Template (.xlsx)</span>
                        </button>

                        <button
                            onClick={handleDownloadCSVTemplate}
                            className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center space-x-2"
                        >
                            <Download className="w-4 h-4" />
                            <span>Download CSV (.csv)</span>
                        </button>
                    </div>
                </div>

                {/* STEP 2: UPLOAD & PROCESS FILE */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
                    <div>
                        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider mb-3">
                            <span>Step 2: Upload & Validate File</span>
                        </div>
                        <h2 className="text-base font-bold text-white">
                            Upload Student Roster
                        </h2>
                        <p className="text-xs text-slate-400 mt-1 mb-4">
                            Select your completed Excel workbook or CSV export. Files up to 50MB and thousands of rows are supported.
                        </p>

                        {/* Drag and Drop Box */}
                        <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl p-6 text-center bg-slate-800/40 cursor-pointer transition-colors">
                            <Upload className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                            <label className="cursor-pointer block">
                                <span className="text-sm font-bold text-white block">
                                    {file ? file.name : 'Choose Excel (.xlsx, .xls) or CSV file'}
                                </span>
                                <span className="text-[11px] text-slate-400 mt-1 block">
                                    {file ? `${(file.size / 1024).toFixed(1)} KB ready for import` : 'or click to browse your files'}
                                </span>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={(e) => setFile(e.target.files[0])}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    </div>

                    <div className="mt-6 space-y-3">
                        <button
                            onClick={() => processUploadFile()}
                            disabled={loading || !file}
                            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 disabled:opacity-50"
                        >
                            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            <span>{loading ? 'Validating & Importing...' : 'Validate & Enroll All Students'}</span>
                        </button>

                        {/* Quick 1-Click Scale Simulator */}
                        <button
                            onClick={handleGenerate50Batch}
                            disabled={loading}
                            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 flex items-center justify-center space-x-2"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>1-Click Test: Generate & Import 50 Students Now</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ================= COMPREHENSIVE PROCESSING RESULTS REPORT ================= */}
            {result && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 animate-fade-in">
                    {/* Header Summary Message */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                <span>Bulk Import Processing Summary</span>
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Total Processed Rows: <strong className="text-white">{result.totalProcessed}</strong>
                            </p>
                        </div>

                        {/* Result KPIs */}
                        <div className="flex items-center space-x-2 text-xs">
                            <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                                {result.successCount} Successfully Enrolled
                            </span>
                            <span className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                                {result.duplicatesCount} Duplicates Skipped
                            </span>
                            {result.failedCount > 0 && (
                                <span className="px-3 py-1.5 rounded-xl bg-red-500/20 text-red-300 border border-red-500/30 font-bold">
                                    {result.failedCount} Failed Records
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Sub Tab Navigation for Result Views */}
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setActiveResultTab('success')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                activeResultTab === 'success' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white bg-slate-800'
                            }`}
                        >
                            Enrolled Students ({result.successCount})
                        </button>
                        <button
                            onClick={() => setActiveResultTab('duplicates')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                activeResultTab === 'duplicates' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white bg-slate-800'
                            }`}
                        >
                            Duplicates Skipped ({result.duplicatesCount})
                        </button>
                        {result.failedCount > 0 && (
                            <button
                                onClick={() => setActiveResultTab('failed')}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    activeResultTab === 'failed' ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-white bg-slate-800'
                                }`}
                            >
                                Failed Validation ({result.failedCount})
                            </button>
                        )}
                    </div>

                    {/* VIEW 1: ENROLLED STUDENTS TABLE */}
                    {activeResultTab === 'success' && (
                        <div>
                            {result.insertedRecords?.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-xs">
                                    No new students were added in this run (all records were either duplicates or invalid).
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                                    <table className="w-full text-left text-xs text-slate-300">
                                        <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700/80">
                                            <tr>
                                                <th className="px-5 py-3">Student Name</th>
                                                <th className="px-5 py-3">PRN</th>
                                                <th className="px-5 py-3">Roll Number</th>
                                                <th className="px-5 py-3">Branch</th>
                                                <th className="px-5 py-3 text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60">
                                            {result.insertedRecords.map((s, idx) => (
                                                <tr key={idx} className="hover:bg-slate-800/40">
                                                    <td className="px-5 py-2.5 font-bold text-white">{s.name}</td>
                                                    <td className="px-5 py-2.5 font-mono text-blue-400 font-semibold">{s.PRN}</td>
                                                    <td className="px-5 py-2.5 text-slate-300">{s.rollNumber}</td>
                                                    <td className="px-5 py-2.5">
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300">
                                                            {s.branch}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-2.5 text-right text-emerald-400 font-semibold">
                                                        <span className="inline-flex items-center space-x-1">
                                                            <Check className="w-3.5 h-3.5" />
                                                            <span>Enrolled</span>
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* VIEW 2: SKIPPED DUPLICATES TABLE */}
                    {activeResultTab === 'duplicates' && (
                        <div>
                            {result.skippedDuplicates?.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-xs">
                                    No duplicates were detected.
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                                    <table className="w-full text-left text-xs text-slate-300">
                                        <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700/80">
                                            <tr>
                                                <th className="px-5 py-3">Excel Row</th>
                                                <th className="px-5 py-3">Candidate Name</th>
                                                <th className="px-5 py-3">PRN Number</th>
                                                <th className="px-5 py-3">Detection Reason</th>
                                                <th className="px-5 py-3 text-right">Action Taken</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60">
                                            {result.skippedDuplicates.map((d, idx) => (
                                                <tr key={idx} className="hover:bg-slate-800/40">
                                                    <td className="px-5 py-2.5 font-mono text-slate-400">Row {d.row}</td>
                                                    <td className="px-5 py-2.5 font-bold text-white">{d.name || 'N/A'}</td>
                                                    <td className="px-5 py-2.5 font-mono text-amber-400 font-semibold">{d.PRN}</td>
                                                    <td className="px-5 py-2.5 text-slate-300">{d.reason}</td>
                                                    <td className="px-5 py-2.5 text-right text-amber-400 font-semibold">
                                                        Skipped (Preserved existing)
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* VIEW 3: FAILED VALIDATION RECORDS */}
                    {activeResultTab === 'failed' && (
                        <div>
                            {result.failedRecords?.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-xs">
                                    No failed validation records.
                                </div>
                            ) : (
                                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                                    <table className="w-full text-left text-xs text-slate-300">
                                        <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700/80">
                                            <tr>
                                                <th className="px-5 py-3">Excel Row</th>
                                                <th className="px-5 py-3">Input Name</th>
                                                <th className="px-5 py-3">Input PRN</th>
                                                <th className="px-5 py-3">Validation Error Details</th>
                                                <th className="px-5 py-3 text-right">Correction Prompt</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60">
                                            {result.failedRecords.map((f, idx) => (
                                                <tr key={idx} className="hover:bg-slate-800/40">
                                                    <td className="px-5 py-2.5 font-mono text-red-400 font-bold">Row {f.row}</td>
                                                    <td className="px-5 py-2.5 text-white">{f.name}</td>
                                                    <td className="px-5 py-2.5 font-mono text-slate-400">{f.PRN}</td>
                                                    <td className="px-5 py-2.5 text-red-400">{f.reason}</td>
                                                    <td className="px-5 py-2.5 text-right text-slate-400">
                                                        Please check required fields
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default BulkUploadPage;
