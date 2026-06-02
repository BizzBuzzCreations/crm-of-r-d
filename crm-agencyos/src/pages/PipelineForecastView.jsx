import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

const STAGES = ['New Lead', 'First Contact', 'Proposal Sent', 'Won', 'Lost'];

const getLeadStage = (lead) => lead?.status || lead?.funnelStage || 'New Lead';
const getDealValue = (lead) => Number(lead?.dealValue) || 0;

export default function PipelineForecastView({ leads = [] }) {
  const safeLeads = Array.isArray(leads) ? leads : [];

  // Prepare forecast data by stage. LeadsPage stores the pipeline stage in `status`.
  const stageData = STAGES.map((stage) => {
    const stageLeads = safeLeads.filter((lead) => getLeadStage(lead) === stage);
    return {
      name: stage,
      value: stageLeads.length,
      revenue: stageLeads.reduce((sum, lead) => sum + getDealValue(lead), 0),
    };
  });

  const wonLeads = safeLeads.filter((lead) => getLeadStage(lead) === 'Won');
  const totalRevenue = safeLeads.reduce((sum, lead) => sum + getDealValue(lead), 0);
  const wonRevenue = wonLeads.reduce((sum, lead) => sum + getDealValue(lead), 0);
  const conversionRate = safeLeads.length > 0 ? ((wonLeads.length / safeLeads.length) * 100).toFixed(1) : 0;

  return (
    <div className="p-6 space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
          <p className="text-sm text-blue-600 dark:text-blue-300 font-semibold">Total Pipeline</p>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">${(totalRevenue / 1000).toFixed(1)}k</p>
          <p className="text-xs text-blue-500 mt-1">{safeLeads.length} leads</p>
        </div>
        <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
          <p className="text-sm text-green-600 dark:text-green-300 font-semibold">Won Revenue</p>
          <p className="text-2xl font-bold text-green-900 dark:text-green-100">${(wonRevenue / 1000).toFixed(1)}k</p>
          <p className="text-xs text-green-500 mt-1">{wonLeads.length} closed</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
          <p className="text-sm text-purple-600 dark:text-purple-300 font-semibold">Conversion Rate</p>
          <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{conversionRate}%</p>
          <p className="text-xs text-purple-500 mt-1 flex items-center gap-1"><TrendingUp size={12} /> Win rate</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Count by Stage */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Leads by Stage</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stageData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue by Stage */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Revenue by Stage</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stageData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => `$${(value / 1000).toFixed(1)}k`} />
              <Bar dataKey="revenue" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stage Funnel */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Conversion Funnel</h3>
        <div className="space-y-3">
          {stageData.map((stage, idx) => {
            const percentage = safeLeads.length > 0 ? ((stage.value / safeLeads.length) * 100) : 0;
            return (
              <div key={stage.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{stage.name}</span>
                  <span className="text-slate-500 dark:text-slate-400">{stage.value} leads • {percentage.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-full rounded-full transition-all ${stage.name === 'Won' ? 'bg-green-500' :
                        stage.name === 'Lost' ? 'bg-red-500' :
                          'bg-blue-500'
                      }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
