<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h2 class="page-title">Laporan & Analitik</h2>
        <p class="text-slate-500 text-sm mt-1">Rekap keuangan dan performa motor</p>
      </div>
    </div>

    <!-- Tab Jenis Laporan -->
    <div class="flex gap-2 mb-6 border-b border-slate-200">
      <button v-for="t in tabs" :key="t.key"
        @click="activeTab = t.key; loadReport()"
        :class="['px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors',
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
        <button @click="exportPdf" class="btn-secondary" :disabled="loading === true || exporting !== ''">
          <span class="material-symbols-outlined">picture_as_pdf</span>
          {{ exporting === 'pdf' ? 'Menyimpan...' : 'Simpan PDF' }}
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
      <!-- ── TAB: Laporan Keuangan ── -->
      <template v-if="activeTab === 'financial'">
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
              <th class="pb-3 text-right">Wavy Gets</th><th class="pb-3 text-right">Owner Gets</th>
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
                <tr><td class="py-2 px-3 pl-6 text-slate-600">Bagian Owner (Mitra)</td><td class="py-2 px-3 text-right text-red-600">( {{ formatRp(profitLossData.owner_gets) }} )</td></tr>
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
        <div class="card">
          <h3 class="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Rekap Omzet Bulanan {{ selectedYear }}</h3>
          <table class="w-full text-left">
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
      </template>

      <!-- ── TAB: Pendapatan per Motor ── -->
      <template v-if="activeTab === 'motor-income'">
        <div class="grid grid-cols-4 gap-6 mb-6">
          <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Transaksi</p>
            <p class="text-2xl font-black text-primary font-headline">{{ motorIncomeData.length }}x</p></div>
          <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Pendapatan</p>
            <p class="text-2xl font-black text-primary font-headline">{{ formatRp(motorIncomeData.reduce((s,r)=>s+(r.total_price||0),0)) }}</p></div>
          <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Wavy Gets</p>
            <p class="text-2xl font-black text-primary font-headline">{{ formatRp(motorIncomeData.reduce((s,r)=>s+(r.wavy_gets||0),0)) }}</p></div>
          <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Owner Gets</p>
            <p class="text-2xl font-black text-slate-700 font-headline">{{ formatRp(motorIncomeData.reduce((s,r)=>s+(r.owner_gets||0),0)) }}</p></div>
        </div>
        <div class="card">
          <table class="w-full text-left">
            <thead><tr class="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
              <th class="pb-3">Tanggal</th><th class="pb-3">Pelanggan</th><th class="pb-3">Motor</th>
              <th class="pb-3 text-right">Durasi</th><th class="pb-3">Bayar</th>
              <th class="pb-3 text-right">Total</th><th class="pb-3 text-right">Wavy Gets</th><th class="pb-3 text-right">Owner Gets</th>
            </tr></thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="r in motorIncomeData" :key="r.id" class="text-sm">
                <td class="py-3">{{ formatDateTime(r.date_time) }}</td>
                <td class="py-3">{{ r.customer_name }}<br v-if="r.hotel"/><span v-if="r.hotel" class="text-xs text-slate-400">{{ r.hotel }}</span></td>
                <td class="py-3">{{ r.model }} <span class="text-slate-400">· {{ r.plate_number }}</span></td>
                <td class="py-3 text-right">{{ r.period_days }} hari</td>
                <td class="py-3"><span class="badge-neutral text-xs">{{ r.payment_method }}</span></td>
                <td class="py-3 text-right font-bold">{{ formatRp(r.total_price) }}</td>
                <td class="py-3 text-right text-primary">{{ formatRp(r.wavy_gets) }}</td>
                <td class="py-3 text-right text-slate-500">{{ formatRp(r.owner_gets) }}</td>
              </tr>
              <tr v-if="!motorIncomeData.length"><td colspan="8" class="py-8 text-center text-slate-400">Belum ada data</td></tr>
            </tbody>
          </table>
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
        <div class="card">
          <table class="w-full text-left">
            <thead><tr class="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
              <th class="pb-3">Tanggal</th><th class="pb-3">Motor</th><th class="pb-3">Tipe</th>
              <th class="pb-3">Kategori</th><th class="pb-3">Keterangan</th><th class="pb-3">Bayar</th><th class="pb-3 text-right">Jumlah</th>
            </tr></thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="e in motorExpensesData" :key="e.id" class="text-sm">
                <td class="py-3">{{ formatDate(e.date) }}</td>
                <td class="py-3">{{ e.model ? e.model + ' · ' + e.plate_number : '-' }}</td>
                <td class="py-3"><span class="badge-warning text-xs">{{ e.type }}</span></td>
                <td class="py-3">{{ e.category }}</td>
                <td class="py-3 text-slate-500">{{ e.description || '-' }}</td>
                <td class="py-3"><span class="badge-neutral text-xs">{{ e.payment_method }}</span></td>
                <td class="py-3 text-right font-bold text-red-600">{{ formatRp(e.amount) }}</td>
              </tr>
              <tr v-if="!motorExpensesData.length"><td colspan="7" class="py-8 text-center text-slate-400">Belum ada data</td></tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- ── TAB: Semua Transaksi ── -->
      <template v-if="activeTab === 'transactions'">
        <div class="grid grid-cols-3 gap-6 mb-6">
          <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Pemasukan</p>
            <p class="text-2xl font-black text-emerald-600 font-headline">{{ formatRp(transactionsData.rentals?.filter(r=>r.status!=='refunded').reduce((s,r)=>s+(r.amount||0),0)) }}</p></div>
          <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Pengeluaran</p>
            <p class="text-2xl font-black text-red-600 font-headline">{{ formatRp(transactionsData.expenses?.reduce((s,e)=>s+(e.amount||0),0)) }}</p></div>
          <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Selisih</p>
            <p class="text-2xl font-black font-headline" :class="netBalance >= 0 ? 'text-emerald-600' : 'text-red-600'">{{ formatRp(netBalance) }}</p></div>
        </div>
        <div class="card mb-4">
          <h3 class="text-sm font-extrabold text-primary mb-3">Pemasukan (Rental)</h3>
          <table class="w-full text-left">
            <thead><tr class="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
              <th class="pb-3">Tanggal</th><th class="pb-3">Pelanggan</th><th class="pb-3">Motor</th>
              <th class="pb-3">Bayar</th><th class="pb-3 text-right">Jumlah</th><th class="pb-3">Status</th>
            </tr></thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="r in transactionsData.rentals" :key="'r'+r.id" class="text-sm">
                <td class="py-2">{{ formatDateTime(r.date) }}</td>
                <td class="py-2">{{ r.description }}</td>
                <td class="py-2 text-slate-500">{{ r.motor }}</td>
                <td class="py-2"><span class="badge-neutral text-xs">{{ r.payment_method }}</span></td>
                <td class="py-2 text-right font-bold text-emerald-600">+{{ formatRp(r.amount) }}</td>
                <td class="py-2"><span :class="r.status==='refunded'?'badge-warning':'badge-neutral'" class="text-xs">{{ r.status }}</span></td>
              </tr>
              <tr v-if="!transactionsData.rentals?.length"><td colspan="6" class="py-6 text-center text-slate-400">Tidak ada data</td></tr>
            </tbody>
          </table>
        </div>
        <div class="card">
          <h3 class="text-sm font-extrabold text-red-600 mb-3">Pengeluaran</h3>
          <table class="w-full text-left">
            <thead><tr class="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
              <th class="pb-3">Tanggal</th><th class="pb-3">Kategori</th><th class="pb-3">Sumber</th>
              <th class="pb-3">Bayar</th><th class="pb-3 text-right">Jumlah</th>
            </tr></thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="e in transactionsData.expenses" :key="'e'+e.id" class="text-sm">
                <td class="py-2">{{ formatDate(e.date) }}</td>
                <td class="py-2">{{ e.description }}</td>
                <td class="py-2">
                  <span v-if="e.motor === 'Umum'" class="text-slate-400 text-xs">Operasional Umum</span>
                  <span v-else class="text-slate-600 text-xs">{{ e.motor }}</span>
                </td>
                <td class="py-2"><span class="badge-neutral text-xs">{{ e.payment_method }}</span></td>
                <td class="py-2 text-right font-bold text-red-600">-{{ formatRp(e.amount) }}</td>
              </tr>
              <tr v-if="!transactionsData.expenses?.length"><td colspan="5" class="py-6 text-center text-slate-400">Tidak ada data</td></tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- ── TAB: Komisi Mitra ── -->
      <template v-if="activeTab === 'commission'">
        <div v-if="!selectedOwnerId" class="card py-12 text-center text-slate-400">
          <span class="material-symbols-outlined text-4xl mb-2 block">person_search</span>
          Pilih mitra di filter atas untuk melihat laporan komisi
        </div>
        <template v-else-if="commissionData">
          <div class="grid grid-cols-4 gap-6 mb-6">
            <div class="card"><p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Komisi</p>
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
            <p class="text-xs text-slate-500">{{ commissionData.owner.bank_name }} — {{ commissionData.owner.bank_account }}</p>
            <p class="text-xs text-slate-500">Motor: {{ commissionData.motors.map(m=>m.model+' ('+m.plate_number+')').join(', ') }}</p>
          </div>
          <div class="card">
            <table class="w-full text-left">
              <thead><tr class="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
                <th class="pb-3">Tanggal</th><th class="pb-3">Motor</th><th class="pb-3">Pelanggan</th>
                <th class="pb-3 text-right">Durasi</th><th class="pb-3 text-right">Total Sewa</th>
                <th class="pb-3 text-right">Komisi</th><th class="pb-3">Status</th>
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
        </template>
      </template>

      <!-- ── TAB: Laporan per Pemilik Motor ── -->
      <template v-if="activeTab === 'owner-report'">
        <div class="card">
          <table class="w-full text-left">
            <thead><tr class="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
              <th class="pb-3">Pemilik</th>
              <th class="pb-3">Bank</th>
              <th class="pb-3 text-right">Motor</th>
              <th class="pb-3 text-right">Rental</th>
              <th class="pb-3 text-right">Total Omzet</th>
              <th class="pb-3 text-right">Komisi Kotor</th>
              <th class="pb-3 text-right">Total Pengeluaran</th>
              <th class="pb-3 text-right">Komisi Bersih</th>
            </tr></thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="o in ownerReportData" :key="o.id" class="text-sm">
                <td class="py-3">
                  <p class="font-semibold text-slate-800">{{ o.name }}</p>
                  <p class="text-xs text-slate-400">{{ o.phone || '-' }}</p>
                </td>
                <td class="py-3 text-xs text-slate-500">
                  {{ o.bank_name || '-' }}<br>
                  <span class="font-mono">{{ o.bank_account || '-' }}</span>
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
                <td class="py-3" colspan="4">TOTAL ({{ ownerReportData.length }} pemilik)</td>
                <td class="py-3 text-right">{{ formatRp(ownerReportData.reduce((s,o)=>s+o.total_omzet,0)) }}</td>
                <td class="py-3 text-right">{{ formatRp(ownerReportData.reduce((s,o)=>s+o.gross_commission,0)) }}</td>
                <td class="py-3 text-right text-red-500">{{ formatRp(ownerReportData.reduce((s,o)=>s+o.total_expenses,0)) }}</td>
                <td class="py-3 text-right text-emerald-600">{{ formatRp(ownerReportData.reduce((s,o)=>s+(o.gross_commission-o.total_expenses),0)) }}</td>
              </tr>
              <tr v-if="!ownerReportData.length"><td colspan="8" class="py-8 text-center text-slate-400">Belum ada data</td></tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- ── TAB: Ranking Motor ── -->      <template v-if="activeTab === 'ranking'">
        <div class="card">
          <h3 class="text-lg font-extrabold text-primary font-headline mb-4">Ranking Motor</h3>
          <table class="w-full text-left">
            <thead><tr class="text-slate-400 text-xs uppercase font-bold border-b border-slate-100">
              <th class="pb-3">#</th><th class="pb-3">Motor</th><th class="pb-3">Tipe</th>
              <th class="pb-3 text-right">Total Rental</th><th class="pb-3 text-right">Total Hari</th>
              <th class="pb-3 text-right">Wavy Gets</th><th class="pb-3 text-right">Owner Gets</th>
            </tr></thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="(m, i) in motorRanking" :key="m.id" class="text-sm">
                <td class="py-3 font-black text-slate-400">{{ i + 1 }}</td>
                <td class="py-3 font-medium">{{ m.model }} <span class="text-slate-400">· {{ m.plate_number }}</span></td>
                <td class="py-3"><span :class="m.type === 'pribadi' ? 'badge-neutral' : 'badge-warning'">{{ m.type }}</span></td>
                <td class="py-3 text-right">{{ m.total_rentals }}x</td>
                <td class="py-3 text-right">{{ m.total_days }} hari</td>
                <td class="py-3 text-right font-bold text-primary">{{ formatRp(m.total_wavy) }}</td>
                <td class="py-3 text-right text-slate-600">{{ formatRp(m.total_owner) }}</td>
              </tr>
              <tr v-if="!motorRanking.length"><td colspan="7" class="py-8 text-center text-slate-400">Belum ada data</td></tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { formatRp, formatDate, formatDateTime, today } from '../utils/format'
import SearchSelect from '../components/SearchSelect.vue'
import {
  buildFinancialHtml, buildMotorIncomeHtml, buildMotorExpensesHtml,
  buildTransactionsHtml, buildOwnerCommissionHtml, savePdfReport,
  buildProfitLossHtml, buildAnnualHtml, buildOwnerReportHtml
} from '../utils/pdf'
import {
  saveFinancialExcel, saveMotorIncomeExcel, saveMotorExpensesExcel,
  saveTransactionsExcel, saveCommissionExcel,
  saveProfitLossExcel, saveAnnualExcel, saveOwnerReportExcel
} from '../utils/excel'

const tabs = [
  { key: 'financial', label: 'Keuangan', icon: 'account_balance' },
  { key: 'profit-loss', label: 'Laba Rugi', icon: 'trending_up' },
  { key: 'annual', label: 'Rekap Tahunan', icon: 'calendar_month' },
  { key: 'motor-income', label: 'Pendapatan Motor', icon: 'two_wheeler' },
  { key: 'motor-expenses', label: 'Pengeluaran Motor', icon: 'build' },
  { key: 'transactions', label: 'Semua Transaksi', icon: 'receipt_long' },
  { key: 'commission', label: 'Komisi Mitra', icon: 'handshake' },
  { key: 'owner-report', label: 'Laporan Mitra', icon: 'person_pin' },
  { key: 'ranking', label: 'Ranking Motor', icon: 'leaderboard' }
]

const activeTab = ref('financial')
const period = ref('month')
const groupBy = ref('day')
const startDate = ref('')
const endDate = ref('')
const selectedMotorId = ref('')
const selectedOwnerId = ref('')
const selectedOwnerReportId = ref('')
const loading = ref(false)
const exporting = ref('')

const motors = ref([])
const owners = ref([])
const summary = ref(null)
const financialRows = ref([])
const motorRanking = ref([])
const motorIncomeData = ref([])
const motorExpensesData = ref([])
const transactionsData = ref({ rentals: [], expenses: [] })
const commissionData = ref(null)
const profitLossData = ref(null)
const annualData = ref([])
const selectedYear = ref(new Date().getFullYear())
const ownerReportData = ref([])

const motorOptions = computed(() => motors.value.map(m => ({ value: m.id, label: m.model, sub: m.plate_number })))
const ownerOptions = computed(() => owners.value.map(o => ({ value: o.id, label: o.name })))
const groupByLabel = computed(() => ({ day: 'Hari', month: 'Bulan', year: 'Tahun' }[groupBy.value]))

const netBalance = computed(() => {
  const inc = transactionsData.value.rentals?.filter(r => r.status !== 'refunded').reduce((s, r) => s + (r.amount || 0), 0) || 0
  const exp = transactionsData.value.expenses?.reduce((s, e) => s + (e.amount || 0), 0) || 0
  return inc - exp
})

const periodLabel = computed(() => {
  if (period.value === 'today') return 'Hari Ini'
  if (period.value === 'week') return 'Minggu Ini'
  if (period.value === 'month') return 'Bulan Ini'
  if (period.value === 'year') return 'Tahun Ini'
  return `${startDate.value} s/d ${endDate.value}`
})

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
  const s = startDate.value + 'T00:00:00'
  const e = endDate.value + 'T23:59:59'
  try {
    if (activeTab.value === 'financial' || activeTab.value === 'ranking') {
      summary.value = await window.api.getReportSummary({ startDate: s, endDate: e })
    }
    if (activeTab.value === 'financial') {
      financialRows.value = await window.api.getFinancialReport({ startDate: s, endDate: e, groupBy: groupBy.value })
    }
    if (activeTab.value === 'ranking') {
      motorRanking.value = await window.api.getMotorRanking({ startDate: s, endDate: e })
    }
    if (activeTab.value === 'motor-income') {
      motorIncomeData.value = await window.api.getMotorIncomeReport({ startDate: s, endDate: e, motorId: selectedMotorId.value || null })
    }
    if (activeTab.value === 'motor-expenses') {
      motorExpensesData.value = await window.api.getMotorExpensesReport({ startDate: s, endDate: e, motorId: selectedMotorId.value || null })
    }
    if (activeTab.value === 'transactions') {
      transactionsData.value = await window.api.getTransactionsReport({ startDate: s, endDate: e })
    }
    if (activeTab.value === 'profit-loss') {
      profitLossData.value = await window.api.getProfitLossReport({ startDate: s, endDate: e })
    }
    if (activeTab.value === 'annual') {
      annualData.value = await window.api.getAnnualRecap({ year: selectedYear.value })
    }
    if (activeTab.value === 'commission' && selectedOwnerId.value) {
      commissionData.value = await window.api.getOwnerCommissionReport({ ownerId: selectedOwnerId.value, startDate: s, endDate: e })
    }
    if (activeTab.value === 'owner-report') {
      ownerReportData.value = await window.api.getOwnerSummaryReport({ startDate: s, endDate: e, ownerId: selectedOwnerReportId.value || null })
    }
  } finally {
    loading.value = false
  }
}

async function exportPdf() {
  const s = startDate.value + 'T00:00:00'
  const e = endDate.value + 'T23:59:59'
  const p = periodLabel.value
  exporting.value = 'pdf'
  try {
    let html = ''
    if (activeTab.value === 'financial') {
      html = buildFinancialHtml({ summary: summary.value, rows: financialRows.value, period: p, groupLabel: groupByLabel.value })
    } else if (activeTab.value === 'profit-loss' && profitLossData.value) {
      html = buildProfitLossHtml({ data: profitLossData.value, period: p })
    } else if (activeTab.value === 'annual') {
      html = buildAnnualHtml({ rows: annualData.value, year: selectedYear.value })
    } else if (activeTab.value === 'owner-report') {
      html = buildOwnerReportHtml({ rows: ownerReportData.value, period: p })
    } else if (activeTab.value === 'motor-income') {
      const motorName = selectedMotorId.value ? motors.value.find(m => m.id == selectedMotorId.value)?.model : ''
      html = buildMotorIncomeHtml({ rentals: motorIncomeData.value, period: p, motorName })
    } else if (activeTab.value === 'motor-expenses') {
      const motorName = selectedMotorId.value ? motors.value.find(m => m.id == selectedMotorId.value)?.model : ''
      html = buildMotorExpensesHtml({ expenses: motorExpensesData.value, period: p, motorName })
    } else if (activeTab.value === 'transactions') {
      html = buildTransactionsHtml({ rentals: transactionsData.value.rentals, expenses: transactionsData.value.expenses, period: p })
    } else if (activeTab.value === 'commission' && commissionData.value) {
      html = buildOwnerCommissionHtml({ data: commissionData.value, period: p })
    } else if (activeTab.value === 'ranking') {
      const allRentals = await window.api.getMotorIncomeReport({ startDate: s, endDate: e, motorId: null })
      html = buildMotorIncomeHtml({ rentals: allRentals, period: p, motorName: 'Semua Motor' })
    }
    if (html) {
      const defaultName = `Laporan_Wavy_${activeTab.value}_${p.replace(/\s/g,'_')}.pdf`
      await savePdfReport(html, defaultName)
    }
  } finally { exporting.value = '' }
}

async function exportExcel() {
  const s = startDate.value + 'T00:00:00'
  const e = endDate.value + 'T23:59:59'
  const p = periodLabel.value
  exporting.value = 'excel'
  try {
    if (activeTab.value === 'financial') {
      await saveFinancialExcel({ rows: financialRows.value, period: p, groupLabel: groupByLabel.value })
    } else if (activeTab.value === 'profit-loss' && profitLossData.value) {
      await saveProfitLossExcel({ data: profitLossData.value, period: p })
    } else if (activeTab.value === 'annual') {
      await saveAnnualExcel({ rows: annualData.value, year: selectedYear.value })
    } else if (activeTab.value === 'owner-report') {
      await saveOwnerReportExcel({ rows: ownerReportData.value, period: p })
    } else if (activeTab.value === 'motor-income') {
      const motorName = selectedMotorId.value ? motors.value.find(m => m.id == selectedMotorId.value)?.model : ''
      await saveMotorIncomeExcel({ rentals: motorIncomeData.value, period: p, motorName })
    } else if (activeTab.value === 'motor-expenses') {
      const motorName = selectedMotorId.value ? motors.value.find(m => m.id == selectedMotorId.value)?.model : ''
      await saveMotorExpensesExcel({ expenses: motorExpensesData.value, period: p, motorName })
    } else if (activeTab.value === 'transactions') {
      await saveTransactionsExcel({ rentals: transactionsData.value.rentals, expenses: transactionsData.value.expenses, period: p })
    } else if (activeTab.value === 'commission' && commissionData.value) {
      await saveCommissionExcel({ data: commissionData.value, period: p })
    } else if (activeTab.value === 'ranking') {
      const allRentals = await window.api.getMotorIncomeReport({ startDate: s, endDate: e, motorId: null })
      await saveMotorIncomeExcel({ rentals: allRentals, period: p, motorName: 'Semua Motor' })
    }
  } finally { exporting.value = '' }
}

onMounted(async () => {
  try {
    motors.value = await window.api.getMotors()
    owners.value = await window.api.getOwners()
    onPeriodChange()
    await loadReport()
  } catch (e) {
    console.error('ReportsView mount error:', e)
  } finally {
    loading.value = false
  }
})
</script>
