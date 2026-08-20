const ExcelJS = require('exceljs');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { supabase } = require('./supabase');

const MONTH_NAMES = [
    'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
    'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
];

/**
 * Mengambil SELURUH data transaksi dari Supabase (All-Time)
 */
async function fetchAllTransactions() {
    try {
        const { data, error } = await supabase
            .from('purchases')
            .select('*')
            .eq('status', 'fulfilled')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching all purchases from Supabase:', error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.error('Error executing Supabase all purchases query:', err);
        return [];
    }
}

/**
 * Mengambil data transaksi dari Supabase untuk bulan dan tahun spesifik
 */
async function fetchMonthlyTransactions(year, month) {
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)).toISOString();
    const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0)).toISOString();

    try {
        const { data, error } = await supabase
            .from('purchases')
            .select('*')
            .gte('created_at', startDate)
            .lt('created_at', endDate)
            .eq('status', 'fulfilled')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching monthly purchases from Supabase:', error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.error('Error executing Supabase monthly query:', err);
        return [];
    }
}

/**
 * Membuat File Buffer Excel (.xlsx) yang Rapi & Profesional
 */
async function generateExcelBuffer(year, month, transactions, customTitle = null) {
    const monthName = month ? (MONTH_NAMES[month - 1] || 'BULAN') : 'SEMUA DATA';
    const periodLabel = customTitle ? customTitle : (month && year ? `${monthName} ${year}` : 'SEMUA DATA (ALL-TIME)');
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bebey Store Bot';
    workbook.lastModifiedBy = 'Bebey Store Bot';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(`Laporan Penjualan`, {
        pageSetup: { paperSize: 9, orientation: 'landscape' }
    });

    // 1. Title Banner Header
    sheet.mergeCells('A1:H1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `LAPORAN PENJUALAN RESMI — BEBEY STORE`;
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } };
    sheet.getRow(1).height = 35;

    sheet.mergeCells('A2:H2');
    const subTitleCell = sheet.getCell('A2');
    subTitleCell.value = `PERIODE: ${periodLabel} | STATUS: FULFILLED (BERHASIL)`;
    subTitleCell.font = { name: 'Arial', size: 11, italic: true, color: { argb: 'D9D9D9' } };
    subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    subTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2F5597' } };
    sheet.getRow(2).height = 24;

    // Blank row
    sheet.getRow(3).height = 10;

    // 2. Table Headers
    const headers = [
        'NO', 'ORDER ID', 'TANGGAL & WAKTU', 'USERNAME ROBLOX', 
        'DISCORD TAG', 'NAMA PRODUK', 'NOMINAL / HARGA', 'STATUS'
    ];

    const headerRow = sheet.getRow(4);
    headerRow.height = 25;
    headers.forEach((headerText, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = headerText;
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '203764' } };
        cell.border = {
            top: { style: 'thin', color: { argb: '000000' } },
            left: { style: 'thin', color: { argb: '000000' } },
            bottom: { style: 'medium', color: { argb: '000000' } },
            right: { style: 'thin', color: { argb: '000000' } }
        };
    });

    // 3. Fill Transaction Rows
    let totalRevenue = 0;
    let currentRowIdx = 5;

    transactions.forEach((tx, idx) => {
        const row = sheet.getRow(currentRowIdx);
        row.height = 20;

        const createdDate = tx.created_at ? new Date(tx.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-';
        const price = Number(tx.price || 0);
        totalRevenue += price;

        row.getCell(1).value = idx + 1;
        row.getCell(2).value = tx.order_id || '-';
        row.getCell(3).value = createdDate;
        row.getCell(4).value = tx.roblox_username || '-';
        row.getCell(5).value = tx.discord_username || '-';
        row.getCell(6).value = tx.item_name || '-';
        row.getCell(7).value = price;
        row.getCell(8).value = 'SUCCESS';

        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
        row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };
        row.getCell(6).alignment = { horizontal: 'left', vertical: 'middle' };
        row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(7).numFmt = '"Rp "#,##0';
        row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };

        const bgColor = (idx % 2 === 0) ? 'F2F2F2' : 'FFFFFF';
        for (let col = 1; col <= 8; col++) {
            const cell = row.getCell(col);
            cell.font = { name: 'Arial', size: 9 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
            cell.border = {
                top: { style: 'thin', color: { argb: 'D9D9D9' } },
                left: { style: 'thin', color: { argb: 'D9D9D9' } },
                bottom: { style: 'thin', color: { argb: 'D9D9D9' } },
                right: { style: 'thin', color: { argb: 'D9D9D9' } }
            };
        }

        currentRowIdx++;
    });

    sheet.getRow(currentRowIdx).height = 10;
    currentRowIdx++;

    // 4. Total Summary Box
    sheet.mergeCells(`A${currentRowIdx}:F${currentRowIdx}`);
    const labelTotalTx = sheet.getCell(`A${currentRowIdx}`);
    labelTotalTx.value = `TOTAL TRANSAKSI SUKSES:`;
    labelTotalTx.font = { name: 'Arial', size: 10, bold: true };
    labelTotalTx.alignment = { horizontal: 'right', vertical: 'middle' };

    sheet.mergeCells(`G${currentRowIdx}:H${currentRowIdx}`);
    const valTotalTx = sheet.getCell(`G${currentRowIdx}`);
    valTotalTx.value = `${transactions.length} Transaksi`;
    valTotalTx.font = { name: 'Arial', size: 10, bold: true, color: { argb: '1F4E78' } };
    valTotalTx.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(currentRowIdx).height = 22;

    currentRowIdx++;

    sheet.mergeCells(`A${currentRowIdx}:F${currentRowIdx}`);
    const labelTotalOmset = sheet.getCell(`A${currentRowIdx}`);
    labelTotalOmset.value = `TOTAL OMSET KESELURUHAN (${periodLabel}):`;
    labelTotalOmset.font = { name: 'Arial', size: 11, bold: true, color: { argb: '27AE60' } };
    labelTotalOmset.alignment = { horizontal: 'right', vertical: 'middle' };

    sheet.mergeCells(`G${currentRowIdx}:H${currentRowIdx}`);
    const valTotalOmset = sheet.getCell(`G${currentRowIdx}`);
    valTotalOmset.value = totalRevenue;
    valTotalOmset.font = { name: 'Arial', size: 11, bold: true, color: { argb: '27AE60' } };
    valTotalOmset.numFmt = '"Rp "#,##0';
    valTotalOmset.alignment = { horizontal: 'right', vertical: 'middle' };
    sheet.getRow(currentRowIdx).height = 25;

    // Set Column Widths
    sheet.getColumn(1).width = 8;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(3).width = 24;
    sheet.getColumn(4).width = 22;
    sheet.getColumn(5).width = 22;
    sheet.getColumn(6).width = 30;
    sheet.getColumn(7).width = 20;
    sheet.getColumn(8).width = 14;

    const buffer = await workbook.xlsx.writeBuffer();
    return {
        buffer: Buffer.from(buffer),
        totalTransactions: transactions.length,
        totalRevenue: totalRevenue
    };
}

/**
 * Mengirim Laporan SELURUH Penjualan (All-Time) ke Admin
 */
async function sendAllTimeReport(clientInstance, targetChannelId = null) {
    const transactions = await fetchAllTransactions();
    const totalTransactions = transactions ? transactions.length : 0;
    const totalRevenue = transactions ? transactions.reduce((sum, t) => sum + (Number(t.price) || 0), 0) : 0;

    const excelRes = await generateExcelBuffer(null, null, transactions || [], 'SEMUA TRANSAKSI (ALL-TIME)');
    const buffer = (excelRes && excelRes.buffer) ? excelRes.buffer : excelRes;
    const fileName = `Laporan_Penjualan_Semua_Data_BebeyStore.xlsx`;
    const attachment = new AttachmentBuilder(buffer, { name: fileName });

    const ownerId = process.env.OWNER_DISCORD_ID ? process.env.OWNER_DISCORD_ID.trim() : null;
    const ownerTag = ownerId ? `<@${ownerId}>` : 'Owner';

    const embed = new EmbedBuilder()
        .setTitle(`📊  BEBEY STORE — LAPORAN REKAPITULASI KESELURUHAN`)
        .setColor(0x2ECC71)
        .setDescription(
            `Halo ${ownerTag}! Laporan rekapitulasi **seluruh data transaksi penjualan** di **Bebey Store** telah selesai dibuat.\n\n` +
            `📅 **Periode Laporan:** \`SEMUA DATA / ALL-TIME\`\n` +
            `📦 **Total Transaksi Sukses:** **${totalTransactions} Transaksi**\n` +
            `💰 **Total Omset Penjualan:** **Rp ${totalRevenue.toLocaleString('id-ID')}**\n\n` +
            `📌 **File Lampiran:** File Excel \`${fileName}\` dilampirkan di bawah ini.`
        )
        .setTimestamp()
        .setFooter({ text: '📊 Bebey Store Official • All-Time Sales Report' });

    return {
        embed,
        attachment,
        totalTransactions,
        totalRevenue
    };
}

/**
 * Mengirim Laporan Penjualan Excel ke Channel
 */
async function sendMonthlyReport(clientInstance, targetChannelId = null, forcedYear = null, forcedMonth = null) {
    const now = new Date();
    let year = forcedYear || now.getFullYear();
    let month = forcedMonth || now.getMonth();

    if (!forcedMonth && month === 0) {
        month = 12;
        year = year - 1;
    }

    const monthName = MONTH_NAMES[month - 1];

    console.log(`[LAPORAN BULANAN] Memproses laporan penjualan ${monthName} ${year}...`);

    const transactions = await fetchMonthlyTransactions(year, month);
    const totalTransactions = transactions ? transactions.length : 0;
    const totalRevenue = transactions ? transactions.reduce((sum, t) => sum + (Number(t.price) || 0), 0) : 0;

    const excelRes = await generateExcelBuffer(year, month, transactions || []);
    const buffer = (excelRes && excelRes.buffer) ? excelRes.buffer : excelRes;
    const monthTitle = monthName.charAt(0).toUpperCase() + monthName.slice(1).toLowerCase();
    const fileName = `Laporan_Penjualan_${monthTitle}_${year}.xlsx`;
    const attachment = new AttachmentBuilder(buffer, { name: fileName });

    const ownerId = process.env.OWNER_DISCORD_ID ? process.env.OWNER_DISCORD_ID.trim() : null;
    const ownerTag = ownerId ? `<@${ownerId}>` : 'Owner';

    const embed = new EmbedBuilder()
        .setTitle(`📊  BEBEY STORE — LAPORAN PENJUALAN BULANAN`)
        .setColor(0x2ECC71)
        .setDescription(
            `Halo ${ownerTag}! Laporan rekapitulasi penjualan bulanan resmi toko **Bebey Store** telah selesai dibuat.\n\n` +
            `📅 **Periode Laporan:** \`${monthName} ${year}\`\n` +
            `📦 **Total Transaksi Sukses:** **${totalTransactions} Transaksi**\n` +
            `💰 **Total Omset Penjualan:** **Rp ${totalRevenue.toLocaleString('id-ID')}**\n\n` +
            `📌 **File Lampiran:** File Excel \`${fileName}\` dilampirkan di bawah ini.`
        )
        .setTimestamp()
        .setFooter({ text: '📊 Bebey Store Official • Automated Monthly Sales Report' });

    const reportChannelId = targetChannelId || (process.env.REPORT_CHANNEL_ID ? process.env.REPORT_CHANNEL_ID.trim() : null) || (process.env.ADMIN_CHANNEL_ID ? process.env.ADMIN_CHANNEL_ID.trim() : null);

    let sent = false;

    if (reportChannelId) {
        try {
            const channel = await clientInstance.channels.fetch(reportChannelId);
            if (channel) {
                await channel.send({
                    content: `📊 **LAPORAN BULANAN OTOMATIS!** ${ownerTag}`,
                    embeds: [embed],
                    files: [attachment]
                });
                sent = true;
                console.log(`[LAPORAN BULANAN] Laporan ${monthName} ${year} berhasil dikirim ke channel #${channel.name}!`);
            }
        } catch (err) {
            console.warn('⚠️ Gagal mengirim laporan bulanan ke channel laporan:', err);
        }
    }

    if (!sent) {
        console.warn(`[LAPORAN BULANAN] ⚠️ Laporan tidak dapat dikirim ke channel. Pastikan REPORT_CHANNEL_ID atau ADMIN_CHANNEL_ID di .env sudah benar.`);
    }

    return { totalTransactions, totalRevenue, monthName, year };
}

function setupMonthlyReportScheduler(clientInstance) {
    setInterval(async () => {
        const now = new Date();
        const jakartaDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
        const dateNum = jakartaDate.getDate();
        const hourNum = jakartaDate.getHours();

        if (dateNum === 1 && hourNum === 0) {
            let prevMonth = jakartaDate.getMonth();
            let prevYear = jakartaDate.getFullYear();
            if (prevMonth === 0) {
                prevMonth = 12;
                prevYear -= 1;
            }

            const currentPeriodKey = `${prevYear}-${prevMonth}`;
            if (lastSentReportPeriod !== currentPeriodKey) {
                lastSentReportPeriod = currentPeriodKey;
                await sendMonthlyReport(clientInstance, null, prevYear, prevMonth);
            }
        }
    }, 60 * 60 * 1000);
}

let lastSentReportPeriod = '';

module.exports = {
    fetchAllTransactions,
    fetchMonthlyTransactions,
    generateExcelBuffer,
    sendAllTimeReport,
    sendMonthlyReport,
    setupMonthlyReportScheduler
};
