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
 * Fetches reports, then manually enriches with vehicle/driver data.
 */
async function getDailyFaults(reportDate) {
    try {
        // Fetch all vehicles and drivers for manual lookup (no FK on inspection_reports)
        const [{ data: allVehicles }, { data: allDrivers }, { data: reports, error }] = await Promise.all([
            supabase.from('vehicles').select('registration, make, nickname'),
            supabase.from('drivers').select('id, name'),
            supabase.from('inspection_reports')
                .select('vehicle_registration, driver_id, checklist')
                .gte('submitted_at', `${reportDate}T00:00:00`)
                .lte('submitted_at', `${reportDate}T23:59:59`)
        ]);

        if (error) throw error;

        const vehicleMap = new Map((allVehicles || []).map(v => [v.registration, v]));
        const driverMap  = new Map((allDrivers  || []).map(d => [String(d.id), d]));

        const faults = [];
        (reports || []).forEach(report => {
            const vehicle = vehicleMap.get(report.vehicle_registration) || {};
            const driver  = driverMap.get(String(report.driver_id)) || {};
            const checklist = report.checklist || [];

            checklist.forEach(item => {
                if (item.status === 'FAULT') {
                    faults.push({
                        registration: report.vehicle_registration,
                        driver_id:    report.driver_id,
                        driver_name:  driver.name || 'Unknown',
                        nickname:     vehicle.nickname || '',
                        make:         vehicle.make || 'Unknown',
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
 * Manual vehicle lookup — no FK join.
 */
async function getFaultStreaks(reportDate, lookbackDays = 14) {
    try {
        const startDate = new Date(reportDate);
        startDate.setDate(startDate.getDate() - lookbackDays);
        const startDateStr = startDate.toISOString().split('T')[0];

        const [{ data: allVehicles }, { data, error }] = await Promise.all([
            supabase.from('vehicles').select('registration, make, nickname'),
            supabase.from('inspection_reports')
                .select('vehicle_registration, submitted_at, checklist')
                .gte('submitted_at', `${startDateStr}T00:00:00`)
                .lte('submitted_at', `${reportDate}T23:59:59`)
                .order('submitted_at', { ascending: false })
        ]);

        if (error) throw error;

        const vehicleMap = new Map((allVehicles || []).map(v => [v.registration, v]));

        // Map: vehicle_reg -> item -> streak info
        const streaksMap = {};

        (data || []).forEach(report => {
            const reg = report.vehicle_registration;
            const date = report.submitted_at.split('T')[0];
            const checklist = report.checklist || [];

            if (!streaksMap[reg]) streaksMap[reg] = {
                info: vehicleMap.get(reg) || {},
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
                        const lastDate    = new Date(streaksMap[reg].items[item.item].lastDate);
                        const currentDate = new Date(date);
                        const diffDays    = Math.ceil(Math.abs(lastDate - currentDate) / (1000 * 60 * 60 * 24));

                        if (diffDays === 1) {
                            streaksMap[reg].items[item.item].streak++;
                            streaksMap[reg].items[item.item].lastDate = date;
                            streaksMap[reg].items[item.item].history.push(date);
                        }
                    }
                }
            });
        });

        const finalStreaks = [];
        for (const [reg, regData] of Object.entries(streaksMap)) {
            for (const [itemName, info] of Object.entries(regData.items)) {
                if (info.streak >= 3) {
                    finalStreaks.push({
                        registration: reg,
                        nickname:     regData.info?.nickname,
                        make:         regData.info?.make,
                        item:         itemName,
                        streak:       info.streak,
                        firstDate:    info.lastDate
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
 * Manual vehicle lookup — no FK join.
 */
async function getResolvedIssues(reportDate) {
    try {
        const yesterday = new Date(reportDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const [{ data: allVehicles }, { data: todayReports, error: tError }, { data: yesterdayReports, error: yError }] = await Promise.all([
            supabase.from('vehicles').select('registration, make, nickname'),
            supabase.from('inspection_reports')
                .select('vehicle_registration, checklist')
                .gte('submitted_at', `${reportDate}T00:00:00`)
                .lte('submitted_at', `${reportDate}T23:59:59`),
            supabase.from('inspection_reports')
                .select('vehicle_registration, checklist')
                .gte('submitted_at', `${yesterdayStr}T00:00:00`)
                .lte('submitted_at', `${yesterdayStr}T23:59:59`)
        ]);

        if (tError) throw tError;
        if (yError) throw yError;

        const vehicleMap = new Map((allVehicles || []).map(v => [v.registration, v]));

        const resolved = [];
        (todayReports || []).forEach(tReport => {
            const yReport = (yesterdayReports || []).find(yr => yr.vehicle_registration === tReport.vehicle_registration);
            if (!yReport) return;

            const vehicle    = vehicleMap.get(tReport.vehicle_registration) || {};
            const tChecklist = tReport.checklist || [];
            const yChecklist = yReport.checklist || [];

            tChecklist.forEach(tItem => {
                const yItem = yChecklist.find(yi => yi.item === tItem.item);
                if (yItem && yItem.status === 'FAULT' && tItem.status === 'OK') {
                    resolved.push({
                        registration: tReport.vehicle_registration,
                        nickname:     vehicle.nickname,
                        make:         vehicle.make,
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
 * Check if a report has already been successfully sent for a specific date.
 * Returns true only if the report row exists AND sent = true.
 * A row with sent = false means a previous attempt saved but failed to deliver —
 * in that case we should retry, so we return false.
 */
async function checkReportExists(reportDate) {
    const { data, error } = await supabase
        .from('daily_reports')
        .select('id, sent')
        .eq('date', reportDate)
        .maybeSingle();
    
    if (error) throw error;
    return !!(data && data.sent === true);
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
