const supabase = require('./supabase');

/**
 * Q1 — Who hasn't submitted today?
 */
async function getUnfiledReports(reportDate) {
    try {
        const { data, error } = await supabase.rpc('get_unfiled_vehicles', { report_date: reportDate });
        if (error) {
            // If RPC doesn't exist, use fallback query
            const { data: allVehicles, error: vError } = await supabase
                .from('vehicles')
                .select('registration, make, nickname')
                .eq('is_active', true);
            
            if (vError) throw vError;

            const { data: submitted, error: sError } = await supabase
                .from('inspection_reports')
                .select('vehicle_registration')
                .gte('submitted_at', `${reportDate}T00:00:00`)
                .lte('submitted_at', `${reportDate}T23:59:59`);
            
            if (sError) throw sError;

            const submittedRegs = new Set(submitted.map(s => s.vehicle_registration));
            return allVehicles.filter(v => !submittedRegs.has(v.registration));
        }
        return data || [];
    } catch (err) {
        console.error('Error in getUnfiledReports:', err);
        throw err;
    }
}

/**
 * Q2 — Today's faults
 */
async function getDailyFaults(reportDate) {
    try {
        const { data, error } = await supabase
            .from('inspection_reports')
            .select(`
                vehicle_registration,
                driver_id,
                checklist,
                vehicles (nickname, make),
                drivers (name)
            `)
            .gte('submitted_at', `${reportDate}T00:00:00`)
            .lte('submitted_at', `${reportDate}T23:59:59`);

        if (error) throw error;

        const faults = [];
        data.forEach(report => {
            const checklist = report.checklist || [];
            checklist.forEach(item => {
                if (item.status === 'FAULT') {
                    faults.push({
                        registration: report.vehicle_registration,
                        driver_id:    report.driver_id,
                        driver_name:  report.drivers?.name || 'Unknown',
                        nickname:     report.vehicles?.nickname || '',
                        make:         report.vehicles?.make || 'Unknown',
                        item:         item.item,
                        description:  item.fault_description
                    });
                }
            });
        });
        return faults;
    } catch (err) {
        console.error('Error in getDailyFaults:', err);
        throw err;
    }
}

/**
 * Q3 — Faults reported 3 or more consecutive days
 */
async function getFaultStreaks(reportDate, lookbackDays = 14) {
    try {
        const startDate = new Date(reportDate);
        startDate.setDate(startDate.getDate() - lookbackDays);
        const startDateStr = startDate.toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('inspection_reports')
            .select('vehicle_registration, submitted_at, checklist, vehicles(nickname, make)')
            .gte('submitted_at', `${startDateStr}T00:00:00`)
            .lte('submitted_at', `${reportDate}T23:59:59`)
            .order('submitted_at', { ascending: false });

        if (error) throw error;

        // Map: vehicle_reg -> item -> streak info
        const streaksMap = {};

        data.forEach(report => {
            const reg = report.vehicle_registration;
            const date = report.submitted_at.split('T')[0];
            const checklist = report.checklist || [];

            if (!streaksMap[reg]) streaksMap[reg] = { 
                info: report.vehicles,
                items: {} 
            };

            checklist.forEach(item => {
                if (item.status === 'FAULT') {
                    if (!streaksMap[reg].items[item.item]) {
                        streaksMap[reg].items[item.item] = { 
                            streak: 1, 
                            firstDate: date,
                            lastDate: date,
                            history: [date]
                        };
                    } else {
                        // Check if consecutive
                        const lastDate = new Date(streaksMap[reg].items[item.item].lastDate);
                        const currentDate = new Date(date);
                        const diffTime = Math.abs(lastDate - currentDate);
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays === 1) {
                            streaksMap[reg].items[item.item].streak++;
                            streaksMap[reg].items[item.item].lastDate = date;
                            streaksMap[reg].items[item.item].history.push(date);
                        } else if (diffDays > 1) {
                            // Streak broken in reverse order (older reports)
                            // We only care about CURRENT streaks ending today
                        }
                    }
                }
            });
        });

        const finalStreaks = [];
        for (const [reg, data] of Object.entries(streaksMap)) {
            for (const [itemName, info] of Object.entries(data.items)) {
                if (info.streak >= 3) {
                    finalStreaks.push({
                        registration: reg,
                        nickname:     data.info?.nickname,
                        make:         data.info?.make,
                        item:         itemName,
                        streak:       info.streak,
                        firstDate:    info.lastDate // In our reverse crawl, lastDate is the oldest consecutive
                    });
                }
            }
        }
        return finalStreaks;
    } catch (err) {
        console.error('Error in getFaultStreaks:', err);
        throw err;
    }
}

/**
 * Q4 — Issues resolved today
 */
async function getResolvedIssues(reportDate) {
    try {
        const yesterday = new Date(reportDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const { data: todayReports, error: tError } = await supabase
            .from('inspection_reports')
            .select('vehicle_registration, checklist, vehicles(nickname, make)')
            .gte('submitted_at', `${reportDate}T00:00:00`)
            .lte('submitted_at', `${reportDate}T23:59:59`);
        
        if (tError) throw tError;

        const { data: yesterdayReports, error: yError } = await supabase
            .from('inspection_reports')
            .select('vehicle_registration, checklist')
            .gte('submitted_at', `${yesterdayStr}T00:00:00`)
            .lte('submitted_at', `${yesterdayStr}T23:59:59`);
        
        if (yError) throw yError;

        const resolved = [];
        todayReports.forEach(tReport => {
            const yReport = yesterdayReports.find(yr => yr.vehicle_registration === tReport.vehicle_registration);
            if (!yReport) return;

            const tChecklist = tReport.checklist || [];
            const yChecklist = yReport.checklist || [];

            tChecklist.forEach(tItem => {
                const yItem = yChecklist.find(yi => yi.item === tItem.item);
                if (yItem && yItem.status === 'FAULT' && tItem.status === 'OK') {
                    resolved.push({
                        registration: tReport.vehicle_registration,
                        nickname:     tReport.vehicles?.nickname,
                        make:         tReport.vehicles?.make,
                        item:         tItem.item
                    });
                }
            });
        });
        return resolved;
    } catch (err) {
        console.error('Error in getResolvedIssues:', err);
        throw err;
    }
}

/**
 * Q5 — Service or suspension due within 14 days
 */
async function getMaintenanceDue(reportDate) {
    try {
        const endDate = new Date(reportDate);
        endDate.setDate(endDate.getDate() + 14);
        const endDateStr = endDate.toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('vehicle_maintenance')
            .select('registration, service_due, suspension_due, vehicles(nickname, make)')
            .or(`service_due.gte.${reportDate},service_due.lte.${endDateStr},suspension_due.gte.${reportDate},suspension_due.lte.${endDateStr}`);

        if (error) throw error;
        
        const due = [];
        data.forEach(m => {
            if (m.service_due && m.service_due >= reportDate && m.service_due <= endDateStr) {
                due.push({
                    registration: m.registration,
                    nickname:     m.vehicles?.nickname,
                    make:         m.vehicles?.make,
                    type:         'Service',
                    date:         m.service_due
                });
            }
            if (m.suspension_due && m.suspension_due >= reportDate && m.suspension_due <= endDateStr) {
                due.push({
                    registration: m.registration,
                    nickname:     m.vehicles?.nickname,
                    make:         m.vehicles?.make,
                    type:         'Suspension Check',
                    date:         m.suspension_due
                });
            }
        });
        return due;
    } catch (err) {
        console.error('Error in getMaintenanceDue:', err);
        throw err;
    }
}

/**
 * Q6 — Insurance due within 14 days
 */
async function getInsuranceDue(reportDate) {
    try {
        const endDate = new Date(reportDate);
        endDate.setDate(endDate.getDate() + 14);
        const endDateStr = endDate.toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('vehicle_insurance')
            .select('registration, insurance_due, policy_number, vehicles(nickname, make)')
            .gte('insurance_due', reportDate)
            .lte('insurance_due', endDateStr);

        if (error) throw error;
        
        return data.map(i => ({
            registration: i.registration,
            nickname:     i.vehicles?.nickname,
            make:         i.vehicles?.make,
            date:         i.insurance_due,
            policy:       i.policy_number
        }));
    } catch (err) {
        console.error('Error in getInsuranceDue:', err);
        throw err;
    }
}

/**
 * Check if a report exists for a specific date
 */
async function checkReportExists(reportDate) {
    const { data, error } = await supabase
        .from('daily_reports')
        .select('id')
        .eq('date', reportDate)
        .maybeSingle();
    
    if (error) throw error;
    return !!data;
}

/**
 * Save the report payload
 */
async function saveDailyReport(reportDate, payload) {
    const { data, error } = await supabase
        .from('daily_reports')
        .upsert({ date: reportDate, payload, created_at: new Date().toISOString() })
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

/**
 * Mark report as sent
 */
async function markReportSent(reportDate) {
    const { error } = await supabase
        .from('daily_reports')
        .update({ sent: true, sent_at: new Date().toISOString() })
        .eq('date', reportDate);
    
    if (error) throw error;
    return true;
}

module.exports = {
    getUnfiledReports,
    getDailyFaults,
    getFaultStreaks,
    getResolvedIssues,
    getMaintenanceDue,
    getInsuranceDue,
    checkReportExists,
    saveDailyReport,
    markReportSent
};
