import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Search, 
    User, 
    GraduationCap, 
    Check, 
    ChevronDown, 
    X, 
    History, 
    Sparkles, 
    Filter, 
    ArrowRight,
    CornerDownLeft,
    Clock,
    Building2
} from 'lucide-react';

const RECENT_STORAGE_KEY = 'gcoea_recent_candidate_prns';

/**
 * Color coding helper for different engineering branches
 */
const getBranchBadgeStyle = (branchCode = '') => {
    const code = branchCode.toUpperCase();
    if (code.includes('CS') || code.includes('COMP')) {
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    } else if (code.includes('CIVIL')) {
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    } else if (code.includes('IT')) {
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    } else if (code.includes('ENTC') || code.includes('EXTC') || code.includes('ELEC')) {
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    } else if (code.includes('MECH')) {
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    }
    return 'bg-slate-700/50 text-slate-300 border-slate-600/40';
};

/**
 * Highlights matching substring in text
 */
const HighlightMatch = ({ text = '', query = '' }) => {
    if (!query || !text) return <span>{text}</span>;
    const str = String(text);
    const index = str.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return <span>{str}</span>;

    const before = str.substring(0, index);
    const match = str.substring(index, index + query.length);
    const after = str.substring(index + query.length);

    return (
        <span>
            {before}
            <span className="bg-emerald-500/30 text-emerald-300 font-extrabold underline rounded-xs px-0.5">
                {match}
            </span>
            {after}
        </span>
    );
};

export const StudentSearchCombobox = ({
    students = [],
    selectedPRN = '',
    onSelectStudent,
    label = 'Preview Student Ticket:',
    compact = false,
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('ALL');
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [recentPRNs, setRecentPRNs] = useState([]);
    const [manualPRN, setManualPRN] = useState('');

    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    // Load recent PRNs on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem(RECENT_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) setRecentPRNs(parsed);
            }
        } catch {}
    }, []);

    // Save recent PRN when selected
    const saveRecentPRN = (prn) => {
        if (!prn) return;
        try {
            const updated = [prn, ...recentPRNs.filter(p => p !== prn)].slice(0, 6);
            setRecentPRNs(updated);
            localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
        } catch {}
    };

    // Global keyboard shortcut ('/' or 'Ctrl+K') to trigger search
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
                e.preventDefault();
                setIsOpen(true);
                setTimeout(() => inputRef.current?.focus(), 60);
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
                setTimeout(() => inputRef.current?.focus(), 60);
            } else if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Click outside listener to close dropdown
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Active candidate details
    const currentStudent = useMemo(() => {
        if (!selectedPRN) {
            return students[0] || null;
        }
        return students.find(s => String(s.PRN) === String(selectedPRN)) || null;
    }, [students, selectedPRN]);

    // Extract available branches with counts for filter chips
    const branchCounts = useMemo(() => {
        const counts = { ALL: students.length };
        students.forEach(s => {
            const b = s.branch?.branchCode || s.branch || 'OTHER';
            counts[b] = (counts[b] || 0) + 1;
        });
        return counts;
    }, [students]);

    const availableBranches = useMemo(() => {
        return Object.keys(branchCounts).sort((a, b) => (a === 'ALL' ? -1 : a.localeCompare(b)));
    }, [branchCounts]);

    // Fast filtered students list
    const filteredStudents = useMemo(() => {
        const q = query.trim().toLowerCase();
        let list = students;

        // Filter by Branch if not 'ALL'
        if (selectedBranch !== 'ALL') {
            list = list.filter(s => {
                const b = s.branch?.branchCode || s.branch;
                return b === selectedBranch;
            });
        }

        // Search across Name, PRN, Roll No, Division, Branch, Email
        if (q) {
            list = list.filter(s => {
                const name = String(s.name || '').toLowerCase();
                const prn = String(s.PRN || '').toLowerCase();
                const roll = String(s.rollNumber || '').toLowerCase();
                const branchCode = String(s.branch?.branchCode || '').toLowerCase();
                const branchName = String(s.branch?.branchName || '').toLowerCase();
                const division = String(s.division || '').toLowerCase();
                const email = String(s.email || '').toLowerCase();

                return (
                    name.includes(q) ||
                    prn.includes(q) ||
                    roll.includes(q) ||
                    branchCode.includes(q) ||
                    branchName.includes(q) ||
                    division.includes(q) ||
                    email.includes(q)
                );
            });
        }

        return list;
    }, [students, query, selectedBranch]);

    // Limit displayed results to 45 for instantaneous smooth 60fps rendering
    const displayedStudents = useMemo(() => {
        return filteredStudents.slice(0, 45);
    }, [filteredStudents]);

    // Recent student objects
    const recentStudents = useMemo(() => {
        return recentPRNs
            .map(prn => students.find(s => String(s.PRN) === String(prn)))
            .filter(Boolean);
    }, [recentPRNs, students]);

    // Handle student selection
    const handleSelect = (student) => {
        if (!student) return;
        saveRecentPRN(student.PRN);
        onSelectStudent(student.PRN, student);
        setIsOpen(false);
        setQuery('');
    };

    // Handle direct PRN manual lookup
    const handleManualPRNSubmit = (e) => {
        e.preventDefault();
        const clean = manualPRN.trim();
        if (!clean) return;

        const match = students.find(s => 
            String(s.PRN).toLowerCase() === clean.toLowerCase() ||
            String(s.rollNumber).toLowerCase() === clean.toLowerCase()
        );

        if (match) {
            handleSelect(match);
        } else {
            // Direct PRN pass-through even if not pre-cached in list
            saveRecentPRN(clean);
            onSelectStudent(clean, null);
            setIsOpen(false);
        }
        setManualPRN('');
    };

    // Keyboard navigation in list
    const handleInputKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.min(prev + 1, displayedStudents.length - 1));
            scrollItemIntoView(highlightedIndex + 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.max(prev - 1, 0));
            scrollItemIntoView(highlightedIndex - 1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (displayedStudents[highlightedIndex]) {
                handleSelect(displayedStudents[highlightedIndex]);
            }
        }
    };

    const scrollItemIntoView = (index) => {
        if (!listRef.current) return;
        const item = listRef.current.children[index];
        if (item) {
            item.scrollIntoView({ block: 'nearest' });
        }
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* ================= TRIGGER BAR ================= */}
            <div className="flex items-center space-x-2">
                {label && (
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1 shrink-0">
                        <User className="w-3.5 h-3.5 text-blue-400" />
                        <span>{label}</span>
                    </span>
                )}

                {/* Interactive Combobox Trigger Button */}
                <button
                    type="button"
                    onClick={() => {
                        setIsOpen(prev => !prev);
                        if (!isOpen) {
                            setTimeout(() => inputRef.current?.focus(), 80);
                        }
                    }}
                    className="flex items-center justify-between space-x-3 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-blue-500/60 transition-all text-left group shadow-inner min-w-[240px] sm:min-w-[320px] max-w-full"
                    title="Click to search candidates (or press /)"
                >
                    {currentStudent ? (
                        <div className="flex items-center space-x-2.5 truncate">
                            <div className="w-7 h-7 rounded-lg overflow-hidden bg-slate-900 border border-slate-700 shrink-0">
                                <img
                                    src={currentStudent.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'}
                                    alt={currentStudent.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="truncate">
                                <div className="flex items-center space-x-1.5">
                                    <span className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors truncate">
                                        {currentStudent.name}
                                    </span>
                                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${getBranchBadgeStyle(currentStudent.branch?.branchCode)}`}>
                                        {currentStudent.branch?.branchCode || 'CSE'}
                                    </span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-2">
                                    <span>PRN: <strong className="text-blue-400">{currentStudent.PRN}</strong></span>
                                    {currentStudent.rollNumber && (
                                        <span>• Roll: {currentStudent.rollNumber}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <span className="text-xs text-slate-400 font-medium">Select a student...</span>
                    )}

                    <div className="flex items-center space-x-1.5 pl-2 shrink-0">
                        <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400 font-mono">
                            /
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 group-hover:text-white transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </button>
            </div>

            {/* ================= FLOATING COMBOBOX POPUP ================= */}
            {isOpen && (
                <div 
                    className="absolute z-50 mt-2 left-0 sm:left-auto right-0 sm:right-auto sm:min-w-[460px] md:min-w-[520px] w-full sm:w-auto bg-slate-900/98 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-150"
                    style={{ maxHeight: '85vh', overflow: 'hidden' }}
                >
                    {/* 1. SEARCH INPUT BAR */}
                    <div className="relative flex items-center">
                        <Search className="w-4 h-4 text-blue-400 absolute left-3 pointer-events-none" />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setHighlightedIndex(0);
                            }}
                            onKeyDown={handleInputKeyDown}
                            placeholder="Type student name, PRN, roll number, or branch..."
                            className="w-full pl-9 pr-20 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-blue-500 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                        />
                        <div className="absolute right-2 flex items-center space-x-1">
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setQuery('');
                                        inputRef.current?.focus();
                                    }}
                                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                                    title="Clear search"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                                title="Close (Esc)"
                            >
                                <span className="text-[10px] font-mono px-1 rounded bg-slate-800 text-slate-400">Esc</span>
                            </button>
                        </div>
                    </div>

                    {/* 2. BRANCH FILTER CHIPS */}
                    <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                        <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center space-x-1 shrink-0 mr-1">
                            <Filter className="w-3 h-3 text-slate-400" />
                            <span>Dept:</span>
                        </span>
                        {availableBranches.map(branch => {
                            const isSelected = selectedBranch === branch;
                            return (
                                <button
                                    key={branch}
                                    type="button"
                                    onClick={() => {
                                        setSelectedBranch(branch);
                                        setHighlightedIndex(0);
                                    }}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-all whitespace-nowrap shrink-0 flex items-center space-x-1 ${
                                        isSelected 
                                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30' 
                                            : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60'
                                    }`}
                                >
                                    <span>{branch}</span>
                                    <span className={`text-[9px] px-1 py-0.2 rounded-full ${isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-700 text-slate-400'}`}>
                                        {branchCounts[branch] || 0}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* 3. RECENT CANDIDATES CHIPS (Displayed when query is empty) */}
                    {!query && recentStudents.length > 0 && (
                        <div className="pt-1 border-t border-slate-800/80">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>Recent Candidates:</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {recentStudents.map(rs => (
                                    <button
                                        key={rs._id}
                                        type="button"
                                        onClick={() => handleSelect(rs)}
                                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center space-x-1.5 border border-slate-700 transition-all truncate"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                        <span className="truncate max-w-[120px]">{rs.name.split(' ')[0]}</span>
                                        <span className="text-[9px] text-blue-400 font-mono">({rs.PRN})</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 4. RESULTS LIST */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 font-semibold">
                            <span>
                                Candidates Roster ({filteredStudents.length} {selectedBranch !== 'ALL' ? selectedBranch : 'total'})
                            </span>
                            {filteredStudents.length > displayedStudents.length && (
                                <span className="text-slate-500">
                                    Showing top {displayedStudents.length} matches
                                </span>
                            )}
                        </div>

                        <div 
                            ref={listRef}
                            className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-slate-700"
                        >
                            {displayedStudents.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 space-y-2">
                                    <p className="text-xs font-semibold">No students found matching "{query}"</p>
                                    <p className="text-[11px] text-slate-500">
                                        Check spelling, or try searching by PRN or switching the Department filter.
                                    </p>
                                </div>
                            ) : (
                                displayedStudents.map((s, idx) => {
                                    const isSelected = String(s.PRN) === String(selectedPRN);
                                    const isHighlighted = idx === highlightedIndex;

                                    return (
                                        <div
                                            key={s._id}
                                            onClick={() => handleSelect(s)}
                                            onMouseEnter={() => setHighlightedIndex(idx)}
                                            className={`p-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-all border ${
                                                isSelected
                                                    ? 'bg-blue-600/15 border-blue-500/50 shadow-sm'
                                                    : isHighlighted
                                                    ? 'bg-slate-800 border-slate-700 text-white'
                                                    : 'bg-slate-950/60 hover:bg-slate-800/60 border-slate-800/80 text-slate-200'
                                            }`}
                                        >
                                            <div className="flex items-center space-x-3 truncate">
                                                {/* Candidate Avatar */}
                                                <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-900 border border-slate-700 shrink-0">
                                                    <img
                                                        src={s.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'}
                                                        alt={s.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>

                                                {/* Candidate Bio */}
                                                <div className="truncate">
                                                    <div className="flex items-center space-x-2 truncate">
                                                        <span className="text-xs font-bold text-white truncate">
                                                            <HighlightMatch text={s.name} query={query} />
                                                        </span>
                                                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border shrink-0 ${getBranchBadgeStyle(s.branch?.branchCode)}`}>
                                                            {s.branch?.branchCode || 'CSE'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-400 flex items-center space-x-2 font-mono mt-0.5 truncate">
                                                        <span>
                                                            PRN: <strong className="text-emerald-400 font-bold"><HighlightMatch text={s.PRN} query={query} /></strong>
                                                        </span>
                                                        {s.rollNumber && (
                                                            <span>• Roll: <HighlightMatch text={s.rollNumber} query={query} /></span>
                                                        )}
                                                        {s.division && (
                                                            <span>• Div: {s.division}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Selection Status */}
                                            <div className="shrink-0 pl-2">
                                                {isSelected ? (
                                                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-md">
                                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                    </span>
                                                ) : isHighlighted ? (
                                                    <span className="text-blue-400 text-xs font-semibold flex items-center space-x-1">
                                                        <span>Select</span>
                                                        <CornerDownLeft className="w-3 h-3" />
                                                    </span>
                                                ) : null}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* 5. DIRECT PRN QUICK JUMPER FOOTER */}
                    <form 
                        onSubmit={handleManualPRNSubmit}
                        className="pt-2 border-t border-slate-800 flex items-center space-x-2"
                    >
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                            Direct PRN Jump:
                        </span>
                        <input
                            type="text"
                            value={manualPRN}
                            onChange={(e) => setManualPRN(e.target.value)}
                            placeholder="e.g. 23005081"
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono font-bold"
                        />
                        <button
                            type="submit"
                            disabled={!manualPRN.trim()}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs flex items-center space-x-1 shadow-md transition-all shrink-0"
                        >
                            <span>Load</span>
                            <ArrowRight className="w-3 h-3" />
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default StudentSearchCombobox;
