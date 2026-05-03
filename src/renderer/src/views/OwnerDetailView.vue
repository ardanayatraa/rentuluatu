<template>
  <div v-if="owner">

    <!-- Header -->
    <div class="card sticky top-4 z-20 mb-6 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
      <div class="flex flex-wrap items-start justify-between gap-5">
        <div class="flex items-start gap-4 min-w-0 flex-1">
          <button @click="router.back()" class="mt-1 p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <span class="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="page-title !text-[2.2rem]">{{ owner.name }}</h2>
              <span :class="owner.is_active ? 'badge-success' : 'badge-neutral'" class="text-[10px]">
                {{ owner.is_active ? 'Aktif' : 'Nonaktif' }}
              </span>
            </div>
            <p class="text-slate-500 text-sm mt-1">Detail mitra pemilik motor & riwayat pembagian hasil</p>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button @click="openSlipModal" class="btn-secondary">
            <span class="material-symbols-outlined text-sm">picture_as_pdf</span>
            Slip Hak Mitra
          </button>
          <button v-if="totalUnpaid > 0" @click="openPayout(null)" class="btn-primary !bg-orange-500 hover:!bg-orange-600">
            <span class="material-symbols-outlined text-sm">payments</span>
            Bayar Semua ({{ formatRp(totalUnpaid) }})
          </button>
        </div>
      </div>

      <div class="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-8 gap-y-4 border-t border-slate-100 pt-5">
        <div class="space-y-1">
          <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Telepon</p>
          <p class="text-base font-bold text-slate-800">{{ owner.phone || '-' }}</p>
        </div>
        <div class="space-y-1">
          <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400">Total Mengendap</p>
          <p class="text-[1.8rem] font-black text-orange-500">{{ formatRp(totalUnpaid) }}</p>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="payoutSuccessMsg"
      class="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
      <span class="material-symbols-outlined text-emerald-500">check_circle</span>
      {{ payoutSuccessMsg }}
    </div>

    <!-- Motor Cards -->
    <div class="card mb-8">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2">
            <span class="material-symbols-outlined text-base">two_wheeler</span>
            Motor Titipan Mitra
          </h3>
          <p class="text-xs text-slate-400 mt-1">{{ filteredMotors.length }} motor terhubung ke mitra ini</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <select v-model="motorPeriodFilter.mode" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="month">Per Bulan</option>
            <option value="year">Per Tahun</option>
            <option value="custom">Rentang Tanggal</option>
            <option value="all">Semua Data</option>
          </select>
          <input
            v-if="motorPeriodFilter.mode === 'month'"
            v-model="motorPeriodFilter.month"
            type="month"
            class="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
          <select
            v-if="motorPeriodFilter.mode === 'year'"
            v-model="motorPeriodFilter.year"
            class="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
          </select>
          <template v-if="motorPeriodFilter.mode === 'custom'">
            <input
              v-model="motorPeriodFilter.startDate"
              type="date"
              class="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <input
              v-model="motorPeriodFilter.endDate"
              type="date"
              class="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
          </template>
          <button @click="applyMotorPeriodFilter" class="btn-primary text-sm py-2 px-3">Terapkan</button>
          <button @click="resetMotorPeriodFilter" class="btn-secondary text-sm py-2 px-3">Reset</button>
          <input
            v-model="motorSearch"
            type="text"
            placeholder="Cari model atau plat..."
            class="border border-slate-200 rounded-lg px-3 py-2 text-sm w-56"
          />
          <select v-model.number="motorPageSize" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option :value="4">4 / halaman</option>
            <option :value="6">6 / halaman</option>
            <option :value="8">8 / halaman</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div v-for="m in pagedMotors" :key="m.id"
        class="rounded-2xl border bg-white p-4 shadow-sm"
        :class="m.net_commission > 0 ? 'border-orange-200' : 'border-slate-200'">

        <!-- Motor header -->
        <div class="flex justify-between items-start mb-4 gap-3">
          <div>
            <p class="font-bold text-primary text-[15px] leading-tight">{{ m.model }}</p>
            <div class="flex items-center gap-2 mt-1 flex-wrap">
              <span class="font-mono bg-slate-100 px-2 py-0.5 rounded text-xs font-bold text-slate-600">{{ m.plate_number }}</span>
              <span class="text-xs text-slate-400 capitalize">{{ m.type }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <button @click="openMotorDetail(m)" class="btn-secondary text-xs py-1.5 px-3">
              <span class="material-symbols-outlined text-sm">insights</span>
              Detail Motor
            </button>
            <button v-if="m.net_commission > 0 || m.pending_commission > 0"
              @click="openPayout(m.id)"
              class="btn-primary text-xs py-1.5 px-3 !bg-orange-500 hover:!bg-orange-600">
              <span class="material-symbols-outlined text-sm">payments</span>
              Bayar Motor Ini
            </button>
          </div>
        </div>

        <!-- Finansial per motor -->
        <div class="grid grid-cols-3 gap-3">
          <div class="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
            <p class="text-[11px] font-bold uppercase tracking-wide text-emerald-700/70">Hak Mitra</p>
            <p class="mt-1 text-base font-black text-emerald-600">{{ formatRp(m.pending_commission) }}</p>
          </div>
          <div class="rounded-xl bg-red-50 border border-red-100 px-3 py-2">
            <p class="text-[11px] font-bold uppercase tracking-wide text-red-700/70">Pengeluaran</p>
            <p class="mt-1 text-base font-black text-red-500">- {{ formatRp(m.total_pending_expenses) }}</p>
          </div>
          <div class="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
            <p class="text-[11px] font-bold uppercase tracking-wide text-amber-700/70">Net</p>
            <p class="mt-1 text-base font-black" :class="m.net_commission > 0 ? 'text-orange-500' : 'text-slate-400'">
              {{ formatRp(m.net_commission) }}
            </p>
          </div>
        </div>

        <!-- Pengeluaran pending -->
        <div v-if="m.pending_expenses.length" class="mt-4 pt-3 border-t border-slate-100">
          <div class="flex items-center justify-between gap-3 mb-2">
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">Pengeluaran Belum Dipotong</p>
            <span v-if="m.pending_expenses.length > 3" class="text-[11px] font-semibold text-slate-400">
              +{{ m.pending_expenses.length - 3 }} lainnya
            </span>
          </div>
          <div class="space-y-1">
            <div v-for="e in m.pending_expenses.slice(0, 3)" :key="e.id"
              class="flex items-start justify-between gap-3 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              <span>{{ e.category }}{{ e.description ? ' — ' + e.description : '' }}
                <span class="text-slate-400">· {{ formatDate(e.date) }}</span>
              </span>
              <span class="text-red-500 font-semibold ml-2">- {{ formatRp(e.amount) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!filteredMotors.length" class="card text-center text-slate-400 py-8 col-span-2">
        Tidak ada motor yang dititipkan
      </div>
      </div>

      <div v-if="filteredMotors.length" class="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <p class="text-xs text-slate-400">
          Menampilkan {{ motorPageStart }}-{{ motorPageEnd }} dari {{ filteredMotors.length }} motor
        </p>
        <div class="flex items-center gap-2">
          <button @click="motorCurrentPage = Math.max(1, motorCurrentPage - 1)" :disabled="motorCurrentPage === 1" class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Prev</button>
          <span class="text-xs font-bold text-slate-500">Hal. {{ motorCurrentPage }} / {{ motorTotalPages }}</span>
          <button @click="motorCurrentPage = Math.min(motorTotalPages, motorCurrentPage + 1)" :disabled="motorCurrentPage === motorTotalPages" class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>

    <div class="card mb-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2">
            <span class="material-symbols-outlined text-base">date_range</span>
            Filter Periode
          </h3>
          <p class="text-xs text-slate-400 mt-1">Dipakai untuk riwayat sewa dan riwayat pencairan hak mitra.</p>
        </div>
        <div class="flex flex-wrap items-end gap-2">
          <select v-model="periodFilter.mode" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="month">Per Bulan</option>
            <option value="year">Per Tahun</option>
            <option value="custom">Rentang Tanggal</option>
            <option value="all">Semua Data</option>
          </select>
          <input
            v-if="periodFilter.mode === 'month'"
            v-model="periodFilter.month"
            type="month"
            class="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
          <select
            v-if="periodFilter.mode === 'year'"
            v-model="periodFilter.year"
            class="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
          </select>
          <template v-if="periodFilter.mode === 'custom'">
            <input v-model="periodFilter.startDate" type="date" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            <input v-model="periodFilter.endDate" type="date" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </template>
          <button @click="applyPeriodFilter" class="btn-primary text-sm">Terapkan</button>
          <button @click="resetPeriodFilter" class="btn-secondary text-sm">Reset</button>
        </div>
      </div>
    </div>

    <!-- Riwayat Sewa -->
    <div class="card table-card mb-6">
      <div class="p-4 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4 bg-slate-50">
        <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2">
          <span class="material-symbols-outlined">history</span>
          Riwayat Sewa
        </h3>
        <div class="flex gap-2 flex-wrap">
          <select v-model="historyFilter.motorId" class="border border-slate-200 rounded-lg px-2 py-1 text-xs">
            <option value="">Semua Motor</option>
            <option v-for="m in motors" :key="m.id" :value="m.id">{{ m.model }}</option>
          </select>
          <input v-model="historyFilter.startDate" type="date" class="border border-slate-200 rounded-lg px-2 py-1 text-xs" />
          <span class="text-slate-400 self-center">—</span>
          <input v-model="historyFilter.endDate" type="date" class="border border-slate-200 rounded-lg px-2 py-1 text-xs" />
          <button @click="loadHistory" class="btn-primary py-1 px-3 text-xs h-auto">Filter</button>
          <button @click="resetFilter" class="btn-secondary py-1 px-2 text-xs h-auto">
            <span class="material-symbols-outlined text-sm">refresh</span>
          </button>
        </div>
      </div>

      <div class="table-scroll">
        <table class="table-base text-left">
          <thead class="bg-slate-50 text-slate-400 text-[11px] uppercase font-bold">
            <tr>
              <th class="px-4 py-3">Tanggal</th>
              <th class="px-4 py-3">Motor</th>
              <th class="px-4 py-3">Pelanggan</th>
              <th class="px-4 py-3 text-right">Durasi</th>
              <th class="px-4 py-3 text-right">Bagian Mitra</th>
              <th class="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50 text-sm">
            <tr v-for="h in paginatedHistory" :key="h.id" class="hover:bg-slate-50 transition-colors">
              <td class="px-4 py-3 text-slate-500 text-xs">{{ formatShortDate(h.date_time) }}</td>
              <td class="px-4 py-3">
                <div class="font-semibold text-primary text-xs">{{ h.model }}</div>
                <div class="text-xs font-mono text-slate-400">{{ h.plate_number }}</div>
              </td>
              <td class="px-4 py-3 text-slate-700">{{ h.customer_name }}</td>
              <td class="px-4 py-3 text-right text-slate-500">{{ h.period_days }} hari</td>
              <td class="px-4 py-3 text-right font-bold text-emerald-600">{{ formatRp(h.owner_gets) }}</td>
              <td class="px-4 py-3 text-center">
                <span :class="h.is_paid ? 'badge-success' : 'badge-error'" class="!text-[10px]">
                  {{ h.is_paid ? 'LUNAS' : 'BELUM' }}
                </span>
              </td>
            </tr>
            <tr v-if="!paginatedHistory.length">
              <td colspan="6" class="px-4 py-12 text-center text-slate-400">Tidak ada data</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="p-4 border-t border-slate-100 flex items-center justify-between text-sm bg-slate-50">
        <span class="text-slate-500 text-xs">
          {{ (currentPage - 1) * itemsPerPage + 1 }} –
          {{ Math.min(currentPage * itemsPerPage, historyData.length) }} dari {{ historyData.length }}
        </span>
        <div class="flex gap-1">
          <button @click="currentPage--" :disabled="currentPage === 1"
            class="px-3 py-1 rounded border border-slate-200 bg-white disabled:opacity-50 text-xs font-bold text-slate-600">Prev</button>
          <span class="px-3 py-1 text-xs font-semibold text-slate-700">{{ currentPage }} / {{ totalPages || 1 }}</span>
          <button @click="currentPage++" :disabled="currentPage >= totalPages"
            class="px-3 py-1 rounded border border-slate-200 bg-white disabled:opacity-50 text-xs font-bold text-slate-600">Next</button>
        </div>
      </div>
    </div>

    <!-- Riwayat Pencairan -->
    <div class="card table-card">
      <div class="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 gap-3 flex-wrap">
        <div>
          <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2">
            <span class="material-symbols-outlined">receipt_long</span>
            Riwayat Pencairan Hak Mitra
          </h3>
          <p class="text-xs text-slate-400 mt-1">{{ filteredPayoutHistory.length }} pencairan tercatat</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="payoutSearch"
            type="text"
            placeholder="Cari tanggal atau kas..."
            class="border border-slate-200 rounded-lg px-3 py-2 text-sm w-52 bg-white"
          />
          <select v-model.number="payoutPageSize" class="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option :value="5">5 / halaman</option>
            <option :value="10">10 / halaman</option>
            <option :value="15">15 / halaman</option>
          </select>
        </div>
      </div>

      <div v-if="!filteredPayoutHistory.length" class="py-10 text-center text-slate-400 text-sm">Belum ada riwayat pencairan</div>

      <div v-for="(p, idx) in pagedPayoutHistory" :key="p.id" class="border-b border-slate-100 last:border-0">
        <div class="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 select-none"
          @click="openIdx = openIdx === payoutPageStartIndex + idx ? -1 : payoutPageStartIndex + idx">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-emerald-500 text-xl">check_circle</span>
            <div>
              <p class="text-sm font-bold text-slate-700">Pencairan {{ formatDate(p.date) }}</p>
              <p class="text-xs text-slate-400">via {{ p.cash_account_name }}</p>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <div class="text-right">
              <p class="font-black text-emerald-600 text-base">{{ formatRp(p.amount) }}</p>
              <p v-if="p.deduction_amount > 0" class="text-xs text-slate-400">
                Kotor {{ formatRp(p.gross_amount) }} − Potongan {{ formatRp(p.deduction_amount) }}
              </p>
            </div>
            <span class="material-symbols-outlined text-slate-400 transition-transform"
              :style="openIdx === payoutPageStartIndex + idx ? 'transform:rotate(180deg)' : ''">expand_more</span>
          </div>
        </div>

        <div v-if="openIdx === payoutPageStartIndex + idx" class="bg-slate-50 border-t border-slate-100 px-6 py-4 text-xs">
          <div class="grid grid-cols-2 gap-6">
            <div v-if="p.rentals.length">
              <p class="font-bold text-slate-500 uppercase tracking-wider mb-2">Asal Hak Mitra</p>
              <div class="space-y-1">
                <div v-for="r in p.rentals" :key="r.date_time + r.model"
                  class="flex justify-between py-1.5 px-2 rounded bg-white border border-slate-100">
                  <span class="text-slate-600">
                    {{ r.model }} <span class="text-slate-400">{{ r.plate_number }}</span><br>
                    <span class="text-slate-400">{{ formatShortDate(r.date_time) }} · {{ r.period_days }} hari</span>
                  </span>
                  <span class="font-semibold text-emerald-600 ml-2">{{ formatRp(r.owner_gets) }}</span>
                </div>
              </div>
            </div>
            <div>
              <p class="font-bold text-slate-500 uppercase tracking-wider mb-2">Biaya Dipotong</p>
              <div v-if="p.deductions.length" class="space-y-1">
                <div v-for="d in p.deductions" :key="d.category + d.amount"
                  class="flex justify-between py-1.5 px-2 rounded bg-white border border-red-50">
                  <span class="text-slate-600">
                    {{ d.model }} <span class="text-slate-400">{{ d.plate_number }}</span><br>
                    <span class="text-slate-400">{{ d.category }}{{ d.description ? ' — ' + d.description : '' }}</span>
                  </span>
                  <span class="font-semibold text-red-500 ml-2">- {{ formatRp(d.amount) }}</span>
                </div>
              </div>
              <div v-else class="py-3 px-2 text-slate-400 italic bg-white rounded border border-slate-100">
                Tidak ada biaya dipotong
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="filteredPayoutHistory.length" class="flex items-center justify-between border-t border-slate-100 px-4 py-4 bg-slate-50">
        <p class="text-xs text-slate-400">
          Menampilkan {{ payoutPageStart }}-{{ payoutPageEnd }} dari {{ filteredPayoutHistory.length }} pencairan
        </p>
        <div class="flex items-center gap-2">
          <button @click="payoutCurrentPage = Math.max(1, payoutCurrentPage - 1)" :disabled="payoutCurrentPage === 1" class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Prev</button>
          <span class="text-xs font-bold text-slate-500">Hal. {{ payoutCurrentPage }} / {{ payoutTotalPages }}</span>
          <button @click="payoutCurrentPage = Math.min(payoutTotalPages, payoutCurrentPage + 1)" :disabled="payoutCurrentPage === payoutTotalPages" class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>

    <n-modal v-model:show="showMotorDetailModal" preset="card" :title="motorDetailTitle" class="max-w-6xl" :auto-focus="false" :trap-focus="false">
      <div class="space-y-5">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Detail Per Motor</p>
            <p class="text-sm text-slate-500 mt-1">Bisa difilter per bulan, rentang tanggal, atau semua data.</p>
          </div>
          <div class="flex flex-wrap items-end gap-2">
            <select v-model="motorDetailFilter.mode" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
              <option value="month">Per Bulan</option>
              <option value="year">Per Tahun</option>
              <option value="custom">Rentang Tanggal</option>
              <option value="all">Semua Data</option>
            </select>
            <input
              v-if="motorDetailFilter.mode === 'month'"
              v-model="motorDetailFilter.month"
              type="month"
              class="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            />
            <select
              v-if="motorDetailFilter.mode === 'year'"
              v-model="motorDetailFilter.year"
              class="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            >
              <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
            </select>
            <template v-if="motorDetailFilter.mode === 'custom'">
              <input
                v-model="motorDetailFilter.startDate"
                type="date"
                class="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
              <input
                v-model="motorDetailFilter.endDate"
                type="date"
                class="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </template>
            <button @click="loadMotorDetail" class="btn-primary text-sm">Terapkan</button>
            <button @click="previewMotorSlip" class="btn-secondary text-sm">
              <span class="material-symbols-outlined text-sm">picture_as_pdf</span>
              Slip Motor
            </button>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4">
          <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Pemasukan Periode Ini</p>
            <p class="mt-2 text-2xl font-black text-emerald-600">{{ formatRp(motorDetailSummary.income) }}</p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Pengeluaran Periode Ini</p>
            <p class="mt-2 text-2xl font-black text-red-500">{{ formatRp(motorDetailSummary.expense) }}</p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Hasil Bersih</p>
            <p class="mt-2 text-2xl font-black" :class="motorDetailSummary.net >= 0 ? 'text-primary' : 'text-red-500'">{{ formatRp(motorDetailSummary.net) }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <div class="rounded-2xl border border-slate-200 overflow-hidden">
            <div class="flex items-center justify-between bg-slate-50 px-4 py-3 border-b border-slate-100">
              <h4 class="text-sm font-bold text-slate-700">Tabel Pemasukan</h4>
              <span class="text-xs text-slate-400">{{ motorIncomeRows.length }} transaksi</span>
            </div>
            <div class="max-h-[360px] overflow-auto">
              <table class="w-full text-left text-sm">
                <thead class="bg-white text-slate-400 text-[11px] uppercase font-bold sticky top-0">
                  <tr>
                    <th class="px-4 py-3">Tanggal</th>
                    <th class="px-4 py-3">Pelanggan</th>
                    <th class="px-4 py-3 text-right">Durasi</th>
                    <th class="px-4 py-3 text-right">Bagian Mitra</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-for="row in motorIncomeRows" :key="row.id">
                    <td class="px-4 py-3 text-slate-500 text-xs">{{ formatShortDate(row.date_time) }}</td>
                    <td class="px-4 py-3 text-slate-700">{{ row.customer_name }}</td>
                    <td class="px-4 py-3 text-right text-slate-500">{{ row.period_days }} hari</td>
                    <td class="px-4 py-3 text-right font-bold text-emerald-600">{{ formatRp(row.owner_gets) }}</td>
                  </tr>
                  <tr v-if="!motorIncomeRows.length">
                    <td colspan="4" class="px-4 py-10 text-center text-slate-400">Belum ada pemasukan pada periode ini</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 overflow-hidden">
            <div class="flex items-center justify-between bg-slate-50 px-4 py-3 border-b border-slate-100">
              <h4 class="text-sm font-bold text-slate-700">Tabel Pengeluaran</h4>
              <span class="text-xs text-slate-400">{{ motorExpenseRows.length }} transaksi</span>
            </div>
            <div class="max-h-[360px] overflow-auto">
              <table class="w-full text-left text-sm">
                <thead class="bg-white text-slate-400 text-[11px] uppercase font-bold sticky top-0">
                  <tr>
                    <th class="px-4 py-3">Tanggal</th>
                    <th class="px-4 py-3">Kategori</th>
                    <th class="px-4 py-3">Keterangan</th>
                    <th class="px-4 py-3 text-right">Jumlah</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-for="row in motorExpenseRows" :key="row.id">
                    <td class="px-4 py-3 text-slate-500 text-xs">{{ formatDate(row.date) }}</td>
                    <td class="px-4 py-3 text-slate-700">{{ row.category }}</td>
                    <td class="px-4 py-3 text-slate-500">{{ row.description || '-' }}</td>
                    <td class="px-4 py-3 text-right font-bold text-red-500">{{ formatRp(row.amount) }}</td>
                  </tr>
                  <tr v-if="!motorExpenseRows.length">
                    <td colspan="4" class="px-4 py-10 text-center text-slate-400">Belum ada pengeluaran pada periode ini</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </n-modal>

    <!-- Modal Payout -->
    <n-modal v-model:show="showPayoutModal" preset="card" title="Konfirmasi Pembayaran Hak Mitra" class="max-w-lg" :auto-focus="false" :trap-focus="false">
      <div v-if="payoutPreview" class="space-y-4">

        <!-- Breakdown per motor -->
        <div class="rounded-xl border border-slate-200 overflow-hidden">
          <div class="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            Rincian per Motor
          </div>

          <div v-for="m in payoutPreview.byMotor" :key="m.motor_id" class="border-b border-slate-100 last:border-0">
            <div class="px-4 py-2.5 bg-white flex justify-between items-center">
              <div>
                <span class="font-bold text-slate-800 text-sm">{{ m.model }}</span>
                <span class="text-xs font-mono text-slate-400 ml-2">{{ m.plate_number }}</span>
              </div>
              <span class="text-xs font-bold"
                :class="(m.rental_total - m.expense_total) >= 0 ? 'text-emerald-600' : 'text-red-600'">
                {{ formatRp(m.rental_total - m.expense_total) }}
              </span>
            </div>
            <div class="px-4 pb-3 space-y-1">
              <div v-for="r in m.rentals" :key="r.id"
                class="flex justify-between text-xs text-slate-500 py-1 border-b border-slate-50">
                <span>{{ formatShortDate(r.date_time) }} · {{ r.period_days }} hari</span>
                <span class="text-emerald-600 font-medium">+ {{ formatRp(r.owner_gets) }}</span>
              </div>
              <div v-for="e in m.expenses" :key="e.id"
                class="flex justify-between text-xs text-slate-500 py-1 border-b border-slate-50">
                <span>{{ e.category }}{{ e.description ? ' — ' + e.description : '' }}</span>
                <span class="text-red-500 font-medium">- {{ formatRp(e.amount) }}</span>
              </div>
            </div>
          </div>

          <div class="divide-y divide-slate-100">
            <div class="flex justify-between px-4 py-3 bg-slate-50">
              <span class="text-sm text-slate-600">Total Hak Mitra Kotor</span>
              <span class="font-bold text-slate-800">{{ formatRp(payoutPreview.grossCommission) }}</span>
            </div>
            <div v-if="payoutPreview.totalDeductions > 0" class="flex justify-between px-4 py-3 bg-slate-50">
              <span class="text-sm text-red-600">Total Potongan</span>
              <span class="font-bold text-red-600">- {{ formatRp(payoutPreview.totalDeductions) }}</span>
            </div>
            <div class="flex justify-between px-4 py-3 bg-emerald-50">
              <span class="text-sm font-bold text-emerald-700">Yang Dibayarkan</span>
              <span class="text-lg font-black text-emerald-700">{{ formatRp(payoutPreview.netAmount) }}</span>
            </div>
          </div>
        </div>

        <div v-if="payoutPreview.netAmount === 0" class="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
          Hak mitra habis dipotong pengeluaran. Tidak ada yang perlu dibayarkan.
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Sumber Dana (Kas)</label>
          <select
            v-model="payoutForm.cash_account_id"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            :required="payoutPreview.netAmount > 0"
          >
            <option value="">— Pilih Kas —</option>
            <option v-for="c in payoutCashAccounts" :key="c.id" :value="c.id">
              {{ payoutMethodLabel(c.type, c.bucket) }} • {{ c.name }} (Saldo: {{ formatRp(c.balance) }})
            </option>
          </select>
          <p v-if="!payoutCashAccounts.length" class="mt-1 text-[11px] text-red-500">
            Tidak ada akun kas pendapatan/modal yang valid untuk payout hak mitra.
          </p>
        </div>

        <p v-if="payoutError" class="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{{ payoutError }}</p>

        <div class="flex justify-end gap-3 pt-2">
          <button type="button" @click="showPayoutModal = false" class="btn-secondary">Batal</button>
          <button @click="submitPayout"
            :disabled="payoutPreview.netAmount > 0 && !payoutForm.cash_account_id"
            class="btn-primary flex items-center gap-2 px-5 font-bold disabled:opacity-50">
            <span class="material-symbols-outlined">payments</span>
            {{ payoutPreview.netAmount > 0 ? 'Bayar ' + formatRp(payoutPreview.netAmount) : 'Tandai Lunas (Rp 0)' }}
          </button>
        </div>
      </div>
      <div v-else class="py-8 text-center text-slate-400">Memuat preview...</div>
    </n-modal>

    <n-modal v-model:show="showSlipModal" preset="card" title="Preview Slip Hak Mitra" class="max-w-xl" :auto-focus="false" :trap-focus="false">
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Periode Slip</label>
          <select v-model="slipFilter.mode" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option value="all">Semua Hak Mitra Sampai Hari Ini</option>
            <option value="month">Hak Mitra Per Bulan</option>
            <option value="year">Hak Mitra Per Tahun</option>
            <option value="custom">Rentang Tanggal Kustom</option>
          </select>
        </div>

        <div v-if="slipFilter.mode === 'month'">
          <label class="block text-xs font-bold text-slate-500 mb-1">Pilih Bulan</label>
          <input v-model="slipFilter.month" type="month" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div v-if="slipFilter.mode === 'year'">
          <label class="block text-xs font-bold text-slate-500 mb-1">Pilih Tahun</label>
          <select v-model="slipFilter.year" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
          </select>
        </div>

        <div v-if="slipFilter.mode === 'custom'" class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Tanggal Mulai</label>
            <input v-model="slipFilter.startDate" type="date" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Tanggal Akhir</label>
            <input v-model="slipFilter.endDate" type="date" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <div class="flex justify-between gap-3">
            <span class="text-slate-500">Periode Dokumen</span>
            <span class="font-semibold text-slate-700 text-right">{{ slipPeriodText }}</span>
          </div>
          <div class="flex justify-between gap-3 mt-2">
            <span class="text-slate-500">Nama File</span>
            <span class="font-mono text-xs text-slate-600 text-right break-all">{{ slipDefaultFileName }}</span>
          </div>
        </div>

        <p v-if="slipError" class="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{{ slipError }}</p>

        <div class="flex justify-end gap-3 pt-2">
          <button type="button" @click="showSlipModal = false" class="btn-secondary">Batal</button>
          <button @click="previewSlip" class="btn-primary flex items-center gap-2 px-5 font-bold">
            <span class="material-symbols-outlined">visibility</span>
            Preview Slip
          </button>
        </div>
      </div>
    </n-modal>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { dateInputValue, formatRp, formatDate, today } from '../utils/format'
import { buildOwnerCommissionHtml, previewReport } from '../utils/pdf'

const route = useRoute()
const router = useRouter()
const ownerId = Number(route.params.id)

function currentYearValue() {
  return today().slice(0, 4)
}

function getAvailableYears() {
  const currentYear = Number(currentYearValue())
  const years = []
  for (let year = currentYear + 2; year >= currentYear - 10; year -= 1) {
    years.push(String(year))
  }
  return years
}

const availableYears = getAvailableYears()

const owner = ref(null)
const motors = ref([])
const historyData = ref([])
const cashAccounts = ref([])
const payoutHistory = ref([])
const payoutPreview = ref(null)
const openIdx = ref(-1)
const payoutError = ref('')
const payoutSuccessMsg = ref('')
const showPayoutModal = ref(false)
const payoutForm = ref({ cash_account_id: '' })
const selectedPayoutMotorIds = ref(null) // null = semua
const showSlipModal = ref(false)
const slipError = ref('')
const slipMeta = ref({
  latestPayoutDate: null,
  firstActivityDate: null
})
const slipFilter = ref({
  mode: 'all',
  month: today().slice(0, 7),
  year: currentYearValue(),
  startDate: today(),
  endDate: today()
})

const historyFilter = ref({ startDate: '', endDate: '', motorId: '' })
const currentPage = ref(1)
const itemsPerPage = 10
const motorPeriodFilter = ref({
  mode: 'month',
  month: today().slice(0, 7),
  year: currentYearValue(),
  startDate: today(),
  endDate: today()
})
const motorSearch = ref('')
const motorCurrentPage = ref(1)
const motorPageSize = ref(4)
const payoutSearch = ref('')
const payoutCurrentPage = ref(1)
const payoutPageSize = ref(5)
const showMotorDetailModal = ref(false)
const selectedMotor = ref(null)
const motorDetailFilter = ref({
  mode: 'month',
  month: today().slice(0, 7),
  year: currentYearValue(),
  startDate: today(),
  endDate: today()
})
const motorIncomeRows = ref([])
const motorExpenseRows = ref([])
const periodFilter = ref({
  mode: 'all',
  month: today().slice(0, 7),
  year: currentYearValue(),
  startDate: today(),
  endDate: today()
})

const totalPages = computed(() => Math.ceil(historyData.value.length / itemsPerPage))
const paginatedHistory = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  return historyData.value.slice(start, start + itemsPerPage)
})
const filteredMotors = computed(() => {
  const keyword = motorSearch.value.trim().toLowerCase()
  if (!keyword) return motors.value
  return motors.value.filter((motor) =>
    String(motor.model || '').toLowerCase().includes(keyword) ||
    String(motor.plate_number || '').toLowerCase().includes(keyword)
  )
})
const motorTotalPages = computed(() => Math.max(1, Math.ceil(filteredMotors.value.length / motorPageSize.value)))
const pagedMotors = computed(() => {
  const start = (motorCurrentPage.value - 1) * motorPageSize.value
  return filteredMotors.value.slice(start, start + motorPageSize.value)
})
const motorPageStart = computed(() => filteredMotors.value.length ? ((motorCurrentPage.value - 1) * motorPageSize.value) + 1 : 0)
const motorPageEnd = computed(() => Math.min(motorCurrentPage.value * motorPageSize.value, filteredMotors.value.length))
const filteredPayoutHistory = computed(() => {
  const keyword = payoutSearch.value.trim().toLowerCase()
  if (!keyword) return payoutHistory.value
  return payoutHistory.value.filter((item) =>
    formatDate(item.date).toLowerCase().includes(keyword) ||
    String(item.cash_account_name || '').toLowerCase().includes(keyword)
  )
})
const payoutTotalPages = computed(() => Math.max(1, Math.ceil(filteredPayoutHistory.value.length / payoutPageSize.value)))
const pagedPayoutHistory = computed(() => {
  const start = (payoutCurrentPage.value - 1) * payoutPageSize.value
  return filteredPayoutHistory.value.slice(start, start + payoutPageSize.value)
})
const payoutPageStartIndex = computed(() => (payoutCurrentPage.value - 1) * payoutPageSize.value)
const payoutPageStart = computed(() => filteredPayoutHistory.value.length ? payoutPageStartIndex.value + 1 : 0)
const payoutPageEnd = computed(() => Math.min(payoutCurrentPage.value * payoutPageSize.value, filteredPayoutHistory.value.length))
const motorDetailTitle = computed(() => {
  if (!selectedMotor.value) return 'Detail Motor'
  return `${selectedMotor.value.model} - ${selectedMotor.value.plate_number}`
})
const motorDetailSummary = computed(() => {
  const income = motorIncomeRows.value.reduce((sum, row) => sum + Number(row.owner_gets || 0), 0)
  const expense = motorExpenseRows.value.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  return {
    income,
    expense,
    net: income - expense
  }
})
const payoutMethodOrder = ['tunai', 'transfer', 'qris', 'debit_card']
const payoutCashAccounts = computed(() =>
  cashAccounts.value
    .filter((account) => {
      const bucket = String(account.bucket || 'pendapatan')
      const type = String(account.type || '')
      if (bucket === 'pendapatan' && payoutMethodOrder.includes(type)) return true
      if (bucket === 'modal' && type === 'tunai') return true
      return false
    })
    .sort((a, b) => {
      const bucketA = String(a.bucket || 'pendapatan')
      const bucketB = String(b.bucket || 'pendapatan')
      const typeA = String(a.type || '')
      const typeB = String(b.type || '')
      const rankA = bucketA === 'modal' ? 99 : payoutMethodOrder.indexOf(typeA)
      const rankB = bucketB === 'modal' ? 99 : payoutMethodOrder.indexOf(typeB)
      return rankA - rankB
    })
)

const totalUnpaid = computed(() =>
  motors.value.reduce((s, m) => s + (m.net_commission || 0), 0)
)

function payoutMethodLabel(method, bucket = 'pendapatan') {
  if (String(bucket || 'pendapatan') === 'modal') return 'Modal'
  if (method === 'tunai') return 'Tunai'
  if (method === 'transfer') return 'Transfer'
  if (method === 'qris') return 'QRIS'
  if (method === 'debit_card') return 'Debit Card'
  return method || '-'
}

function addDays(dateStr, days) {
  if (!dateStr) return null
  const dt = new Date(`${dateStr}T00:00:00`)
  dt.setDate(dt.getDate() + days)
  return dateInputValue(dt)
}

function getAutoSlipStartDate() {
  if (slipMeta.value.latestPayoutDate) {
    return addDays(slipMeta.value.latestPayoutDate, 1) || today()
  }
  return slipMeta.value.firstActivityDate || today()
}

const slipPeriodText = computed(() => {
  if (slipFilter.value.mode === 'all') {
    const startDate = getAutoSlipStartDate()
    const endDate = slipFilter.value.endDate || today()
    return `${formatLongDate(startDate)} s/d ${formatLongDate(endDate)}`
  }
  if (slipFilter.value.mode === 'month') {
    const [year, month] = (slipFilter.value.month || '').split('-')
    if (!year || !month) return '-'
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  }
  if (slipFilter.value.mode === 'year') return `Tahun ${slipFilter.value.year || currentYearValue()}`
  return `${formatLongDate(slipFilter.value.startDate)} s/d ${formatLongDate(slipFilter.value.endDate)}`
})

const slipDefaultFileName = computed(() =>
  `Slip_Hak_Mitra_${toFileNamePart(owner.value?.name || 'Mitra')}_${getSlipFilePeriodLabel()}.pdf`
)

function formatShortDate(dateStr) {
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

function formatLongDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

function toFileNamePart(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
}

function getLastDayOfMonth(monthValue) {
  const [year, month] = (monthValue || '').split('-')
  if (!year || !month) return ''
  return dateInputValue(new Date(Number(year), Number(month), 0))
}

function getMonthRange(monthValue) {
  const normalizedMonth = monthValue || today().slice(0, 7)
  return {
    startDate: `${normalizedMonth}-01`,
    endDate: getLastDayOfMonth(normalizedMonth)
  }
}

function getYearRange(yearValue) {
  const year = String(yearValue || currentYearValue())
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` }
}

function getOwnerPeriodRange() {
  if (periodFilter.value.mode === 'month') {
    const monthValue = periodFilter.value.month || today().slice(0, 7)
    return {
      startDate: `${monthValue}-01`,
      endDate: getLastDayOfMonth(monthValue)
    }
  }

  if (periodFilter.value.mode === 'year') {
    return getYearRange(periodFilter.value.year)
  }

  if (periodFilter.value.mode === 'custom') {
    return {
      startDate: periodFilter.value.startDate || null,
      endDate: periodFilter.value.endDate || null
    }
  }

  return { startDate: null, endDate: null }
}

function getMotorOwnerRange() {
  if (motorPeriodFilter.value.mode === 'month') {
    const monthValue = motorPeriodFilter.value.month || today().slice(0, 7)
    return {
      startDate: `${monthValue}-01`,
      endDate: getLastDayOfMonth(monthValue)
    }
  }

  if (motorPeriodFilter.value.mode === 'year') {
    return getYearRange(motorPeriodFilter.value.year)
  }

  if (motorPeriodFilter.value.mode === 'custom') {
    return {
      startDate: motorPeriodFilter.value.startDate || null,
      endDate: motorPeriodFilter.value.endDate || null
    }
  }

  return { startDate: null, endDate: null }
}

function getSlipRange() {
  if (slipFilter.value.mode === 'all') {
    return {
      startDate: getAutoSlipStartDate(),
      endDate: slipFilter.value.endDate || today()
    }
  }

  if (slipFilter.value.mode === 'month') {
    const monthValue = slipFilter.value.month || today().slice(0, 7)
    return {
      startDate: `${monthValue}-01`,
      endDate: getLastDayOfMonth(monthValue)
    }
  }

  if (slipFilter.value.mode === 'year') {
    return getYearRange(slipFilter.value.year)
  }

  return {
    startDate: slipFilter.value.startDate,
    endDate: slipFilter.value.endDate
  }
}

function getSlipFilePeriodLabel() {
  const { startDate, endDate } = getSlipRange()
  if (slipFilter.value.mode === 'all') return `${toFileNamePart(startDate || today())}_sd_${toFileNamePart(endDate || today())}`
  if (slipFilter.value.mode === 'month') return toFileNamePart(slipFilter.value.month)
  if (slipFilter.value.mode === 'year') return toFileNamePart(slipFilter.value.year)
  if (startDate && endDate && startDate !== endDate) return `${toFileNamePart(startDate)}_sd_${toFileNamePart(endDate)}`
  return toFileNamePart(endDate || startDate || today())
}

function getMotorDetailRange() {
  if (motorDetailFilter.value.mode === 'month') {
    return getMonthRange(motorDetailFilter.value.month)
  }

  if (motorDetailFilter.value.mode === 'year') {
    return getYearRange(motorDetailFilter.value.year)
  }

  if (motorDetailFilter.value.mode === 'custom') {
    return {
      startDate: motorDetailFilter.value.startDate || null,
      endDate: motorDetailFilter.value.endDate || null
    }
  }

  const rentals = motorIncomeRows.value.map(row => String(row.date_time || '').split('T')[0]).filter(Boolean)
  const expenses = motorExpenseRows.value.map(row => String(row.date || '')).filter(Boolean)
  const dates = [...rentals, ...expenses].sort()
  return {
    startDate: dates[0] || '2000-01-01',
    endDate: dates[dates.length - 1] || today()
  }
}

function openSlipModal() {
  slipError.value = ''
  slipFilter.value.endDate = today()
  slipFilter.value.startDate = getAutoSlipStartDate()
  showSlipModal.value = true
}

function resetMotorFilter() {
  historyFilter.value.motorId = ''
  loadHistory()
}

function resetFilter() {
  resetMotorFilter()
}

async function applyPeriodFilter() {
  const { startDate, endDate } = getOwnerPeriodRange()
  if (periodFilter.value.mode === 'custom' && (!startDate || !endDate)) return
  if (startDate && endDate && startDate > endDate) return
  historyFilter.value.startDate = startDate || ''
  historyFilter.value.endDate = endDate || ''
  await loadHistory()
  await loadPayoutHistory()
}

async function resetPeriodFilter() {
  periodFilter.value = {
    mode: 'all',
    month: today().slice(0, 7),
    year: currentYearValue(),
    startDate: today(),
    endDate: today()
  }
  historyFilter.value.startDate = ''
  historyFilter.value.endDate = ''
  await loadHistory()
  await loadPayoutHistory()
}

async function applyMotorPeriodFilter() {
  const { startDate, endDate } = getMotorOwnerRange()
  if (motorPeriodFilter.value.mode === 'custom' && (!startDate || !endDate)) return
  if (startDate && endDate && startDate > endDate) return
  await loadData()
}

async function resetMotorPeriodFilter() {
  motorPeriodFilter.value = {
    mode: 'month',
    month: today().slice(0, 7),
    year: currentYearValue(),
    startDate: today(),
    endDate: today()
  }
  await loadData()
}

async function openMotorDetail(motor) {
  selectedMotor.value = motor
  motorDetailFilter.value = {
    mode: motorPeriodFilter.value.mode === 'custom' ? 'custom' : motorPeriodFilter.value.mode === 'all' ? 'all' : motorPeriodFilter.value.mode === 'year' ? 'year' : 'month',
    month: (motorPeriodFilter.value.mode === 'month' ? motorPeriodFilter.value.month : today().slice(0, 7)) || today().slice(0, 7),
    year: (motorPeriodFilter.value.mode === 'year' ? motorPeriodFilter.value.year : currentYearValue()) || currentYearValue(),
    startDate: motorPeriodFilter.value.startDate || today(),
    endDate: motorPeriodFilter.value.endDate || today()
  }
  showMotorDetailModal.value = true
  await loadMotorDetail()
}

async function loadMotorDetail() {
  if (!selectedMotor.value) return
  const { startDate, endDate } = getMotorDetailRange()
  if (motorDetailFilter.value.mode === 'custom' && (!startDate || !endDate)) return
  if (startDate && endDate && startDate > endDate) return
  motorIncomeRows.value = await window.api.getMotorIncomeReport({
    startDate: `${startDate}T00:00:00`,
    endDate: `${endDate}T23:59:59`,
    motorId: selectedMotor.value.id
  })
  motorExpenseRows.value = await window.api.getMotorExpensesReport({
    startDate: `${startDate}T00:00:00`,
    endDate: `${endDate}T23:59:59`,
    motorId: selectedMotor.value.id
  })
}

async function previewMotorSlip() {
  if (!selectedMotor.value) return
  const { startDate, endDate } = getMotorDetailRange()
  if (!startDate || !endDate || startDate > endDate) return
  const reportData = await window.api.getOwnerCommissionReport({
    ownerId,
    motorId: selectedMotor.value.id,
    startDate: `${startDate}T00:00:00`,
    endDate: `${endDate}T23:59:59`
  })
  const period = `${formatLongDate(startDate)} s/d ${formatLongDate(endDate)}`
  const html = buildOwnerCommissionHtml({
    data: reportData,
    period
  })
  await previewReport(
    html,
    `Slip_Hak_Mitra_${toFileNamePart(owner.value?.name || 'Mitra')}_${toFileNamePart(selectedMotor.value.plate_number)}_${toFileNamePart(startDate)}_sd_${toFileNamePart(endDate)}.pdf`
  )
}

async function loadData() {
  const range = getMotorOwnerRange()
  const res = await window.api.getOwner({
    id: ownerId,
    startDate: range.startDate,
    endDate: range.endDate
  })
  owner.value = res
  motors.value = res.motors
  cashAccounts.value = await window.api.getCashAccounts()
  slipMeta.value = await window.api.getOwnerSlipPeriodMeta({ ownerId })
  await loadHistory()
  await loadPayoutHistory()
  motorCurrentPage.value = 1
  payoutCurrentPage.value = 1
}

async function loadHistory() {
  const params = {
    ownerId,
    startDate: historyFilter.value.startDate || null,
    endDate: historyFilter.value.endDate || null
  }
  let data = await window.api.getOwnerCommission(params)
  // Filter per motor di frontend
  if (historyFilter.value.motorId) {
    data = data.filter(h => h.motor_id == historyFilter.value.motorId)
  }
  historyData.value = data
  currentPage.value = 1
}

async function loadPayoutHistory() {
  const { startDate, endDate } = getOwnerPeriodRange()
  const raw = await window.api.getPayoutHistory({
    ownerId,
    startDate,
    endDate
  })
  payoutHistory.value = raw.payouts || raw
  payoutCurrentPage.value = 1
}

// motorId = null → bayar semua, motorId = number → bayar satu motor
async function openPayout(motorId) {
  payoutPreview.value = null
  payoutError.value = ''
  payoutForm.value = { cash_account_id: '' }
  selectedPayoutMotorIds.value = motorId ? [motorId] : null
  showPayoutModal.value = true
  payoutPreview.value = await window.api.getPayoutPreview({
    ownerId,
    motorIds: motorId ? [motorId] : null
  })
}

async function submitPayout() {
  try {
    const preview = payoutPreview.value
    const expenseIds = Array.isArray(preview?.expenses) ? preview.expenses.map(e => Number(e.id)) : []
    const motorIds = Array.isArray(selectedPayoutMotorIds.value)
      ? selectedPayoutMotorIds.value.map(id => Number(id))
      : null
    const cashAccountId = preview?.netAmount > 0
      ? (payoutForm.value.cash_account_id ? Number(payoutForm.value.cash_account_id) : null)
      : null
    if (preview?.netAmount > 0 && !cashAccountId) {
      throw new Error('Pilih sumber dana kas untuk pembayaran hak mitra')
    }

    await window.api.payoutOwner({
      owner_id: ownerId,
      owner_name: owner.value.name,
      net_amount: Number(preview.netAmount || 0),
      gross_amount: Number(preview.grossCommission || 0),
      deduction_amount: Number(preview.totalDeductions || 0),
      expense_ids: expenseIds,
      motor_ids: motorIds,
      cash_account_id: cashAccountId,
      date: today()
    })
    showPayoutModal.value = false
    payoutSuccessMsg.value = 'Pembayaran hak mitra berhasil dicatat!'
    setTimeout(() => { payoutSuccessMsg.value = '' }, 4000)
    await loadData()
  } catch (err) {
    payoutError.value = err.message.replace("Error invoking remote method 'owner:payout': Error: ", '')
  }
}

async function previewSlip() {
  try {
    slipError.value = ''
    const { startDate, endDate } = getSlipRange()
    if (!startDate || !endDate) {
      slipError.value = 'Tanggal slip hak mitra belum lengkap.'
      return
    }
    if (startDate > endDate) {
      slipError.value = 'Tanggal mulai tidak boleh lebih besar dari tanggal akhir.'
      return
    }

    const commissionData = await window.api.getOwnerCommissionReport({
      ownerId,
      startDate: `${startDate}T00:00:00`,
      endDate: `${endDate}T23:59:59`
    })
    const html = buildOwnerCommissionHtml({
      data: commissionData,
      period: slipPeriodText.value
    })
    await previewReport(html, slipDefaultFileName.value)
  } catch (e) {
    slipError.value = e.message || 'Gagal membuat preview slip hak mitra.'
  }
}

onMounted(() => loadData())

watch([motorSearch, motorPageSize], () => {
  motorCurrentPage.value = 1
})

watch([payoutSearch, payoutPageSize], () => {
  payoutCurrentPage.value = 1
  openIdx.value = -1
})
</script>
