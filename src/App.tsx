import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Package, 
  AlertTriangle, 
  History, 
  Plus, 
  MinusCircle, 
  Search,
  Calendar,
  ShieldCheck,
  LayoutDashboard,
  Scan,
  X,
  Camera,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Medicine = {
  id: number;
  name: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  added_at: string;
};

type AuditLog = {
  id: number;
  action: string;
  medicine_name: string;
  quantity: number;
  timestamp: string;
};

const calculateHealthScore = (expiryDate: string) => {
  const expiry = new Date(expiryDate).getTime();
  const now = new Date().getTime();
  const diffDays = (expiry - now) / (1000 * 60 * 60 * 24);
  return diffDays / 30;
};

const getStatusFromScore = (score: number) => {
  if (score <= 0) return { label: 'Expired', color: 'text-rose-600', bg: 'bg-rose-100' };
  if (score <= 1) return { label: 'Critical', color: 'text-amber-600', bg: 'bg-amber-100' };
  return { label: 'Safe', color: 'text-emerald-600', bg: 'bg-emerald-100' };
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'dispense' | 'logs'>('dashboard');
  const [inventory, setInventory] = useState<Medicine[]>([]);
  const [alerts, setAlerts] = useState<Medicine[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Form states
  const [newMed, setNewMed] = useState({ name: '', batch: '', expiry: '', quantity: '' });
  const [dispenseData, setDispenseData] = useState({ name: '', quantity: '' });
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      const [invRes, alertRes, logRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/alerts'),
        fetch('/api/logs')
      ]);
      
      const [inv, alrt, lg] = await Promise.all([
        invRes.json(),
        alertRes.json(),
        logRes.json()
      ]);

      setInventory(inv);
      setAlerts(alrt);
      setLogs(lg);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch data", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const startScanner = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access denied", err);
      alert("Camera access is required for scanning.");
      setIsScanning(false);
    }
  };

  const stopScanner = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsScanning(false);
  };

  const simulateScan = () => {
    // Simulate finding a barcode
    setNewMed({
      name: 'Amoxicillin 500mg',
      batch: 'AMX-' + Math.floor(Math.random() * 10000),
      expiry: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      quantity: '100'
    });
    stopScanner();
    setActiveTab('inventory');
  };

  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMed.name || !newMed.batch || !newMed.expiry || !newMed.quantity) return;

    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newMed.name,
        batch_number: newMed.batch,
        expiry_date: newMed.expiry,
        quantity: parseInt(newMed.quantity)
      })
    });

    if (res.ok) {
      setNewMed({ name: '', batch: '', expiry: '', quantity: '' });
      fetchData();
    }
  };

  const handleDispense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispenseData.name || !dispenseData.quantity) return;

    const res = await fetch('/api/dispense', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: dispenseData.name,
        quantity: parseInt(dispenseData.quantity)
      })
    });

    if (res.ok) {
      setDispenseData({ name: '', quantity: '' });
      fetchData();
    } else {
      const err = await res.json();
      alert(err.error);
    }
  };

  const filteredInventory = inventory.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.batch_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalStock = inventory.reduce((sum, m) => sum + m.quantity, 0);

  return (
    <div className="min-h-screen bg-[#f0f4f8] text-slate-900 font-sans selection:bg-blue-100">
      {/* Glassmorphism Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white/70 backdrop-blur-xl border-r border-white/20 z-50 shadow-2xl">
        <div className="p-6 border-b border-slate-200/50 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
            <ShieldCheck className="text-white w-6 h-6" />
          </div>
          <h1 className="font-bold text-xl tracking-tight text-blue-900">PharmaFIFO</h1>
        </div>

        <nav className="mt-6 px-4 space-y-2">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'inventory', icon: Package, label: 'Inventory' },
            { id: 'dispense', icon: MinusCircle, label: 'Dispense' },
            { id: 'logs', icon: History, label: 'Audit Logs' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                activeTab === item.id 
                  ? 'bg-blue-600 text-white font-semibold shadow-lg shadow-blue-100' 
                  : 'text-slate-500 hover:bg-white/50 hover:text-blue-600'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-8 left-6 right-6 space-y-4">
          <button 
            onClick={startScanner}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-xl"
          >
            <Scan className="w-5 h-5" />
            Scan Barcode
          </button>
          
          <div className="bg-blue-900/90 backdrop-blur-md rounded-2xl p-4 text-white shadow-2xl border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-blue-300" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-200">System Status</span>
            </div>
            <p className="text-sm font-medium">Clinical Standard Active</p>
            <div className="mt-3 h-1 w-full bg-blue-800/50 rounded-full overflow-hidden">
              <div className="h-full w-full bg-emerald-400 animate-pulse" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-64 p-8 min-h-screen bg-gradient-to-br from-[#f0f4f8] to-[#d9e2ec]">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <header className="flex justify-between items-end">
                <div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">Clinical Dashboard</h2>
                  <p className="text-slate-500 mt-1 font-medium">UTC Standardized Pharmacological Monitoring</p>
                </div>
                <div className="text-right bg-white/50 backdrop-blur-sm px-4 py-2 rounded-2xl border border-white/50 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Time (UTC)</p>
                  <p className="text-lg font-bold text-blue-900">{new Date().toISOString().split('T')[0]}</p>
                </div>
              </header>

              {/* Stats Grid with Glassmorphism */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'Total Stock Units', value: totalStock, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Critical Expiry', value: alerts.length, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
                  { label: 'Active Batches', value: inventory.length, icon: Activity, color: 'text-slate-600', bg: 'bg-slate-50' }
                ].map((stat, i) => (
                  <motion.div 
                    key={i}
                    whileHover={{ y: -5 }}
                    className="bg-white/60 backdrop-blur-lg p-6 rounded-3xl border border-white/40 shadow-xl"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                        <h3 className={`text-4xl font-black mt-2 ${stat.color}`}>{stat.value}</h3>
                      </div>
                      <div className={`${stat.bg} p-4 rounded-2xl shadow-inner`}>
                        <stat.icon className={`${stat.color} w-6 h-6`} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Health Score Analysis */}
              <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-[2rem] p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <Activity className="text-blue-600 w-6 h-6" />
                  <h3 className="text-xl font-black text-slate-900">Batch Health Analysis</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {inventory.slice(0, 6).map(med => {
                    const score = calculateHealthScore(med.expiry_date);
                    const status = getStatusFromScore(score);
                    return (
                      <div key={med.id} className="bg-white/80 p-5 rounded-2xl border border-white/20 shadow-lg group hover:bg-white transition-all">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{med.name}</h4>
                            <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase">Batch: {med.batch_number}</p>
                          </div>
                          <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${status.bg} ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-400">Health Score</span>
                            <span className={status.color}>{score.toFixed(2)}</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(Math.max(score * 20, 0), 100)}%` }}
                              className={`h-full ${score <= 1 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'inventory' && (
            <motion.div
              key="inventory"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">Inventory Control</h2>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input 
                    type="text" 
                    placeholder="Search clinical database..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 pr-6 py-3 bg-white/60 backdrop-blur-md border border-white/40 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none w-96 transition-all shadow-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Glassmorphism Add Form */}
                <div className="lg:col-span-1">
                  <div className="bg-white/60 backdrop-blur-xl p-8 rounded-[2rem] border border-white/40 shadow-2xl sticky top-8">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="bg-blue-600 p-2 rounded-lg shadow-lg">
                        <Plus className="text-white w-5 h-5" />
                      </div>
                      <h3 className="text-xl font-black">Register Batch</h3>
                    </div>
                    <form onSubmit={handleAddMedicine} className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Medicine Name</label>
                        <input 
                          type="text" 
                          required
                          value={newMed.name}
                          onChange={e => setNewMed({...newMed, name: e.target.value})}
                          className="w-full px-5 py-3 bg-white/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Batch Number</label>
                        <input 
                          type="text" 
                          required
                          value={newMed.batch}
                          onChange={e => setNewMed({...newMed, batch: e.target.value})}
                          className="w-full px-5 py-3 bg-white/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Expiry Date</label>
                          <input 
                            type="date" 
                            required
                            value={newMed.expiry}
                            onChange={e => setNewMed({...newMed, expiry: e.target.value})}
                            className="w-full px-5 py-3 bg-white/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantity</label>
                          <input 
                            type="number" 
                            required
                            min="1"
                            value={newMed.quantity}
                            onChange={e => setNewMed({...newMed, quantity: e.target.value})}
                            className="w-full px-5 py-3 bg-white/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                          />
                        </div>
                      </div>
                      <button 
                        type="submit"
                        className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 mt-4 active:scale-95"
                      >
                        Authorize Entry
                      </button>
                    </form>
                  </div>
                </div>

                {/* Inventory Table with Glassmorphism */}
                <div className="lg:col-span-2">
                  <div className="bg-white/40 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-2xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white/50 border-b border-white/40">
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Medicine</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Batch</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Expiry (UTC)</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInventory.map(med => (
                          <tr key={med.id} className="border-b border-white/20 hover:bg-white/60 transition-all">
                            <td className="px-8 py-5 font-bold text-slate-900">{med.name}</td>
                            <td className="px-8 py-5 font-mono text-xs text-slate-500">{med.batch_number}</td>
                            <td className="px-8 py-5">
                              <span className={`text-sm font-black ${
                                calculateHealthScore(med.expiry_date) <= 1 ? 'text-rose-600' : 'text-emerald-600'
                              }`}>
                                {med.expiry_date}
                              </span>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${med.quantity < 10 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                                <span className="text-sm font-black text-slate-700">{med.quantity} Units</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'dispense' && (
            <motion.div
              key="dispense"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="max-w-3xl mx-auto space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">Medicine Dispensing</h2>
                <p className="text-slate-500 font-medium">Automated FIFO Logic Engine • Expiry Prioritization</p>
              </div>

              <div className="bg-white/60 backdrop-blur-2xl p-10 rounded-[3rem] border border-white/40 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)]">
                <form onSubmit={handleDispense} className="space-y-8">
                  <div className="space-y-3">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Select Pharmaceutical</label>
                    <select 
                      required
                      value={dispenseData.name}
                      onChange={e => setDispenseData({...dispenseData, name: e.target.value})}
                      className="w-full px-6 py-4 bg-white/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none appearance-none font-bold text-slate-700"
                    >
                      <option value="">Choose from inventory...</option>
                      {Array.from(new Set(inventory.map(m => m.name))).map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Dispense Quantity</label>
                    <input 
                      type="number" 
                      required
                      min="1"
                      placeholder="Units to remove..."
                      value={dispenseData.quantity}
                      onChange={e => setDispenseData({...dispenseData, quantity: e.target.value})}
                      className="w-full px-6 py-4 bg-white/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none font-bold"
                    />
                  </div>

                  <div className="bg-blue-900/5 backdrop-blur-sm p-6 rounded-3xl border border-blue-200/50 flex gap-5">
                    <div className="bg-blue-600 p-3 rounded-2xl shadow-lg h-fit">
                      <ShieldCheck className="text-white w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-black text-blue-900 text-sm uppercase tracking-wider">FIFO Protocol Active</h4>
                      <p className="text-sm text-blue-800/80 leading-relaxed font-medium">
                        The system is currently configured to automatically select batches with the earliest expiry dates. This ensures compliance with medical safety standards and minimizes inventory shrinkage.
                      </p>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl hover:bg-blue-700 transition-all shadow-2xl shadow-blue-200 flex items-center justify-center gap-3 text-lg active:scale-[0.98]"
                  >
                    <CheckCircle2 className="w-6 h-6" />
                    Authorize Dispensing
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {activeTab === 'logs' && (
            <motion.div
              key="logs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">Audit Trail</h2>
                  <p className="text-slate-500 font-medium mt-1">Immutable transaction history for regulatory compliance.</p>
                </div>
                <button className="bg-white/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/40 font-black text-xs uppercase tracking-widest text-slate-600 hover:bg-white transition-all shadow-lg">
                  Export CSV
                </button>
              </div>
              
              <div className="bg-white/40 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-2xl overflow-hidden">
                <div className="p-6 bg-white/50 border-b border-white/40 flex items-center gap-3">
                  <History className="text-blue-600 w-6 h-6" />
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Recent Clinical Activity</span>
                </div>
                <div className="divide-y divide-white/20">
                  {logs.map(log => (
                    <div key={log.id} className="p-6 flex items-center justify-between hover:bg-white/60 transition-all">
                      <div className="flex items-center gap-6">
                        <div className={`p-4 rounded-2xl shadow-lg ${
                          log.action === 'ADD_STOCK' ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white'
                        }`}>
                          {log.action === 'ADD_STOCK' ? <Plus className="w-6 h-6" /> : <MinusCircle className="w-6 h-6" />}
                        </div>
                        <div>
                          <p className="text-lg font-black text-slate-900">
                            {log.action === 'ADD_STOCK' ? 'Inventory Replenishment' : 'Clinical Dispensing'}
                          </p>
                          <p className="text-sm font-bold text-slate-500 mt-1">
                            {log.medicine_name} • <span className="text-blue-600">{log.quantity} Units</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Timestamp (UTC)</p>
                        <p className="text-sm font-mono font-bold text-slate-700">{new Date(log.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Barcode Scanner Modal */}
      <AnimatePresence>
        {isScanning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-xl p-6"
          >
            <div className="bg-white rounded-[3rem] overflow-hidden shadow-2xl max-w-lg w-full relative border border-white/20">
              <button 
                onClick={stopScanner}
                className="absolute top-6 right-6 z-10 bg-slate-900/50 text-white p-2 rounded-full hover:bg-slate-900 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="p-8 space-y-6">
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-black text-slate-900">Scan Medicine Barcode</h3>
                  <p className="text-slate-500 font-medium">Align the barcode within the frame below</p>
                </div>
                
                <div className="relative aspect-square bg-slate-900 rounded-[2rem] overflow-hidden border-4 border-blue-600 shadow-2xl">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover grayscale opacity-80"
                  />
                  <div className="absolute inset-0 border-[40px] border-slate-900/60 pointer-events-none">
                    <div className="w-full h-full border-2 border-blue-400/50 rounded-xl relative">
                      <motion.div 
                        animate={{ top: ['0%', '100%', '0%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        className="absolute left-0 right-0 h-0.5 bg-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.8)]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={simulateScan}
                    className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 flex items-center justify-center gap-2"
                  >
                    <Camera className="w-5 h-5" />
                    Capture & Analyze
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
