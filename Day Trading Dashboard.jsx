import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Upload, TrendingUp, TrendingDown, DollarSign, Target, Clock, Calendar, Filter, Download, Trash2 } from 'lucide-react';

const TradingDashboard = () => {
  const [trades, setTrades] = useState([]);
  const [filteredTrades, setFilteredTrades] = useState([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [filterDirection, setFilterDirection] = useState('all');
  const [filterInstrument, setFilterInstrument] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Load trades from persistent storage on mount
  useEffect(() => {
    loadFromStorage();
  }, []);

  // Save to storage whenever trades change
  useEffect(() => {
    if (trades.length > 0) {
      saveToStorage();
    }
  }, [trades]);

  // Apply filters
  useEffect(() => {
    let filtered = [...trades];
    
    if (dateRange.start) {
      filtered = filtered.filter(t => new Date(t.timestamp) >= new Date(dateRange.start));
    }
    if (dateRange.end) {
      filtered = filtered.filter(t => new Date(t.timestamp) <= new Date(dateRange.end));
    }
    if (filterDirection !== 'all') {
      filtered = filtered.filter(t => t.direction === filterDirection);
    }
    if (filterInstrument !== 'all') {
      filtered = filtered.filter(t => t.instrument === filterInstrument);
    }
    
    setFilteredTrades(filtered);
  }, [trades, dateRange, filterDirection, filterInstrument]);

  const saveToStorage = async () => {
    try {
      await window.storage.set('trading-data', JSON.stringify(trades));
    } catch (err) {
      console.log('Storage not available, data will not persist');
    }
  };

  const loadFromStorage = async () => {
    try {
      const data = await window.storage.get('trading-data');
      if (data && data.value) {
        setTrades(JSON.parse(data.value));
      }
    } catch (err) {
      console.log('No stored data found');
    }
  };

  const clearData = async () => {
    if (confirm('Are you sure you want to clear all trading data?')) {
      try {
        await window.storage.delete('trading-data');
        setTrades([]);
        setFilteredTrades([]);
      } catch (err) {
        setTrades([]);
        setFilteredTrades([]);
      }
    }
  };

  const parseCSV = (csvText) => {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const parsedTrades = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',');
      const trade = {};
      
      headers.forEach((header, index) => {
        trade[header] = values[index]?.trim() || '';
      });
      
      // Parse the trade data
      const quantity = parseFloat(trade['Quantity']);
      const rpl = parseFloat(trade['Rpl Converted']) || 0;
      const fee = parseFloat(trade['Fee']) || 0;
      const swap = parseFloat(trade['Swap Converted']) || 0;
      
      parsedTrades.push({
        id: trade['Trade Id'],
        instrument: trade['Instrument Symbol'] || trade['Instrument Name'],
        direction: quantity > 0 ? 'Long' : 'Short',
        quantity: Math.abs(quantity),
        price: parseFloat(trade['Price']) || 0,
        takeProfit: parseFloat(trade['Take Profit']) || 0,
        stopLoss: parseFloat(trade['Stop Loss']) || 0,
        pnl: rpl,
        fee: fee,
        swap: swap,
        netPnl: rpl - fee + swap,
        timestamp: trade['Timestamp'],
        executionType: trade['Execution Type'],
        status: trade['Status']
      });
    }
    
    return parsedTrades.filter(t => t.pnl !== 0); // Only completed trades
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvText = e.target.result;
      const parsedTrades = parseCSV(csvText);
      setTrades(parsedTrades);
    };
    reader.readAsText(file);
  };

  // Calculate metrics
  const metrics = useMemo(() => {
    if (filteredTrades.length === 0) return null;

    const totalPnl = filteredTrades.reduce((sum, t) => sum + t.netPnl, 0);
    const totalFees = filteredTrades.reduce((sum, t) => sum + t.fee, 0);
    const winners = filteredTrades.filter(t => t.netPnl > 0);
    const losers = filteredTrades.filter(t => t.netPnl < 0);
    
    const winRate = (winners.length / filteredTrades.length) * 100;
    const avgWin = winners.length > 0 ? winners.reduce((sum, t) => sum + t.netPnl, 0) / winners.length : 0;
    const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((sum, t) => sum + t.netPnl, 0) / losers.length) : 0;
    
    const grossProfit = winners.reduce((sum, t) => sum + t.netPnl, 0);
    const grossLoss = Math.abs(losers.reduce((sum, t) => sum + t.netPnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
    
    const riskReward = avgLoss > 0 ? avgWin / avgLoss : 0;
    
    // Equity curve
    const sortedTrades = [...filteredTrades].sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
    
    let runningTotal = 0;
    const equityCurve = sortedTrades.map(trade => {
      runningTotal += trade.netPnl;
      return {
        date: new Date(trade.timestamp).toLocaleDateString(),
        equity: runningTotal,
        pnl: trade.netPnl
      };
    });
    
    // Performance by day of week
    const dayStats = {};
    filteredTrades.forEach(trade => {
      const day = new Date(trade.timestamp).toLocaleDateString('en-US', { weekday: 'short' });
      if (!dayStats[day]) {
        dayStats[day] = { day, pnl: 0, trades: 0 };
      }
      dayStats[day].pnl += trade.netPnl;
      dayStats[day].trades += 1;
    });
    
    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayPerformance = dayOrder
      .map(day => dayStats[day])
      .filter(Boolean);
    
    // Performance by hour
    const hourStats = {};
    filteredTrades.forEach(trade => {
      const hour = new Date(trade.timestamp).getHours();
      if (!hourStats[hour]) {
        hourStats[hour] = { hour: `${hour}:00`, pnl: 0, trades: 0 };
      }
      hourStats[hour].pnl += trade.netPnl;
      hourStats[hour].trades += 1;
    });
    
    const hourPerformance = Object.values(hourStats).sort((a, b) => 
      parseInt(a.hour) - parseInt(b.hour)
    );
    
    // Long vs Short
    const longs = filteredTrades.filter(t => t.direction === 'Long');
    const shorts = filteredTrades.filter(t => t.direction === 'Short');
    
    const longPnl = longs.reduce((sum, t) => sum + t.netPnl, 0);
    const shortPnl = shorts.reduce((sum, t) => sum + t.netPnl, 0);
    
    const directionStats = [
      { name: 'Long', pnl: longPnl, trades: longs.length, winRate: longs.length > 0 ? (longs.filter(t => t.netPnl > 0).length / longs.length) * 100 : 0 },
      { name: 'Short', pnl: shortPnl, trades: shorts.length, winRate: shorts.length > 0 ? (shorts.filter(t => t.netPnl > 0).length / shorts.length) * 100 : 0 }
    ];
    
    // Best and worst trades
    const sortedByPnl = [...filteredTrades].sort((a, b) => b.netPnl - a.netPnl);
    const bestTrades = sortedByPnl.slice(0, 5);
    const worstTrades = sortedByPnl.slice(-5).reverse();
    
    // Consecutive streaks
    let currentStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    
    sortedTrades.forEach(trade => {
      if (trade.netPnl > 0) {
        currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;
        maxWinStreak = Math.max(maxWinStreak, currentStreak);
      } else {
        currentStreak = currentStreak < 0 ? currentStreak - 1 : -1;
        maxLossStreak = Math.max(maxLossStreak, Math.abs(currentStreak));
      }
    });

    // Instrument breakdown
    const instrumentStats = {};
    filteredTrades.forEach(trade => {
      if (!instrumentStats[trade.instrument]) {
        instrumentStats[trade.instrument] = { name: trade.instrument, pnl: 0, trades: 0 };
      }
      instrumentStats[trade.instrument].pnl += trade.netPnl;
      instrumentStats[trade.instrument].trades += 1;
    });

    return {
      totalPnl,
      totalFees,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      riskReward,
      totalTrades: filteredTrades.length,
      winners: winners.length,
      losers: losers.length,
      equityCurve,
      dayPerformance,
      hourPerformance,
      directionStats,
      bestTrades,
      worstTrades,
      maxWinStreak,
      maxLossStreak,
      instruments: Object.values(instrumentStats)
    };
  }, [filteredTrades]);

  const uniqueInstruments = useMemo(() => {
    const instruments = new Set(trades.map(t => t.instrument));
    return Array.from(instruments);
  }, [trades]);

  if (trades.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent" style={{ fontFamily: 'SF Mono, Monaco, Consolas, monospace' }}>
              TRADING ANALYTICS
            </h1>
            <p className="text-slate-400 text-lg">Advanced performance insights for your trading</p>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-12 text-center shadow-2xl">
            <Upload className="w-16 h-16 mx-auto mb-6 text-cyan-400" />
            <h2 className="text-2xl font-semibold mb-4">Upload Your Trading Data</h2>
            <p className="text-slate-400 mb-8">
              Import your Capital.com CSV report to unlock detailed analytics and insights
            </p>
            
            <label className="inline-block">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 rounded-xl cursor-pointer transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-cyan-500/25 transform hover:scale-105">
                Select CSV File
              </div>
            </label>
            
            <div className="mt-8 text-left text-sm text-slate-500 bg-slate-900/50 rounded-lg p-6 border border-slate-700/30">
              <p className="font-semibold text-slate-300 mb-2">Expected CSV format from Capital.com:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Trade Id, Instrument Symbol, Quantity, Price</li>
                <li>Rpl Converted, Fee, Swap, Timestamp</li>
                <li>Take Profit, Stop Loss, Execution Type</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent" style={{ fontFamily: 'SF Mono, Monaco, Consolas, monospace' }}>
              TRADING ANALYTICS
            </h1>
            <p className="text-slate-400">
              {filteredTrades.length} trades analyzed
              {filteredTrades.length !== trades.length && ` (${trades.length} total)`}
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2 border border-slate-700"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            
            <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-2 cursor-pointer border border-slate-700">
              <Upload className="w-4 h-4" />
              Upload New
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            
            <button
              onClick={clearData}
              className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 rounded-lg transition-colors flex items-center gap-2 border border-red-800/50"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Start Date</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">End Date</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Direction</label>
                <select
                  value={filterDirection}
                  onChange={(e) => setFilterDirection(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="all">All</option>
                  <option value="Long">Long</option>
                  <option value="Short">Short</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Instrument</label>
                <select
                  value={filterInstrument}
                  onChange={(e) => setFilterInstrument(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="all">All</option>
                  {uniqueInstruments.map(inst => (
                    <option key={inst} value={inst}>{inst}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <button
              onClick={() => {
                setDateRange({ start: '', end: '' });
                setFilterDirection('all');
                setFilterInstrument('all');
              }}
              className="mt-4 text-sm text-cyan-400 hover:text-cyan-300"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Key Metrics */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <MetricCard
            title="Total P&L"
            value={`$${metrics.totalPnl.toFixed(2)}`}
            subtitle={`${metrics.totalTrades} trades`}
            icon={<DollarSign />}
            positive={metrics.totalPnl >= 0}
            highlight
          />
          
          <MetricCard
            title="Win Rate"
            value={`${metrics.winRate.toFixed(1)}%`}
            subtitle={`${metrics.winners}W / ${metrics.losers}L`}
            icon={<Target />}
            positive={metrics.winRate >= 50}
          />
          
          <MetricCard
            title="Profit Factor"
            value={metrics.profitFactor.toFixed(2)}
            subtitle={metrics.profitFactor >= 2 ? 'Excellent' : metrics.profitFactor >= 1.5 ? 'Good' : 'Fair'}
            icon={<TrendingUp />}
            positive={metrics.profitFactor >= 1.5}
          />
          
          <MetricCard
            title="Avg Win/Loss"
            value={`$${metrics.avgWin.toFixed(2)}`}
            subtitle={`/ $${metrics.avgLoss.toFixed(2)}`}
            icon={<TrendingUp />}
            positive={metrics.avgWin > metrics.avgLoss}
          />
          
          <MetricCard
            title="Risk:Reward"
            value={`1:${metrics.riskReward.toFixed(2)}`}
            subtitle={`Total fees: $${metrics.totalFees.toFixed(2)}`}
            icon={<Target />}
            positive={metrics.riskReward >= 1.5}
          />
        </div>
      </div>

      {/* Charts Section */}
      <div className="max-w-7xl mx-auto mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Equity Curve */}
        <ChartCard title="Equity Curve" subtitle="Cumulative P&L over time">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics.equityCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Line 
                type="monotone" 
                dataKey="equity" 
                stroke="#06b6d4" 
                strokeWidth={2}
                dot={{ fill: '#06b6d4', r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Day Performance */}
        <ChartCard title="Performance by Day" subtitle="Which days are most profitable">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.dayPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="day" stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Bar dataKey="pnl" fill="#06b6d4" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Hour Performance */}
        <ChartCard title="Performance by Hour" subtitle="Best trading times">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.hourPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="hour" stroke="#94a3b8" style={{ fontSize: '10px' }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Bar dataKey="pnl" radius={[8, 8, 0, 0]}>
                {metrics.hourPerformance.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Long vs Short */}
        <ChartCard title="Long vs Short" subtitle="Direction comparison">
          <div className="space-y-4 p-4">
            {metrics.directionStats.map((stat, idx) => (
              <div key={idx} className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-lg">{stat.name}</span>
                  <span className={`text-xl font-bold ${stat.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${stat.pnl.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-slate-400">
                  <span>{stat.trades} trades</span>
                  <span>Win rate: {stat.winRate.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Best and Worst Trades */}
      <div className="max-w-7xl mx-auto mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Top 5 Wins" subtitle="Your best performing trades">
          <div className="space-y-2">
            {metrics.bestTrades.map((trade, idx) => (
              <div key={idx} className="flex justify-between items-center bg-green-900/20 border border-green-800/30 rounded-lg p-3">
                <div>
                  <div className="font-semibold">{trade.instrument}</div>
                  <div className="text-xs text-slate-400">{new Date(trade.timestamp).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-green-400 font-bold">${trade.netPnl.toFixed(2)}</div>
                  <div className="text-xs text-slate-400">{trade.direction}</div>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Top 5 Losses" subtitle="Trades to learn from">
          <div className="space-y-2">
            {metrics.worstTrades.map((trade, idx) => (
              <div key={idx} className="flex justify-between items-center bg-red-900/20 border border-red-800/30 rounded-lg p-3">
                <div>
                  <div className="font-semibold">{trade.instrument}</div>
                  <div className="text-xs text-slate-400">{new Date(trade.timestamp).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-red-400 font-bold">${trade.netPnl.toFixed(2)}</div>
                  <div className="text-xs text-slate-400">{trade.direction}</div>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Additional Stats */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ChartCard title="Streak Analysis" subtitle="Consecutive wins and losses">
            <div className="space-y-4 p-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Max Win Streak</span>
                <span className="text-2xl font-bold text-green-400">{metrics.maxWinStreak}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Max Loss Streak</span>
                <span className="text-2xl font-bold text-red-400">{metrics.maxLossStreak}</span>
              </div>
            </div>
          </ChartCard>

          <ChartCard title="Instrument Breakdown" subtitle="Performance by symbol" span2>
            <div className="space-y-2">
              {metrics.instruments.map((inst, idx) => (
                <div key={idx} className="flex justify-between items-center bg-slate-900/50 rounded-lg p-3">
                  <div>
                    <div className="font-semibold">{inst.name}</div>
                    <div className="text-xs text-slate-400">{inst.trades} trades</div>
                  </div>
                  <div className={`text-lg font-bold ${inst.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${inst.pnl.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      </div>

      {/* Trade Log Table */}
      <div className="max-w-7xl mx-auto">
        <ChartCard title="Complete Trade Log" subtitle="All trades with details">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700">
                <tr className="text-left text-slate-400">
                  <th className="pb-3 px-2">Date</th>
                  <th className="pb-3 px-2">Instrument</th>
                  <th className="pb-3 px-2">Direction</th>
                  <th className="pb-3 px-2">Quantity</th>
                  <th className="pb-3 px-2">Price</th>
                  <th className="pb-3 px-2">P&L</th>
                  <th className="pb-3 px-2">Fees</th>
                  <th className="pb-3 px-2">Net P&L</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map((trade, idx) => (
                  <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-3 px-2">{new Date(trade.timestamp).toLocaleString()}</td>
                    <td className="py-3 px-2">{trade.instrument}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        trade.direction === 'Long' ? 'bg-blue-900/30 text-blue-300' : 'bg-purple-900/30 text-purple-300'
                      }`}>
                        {trade.direction}
                      </span>
                    </td>
                    <td className="py-3 px-2">{trade.quantity}</td>
                    <td className="py-3 px-2">${trade.price.toFixed(2)}</td>
                    <td className={`py-3 px-2 font-semibold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${trade.pnl.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-slate-400">${trade.fee.toFixed(2)}</td>
                    <td className={`py-3 px-2 font-bold ${trade.netPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${trade.netPnl.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

// Reusable components
const MetricCard = ({ title, value, subtitle, icon, positive, highlight }) => (
  <div className={`bg-slate-800/50 backdrop-blur border rounded-xl p-5 ${
    highlight 
      ? 'border-cyan-500/30 shadow-lg shadow-cyan-500/10' 
      : 'border-slate-700/50'
  }`}>
    <div className="flex items-start justify-between mb-3">
      <span className="text-slate-400 text-sm font-medium">{title}</span>
      <div className={`text-${positive ? 'green' : 'red'}-400`}>
        {icon}
      </div>
    </div>
    <div className={`text-2xl font-bold mb-1 ${
      positive ? 'text-green-400' : value.includes('-') ? 'text-red-400' : 'text-slate-100'
    }`} style={{ fontFamily: 'SF Mono, Monaco, Consolas, monospace' }}>
      {value}
    </div>
    <div className="text-xs text-slate-500">{subtitle}</div>
  </div>
);

const ChartCard = ({ title, subtitle, children, span2 }) => (
  <div className={`bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-6 ${
    span2 ? 'md:col-span-2' : ''
  }`}>
    <div className="mb-4">
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-slate-400">{subtitle}</p>
    </div>
    {children}
  </div>
);

export default TradingDashboard;