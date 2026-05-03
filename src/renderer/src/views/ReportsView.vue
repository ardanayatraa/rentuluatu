<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h2 class="page-title">Laporan & Analitik</h2>
        <p class="text-slate-500 text-sm mt-1">Rekap keuangan dan performa motor</p>
      </div>
    </div>

    <!-- Tab Jenis Laporan (konsisten seperti Daily Record) -->
    <div class="flex gap-2 mb-6 border-b border-slate-200">
      <button v-for="t in tabs" :key="t.key"
        @click="activeTab = t.key; loadReport()"
        :class="['px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors whitespace-nowrap',
          activeTab === t.key ? 'bg-white border border-b-white border-slate-200 text-primary -mb-px' : 'text-slate-500 hover:text-slate-700']">
        <span class="material-symbols-outlined text-sm align-middle mr-1">{{ t.icon }}</span>{{ t.label }}
      </button>
    </div>

    <!-- Filter Bar -->
    <div class="card mb-6 flex flex-wrap gap-3 items-center">
      <select v-model="period" @change="onPeriodChange" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
        <option value="today">Hari Ini</option>
        <option value="week">Minggu Ini</option>
        <option value="month">Bulan Ini</option>
        <option value="year">Tahun Ini</option>
        <option value="custom">Kustom</option>
      </select>

      <template v-if="activeTab === 'financial'">
        <select v-model="groupBy" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <option value="day">Per Hari</option>
          <option value="month">Per Bulan</option>
          <option value="year">Per Tahun</option>
        </select>
      </template>

      <template v-if="activeTab === 'annual'">
        <select v-model="selectedYear" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
          <option v-for="y in [2024,2025,2026,2027,2028]" :key="y" :value="y">{{ y }}</option>
        </select>
      </template>

      <template v-if="activeTab === 'motor-income' || activeTab === 'motor-expenses'">
        <SearchSelect v-model="selectedMotorId" :options="motorOptions" placeholder="Semua Motor" />
      </template>

      <template v-if="activeTab === 'commission'">
        <SearchSelect v-model="selectedOwnerId" :options="ownerOptions" placeholder="Pilih Mitra" :clearable="false" />
      </template>

      <template v-if="activeTab === 'owner-report'">
        <SearchSelect v-model="selectedOwnerReportId" :options="[{value:'',label:'Semua Pemilik'},...ownerOptions]" placeholder="Semua Pemilik" />
      </template>

      <template v-if="period === 'custom'">
        <input v-model="startDate" type="date" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        <span class="text-slate-400">—</span>
        <input v-model="endDate" type="date" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      </template>

      <button @click="loadReport" class="btn-primary">
        <span class="material-symbols-outlined">bar_chart</span> Tampilkan
      </button>
      <div class="ml-auto flex gap-2">
        <button @click="previewPdf" class="btn-secondary" :disabled="loading === true || exporting !== ''">
          <span class="material-symbols-outlined">visibility</span>
          {{ exporting === 'pdf' ? 'Memuat...' : 'Lihat Laporan' }}
        </button>
        <button @click="exportExcel" class="btn-secondary" :disabled="loading === true || exporting !== ''">
          <span class="material-symbols-outlined">table_view</span>
          {{ exporting === 'excel' ? 'Menyimpan...' : 'Simpan Excel' }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-slate-400">
      <span class="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
    </div>

    <template v-else>
      <div v-if="reportError" class="card mb-6 border border-red-200 bg-red-50 text-red-700">
        <div class="flex items-start gap-3">
          <span class="material-symbols-outlined text-red-500">error</span>
          <div>
            <p class="font-semibold">Laporan gagal dimuat</p>
            <p class="text-sm mt-1">{{ reportError }}</p>
          </div>
        </div>
      </div>

      <!-- ── TAB: Laporan Keuangan ── -->
      <template v-if="activeTab === 'supporting'">
        <div class="grid grid-cols-[220px_minmax(0,1fr)] gap-6">
          <div class="card p-3 h-fit">
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Laporan Pendukung</p>
            <div class="space-y-2">
              <button
                v-for="item in supportingReports"
                :key="item.key"
                @click="activeSupportingReport = item.key; loadReport()"
                :class="[
                  'w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition-colors',
                  activeSupportingReport === item.key
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                ]"
              >
                <span class="material-symbols-outlined text-[18px]">{{ item.icon }}</span>
                <span>{{ item.label }}</span>
              </button>
            </div>
          </div>

          <div>
            <template v-if="activeSupportingReport === 'profit-loss'">
              <div v-if="profitLossData" class="space-y-4">
                <div class="card table-card">
                  <div class="px-6 pt-5 pb-3 border-b border-slate-100">
                    <h3 class="text-sm font-bold uppercase tracking-wider text-slate-500">Laporan Laba Rugi</h3>
                  </div>
                  <div class="table-scroll px-6 pb-5">
                  <table class="table-base text-sm">
                    <tbody class="divide-y divide-slate-100">
                      <tr class="font-bold bg-slate-50"><td class="py-2 px-3" colspan="2">PENDAPATAN</td></tr>
                      <tr><td class="py-2 px-3 pl-6 text-slate-600">Total Omzet Sewa</td><td class="py-2 px-3 text-right">{{ formatRp(profitLossData.omzet) }}</td></tr>
                      <tr><td class="py-2 px-3 pl-6 text-slate-600">Refund / Pembatalan</td><td class="py-2 px-3 text-right text-red-600">( {{ formatRp(profitLossData.refunds) }} )</td></tr>
                      <tr><td class="py-2 px-3 pl-6 text-slate-600">Bagian Mitra / Pemilik Motor</td><td class="py-2 px-3 text-right text-red-600">( {{ formatRp(profitLossData.owner_gets) }} )</td></tr>
                      <tr class="font-bold border-t-2 border-slate-300"><td class="py-2 px-3">Pendapatan Bersih (Wavy Gets)</td><td class="py-2 px-3 text-right">{{ formatRp(profitLossData.wavy_gets) }}</td></tr>

                      <tr class="font-bold bg-slate-50 mt-2"><td class="py-2 px-3" colspan="2">BEBAN OPERASIONAL</td></tr>
                      <tr v-for="e in profitLossData.expenses" :key="e.category+e.type">
                        <td class="py-2 px-3 pl-6 text-slate-600 capitalize">{{ e.category }} <span class="text-xs text-slate-400">({{ e.type }})</span></td>
                        <td class="py-2 px-3 text-right text-red-600">( {{ formatRp(e.total) }} )</td>
                      </tr>
                      <tr class="font-bold border-t border-slate-300"><td class="py-2 px-3">Total Beban</td><td class="py-2 px-3 text-right text-red-600">( {{ formatRp(profitLossData.total_expenses) }} )</td></tr>

                      <tr class="font-bold text-base border-t-2 border-slate-800 bg-slate-50">
                        <td class="py-3 px-3">LABA BERSIH</td>
                        <td class="py-3 px-3 text-right" :class="profitLossData.laba_bersih >= 0 ? 'text-emerald-700' : 'text-red-700'">
                          {{ formatRp(profitLossData.laba_bersih) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
              <div v-else class="card py-12 text-center text-slate-400">Klik Tampilkan untuk memuat data</div>
            </template>

            <template v-else>
              <div v-if="balanceSheetData" class="space-y-6">
                <div class="grid grid-cols-3 gap-6">
                  <div class="card">
                    <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Aset</p>
                    <p class="text-2xl font-black text-primary font-headline">{{ formatRp(balanceSheetData.totals.assets) }}</p>
                  </div>
                  <div class="card">
                    <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Kewajiban</p>
                    <p class="text-2xl font-black text-red-600 font-headline">{{ formatRp(balanceSheetData.totals.liabilities) }}</p>
                  </div>
                  <div class="card">
                    <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Ekuitas</p>
                    <p class="text-2xl font-black text-emerald-700 font-headline">{{ formatRp(balanceSheetData.totals.equity) }}</p>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-6">
                  <div class="card table-card">
                    <div class="px-6 pt-5 pb-3 border-b border-slate-100">
                      <h3 class="text-sm font-bold uppercase tracking-wider text-slate-500">Aset</h3>
                    </div>
                    <div class="table-scroll px-6 pb-5">
                    <table class="table-base text-sm">
                      <tbody class="divide-y divide-slate-100">
                        <tr v-for="row in balanceSheetData.assets.current" :key="row.label">
                          <td class="py-2 px-3 text-slate-600">{{ row.label }}</td>
                          <td class="py-2 px-3 text-right font-semibold">{{ formatRp(row.amount) }}</td>
                        </tr>
                        <tr class="font-bold border-t-2 border-slate-300 bg-slate-50">
                          <td class="py-3 px-3">TOTAL ASET</td>
                          <td class="py-3 px-3 text-right">{{ formatRp(balanceSheetData.assets.total) }}</td>
                        </tr>
                      </tbody>
                    </table>
                    </div>
                  </div>

                  <div class="space-y-6">
                    <div class="card table-card">
                      <div class="px-6 pt-5 pb-3 border-b border-slate-100">
                        <h3 class="text-sm font-bold uppercase tracking-wider text-slate-500">Kewajiban</h3>
                      </div>
                      <div class="table-scroll px-6 pb-5">
                      <table class="table-base text-sm">
                        <tbody class="divide-y divide-slate-100">
                          <tr v-for="row in balanceSheetData.liabilities.current" :key="row.label">
                            <td class="py-2 px-3 text-slate-600">{{ row.label }}</td>
                            <td class="py-2 px-3 text-right font-semibold">{{ formatRp(row.amount) }}</td>
                          </tr>
                          <tr v-if="!balanceSheetData.liabilities.current.length">
                            <td colspan="2" class="py-8 text-center text-slate-400">Tidak ada kewajiban tercatat</td>
                          </tr>
                          <tr class="font-bold border-t-2 border-slate-300 bg-slate-50">
                            <td class="py-3 px-3">TOTAL KEWAJIBAN</td>
                            <td class="py-3 px-3 text-right">{{ formatRp(balanceSheetData.liabilities.total) }}</td>
                          </tr>
                        </tbody>
                      </table>
                      </div>
                    </div>

                    <div class="card table-card">
                      <div class="px-6 pt-5 pb-3 border-b border-slate-100">
                        <h3 class="text-sm font-bold uppercase tracking-wider text-slate-500">Ekuitas</h3>
                      </div>
                      <div class="table-scroll px-6 pb-5">
                      <table class="table-base text-sm">
                        <tbody class="divide-y divide-slate-100">
                          <tr v-for="row in balanceSheetData.equity.rows" :key="row.label">
                            <td class="py-2 px-3 text-slate-600">{{ row.label }}</td>
                            <td class="py-2 px-3 text-right font-semibold">{{ formatRp(row.amount) }}</td>
                          </tr>
                          <tr class="font-bold border-t border-slate-300">
                            <td class="py-3 px-3">TOTAL EKUITAS</td>
                            <td class="py-3 px-3 text-right">{{ formatRp(balanceSheetData.equity.total) }}</td>
                          </tr>
                          <tr class="font-bold text-base border-t-2 border-slate-800 bg-slate-50">
                            <td class="py-3 px-3">TOTAL KEWAJIBAN + EKUITAS</td>
                            <td class="py-3 px-3 text-right">{{ formatRp(balanceSheetData.totals.liabilitiesAndEquity) }}</td>
                          </tr>
                        </tbody>
                      </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="card py-12 text-center text-slate-400">Klik Tampilkan untuk memuat data neraca</div>
            </template>
          </div>
        </div>
      </template>

      <template v-if="false">
        <div class="grid grid-cols-4 gap-6 mb-6" v-if="summary">
          <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Pemasukan</p>
            <p class="text-2xl font-black text-primary font-headline">{{ formatRp(summary.income) }}</p></div>
          <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Pengeluaran</p>
            <p class="text-2xl font-black text-red-600 font-headline">{{ formatRp(summary.expenses) }}</p></div>
          <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Wavy Gets</p>
            <p class="text-2xl font-black text-primary font-headline">{{ formatRp(summary.wavy_gets) }}</p></div>
          <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Profit Bersih</p>
            <p class="text-2xl font-black font-headline" :class="summary.profit >= 0 ? 'text-emerald-600' : 'text-red-600'">{{ formatRp(summary.profit) }}</p></div>
        </div>
        <div class="card">
          <h3 class="text-base font-extrabold text-primary font-headline mb-4">Rincian per {{ groupByLabel }}</h3>
          <table class="w-full text-left">
            <thead><tr class="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
              <th class="pb-3">Periode</th><th class="pb-3 text-right">Rental</th>
              <th class="pb-3 text-right">Pemasukan</th><th class="pb-3 text-right">Pengeluaran</th>
              <th class="pb-3 text-right">Wavy Gets</th><th class="pb-3 text-right">Bagian Mitra</th>
              <th class="pb-3 text-right">Profit</th>
            </tr></thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="r in financialRows" :key="r.period" class="text-sm">
                <td class="py-3 font-semibold">{{ r.period }}</td>
                <td class="py-3 text-right">{{ r.rental_count }}x</td>
                <td class="py-3 text-right font-bold text-primary">{{ formatRp(r.income) }}</td>
                <td class="py-3 text-right text-red-500">{{ formatRp(r.expenses) }}</td>
                <td class="py-3 text-right">{{ formatRp(r.wavy_gets) }}</td>
                <td class="py-3 text-right text-slate-500">{{ formatRp(r.owner_gets) }}</td>
                <td class="py-3 text-right font-bold" :class="r.profit >= 0 ? 'text-emerald-600' : 'text-red-600'">{{ formatRp(r.profit) }}</td>
              </tr>
              <tr v-if="!financialRows.length"><td colspan="7" class="py-8 text-center text-slate-400">Belum ada data</td></tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- ── TAB: Laba Rugi ── -->
      <template v-if="activeTab === 'profit-loss'">
        <div v-if="profitLossData" class="space-y-4">
          <div class="card">
            <h3 class="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Laporan Laba Rugi</h3>
            <table class="w-full text-sm">
              <tbody class="divide-y divide-slate-100">
                <tr class="font-bold bg-slate-50"><td class="py-2 px-3" colspan="2">PENDAPATAN</td></tr>
                <tr><td class="py-2 px-3 pl-6 text-slate-600">Total Omzet Sewa</td><td class="py-2 px-3 text-right">{{ formatRp(profitLossData.omzet) }}</td></tr>
                <tr><td class="py-2 px-3 pl-6 text-slate-600">Refund / Pembatalan</td><td class="py-2 px-3 text-right text-red-600">( {{ formatRp(profitLossData.refunds) }} )</td></tr>
                <tr><td class="py-2 px-3 pl-6 text-slate-600">Bagian Mitra / Pemilik Motor</td><td class="py-2 px-3 text-right text-red-600">( {{ formatRp(profitLossData.owner_gets) }} )</td></tr>
                <tr class="font-bold border-t-2 border-slate-300"><td class="py-2 px-3">Pendapatan Bersih (Wavy Gets)</td><td class="py-2 px-3 text-right">{{ formatRp(profitLossData.wavy_gets) }}</td></tr>

                <tr class="font-bold bg-slate-50 mt-2"><td class="py-2 px-3" colspan="2">BEBAN OPERASIONAL</td></tr>
                <tr v-for="e in profitLossData.expenses" :key="e.category+e.type">
                  <td class="py-2 px-3 pl-6 text-slate-600 capitalize">{{ e.category }} <span class="text-xs text-slate-400">({{ e.type }})</span></td>
                  <td class="py-2 px-3 text-right text-red-600">( {{ formatRp(e.total) }} )</td>
                </tr>
                <tr class="font-bold border-t border-slate-300"><td class="py-2 px-3">Total Beban</td><td class="py-2 px-3 text-right text-red-600">( {{ formatRp(profitLossData.total_expenses) }} )</td></tr>

                <tr class="font-bold text-base border-t-2 border-slate-800 bg-slate-50">
                  <td class="py-3 px-3">LABA BERSIH</td>
                  <td class="py-3 px-3 text-right" :class="profitLossData.laba_bersih >= 0 ? 'text-emerald-700' : 'text-red-700'">
                    {{ formatRp(profitLossData.laba_bersih) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div v-else class="card py-12 text-center text-slate-400">Klik Tampilkan untuk memuat data</div>
      </template>

      <!-- ── TAB: Rekap Tahunan ── -->
      <template v-if="activeTab === 'annual'">
        <div class="card table-card">
          <h3 class="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Rekap Omzet Bulanan {{ selectedYear }}</h3>
          <div class="table-scroll">
          <table class="table-base text-left">
            <thead><tr class="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
              <th class="pb-3">Bulan</th>
              <th class="pb-3 text-right">Jml Rental</th>
              <th class="pb-3 text-right">Omzet</th>
              <th class="pb-3 text-right">Wavy Gets</th>
              <th class="pb-3 text-right">Pengeluaran</th>
              <th class="pb-3 text-right">Laba</th>
            </tr></thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="m in annualData" :key="m.month" class="text-sm" :class="m.omzet > 0 ? '' : 'text-slate-300'">
                <td class="py-3 font-semibold">{{ m.month_name }}</td>
                <td class="py-3 text-right">{{ m.rental_count }}x</td>
                <td class="py-3 text-right">{{ formatRp(m.omzet) }}</td>
                <td class="py-3 text-right">{{ formatRp(m.wavy_gets) }}</td>
                <td class="py-3 text-right">{{ formatRp(m.expenses) }}</td>
                <td class="py-3 text-right font-bold" :class="m.laba >= 0 ? 'text-emerald-600' : 'text-red-600'">{{ formatRp(m.laba) }}</td>
              </tr>
              <!-- Total row -->
              <tr class="text-sm font-bold border-t-2 border-slate-300 bg-slate-50">
                <td class="py-3">TOTAL {{ selectedYear }}</td>
                <td class="py-3 text-right">{{ annualData.reduce((s,m)=>s+m.rental_count,0) }}x</td>
                <td class="py-3 text-right">{{ formatRp(annualData.reduce((s,m)=>s+m.omzet,0)) }}</td>
                <td class="py-3 text-right">{{ formatRp(annualData.reduce((s,m)=>s+m.wavy_gets,0)) }}</td>
                <td class="py-3 text-right">{{ formatRp(annualData.reduce((s,m)=>s+m.expenses,0)) }}</td>
                <td class="py-3 text-right" :class="annualData.reduce((s,m)=>s+m.laba,0) >= 0 ? 'text-emerald-600' : 'text-red-600'">
                  {{ formatRp(annualData.reduce((s,m)=>s+m.laba,0)) }}
                </td>
              </tr>
            </tbody>
          </table>
          </div>
          <TablePagination
            v-model:page="rankingPage"
            v-model:pageSize="rankingPageSize"
            :total="motorRanking.length"
            :pageSizeOptions="[10,25,50]"
          />
        </div>
      </template>

      <!-- ── TAB: Pendapatan per Motor ── -->
      <template v-if="activeTab === 'motor-income'">
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
          <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Transaksi</p>
            <p class="text-2xl font-black text-primary font-headline">{{ motorIncomeData.length }}x</p></div>
          <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Omzet</p>
            <p class="text-2xl font-black text-primary font-headline">{{ formatRp(motorIncomeData.reduce((s,r)=>s+(r.total_price||0),0)) }}</p></div>
          <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fee Vendor</p>
            <p class="text-2xl font-black text-orange-500 font-headline">{{ formatRp(motorIncomeData.reduce((s,r)=>s+(r.vendor_fee||0),0)) }}</p></div>
          <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Wavy Gets</p>
            <p class="text-2xl font-black text-primary font-headline">{{ formatRp(motorIncomeData.reduce((s,r)=>s+(r.wavy_gets||0),0)) }}</p></div>
            <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Bagian Mitra</p>
            <p class="text-2xl font-black text-slate-700 font-headline">{{ formatRp(motorIncomeData.reduce((s,r)=>s+(r.owner_gets||0),0)) }}</p></div>
        </div>
        <div class="card table-card">
          <div class="px-6 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-extrabold text-primary">Detail Transaksi Rental</h3>
              <p class="text-xs text-slate-500 mt-1">
                Kas Pendapatan: {{ formatRp(motorIncomeCashSummary.pendapatan) }} ·
                Kas Modal: {{ formatRp(motorIncomeCashSummary.modal) }} ·
                Total Saldo Rekening: {{ formatRp(motorIncomeCashSummary.rekening) }}
              </p>
            </div>
            <span class="badge-neutral text-xs">{{ motorIncomeData.length }} transaksi</span>
          </div>
          <div class="table-scroll">
          <table class="table-base text-left">
            <thead class="bg-slate-50/70"><tr class="text-slate-500 text-xs uppercase font-bold tracking-wide border-b border-slate-100">
              <th class="px-4 py-3">Tanggal</th><th class="px-4 py-3">Pelanggan</th><th class="px-4 py-3">Motor</th>
              <th class="px-4 py-3 text-right">Durasi</th><th class="px-4 py-3">Sumber Kas · Bayar</th>
                <th class="px-4 py-3 text-right">Total</th>
                <th class="px-4 py-3 text-right">Fee Vendor</th>
                <th class="px-4 py-3 text-right">Bagian Perusahaan</th>
                <th class="px-4 py-3 text-right">Bagian Mitra</th>
            </tr></thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="r in pagedMotorIncomeData" :key="r.id" class="text-sm odd:bg-white even:bg-slate-50/30 hover:bg-slate-50">
                <td class="px-4 py-3 text-slate-700 whitespace-nowrap">{{ formatDateTime(r.date_time) }}</td>
                <td class="px-4 py-3">
                  <p class="font-semibold text-slate-800 leading-tight">{{ r.customer_name }}</p>
                  <p v-if="r.hotel" class="text-xs text-slate-400 mt-1 leading-tight">{{ r.hotel }}</p>
                </td>
                <td class="px-4 py-3">
                  <p class="font-semibold text-slate-800 leading-tight">{{ r.model }}</p>
                  <p class="text-xs text-slate-400 mt-1 leading-tight">{{ r.plate_number }}</p>
                </td>
                <td class="px-4 py-3 text-right whitespace-nowrap">{{ r.period_days }} hari</td>
                <td class="px-4 py-3 whitespace-nowrap"><span class="badge-neutral text-xs">{{ paymentSummaryLabel(r) }}</span></td>
                <td class="px-4 py-3 text-right font-bold whitespace-nowrap">{{ formatRp(r.total_price) }}</td>
                <td class="px-4 py-3 text-right text-orange-500 font-semibold whitespace-nowrap">{{ formatRp(r.vendor_fee || 0) }}</td>
                <td class="px-4 py-3 text-right text-primary font-semibold whitespace-nowrap">{{ formatRp(r.wavy_gets) }}</td>
                <td class="px-4 py-3 text-right text-slate-600 whitespace-nowrap">{{ formatRp(r.owner_gets) }}</td>
              </tr>
              <tr v-if="!motorIncomeData.length"><td colspan="9" class="px-4 py-10 text-center text-slate-400">Belum ada data</td></tr>
            </tbody>
          </table>
          </div>
          <TablePagination
            v-model:page="motorIncomePage"
            v-model:pageSize="motorIncomePageSize"
            :total="motorIncomeData.length"
            :pageSizeOptions="[10,25,50]"
          />
        </div>
      </template>

      <!-- ── TAB: Pengeluaran per Motor ── -->
      <template v-if="activeTab === 'motor-expenses'">
        <div class="grid grid-cols-2 gap-6 mb-6">
          <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Pengeluaran</p>
            <p class="text-2xl font-black text-red-600 font-headline">{{ formatRp(motorExpensesData.reduce((s,e)=>s+(e.amount||0),0)) }}</p></div>
          <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Jumlah Transaksi</p>
            <p class="text-2xl font-black text-slate-700 font-headline">{{ motorExpensesData.length }}x</p></div>
        </div>
        <div class="card table-card">
          <div class="px-6 pt-5 pb-3 border-b border-slate-100">
            <p class="text-xs text-slate-500">
              Kas Pendapatan: {{ formatRp(motorExpenseCashSummary.pendapatan) }} ·
              Kas Modal Tanam: {{ formatRp(motorExpenseCashSummary.modal) }} ·
              Kas Ganti Rugi: {{ formatRp(motorExpenseCashSummary.ganti_rugi) }} ·
              Total Saldo Rekening: {{ formatRp(motorExpenseCashSummary.rekening) }}
            </p>
          </div>
          <div class="table-scroll">
          <table class="table-base text-left">
            <thead class="bg-slate-50/70"><tr class="text-slate-500 text-xs uppercase font-bold tracking-wide border-b border-slate-100">
              <th class="px-4 py-3">Tanggal</th>
              <th class="px-4 py-3">Motor</th>
              <th class="px-4 py-3">Tipe</th>
              <th class="px-4 py-3">Kategori</th>
              <th class="px-4 py-3">Keterangan</th>
              <th class="px-4 py-3">Sumber Kas · Bayar</th>
              <th class="px-4 py-3 text-right">Jumlah</th>
            </tr></thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="e in pagedMotorExpensesData" :key="e.id" class="text-sm odd:bg-white even:bg-slate-50/30 hover:bg-slate-50">
                <td class="px-4 py-3 text-slate-700 whitespace-nowrap">{{ formatDate(e.date) }}</td>
                <td class="px-4 py-3">
                  <p class="font-semibold text-slate-800 leading-tight">{{ e.model || '-' }}</p>
                  <p v-if="e.plate_number" class="text-xs text-slate-400 mt-1 leading-tight">{{ e.plate_number }}</p>
                </td>
                <td class="px-4 py-3"><span class="badge-warning text-xs">{{ e.type }}</span></td>
                <td class="px-4 py-3">{{ e.category }}</td>
                <td class="px-4 py-3 text-slate-500">{{ e.description || '-' }}</td>
                <td class="px-4 py-3 whitespace-nowrap"><span class="badge-neutral text-xs">{{ paymentSummaryLabel(e) }}</span></td>
                <td class="px-4 py-3 text-right font-bold text-red-600 whitespace-nowrap">{{ formatRp(e.amount) }}</td>
              </tr>
              <tr v-if="!motorExpensesData.length"><td colspan="7" class="px-4 py-10 text-center text-slate-400">Belum ada data</td></tr>
            </tbody>
          </table>
          </div>
          <TablePagination
            v-model:page="motorExpensesPage"
            v-model:pageSize="motorExpensesPageSize"
            :total="motorExpensesData.length"
            :pageSizeOptions="[10,25,50]"
          />
        </div>
      </template>

      <!-- ── TAB: Semua Transaksi ── -->
      <template v-if="activeTab === 'transactions'">
        <div class="grid grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
          <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Pemasukan</p>
            <p class="text-2xl font-black text-emerald-600 font-headline">{{ formatRp(transactionsData.rentals?.filter(r=>r.status!=='refunded').reduce((s,r)=>s+(r.amount||0),0)) }}</p></div>
          <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pengeluaran Operasional</p>
            <p class="text-2xl font-black text-red-600 font-headline">{{ formatRp(transactionsData.operationalExpenses?.reduce((s,e)=>s+(e.amount||0),0)) }}</p></div>
          <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pengeluaran Motor</p>
            <p class="text-2xl font-black text-amber-600 font-headline">{{ formatRp(transactionsData.motorExpenses?.reduce((s,e)=>s+(e.amount||0),0)) }}</p></div>
          <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Selisih</p>
            <p class="text-2xl font-black font-headline" :class="netBalance >= 0 ? 'text-emerald-600' : 'text-red-600'">{{ formatRp(netBalance) }}</p></div>
        </div>
        <div class="card table-card mb-4">
          <div class="px-6 pt-5 mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-sm font-extrabold text-primary">Jejak Ganti Unit</h3>
            <p class="text-xs text-slate-400 mt-1">Riwayat transaksi sumber dan motor pengganti.</p>
            </div>
            <span class="badge-neutral text-xs">{{ rentalJourneys.length }} ganti unit</span>
          </div>
          <div class="px-6 pb-5 space-y-3">
            <div v-for="(journey, index) in rentalJourneys" :key="journey.key || index" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p class="text-sm font-bold text-slate-700">{{ journey.root }}</p>
              <p v-for="(step, stepIndex) in journey.steps" :key="`${journey.key}-${stepIndex}`" class="text-sm text-slate-600 mt-1">
                -> {{ step }}
              </p>
            </div>
            <div v-if="!rentalJourneys.length" class="py-6 text-center text-slate-400 text-sm">Tidak ada data ganti unit pada periode ini</div>
          </div>
        </div>
        <div class="card table-card mb-4">
          <div class="px-6 pt-5 mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-sm font-extrabold text-primary">Pemasukan Rental</h3>
              <p class="text-xs text-slate-400 mt-1">Semua transaksi sewa pada periode terpilih</p>
              <p class="text-xs text-slate-500 mt-1">
                Kas Pendapatan: {{ formatRp(txRentalCashSummary.pendapatan) }} ·
                Kas Modal Tanam: {{ formatRp(txRentalCashSummary.modal) }} ·
                Kas Ganti Rugi: {{ formatRp(txRentalCashSummary.ganti_rugi) }} ·
                Total Saldo Rekening: {{ formatRp(txRentalCashSummary.rekening) }}
              </p>
            </div>
            <span class="badge-neutral text-xs">{{ transactionsData.rentals?.length || 0 }} transaksi</span>
          </div>
          <div class="table-scroll px-6 pb-5">
          <table class="table-base text-left">
            <thead><tr class="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
              <th class="pb-3">Tanggal</th><th class="pb-3">Pelanggan</th><th class="pb-3">Motor</th>
              <th class="pb-3">Sumber Kas · Bayar</th><th class="pb-3 text-right">Jumlah</th><th class="pb-3">Status</th>
            </tr></thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="r in pagedTxRentals" :key="'r'+r.id" class="text-sm">
                <td class="py-2">{{ formatDateTime(r.date) }}</td>
                <td class="py-2">{{ r.description }}</td>
                <td class="py-2 text-slate-500">{{ r.motor }}</td>
                  <td class="py-2"><span class="badge-neutral text-xs">{{ paymentSummaryLabel(r) }}</span></td>
                <td class="py-2 text-right font-bold text-emerald-600">+{{ formatRp(r.amount) }}</td>
                <td class="py-2"><span :class="r.status==='refunded'?'badge-warning':'badge-neutral'" class="text-xs">{{ r.status }}</span></td>
              </tr>
              <tr v-if="!transactionsData.rentals?.length"><td colspan="6" class="py-6 text-center text-slate-400">Tidak ada data</td></tr>
            </tbody>
          </table>
          </div>
          <TablePagination
            v-model:page="txRentalsPage"
            v-model:pageSize="txRentalsPageSize"
            :total="transactionsData.rentals?.length || 0"
            :pageSizeOptions="[10,25,50]"
          />
        </div>
        <div class="card table-card mb-4">
          <div class="px-6 pt-5 mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-sm font-extrabold text-red-600">Pengeluaran Operasional</h3>
              <p class="text-xs text-slate-400 mt-1">Beban usaha dan operasional umum perusahaan</p>
              <p class="text-xs text-slate-500 mt-1">
                Kas Pendapatan: {{ formatRp(txOperationalCashSummary.pendapatan) }} ·
                Kas Modal Tanam: {{ formatRp(txOperationalCashSummary.modal) }} ·
                Kas Ganti Rugi: {{ formatRp(txOperationalCashSummary.ganti_rugi) }} ·
                Total Saldo Rekening: {{ formatRp(txOperationalCashSummary.rekening) }}
              </p>
            </div>
            <span class="badge-neutral text-xs">{{ transactionsData.operationalExpenses?.length || 0 }} transaksi</span>
          </div>
          <div class="table-scroll px-6 pb-5">
          <table class="table-base text-left">
            <thead><tr class="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
              <th class="pb-3">Tanggal</th><th class="pb-3">Kategori</th><th class="pb-3">Sumber</th>
              <th class="pb-3">Sumber Kas · Bayar</th><th class="pb-3 text-right">Jumlah</th>
            </tr></thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="e in pagedTxOperational" :key="'oe'+e.id" class="text-sm">
                <td class="py-2">{{ formatDate(e.date) }}</td>
                <td class="py-2">{{ e.description }}</td>
                <td class="py-2">
                  <span v-if="e.motor === 'Umum'" class="text-slate-400 text-xs">Operasional Umum</span>
                  <span v-else class="text-slate-600 text-xs">{{ e.motor }}</span>
                </td>
                  <td class="py-2"><span class="badge-neutral text-xs">{{ paymentSummaryLabel(e) }}</span></td>
                <td class="py-2 text-right font-bold text-red-600">-{{ formatRp(e.amount) }}</td>
              </tr>
              <tr v-if="!transactionsData.operationalExpenses?.length"><td colspan="5" class="py-6 text-center text-slate-400">Tidak ada data</td></tr>
            </tbody>
          </table>
          </div>
          <TablePagination
            v-model:page="txOperationalPage"
            v-model:pageSize="txOperationalPageSize"
            :total="transactionsData.operationalExpenses?.length || 0"
            :pageSizeOptions="[10,25,50]"
          />
        </div>
        <div class="card table-card">
          <div class="px-6 pt-5 mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 class="text-sm font-extrabold text-amber-600">Pengeluaran Motor</h3>
              <p class="text-xs text-slate-400 mt-1">Biaya terkait unit motor yang tercatat pada periode ini</p>
              <p class="text-xs text-slate-500 mt-1">
                Kas Pendapatan: {{ formatRp(txMotorCashSummary.pendapatan) }} ·
                Kas Modal Tanam: {{ formatRp(txMotorCashSummary.modal) }} ·
                Kas Ganti Rugi: {{ formatRp(txMotorCashSummary.ganti_rugi) }} ·
                Total Saldo Rekening: {{ formatRp(txMotorCashSummary.rekening) }}
              </p>
            </div>
            <span class="badge-neutral text-xs">{{ transactionsData.motorExpenses?.length || 0 }} transaksi</span>
          </div>
          <div class="table-scroll px-6 pb-5">
          <table class="table-base text-left">
            <thead><tr class="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
              <th class="pb-3">Tanggal</th><th class="pb-3">Kategori</th><th class="pb-3">Motor</th>
              <th class="pb-3">Sumber Kas · Bayar</th><th class="pb-3 text-right">Jumlah</th>
            </tr></thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="e in pagedTxMotorExpenses" :key="'me'+e.id" class="text-sm">
                <td class="py-2">{{ formatDate(e.date) }}</td>
                <td class="py-2">{{ e.description }}</td>
                <td class="py-2 text-slate-600 text-xs">{{ e.motor }}</td>
                <td class="py-2"><span class="badge-neutral text-xs">{{ paymentSummaryLabel(e) }}</span></td>
                <td class="py-2 text-right font-bold text-amber-600">-{{ formatRp(e.amount) }}</td>
              </tr>
              <tr v-if="!transactionsData.motorExpenses?.length"><td colspan="5" class="py-6 text-center text-slate-400">Tidak ada data</td></tr>
            </tbody>
          </table>
          </div>
          <TablePagination
            v-model:page="txMotorExpensesPage"
            v-model:pageSize="txMotorExpensesPageSize"
            :total="transactionsData.motorExpenses?.length || 0"
            :pageSizeOptions="[10,25,50]"
          />
        </div>
      </template>

      <!-- ── TAB: Hak Mitra ── -->
      <template v-if="activeTab === 'commission'">
        <div v-if="!selectedOwnerId" class="card py-12 text-center text-slate-400">
          <span class="material-symbols-outlined text-4xl mb-2 block">person_search</span>
          Pilih mitra di filter atas untuk melihat laporan hak mitra
        </div>
        <template v-else-if="commissionData">
          <div class="grid grid-cols-4 gap-6 mb-6">
            <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Hak Mitra</p>
              <p class="text-2xl font-black text-primary font-headline">{{ formatRp(commissionData.totalOwnerGets) }}</p></div>
            <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sudah Dibayar</p>
              <p class="text-2xl font-black text-emerald-600 font-headline">{{ formatRp(commissionData.totalPaid) }}</p></div>
            <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Belum Dibayar</p>
              <p class="text-2xl font-black text-red-600 font-headline">{{ formatRp(commissionData.totalUnpaid) }}</p></div>
            <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Jml Transaksi</p>
              <p class="text-2xl font-black text-slate-700 font-headline">{{ commissionData.rentals.length }}x</p></div>
          </div>
          <div class="card mb-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <p class="text-sm font-bold text-slate-700">{{ commissionData.owner.name }}</p>
            <p class="text-xs text-slate-500">Kontak: {{ commissionData.owner.phone || '-' }}</p>
            <p class="text-xs text-slate-500">Motor: {{ commissionData.motors.map(m=>m.model+' ('+m.plate_number+')').join(', ') }}</p>
          </div>
          <div class="card table-card">
            <div class="table-scroll">
            <table class="table-base text-left">
              <thead><tr class="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
                <th class="pb-3">Tanggal</th><th class="pb-3">Motor</th><th class="pb-3">Pelanggan</th>
                <th class="pb-3 text-right">Durasi</th><th class="pb-3 text-right">Total Sewa</th>
                <th class="pb-3 text-right">Hak Mitra</th><th class="pb-3">Status</th>
              </tr></thead>
              <tbody class="divide-y divide-slate-50">
                <tr v-for="r in commissionData.rentals" :key="r.id" class="text-sm">
                  <td class="py-3">{{ formatDateTime(r.date_time) }}</td>
                  <td class="py-3">{{ r.model }} <span class="text-slate-400">· {{ r.plate_number }}</span></td>
                  <td class="py-3">{{ r.customer_name }}</td>
                  <td class="py-3 text-right">{{ r.period_days }} hari</td>
                  <td class="py-3 text-right">{{ formatRp(r.total_price) }}</td>
                  <td class="py-3 text-right font-bold text-primary">{{ formatRp(r.owner_gets) }}</td>
                  <td class="py-3"><span :class="r.payout_id ? 'badge-neutral' : 'badge-warning'" class="text-xs">{{ r.payout_id ? 'Lunas' : 'Belum' }}</span></td>
                </tr>
                <tr v-if="!commissionData.rentals.length"><td colspan="7" class="py-8 text-center text-slate-400">Belum ada data</td></tr>
              </tbody>
            </table>
            </div>
          </div>
        </template>
      </template>

      <!-- ── TAB: Laporan per Pemilik Motor ── -->
      <template v-if="activeTab === 'owner-report'">
        <div class="card table-card">
          <div class="table-scroll">
          <table class="table-base text-left">
            <thead><tr class="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
              <th class="pb-3">Pemilik</th>
              <th class="pb-3 text-right">Motor</th>
              <th class="pb-3 text-right">Rental</th>
              <th class="pb-3 text-right">Total Omzet</th>
              <th class="pb-3 text-right">Hak Mitra Kotor</th>
              <th class="pb-3 text-right">Total Pengeluaran</th>
              <th class="pb-3 text-right">Hak Mitra Bersih</th>
            </tr></thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="o in ownerReportData" :key="o.id" class="text-sm">
                <td class="py-3">
                  <p class="font-semibold text-slate-800">{{ o.name }}</p>
                  <p class="text-xs text-slate-400">{{ o.phone || '-' }}</p>
                </td>
                <td class="py-3 text-right">{{ o.motor_count }}</td>
                <td class="py-3 text-right">{{ o.rental_count }}x</td>
                <td class="py-3 text-right">{{ formatRp(o.total_omzet) }}</td>
                <td class="py-3 text-right font-semibold">{{ formatRp(o.gross_commission) }}</td>
                <td class="py-3 text-right text-red-500">{{ formatRp(o.total_expenses) }}</td>
                <td class="py-3 text-right font-bold" :class="(o.gross_commission - o.total_expenses) >= 0 ? 'text-emerald-600' : 'text-red-600'">
                  {{ formatRp(o.gross_commission - o.total_expenses) }}
                </td>
              </tr>
              <!-- Total row -->
              <tr v-if="ownerReportData.length" class="text-sm font-bold border-t-2 border-slate-300 bg-slate-50">
                <td class="py-3" colspan="3">TOTAL ({{ ownerReportData.length }} pemilik)</td>
                <td class="py-3 text-right">{{ formatRp(ownerReportData.reduce((s,o)=>s+o.total_omzet,0)) }}</td>
                <td class="py-3 text-right">{{ formatRp(ownerReportData.reduce((s,o)=>s+o.gross_commission,0)) }}</td>
                <td class="py-3 text-right text-red-500">{{ formatRp(ownerReportData.reduce((s,o)=>s+o.total_expenses,0)) }}</td>
                <td class="py-3 text-right text-emerald-600">{{ formatRp(ownerReportData.reduce((s,o)=>s+(o.gross_commission-o.total_expenses),0)) }}</td>
              </tr>
              <tr v-if="!ownerReportData.length"><td colspan="7" class="py-8 text-center text-slate-400">Belum ada data</td></tr>
            </tbody>
          </table>
          </div>
        </div>
      </template>

      <!-- ── TAB: Ranking Motor ── -->      <template v-if="activeTab === 'ranking'">
        <div class="card table-card">
          <h3 class="text-lg font-extrabold text-primary font-headline mb-4">Ranking Motor</h3>
          <div class="table-scroll">
          <table class="table-base text-left">
            <thead><tr class="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
              <th class="pb-3">#</th><th class="pb-3">Motor</th><th class="pb-3">Tipe</th>
              <th class="pb-3 text-right">Total Rental</th><th class="pb-3 text-right">Total Hari</th>
              <th class="pb-3 text-right">Wavy Gets</th><th class="pb-3 text-right">Bagian Mitra</th>
            </tr></thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="(m, i) in pagedRanking" :key="m.id" class="text-sm">
                <td class="py-3 font-black text-slate-400">{{ ((rankingPage - 1) * rankingPageSize) + i + 1 }}</td>
                <td class="py-3 font-medium">{{ m.model }} <span class="text-slate-400">· {{ m.plate_number }}</span></td>
                <td class="py-3"><span :class="isAsetPt(m.type) ? 'badge-neutral' : 'badge-warning'">{{ getMotorTypeLabel(m.type) }}</span></td>
                <td class="py-3 text-right">{{ m.total_rentals }}x</td>
                <td class="py-3 text-right">{{ m.total_days }} hari</td>
                <td class="py-3 text-right font-bold text-primary">{{ formatRp(m.total_wavy) }}</td>
                <td class="py-3 text-right text-slate-600">{{ formatRp(m.total_owner) }}</td>
              </tr>
              <tr v-if="!motorRanking.length"><td colspan="7" class="py-8 text-center text-slate-400">Belum ada data</td></tr>
            </tbody>
          </table>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { formatRp, formatDate, formatDateTime, today } from '../utils/format'
import SearchSelect from '../components/SearchSelect.vue'
import TablePagination from '../components/TablePagination.vue'
import { getMotorTypeLabel, isAsetPt } from '../utils/motorType'
import {
  buildFinancialHtml, buildMotorIncomeHtml, buildMotorExpensesHtml,
  buildTransactionsHtml, buildOwnerCommissionHtml, previewReport,
  buildProfitLossHtml, buildBalanceSheetHtml, buildAnnualHtml, buildOwnerReportHtml, buildRankingHtml
} from '../utils/pdf'
import {
  saveFinancialExcel, saveMotorIncomeExcel, saveMotorExpensesExcel,
  saveTransactionsExcel, saveCommissionExcel,
  saveProfitLossExcel, saveBalanceSheetExcel, saveAnnualExcel, saveOwnerReportExcel, saveRankingExcel
} from '../utils/excel'

const tabs = [
  { key: 'motor-income', label: 'Pendapatan Motor', icon: 'two_wheeler' },
  { key: 'motor-expenses', label: 'Pengeluaran Motor', icon: 'build' },
  { key: 'transactions', label: 'Semua Transaksi', icon: 'receipt_long' },
  { key: 'supporting', label: 'Laporan Pendukung', icon: 'folder_open' }
]

const activeTab = ref('motor-income')
const supportingReports = [
  { key: 'profit-loss', label: 'Laba Rugi', icon: 'trending_up' },
  { key: 'balance-sheet', label: 'Neraca', icon: 'balance' }
]
const activeSupportingReport = ref('profit-loss')
const period = ref('month')
const groupBy = ref('day')
const startDate = ref('')
const endDate = ref('')
const selectedMotorId = ref('')
const selectedOwnerId = ref('')
const selectedOwnerReportId = ref('')
const loading = ref(false)
const exporting = ref('')
const reportError = ref('')

const motors = ref([])
const owners = ref([])
const summary = ref(null)
const financialRows = ref([])
const motorRanking = ref([])
const motorIncomeData = ref([])
const motorExpensesData = ref([])
const transactionsData = ref({ rentals: [], operationalExpenses: [], motorExpenses: [] })
const commissionData = ref(null)
const profitLossData = ref(null)
const balanceSheetData = ref(null)
const annualData = ref([])
const selectedYear = ref(new Date().getFullYear())
const ownerReportData = ref([])

const motorIncomePage = ref(1)
const motorIncomePageSize = ref(10)
const motorExpensesPage = ref(1)
const motorExpensesPageSize = ref(10)
const txRentalsPage = ref(1)
const txRentalsPageSize = ref(10)
const txOperationalPage = ref(1)
const txOperationalPageSize = ref(10)
const txMotorExpensesPage = ref(1)
const txMotorExpensesPageSize = ref(10)
const rankingPage = ref(1)
const rankingPageSize = ref(10)

const pagedMotorIncomeData = computed(() => {
  const start = (motorIncomePage.value - 1) * motorIncomePageSize.value
  return motorIncomeData.value.slice(start, start + motorIncomePageSize.value)
})
const pagedMotorExpensesData = computed(() => {
  const start = (motorExpensesPage.value - 1) * motorExpensesPageSize.value
  return motorExpensesData.value.slice(start, start + motorExpensesPageSize.value)
})
const pagedTxRentals = computed(() => {
  const list = transactionsData.value.rentals || []
  const start = (txRentalsPage.value - 1) * txRentalsPageSize.value
  return list.slice(start, start + txRentalsPageSize.value)
})
const pagedTxOperational = computed(() => {
  const list = transactionsData.value.operationalExpenses || []
  const start = (txOperationalPage.value - 1) * txOperationalPageSize.value
  return list.slice(start, start + txOperationalPageSize.value)
})
const pagedTxMotorExpenses = computed(() => {
  const list = transactionsData.value.motorExpenses || []
  const start = (txMotorExpensesPage.value - 1) * txMotorExpensesPageSize.value
  return list.slice(start, start + txMotorExpensesPageSize.value)
})
const pagedRanking = computed(() => {
  const start = (rankingPage.value - 1) * rankingPageSize.value
  return motorRanking.value.slice(start, start + rankingPageSize.value)
})

const motorOptions = computed(() => motors.value.map(m => ({ value: m.id, label: m.model, sub: m.plate_number + (m.owner_name ? ' · ' + m.owner_name : '') })))
const ownerOptions = computed(() => owners.value.map(o => ({ value: o.id, label: o.name })))
const groupByLabel = computed(() => ({ day: 'Hari', month: 'Bulan', year: 'Tahun' }[groupBy.value]))

const netBalance = computed(() => {
  const inc = transactionsData.value.rentals?.filter(r => r.status !== 'refunded').reduce((s, r) => s + (r.amount || 0), 0) || 0
  const exp = (transactionsData.value.operationalExpenses?.reduce((s, e) => s + (e.amount || 0), 0) || 0)
    + (transactionsData.value.motorExpenses?.reduce((s, e) => s + (e.amount || 0), 0) || 0)
  return inc - exp
})

const rekeningMethods = ['transfer', 'qris', 'debit_card']

function normalizeCashBucket(bucket) {
  const value = String(bucket || 'pendapatan').trim().toLowerCase()
  if (value === 'modal') return 'modal'
  if (value === 'ganti_rugi') return 'ganti_rugi'
  return 'pendapatan'
}

function cashBucketLabel(bucket) {
  const normalizedBucket = normalizeCashBucket(bucket)
  if (normalizedBucket === 'modal') return 'Kas Modal Tanam'
  if (normalizedBucket === 'ganti_rugi') return 'Kas Ganti Rugi'
  return 'Kas Pendapatan'
}

function isRekeningMethod(method) {
  return rekeningMethods.includes(String(method || '').trim().toLowerCase())
}

function paymentMethodLabel(method) {
  return {
    tunai: 'Tunai',
    transfer: 'Transfer',
    qris: 'QRIS',
    debit_card: 'Debit Card'
  }[method] || method || '-'
}

function paymentMethodGroupLabel(method, bucket) {
  if (normalizeCashBucket(bucket) === 'modal' && String(method || '').trim().toLowerCase() === 'tunai') {
    return 'Modal Tanam'
  }
  if (normalizeCashBucket(bucket) === 'ganti_rugi' && String(method || '').trim().toLowerCase() === 'tunai') {
    return 'Ganti Rugi'
  }
  return isRekeningMethod(method) ? 'Saldo Rekening' : paymentMethodLabel(method)
}

function paymentSummaryLabel(row) {
  return `${cashBucketLabel(row?.cash_bucket)} · ${paymentMethodGroupLabel(row?.payment_method, row?.cash_bucket)}`
}

function calculateCashSummary(rows, amountKey = 'amount') {
  return (rows || []).reduce((summary, row) => {
    const amount = Number(row?.[amountKey] || 0)
    const bucket = normalizeCashBucket(row?.cash_bucket)
    summary[bucket] += amount
    if (isRekeningMethod(row?.payment_method)) summary.rekening += amount
    return summary
  }, { pendapatan: 0, modal: 0, ganti_rugi: 0, rekening: 0 })
}

const motorIncomeCashSummary = computed(() => calculateCashSummary(motorIncomeData.value, 'total_price'))
const motorExpenseCashSummary = computed(() => calculateCashSummary(motorExpensesData.value, 'amount'))
const txRentalCashSummary = computed(() => calculateCashSummary(transactionsData.value.rentals || [], 'amount'))
const txOperationalCashSummary = computed(() => calculateCashSummary(transactionsData.value.operationalExpenses || [], 'amount'))
const txMotorCashSummary = computed(() => calculateCashSummary(transactionsData.value.motorExpenses || [], 'amount'))

const rentalJourneys = computed(() => {
  const rentals = (transactionsData.value.rentals || []).map(item => ({ ...item }))
  if (!rentals.length) return []

  const childrenMap = new Map()
  for (const item of rentals) {
    const parentId = Number(item.parent_rental_id || 0)
    if (!parentId) continue
    if (String(item.relation_type || '').toLowerCase() !== 'swap') continue
    if (!childrenMap.has(parentId)) childrenMap.set(parentId, [])
    childrenMap.get(parentId).push(item)
  }

  const sortChildren = (list = []) => [...list].sort((a, b) => {
    const da = new Date(a.date).getTime()
    const db = new Date(b.date).getTime()
    if (da !== db) return da - db
    return Number(a.id || 0) - Number(b.id || 0)
  })

  const roots = rentals
    .filter(item => !item.parent_rental_id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const journeys = []
  const visited = new Set()

  const walk = (node, steps) => {
    const children = sortChildren(childrenMap.get(Number(node.id)) || [])
    for (const child of children) {
      const childId = Number(child.id)
      if (visited.has(childId)) continue
      visited.add(childId)
      const relation = String(child.relation_type || '').toLowerCase()
      if (relation === 'swap') {
        steps.push(`Ganti ke ${child.motor_model || '-'} (${child.plate_number || '-'}) tgl ${formatDate(child.date)}`)
      }
      walk(child, steps)
    }
  }

  for (const root of roots) {
    const rootId = Number(root.id)
    if (visited.has(rootId)) continue
    visited.add(rootId)
    const steps = []
    walk(root, steps)
    if (!steps.length) continue
    journeys.push({
      key: root.invoice_number || `rental-${root.id}`,
      root: `${root.description || '-'} ${root.motor_model || ''} (${root.plate_number || '-'})${root.invoice_number ? ` [${root.invoice_number}]` : ''}`.trim(),
      steps
    })
  }

  // fallback untuk ganti unit yg parent-nya tidak masuk periode filter
  for (const item of rentals) {
    const id = Number(item.id)
    if (visited.has(id)) continue
    const relation = String(item.relation_type || '').toLowerCase()
    if (relation !== 'swap') continue
    const fallbackRoot = item.parent_invoice_number
      ? `Transaksi awal [${item.parent_invoice_number}] ${item.parent_motor_model || ''} (${item.parent_plate_number || '-'})`
      : `Transaksi awal (di luar periode)`
    const step = `Ganti ke ${item.motor_model || '-'} (${item.plate_number || '-'}) tgl ${formatDate(item.date)}`
    journeys.push({
      key: `fallback-${id}`,
      root: fallbackRoot,
      steps: [step]
    })
    visited.add(id)
  }

  return journeys
})

const periodLabel = computed(() => {
  if (period.value === 'today') return 'Hari Ini'
  if (period.value === 'week') return 'Minggu Ini'
  if (period.value === 'month') return 'Bulan Ini'
  if (period.value === 'year') return 'Tahun Ini'
  return `${startDate.value} s/d ${endDate.value}`
})

function toFileNamePart(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
}

function getDateRangeFileLabel() {
  const start = toFileNamePart(startDate.value)
  const end = toFileNamePart(endDate.value)
  if (!start && !end) return ''
  if (start && end && start !== end) return `${start}_sd_${end}`
  return start || end
}

function getPdfPayload() {
  const p = periodLabel.value
  const dateLabel = getDateRangeFileLabel()

  if (activeTab.value === 'supporting' && activeSupportingReport.value === 'profit-loss' && profitLossData.value) {
    return {
      html: buildProfitLossHtml({ data: profitLossData.value, period: p }),
      defaultName: `Laporan_Laba_Rugi_${dateLabel}.pdf`
    }
  }
  if (activeTab.value === 'supporting' && activeSupportingReport.value === 'balance-sheet' && balanceSheetData.value) {
    return {
      html: buildBalanceSheetHtml({ data: balanceSheetData.value, period: `Per ${endDate.value}` }),
      defaultName: `Neraca_${toFileNamePart(endDate.value)}.pdf`
    }
  }
  if (activeTab.value === 'annual') {
    return {
      html: buildAnnualHtml({ rows: annualData.value, year: selectedYear.value }),
      defaultName: `Rekap_Tahunan_${selectedYear.value}.pdf`
    }
  }
  if (activeTab.value === 'owner-report') {
    return {
      html: buildOwnerReportHtml({ rows: ownerReportData.value, period: p }),
      defaultName: `Laporan_Mitra_${dateLabel}.pdf`
    }
  }
  if (activeTab.value === 'motor-income') {
    const motorName = selectedMotorId.value ? motors.value.find(m => m.id == selectedMotorId.value)?.model : ''
    return {
      html: buildMotorIncomeHtml({ rentals: motorIncomeData.value, period: p, motorName }),
      defaultName: `Pendapatan_Motor_${toFileNamePart(motorName || 'Semua')}_${dateLabel}.pdf`
    }
  }
  if (activeTab.value === 'motor-expenses') {
    const motorName = selectedMotorId.value ? motors.value.find(m => m.id == selectedMotorId.value)?.model : ''
    return {
      html: buildMotorExpensesHtml({ expenses: motorExpensesData.value, period: p, motorName }),
      defaultName: `Pengeluaran_Motor_${toFileNamePart(motorName || 'Semua')}_${dateLabel}.pdf`
    }
  }
  if (activeTab.value === 'transactions') {
    return {
      html: buildTransactionsHtml({
        rentals: transactionsData.value.rentals,
        operationalExpenses: transactionsData.value.operationalExpenses,
        motorExpenses: transactionsData.value.motorExpenses,
        journeys: rentalJourneys.value,
        period: p
      }),
      defaultName: `Semua_Transaksi_${dateLabel}.pdf`
    }
  }
  if (activeTab.value === 'commission' && commissionData.value) {
    return {
      html: buildOwnerCommissionHtml({ data: commissionData.value, period: p }),
      defaultName: `Hak_Mitra_${toFileNamePart(commissionData.value.owner?.name || 'Mitra')}_${dateLabel}.pdf`
    }
  }
  if (activeTab.value === 'ranking') {
    return {
      html: buildRankingHtml({ rows: motorRanking.value, period: p }),
      defaultName: `Ranking_Motor_${dateLabel}.pdf`
    }
  }

  return { html: '', defaultName: `Laporan_${dateLabel || toFileNamePart(p)}.pdf` }
}

function onPeriodChange() {
  const now = new Date()
  if (period.value === 'today') {
    startDate.value = endDate.value = today()
  } else if (period.value === 'week') {
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    startDate.value = new Date(new Date().setDate(diff)).toISOString().split('T')[0]
    endDate.value = today()
  } else if (period.value === 'month') {
    startDate.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    endDate.value = today()
  } else if (period.value === 'year') {
    startDate.value = `${now.getFullYear()}-01-01`
    endDate.value = `${now.getFullYear()}-12-31`
    if (groupBy.value === 'day') groupBy.value = 'month'
  }
}

async function loadReport() {
  loading.value = true
  reportError.value = ''
  const s = startDate.value + 'T00:00:00'
  const e = endDate.value + 'T23:59:59'
  try {
    if (activeTab.value === 'motor-income') {
      motorIncomeData.value = await window.api.getMotorIncomeReport({ startDate: s, endDate: e, motorId: selectedMotorId.value || null })
    }
    if (activeTab.value === 'motor-expenses') {
      motorExpensesData.value = await window.api.getMotorExpensesReport({ startDate: s, endDate: e, motorId: selectedMotorId.value || null })
    }
    if (activeTab.value === 'transactions') {
      transactionsData.value = await window.api.getTransactionsReport({ startDate: s, endDate: e })
    }
    if (activeTab.value === 'supporting' && activeSupportingReport.value === 'profit-loss') {
      profitLossData.value = null
      profitLossData.value = await window.api.getProfitLossReport({ startDate: s, endDate: e })
    }
    if (activeTab.value === 'supporting' && activeSupportingReport.value === 'balance-sheet') {
      balanceSheetData.value = null
      if (typeof window.api?.getBalanceSheetReport !== 'function') {
        throw new Error('Fitur neraca belum termuat. Tutup lalu buka ulang aplikasi, lalu coba lagi.')
      }
      balanceSheetData.value = await window.api.getBalanceSheetReport({ endDate: endDate.value })
    }
  } catch (error) {
    console.error('ReportsView loadReport error:', error)
    reportError.value = error?.message || 'Terjadi kesalahan saat memuat laporan.'
  } finally {
    loading.value = false
  }
}

async function previewPdf() {
  exporting.value = 'pdf'
  try {
    const { html, defaultName } = getPdfPayload()
    if (html) await previewReport(html, defaultName)
  } finally { exporting.value = '' }
}

async function exportExcel() {
  const s = startDate.value + 'T00:00:00'
  const e = endDate.value + 'T23:59:59'
  const p = periodLabel.value
  const dateLabel = getDateRangeFileLabel()
  exporting.value = 'excel'
  try {
    if (activeTab.value === 'supporting' && activeSupportingReport.value === 'profit-loss' && profitLossData.value) {
      await saveProfitLossExcel({ data: profitLossData.value, period: p, fileLabel: dateLabel })
    } else if (activeTab.value === 'supporting' && activeSupportingReport.value === 'balance-sheet' && balanceSheetData.value) {
      await saveBalanceSheetExcel({ data: balanceSheetData.value, period: `Per ${endDate.value}`, fileLabel: toFileNamePart(endDate.value) })
    } else if (activeTab.value === 'motor-income') {
      const motorName = selectedMotorId.value ? motors.value.find(m => m.id == selectedMotorId.value)?.model : ''
      await saveMotorIncomeExcel({ rentals: motorIncomeData.value, period: p, motorName, fileLabel: dateLabel })
    } else if (activeTab.value === 'motor-expenses') {
      const motorName = selectedMotorId.value ? motors.value.find(m => m.id == selectedMotorId.value)?.model : ''
      await saveMotorExpensesExcel({ expenses: motorExpensesData.value, period: p, motorName, fileLabel: dateLabel })
    } else if (activeTab.value === 'transactions') {
      await saveTransactionsExcel({
        rentals: transactionsData.value.rentals,
        operationalExpenses: transactionsData.value.operationalExpenses,
        motorExpenses: transactionsData.value.motorExpenses,
        period: p,
        fileLabel: dateLabel
      })
    }
  } finally { exporting.value = '' }
}

onMounted(async () => {
  try {
    motors.value = await window.api.getMotors()
    owners.value = await window.api.getOwners({ activeOnly: true })
    onPeriodChange()
    await loadReport()
  } catch (e) {
    console.error('ReportsView mount error:', e)
  } finally {
    loading.value = false
  }
})
</script>




