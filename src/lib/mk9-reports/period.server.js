function pad(n) { return n < 10 ? `0${n}` : `${n}`; }
function isoUTC(y, m, d) {
    return `${y}-${pad(m)}-${pad(d)}`;
}
function lastDayOfMonth(y, m) {
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function daysBetween(a, b) {
    const da = new Date(a + "T00:00:00Z").getTime();
    const db = new Date(b + "T00:00:00Z").getTime();
    return Math.round((db - da) / 86400000) + 1;
}
export async function loadPeriodConfig(supabase, industryId) {
    const { data, error } = await supabase
        .from("mk9_industry_period_config")
        .select("*")
        .eq("industry_id", industryId)
        .maybeSingle();
    if (error)
        throw new Error(error.message);
    if (!data) {
        return {
            industryId,
            periodType: "CALENDAR_MONTH",
            startDay: 1,
            endDay: 31,
            usesPreviousMonth: false,
            weekGrouping: "CALENDAR_WEEK",
            active: true,
        };
    }
    return {
        industryId: data.industry_id,
        periodType: data.period_type,
        startDay: data.start_day,
        endDay: data.end_day,
        usesPreviousMonth: data.uses_previous_month,
        weekGrouping: data.week_grouping,
        active: data.active,
    };
}
export function resolveWindow(config, year, month) {
    if (config.periodType === "CALENDAR_MONTH") {
        const start = isoUTC(year, month, 1);
        const end = isoUTC(year, month, lastDayOfMonth(year, month));
        return { startDate: start, endDate: end, totalDays: daysBetween(start, end), config };
    }
    // CUSTOM_CYCLE: começa em startDay do mês anterior (se usesPreviousMonth) e vai até endDay do mês selecionado.
    const startMonth = config.usesPreviousMonth ? month - 1 : month;
    let startY = year;
    let startM = startMonth;
    if (startM < 1) {
        startM = 12;
        startY -= 1;
    }
    const startD = Math.min(config.startDay, lastDayOfMonth(startY, startM));
    const endD = Math.min(config.endDay, lastDayOfMonth(year, month));
    const start = isoUTC(startY, startM, startD);
    const end = isoUTC(year, month, endD);
    return { startDate: start, endDate: end, totalDays: daysBetween(start, end), config };
}
