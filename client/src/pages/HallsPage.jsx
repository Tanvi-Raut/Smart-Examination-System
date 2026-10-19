import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
    Building2, 
    Plus, 
    Grid, 
    Trash2, 
    Edit2, 
    Check, 
    X, 
    Eye,
    Layers,
    Info,
    GraduationCap
} from 'lucide-react';

const HallsPage = () => {
    const [halls, setHalls] = useState([]);
    const [selectedHall, setSelectedHall] = useState(null);
    const [seats, setSeats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingSeats, setLoadingSeats] = useState(false);

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showGridModal, setShowGridModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Forms
    const [hallForm, setHallForm] = useState({
        hallNumber: '',
        building: 'Main Academic Complex',
        floor: 1,
        totalSeats: 30
    });

    const [gridForm, setGridForm] = useState({
        rows: 5,
        columns: 6
    });

    const fetchHalls = async () => {
        try {
            setLoading(true);
            const res = await api.get('/halls');
            setHalls(res.data || []);
            if (res.data?.length > 0 && !selectedHall) {
                viewHallSeats(res.data[0]);
            }
        } catch (error) {
            console.error('Error fetching halls:', error);
        } finally {
            setLoading(false);
        }
    };

    const viewHallSeats = async (hall) => {
        setSelectedHall(hall);
        try {
            setLoadingSeats(true);
            const res = await api.get(`/halls/${hall._id}/seats`);
            setSeats(res.data?.seats || []);
        } catch (error) {
            console.error('Error fetching hall seats:', error);
        } finally {
            setLoadingSeats(false);
        }
    };

    useEffect(() => {
        fetchHalls();
    }, []);

    const handleHallSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditing && selectedHall) {
                await api.put(`/halls/${selectedHall._id}`, hallForm);
            } else {
                const res = await api.post('/halls', hallForm);
                // Auto generate seats default grid
                await api.post(`/halls/${res.data._id}/generate-seats`, {
                    rows: 5,
                    columns: 6
                });
            }
            setShowAddModal(false);
            setIsEditing(false);
            fetchHalls();
        } catch (error) {
            alert(error.response?.data?.message || 'Error saving hall');
        }
    };

    const handleGridGenerate = async (e) => {
        e.preventDefault();
        if (!selectedHall) return;
        try {
            await api.post(`/halls/${selectedHall._id}/generate-seats`, {
                rows: Number(gridForm.rows),
                columns: Number(gridForm.columns)
            });
            setShowGridModal(false);
            viewHallSeats(selectedHall);
            fetchHalls();
        } catch (error) {
            alert(error.response?.data?.message || 'Error generating seats');
        }
    };

    const handleDeleteHall = async (id) => {
        if (!window.confirm('Delete this hall and all its configured seats?')) return;
        try {
            await api.delete(`/halls/${id}`);
            setSelectedHall(null);
            setSeats([]);
            fetchHalls();
        } catch (error) {
            alert(error.response?.data?.message || 'Error deleting hall');
        }
    };

    // Calculate rows and columns for matrix rendering
    const maxRow = seats.reduce((max, s) => Math.max(max, s.row), 0);
    const maxCol = seats.reduce((max, s) => Math.max(max, s.column), 0);

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
                        <Building2 className="w-6 h-6 text-emerald-500" />
                        <span>Examination Halls & Seat Layouts</span>
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Configure examination halls, building floors, capacities, and interactive seat matrices.
                    </p>
                </div>

                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => {
                            setIsEditing(false);
                            setHallForm({ hallNumber: '', building: 'Main Academic Complex', floor: 1, totalSeats: 30 });
                            setShowAddModal(true);
                        }}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/30 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Hall</span>
                    </button>
                </div>
            </div>

            {/* Halls Grid & Selected Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Halls List */}
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Configured Halls</h3>
                    {loading ? (
                        <div className="text-slate-400 text-xs">Loading halls...</div>
                    ) : (
                        halls.map((hall) => {
                            const isSelected = selectedHall?._id === hall._id;
                            return (
                                <div
                                    key={hall._id}
                                    onClick={() => viewHallSeats(hall)}
                                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                                        isSelected
                                            ? 'bg-slate-800 border-emerald-500 shadow-xl'
                                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="font-bold text-white text-base">{hall.hallNumber}</span>
                                            <p className="text-xs text-slate-400 mt-0.5">{hall.building} • Floor {hall.floor}</p>
                                        </div>
                                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                            {hall.totalSeats} Desks
                                        </span>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedHall(hall);
                                                setShowGridModal(true);
                                            }}
                                            className="text-blue-400 hover:text-blue-300 font-medium flex items-center space-x-1"
                                        >
                                            <Grid className="w-3.5 h-3.5" />
                                            <span>Regenerate Grid</span>
                                        </button>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteHall(hall._id);
                                            }}
                                            className="text-red-400 hover:text-red-300 p-1"
                                            title="Delete Hall"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Interactive Seat Matrix Visualizer */}
                <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800">
                        <div>
                            <div className="flex items-center space-x-2">
                                <h3 className="text-lg font-bold text-white">
                                    {selectedHall ? `Hall Layout: ${selectedHall.hallNumber}` : 'Select a Hall'}
                                </h3>
                                {selectedHall && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                        {seats.length} Configured Seats
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Invigilator Podium at front. Each seat represents a student examination desk.
                            </p>
                        </div>

                        {selectedHall && (
                            <button
                                onClick={() => setShowGridModal(true)}
                                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl"
                            >
                                <Grid className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Adjust Rows & Cols</span>
                            </button>
                        )}
                    </div>

                    {/* Invigilator Podium Graphic */}
                    <div className="w-full py-2 mb-6 rounded-xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 flex items-center justify-center space-x-2 text-xs font-bold text-slate-300 tracking-widest uppercase border border-slate-600/50 shadow-inner">
                        <GraduationCap className="w-4 h-4 text-blue-400" />
                        <span>Front / Invigilator Stage & Blackboard</span>
                    </div>

                    {/* Seat Grid View */}
                    {loadingSeats ? (
                        <div className="text-center py-16 text-slate-400 text-xs">Loading seat grid layout...</div>
                    ) : seats.length === 0 ? (
                        <div className="text-center py-16 text-slate-400 text-xs">
                            No seats configured for this hall. Click "Regenerate Grid" above.
                        </div>
                    ) : (
                        <div className="overflow-x-auto py-2">
                            <div 
                                className="grid gap-3 mx-auto justify-center min-w-[320px]"
                                style={{
                                    gridTemplateColumns: `repeat(${maxCol || 6}, minmax(48px, 64px))`
                                }}
                            >
                                {Array.from({ length: maxRow || 5 }).map((_, rIdx) => {
                                    const r = rIdx + 1;
                                    return Array.from({ length: maxCol || 6 }).map((_, cIdx) => {
                                        const c = cIdx + 1;
                                        const seat = seats.find(s => s.row === r && s.column === c);
                                        return (
                                            <div
                                                key={`${r}-${c}`}
                                                className={`h-14 rounded-xl border flex flex-col items-center justify-center p-1 transition-all ${
                                                    seat
                                                        ? 'bg-slate-800/90 border-slate-700 hover:border-emerald-500 hover:bg-slate-700/80 text-slate-200 shadow-md group'
                                                        : 'bg-slate-900/40 border-dashed border-slate-800 text-slate-600'
                                                }`}
                                            >
                                                {seat ? (
                                                    <>
                                                        <span className="text-[10px] text-slate-400 font-mono">R{r}C{c}</span>
                                                        <span className="text-xs font-bold text-emerald-400 truncate max-w-full">
                                                            {seat.seatNumber.replace(/.*-/, '')}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="text-[10px] opacity-40">-</span>
                                                )}
                                            </div>
                                        );
                                    });
                                })}
                            </div>
                        </div>
                    )}

                    <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1.5">
                                <div className="w-3.5 h-3.5 rounded bg-slate-800 border border-slate-700"></div>
                                <span>Configured Desk</span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                                <div className="w-3.5 h-3.5 rounded bg-emerald-500/20 border border-emerald-500/40"></div>
                                <span>Active Allocation</span>
                            </div>
                        </div>
                        <span>Row × Column matrix generated for automated anti-copy interleaving</span>
                    </div>
                </div>
            </div>

            {/* Add Hall Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
                        <button
                            onClick={() => setShowAddModal(false)}
                            className="absolute right-5 top-5 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h2 className="text-lg font-bold text-white mb-4">
                            {isEditing ? 'Edit Examination Hall' : 'Create Examination Hall'}
                        </h2>

                        <form onSubmit={handleHallSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Hall Number / Identifier</label>
                                <input
                                    type="text"
                                    required
                                    value={hallForm.hallNumber}
                                    onChange={(e) => setHallForm({ ...hallForm, hallNumber: e.target.value })}
                                    placeholder="LH-103"
                                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Building / Complex</label>
                                <input
                                    type="text"
                                    value={hallForm.building}
                                    onChange={(e) => setHallForm({ ...hallForm, building: e.target.value })}
                                    placeholder="Main Academic Complex"
                                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Floor Number</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={hallForm.floor}
                                        onChange={(e) => setHallForm({ ...hallForm, floor: Number(e.target.value) })}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Total Desks</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={hallForm.totalSeats}
                                        onChange={(e) => setHallForm({ ...hallForm, totalSeats: Number(e.target.value) })}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-500/20"
                                >
                                    Create Hall & Seats
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Generate Grid Modal */}
            {showGridModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative">
                        <button
                            onClick={() => setShowGridModal(false)}
                            className="absolute right-5 top-5 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h2 className="text-lg font-bold text-white mb-2">Configure Seat Layout Grid</h2>
                        <p className="text-xs text-slate-400 mb-4">
                            Hall: <span className="text-white font-bold">{selectedHall?.hallNumber}</span>
                        </p>

                        <form onSubmit={handleGridGenerate} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Rows (Depth)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="20"
                                        value={gridForm.rows}
                                        onChange={(e) => setGridForm({ ...gridForm, rows: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1">Columns (Benches)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="15"
                                        value={gridForm.columns}
                                        onChange={(e) => setGridForm({ ...gridForm, columns: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>

                            <div className="p-3 bg-slate-800/80 rounded-xl text-xs text-slate-300">
                                Total seats generated: <span className="font-bold text-emerald-400">{gridForm.rows * gridForm.columns} seats</span>
                            </div>

                            <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowGridModal(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-500/20"
                                >
                                    Generate Grid
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HallsPage;
