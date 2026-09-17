'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AnalyticsPage() {
  const [stats, setStats] = useState([]);
  const [dailyStats, setDailyStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    const { data: clickStats } = await supabase
      .from('click_statistics')
      .select('*')
      .order('click_date', { ascending: false })
      .limit(100);

    const { data: daily } = await supabase
      .from('daily_statistics')
      .select('*')
      .order('click_date', { ascending: false })
      .limit(30);

    setStats(clickStats || []);
    setDailyStats(daily || []);
    setLoading(false);
  }

  if (loading) return <div className="text-slate-400">Loading analytics...</div>;

  const totalClicks = dailyStats.reduce((sum, d) => sum + d.total_clicks, 0);
  const totalUnique = dailyStats.reduce((sum, d) => sum + d.unique_visitors, 0);

  // Group by shortcode
  const byShortcode = {};
  dailyStats.forEach((d) => {
    if (!byShortcode[d.shortcode]) byShortcode[d.shortcode] = 0;
    byShortcode[d.shortcode] += d.total_clicks;
  });
  const topLinks = Object.entries(byShortcode).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Click Analytics</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6">
          <div className="text-3xl font-extrabold brand-gradient-text">{totalClicks.toLocaleString()}</div>
          <div className="text-sm text-slate-400 mt-1">Total Clicks (30 days)</div>
        </div>
        <div className="card p-6">
          <div className="text-3xl font-extrabold brand-gradient-text">{totalUnique.toLocaleString()}</div>
          <div className="text-sm text-slate-400 mt-1">Unique Visitors (30 days)</div>
        </div>
        <div className="card p-6">
          <div className="text-3xl font-extrabold brand-gradient-text">{Object.keys(byShortcode).length}</div>
          <div className="text-sm text-slate-400 mt-1">Active Links</div>
        </div>
      </div>

      {/* Top links */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Top Links by Clicks</h2>
        {topLinks.length === 0 ? (
          <p className="text-slate-400 text-sm">No click data yet. Analytics sync every evening via cron.</p>
        ) : (
          <div className="space-y-2">
            {topLinks.map(([shortcode, clicks], i) => (
              <div key={shortcode} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 text-sm w-6">#{i + 1}</span>
                  <span className="font-semibold text-amber-400">/{shortcode}</span>
                </div>
                <span className="text-slate-300 font-semibold">{clicks.toLocaleString()} clicks</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Country breakdown */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Clicks by Country</h2>
        {(() => {
          const byCountry = {};
          stats.forEach((s) => {
            const c = s.country || 'Unknown';
            if (!byCountry[c]) byCountry[c] = 0;
            byCountry[c] += s.click_count;
          });
          const sorted = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10);
          if (sorted.length === 0) return <p className="text-slate-400 text-sm">No country data yet.</p>;
          return (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {sorted.map(([country, count]) => (
                <div key={country} className="p-3 rounded-xl bg-white/5 text-center">
                  <div className="text-sm font-semibold">{country}</div>
                  <div className="text-xs text-slate-400">{count} clicks</div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
