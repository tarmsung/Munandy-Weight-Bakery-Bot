const { supabase } = require('./supabase');

/**
 * Insert a completed daily supervisor report.
 */
async function insertSupervisorReport(reportData) {
    const { error } = await supabase
        .from('supervisor_reports')
        .insert([reportData]);

    if (error) {
        throw new Error(`insertSupervisorReport: ${error.message}`);
    }
}

/**
 * Fetch supervisor reports for a specific month and year.
 */
async function getReportsByMonth(year, month) {
    // Assuming month is 1-indexed (1-12)
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    // Get the last day of the month
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('supervisor_reports')
        .select('*')
        .gte('report_date', startDate)
        .lte('report_date', endDate);

    if (error) {
        throw new Error(`getReportsByMonth: ${error.message}`);
    }

    return data || [];
}

module.exports = {
    insertSupervisorReport,
    getReportsByMonth
};
