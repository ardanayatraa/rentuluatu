<template>
  <div>
    <div class="mb-8 flex justify-between items-end">
      <div>
        <h2 class="page-title">Daily Record</h2>
        <p class="text-slate-500 text-sm mt-1">Pencatatan transaksi penyewaan</p>
      </div>
        <div class="flex gap-3">
          <button v-if="activeRecordTab === 'rental'" @click="openAdd" class="btn-primary">
            <span class="material-symbols-outlined">add</span>
            Tambah Rental
          </button>
          <button v-else-if="activeRecordTab === 'extend'" @click="openExtendFromTab" class="btn-primary">
            <span class="material-symbols-outlined">autorenew</span>
            Tambah Extend
          </button>
          <button v-else @click="openSwapFromTab" class="btn-primary">
            <span class="material-symbols-outlined">swap_horiz</span>
            Ganti Unit
          </button>
        </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 mb-6 border-b border-slate-200">
      <button
        @click="activeRecordTab = 'rental'"
        :class="[
          'px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors',
          activeRecordTab === 'rental'
            ? 'bg-white border border-b-white border-slate-200 text-primary -mb-px'
            : 'text-slate-500 hover:text-slate-700'
        ]"
      >
        <span class="material-symbols-outlined text-sm align-middle mr-1">receipt_long</span>
        Transaksi Rental
      </button>
      <button
        @click="activeRecordTab = 'extend'"
        :class="[
          'px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors',
          activeRecordTab === 'extend'
            ? 'bg-white border border-b-white border-slate-200 text-primary -mb-px'
            : 'text-slate-500 hover:text-slate-700'
        ]"
      >
        <span class="material-symbols-outlined text-sm align-middle mr-1">autorenew</span>
        Extend
      </button>
      <button
        @click="activeRecordTab = 'swap'"
        :class="[
          'px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors',
          activeRecordTab === 'swap'
            ? 'bg-white border border-b-white border-slate-200 text-primary -mb-px'
            : 'text-slate-500 hover:text-slate-700'
        ]"
      >
        <span class="material-symbols-outlined text-sm align-middle mr-1">swap_horiz</span>
        Ganti Unit
      </button>
    </div>

    <!-- Sub-tabs untuk Transaksi Rental -->
    <div v-if="activeRecordTab === 'rental'" class="flex gap-2 mb-4">
      <button
        @click="payoutFilter = 'all'"
        :class="[
          'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors',
          payoutFilter === 'all'
            ? 'bg-primary text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        ]"
      >
        Semua
      </button>
      <button
        @click="payoutFilter = 'unpaid'"
        :class="[
          'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors',
          payoutFilter === 'unpaid'
            ? 'bg-amber-500 text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        ]"
      >
        <span class="material-symbols-outlined text-xs align-middle mr-0.5">schedule</span>
        Belum Payout
      </button>
      <button
        @click="payoutFilter = 'paid'"
        :class="[
          'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors',
          payoutFilter === 'paid'
            ? 'bg-emerald-500 text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        ]"
      >
        <span class="material-symbols-outlined text-xs align-middle mr-0.5">check_circle</span>
        Sudah Payout
      </button>
    </div>

    <div class="card mb-6 flex gap-4 items-center flex-wrap">
      <select v-model="filters.periodMode" @change="syncRentalPeriod" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
        <option value="month">Per Bulan</option>
        <option value="year">Per Tahun</option>
        <option value="custom">Rentang Tanggal</option>
      </select>
      <input v-if="filters.periodMode === 'month'" v-model="filters.periodMonth" @change="syncRentalPeriod" type="month" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      <select v-else-if="filters.periodMode === 'year'" v-model="filters.periodYear" @change="syncRentalPeriod" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
        <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
      </select>
      <template v-else>
        <input v-model="filters.startDate" type="date" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      <span class="text-slate-400">—</span>
        <input v-model="filters.endDate" type="date" class="border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      </template>
      <input v-model="filters.keyword" type="text" placeholder="Cari nama atau plat..." class="border border-slate-200 rounded-lg px-3 py-2 text-sm min-w-[220px]" />
      <select v-model="filters.status" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
        <option value="">Semua Status</option>
        <option value="completed">Completed</option>
        <option value="refunded">Refunded</option>
      </select>
      <button @click="loadRentals" class="btn-secondary">
        <span class="material-symbols-outlined">filter_list</span>
        Filter
      </button>
      <button @click="resetFilters" class="btn-secondary">
        <span class="material-symbols-outlined">restart_alt</span>
        Reset
      </button>
      <select v-model="sortOrder" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
        <option value="oldest">Terlama</option>
        <option value="newest">Terbaru</option>
      </select>
      <select v-model.number="pageSize" class="border border-slate-200 rounded-lg px-3 py-2 text-sm">
        <option :value="10">10 / halaman</option>
        <option :value="25">25 / halaman</option>
        <option :value="50">50 / halaman</option>
      </select>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div class="card">
        <p class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Total Pendapatan</p>
        <p class="text-2xl font-black text-emerald-600 font-headline">{{ formatRp(filteredRevenueTotal) }}</p>
        <p class="text-xs text-slate-400 mt-1">Mengikuti filter aktif (periode, status, keyword, dan jenis transaksi).</p>
      </div>
      <div class="card">
        <p class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Jumlah Transaksi</p>
        <p class="text-2xl font-black text-slate-700 font-headline">{{ filteredRentals.length }}</p>
        <p class="text-xs text-slate-400 mt-1">Tab: {{ activeRecordTabLabel }}</p>
      </div>
    </div>

    <!-- Table -->
    <div class="card table-card">
      <div class="table-scroll">
      <table class="table-base text-left">
        <thead>
          <tr class="bg-slate-50 text-slate-400 text-xs uppercase font-bold">
            <th class="px-6 py-4">Tanggal</th>
            <th class="px-6 py-4">Pelanggan</th>
            <th v-if="showHotelColumn" class="px-6 py-4">Hotel / Vendor Hotel</th>
            <th class="px-6 py-4">Motor</th>
            <th class="px-6 py-4">Periode</th>
            <th class="px-6 py-4">Bayar</th>
            <th class="px-6 py-4 text-right">Total Transaksi</th>
            <th v-if="showVendorFeeColumn" class="px-6 py-4 text-right">Fee Vendor</th>
            <th class="px-6 py-4 text-right">Wavy Gets</th>
            <th class="px-6 py-4 text-right">Bagian Mitra</th>
            <th class="px-6 py-4 text-right">Status</th>
            <th class="px-6 py-4"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-if="loading" v-for="index in 6" :key="`sk-${index}`">
            <td :colspan="tableColumnCount" class="px-6 py-4">
              <div class="skeleton h-10 rounded-xl"></div>
            </td>
          </tr>
          <tr v-for="r in pagedRentals" :id="`rental-row-${r.id}`" :key="r.id" :class="[
            'transition-colors text-sm',
            highlightedRentalId === r.id ? 'bg-amber-50' : 'hover:bg-slate-50'
          ]">
            <td class="px-6 py-4 text-slate-500">
              <span class="block text-xs font-medium text-slate-700">{{ formatTime(r.date_time) }}</span>
              <span class="text-xs">{{ formatDate(r.date_time) }}</span>
            </td>
            <td class="px-6 py-4">
              <p class="font-medium">{{ r.customer_name }}</p>
              <div v-if="rentalRelation(r) === 'swap'" class="mt-1 flex flex-col items-start gap-1.5">
                <span class="inline-flex items-center rounded-full bg-violet-100 text-violet-700 text-xs font-semibold px-3 py-1">
                  Motor Pengganti
                </span>
                <button v-if="r.parent_rental_id" @click="goToParentRental(r)" class="text-xs text-primary hover:underline font-semibold">
                  Sumber ganti unit: {{ parentLabel(r) }}
                </button>
                <p class="text-xs text-slate-500">
                  Harga ganti unit: {{ formatRp(r.total_price) }}
                </p>
                <p v-if="swapSettlementLabel(r)" class="text-xs text-violet-600 font-semibold">
                  {{ swapSettlementLabel(r) }}
                </p>
                <p v-if="swapNote(r)" class="text-xs text-slate-500">Catatan: {{ swapNote(r) }}</p>
              </div>
              <div v-else-if="rentalRelation(r) === 'swap_source'" class="mt-1 flex flex-col items-start gap-1.5">
                <span class="inline-flex items-center rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1">
                  Diganti Unit
                </span>
                <p v-if="swapSettlementLabel(r)" class="text-xs text-violet-600 font-semibold">
                  {{ swapSettlementLabel(r) }}
                </p>
                <p v-if="swapNote(r)" class="text-xs text-slate-500">Catatan: {{ swapNote(r) }}</p>
              </div>
              <div v-else-if="hasRelatedTransactions(r)" class="mt-1">
                <span class="inline-flex items-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1">
                  Sumber Ganti Unit
                </span>
              </div>
            </td>
            <td v-if="showHotelColumn" class="px-6 py-4 text-slate-500">{{ r.hotel || '-' }}</td>
            <td class="px-6 py-4">
              <span class="font-medium">{{ r.model }}</span>
              <span class="text-slate-400 text-xs ml-1">{{ r.plate_number }}</span>
            </td>
            <td class="px-6 py-4">{{ r.period_days }} hari</td>
            <td class="px-6 py-4">
              <div class="flex flex-col items-start gap-1.5">
                <span :class="paymentMethodBadge(displayPaymentMethod(r))">{{ paymentMethodLabel(displayPaymentMethod(r)) }}</span>
                <p v-if="rentalRelation(r) !== 'extend' && paymentSummary(r)" class="text-xs text-slate-500">{{ paymentSummary(r) }}</p>
              </div>
            </td>
            <td class="px-6 py-4 text-right">
              <p class="font-semibold">{{ formatRp(transactionNetAmount(r)) }}</p>
              <p v-if="rentalRelation(r) !== 'extend' && Number(r.vendor_fee || 0) > 0" class="text-xs text-slate-400">Gross {{ formatRp(r.total_price) }}</p>
            </td>
            <td v-if="showVendorFeeColumn" class="px-6 py-4 text-right text-amber-600">{{ r.vendor_fee > 0 ? formatRp(r.vendor_fee) : '-' }}</td>
            <td class="px-6 py-4 text-right font-bold text-primary">{{ formatRp(r.wavy_gets) }}</td>
            <td class="px-6 py-4 text-right text-slate-600">{{ formatRp(r.owner_gets) }}</td>
            <td class="px-6 py-4 text-right">
              <div class="flex flex-col items-end gap-1.5">
                <span :class="statusBadge(r.status)">{{ r.status }}</span>
                <!-- Badge payout hanya muncul di tab "Semua" atau "Sudah Payout" -->
                <span v-if="r.status === 'completed' && r.payout_id && r.payout_id > 0 && (payoutFilter === 'all' || payoutFilter === 'paid')" class="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1">
                  Sudah Payout
                </span>
                <span v-else-if="r.status === 'completed' && (!r.payout_id || r.payout_id === 0) && payoutFilter === 'all'" class="inline-flex items-center rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1">
                  Belum Payout
                </span>
              </div>
            </td>
            <td class="px-6 py-4 text-right">
              <div class="flex gap-1 justify-end">
                <button v-if="r.status === 'completed' && (!r.payout_id || r.payout_id === 0) && (!r.hotel_payout_id || r.hotel_payout_id === 0)"
                  @click="openExtend(r)"
                  class="p-1.5 hover:bg-emerald-50 rounded text-slate-400 hover:text-emerald-600 transition-colors" :title="extendActionLabel">
                  <span class="material-symbols-outlined text-base">autorenew</span>
                </button>
                <button v-if="canSwapRental(r)"
                  @click="openSwap(r)"
                  class="p-1.5 hover:bg-violet-50 rounded text-slate-400 hover:text-violet-600 transition-colors" title="Ganti Unit">
                  <span class="material-symbols-outlined text-base">swap_horiz</span>
                </button>
                <button v-if="r.status === 'completed' && (!r.payout_id || r.payout_id === 0) && (!r.hotel_payout_id || r.hotel_payout_id === 0)"
                  @click="openEdit(r)"
                  class="p-1.5 hover:bg-blue-50 rounded text-slate-400 hover:text-blue-500 transition-colors" title="Edit">
                  <span class="material-symbols-outlined text-base">edit</span>
                </button>
                <button v-if="r.status === 'completed'" @click="openRefund(r)"
                  class="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors" title="Refund">
                  <span class="material-symbols-outlined text-base">undo</span>
                </button>
                <button
                  @click="deleteRental(r)"
                  class="p-1.5 rounded transition-colors hover:bg-red-50 text-slate-400 hover:text-red-500"
                  title="Hapus"
                >
                  <span class="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!loading && !filteredRentals.length">
            <td :colspan="tableColumnCount" class="px-6 py-12 text-center text-slate-400">Belum ada data rental</td>
          </tr>
        </tbody>
      </table>
      </div>
      <div v-if="!loading && filteredRentals.length" class="flex items-center justify-between border-t border-slate-100 px-6 py-4">
        <p class="text-xs text-slate-400">Menampilkan {{ pageStart }}-{{ pageEnd }} dari {{ filteredRentals.length }} data</p>
        <div class="flex items-center gap-2">
          <button @click="currentPage = Math.max(1, currentPage - 1)" :disabled="currentPage === 1" class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Prev</button>
          <span class="text-xs font-bold text-slate-500">Hal. {{ currentPage }} / {{ totalPages }}</span>
          <button @click="currentPage = Math.min(totalPages, currentPage + 1)" :disabled="currentPage === totalPages" class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>

    <!-- Add/Edit Rental Modal -->
    <n-modal v-model:show="showModal" preset="card" :title="editId ? 'Edit Rental' : 'Tambah Rental'" style="max-width: 560px" :auto-focus="false" :trap-focus="false">
      <form @submit.prevent="submitRental" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Tanggal & Waktu</label>
            <input v-model="form.date_time" type="datetime-local" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Nama Pelanggan</label>
            <input v-model="form.customer_name" type="text" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-bold text-slate-500 mb-1">Motor</label>
            <!-- Search box -->
            <div class="relative">
              <input
                v-model="motorSearch"
                type="text"
                placeholder="Cari model atau plat (contoh: DK 1234 AB)..."
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm pr-8"
                @focus="showMotorDropdown = true"
                @blur="onMotorBlur"
              />
              <span class="material-symbols-outlined absolute right-2 top-2 text-slate-400 text-base">search</span>
            </div>
            <!-- Dropdown hasil search -->
            <div v-if="showMotorDropdown && filteredMotors.length"
              class="border border-slate-200 rounded-lg mt-1 max-h-48 overflow-y-auto bg-white shadow-lg z-50 relative">
              <div
                v-for="m in filteredMotors" :key="m.id"
                @mousedown.prevent="selectMotor(m)"
                class="px-3 py-2.5 hover:bg-slate-50 cursor-pointer text-sm flex justify-between items-center"
              >
                <span class="font-medium">{{ m.model }}</span>
                <div class="text-right">
                  <span class="text-slate-400 text-xs font-mono block">{{ m.plate_number }}</span>
                  <span v-if="m.owner_name" class="text-slate-400 text-xs block">{{ m.owner_name }}</span>
                </div>
              </div>
            </div>
            <div v-if="showMotorDropdown && motorSearch && !filteredMotors.length"
              class="border border-slate-200 rounded-lg mt-1 px-3 py-2 text-sm text-slate-400 bg-white">
              Motor tidak ditemukan
            </div>
            <!-- Selected motor info -->
            <div v-if="selectedMotor" class="mt-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-sm flex justify-between">
              <span class="font-semibold text-primary">{{ selectedMotor.model }} · {{ selectedMotor.plate_number }}</span>
              <span class="text-slate-500 text-xs">{{ getSplitLabel(selectedMotor.type) }}{{ selectedMotor.owner_name ? ' · ' + selectedMotor.owner_name : '' }}</span>
            </div>
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-bold text-slate-500 mb-1">Hotel / Vendor Hotel</label>
            <div class="relative">
              <input
                v-model="form.hotel"
                type="text"
                placeholder="Ketik untuk mengisi teks biasa atau mencari nama hotel..."
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm pr-8"
                @input="form.hotel_id = null; form.vendor_fee = 0"
                @focus="showVendorDropdown = true"
                @blur="onVendorBlur"
              />
              <span class="material-symbols-outlined absolute right-2 top-2 text-slate-400 text-base">domain</span>
            </div>
            <!-- Dropdown hotel / vendor hotel -->
            <div v-if="showVendorDropdown && filteredVendors.length"
              class="border border-slate-200 rounded-lg mt-1 max-h-40 overflow-y-auto bg-white shadow-lg z-50 relative">
              <div
                v-for="h in filteredVendors" :key="h.id"
                @mousedown.prevent="selectVendor(h)"
                class="px-3 py-2.5 hover:bg-slate-50 cursor-pointer text-sm font-medium"
              >
                {{ h.name }}
              </div>
            </div>
            <!-- Selected Vendor Info -->
            <div v-if="form.hotel_id" class="mt-2 text-xs font-bold text-primary flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">check_circle</span>
              Terhubung ke data hotel yang terdaftar
            </div>
            <div v-else-if="form.hotel && form.vendor_fee > 0" class="mt-2 bg-amber-50 text-amber-600 rounded-lg border border-amber-200 px-3 py-2 text-xs flex items-center gap-1.5">
              <span class="material-symbols-outlined text-sm">warning</span>
              Nama ini belum ada di master data hotel. Fee vendor tidak akan masuk ke pencairan mana pun.
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Periode (hari)</label>
            <input v-model.number="form.period_days" type="number" min="1" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Harga Kotor</label>
            <input v-model.number="form.total_price" type="number" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div v-if="form.hotel_id">
            <label class="block text-xs font-bold text-slate-500 mb-1">Fee Vendor</label>
            <input v-model.number="form.vendor_fee" type="number" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-bold text-slate-500 mb-1">Metode Bayar</label>
            <div class="flex gap-3">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="form.payment_method" value="tunai" class="accent-primary" />
                <span class="text-sm font-medium">Tunai</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="form.payment_method" value="transfer" class="accent-primary" />
                <span class="text-sm font-medium">Transfer</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="form.payment_method" value="qris" class="accent-primary" />
                <span class="text-sm font-medium">QRIS</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="form.payment_method" value="debit_card" class="accent-primary" />
                <span class="text-sm font-medium">Debit Card</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Preview fee vendor -->
        <div v-if="selectedMotor && form.total_price"
          class="bg-slate-50 rounded-lg p-4 text-sm space-y-1.5 border border-slate-200">
          <div class="flex justify-between">
            <span class="text-slate-500">Harga Kotor</span>
            <span class="font-bold">{{ formatRp(form.total_price) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Fee Vendor</span>
            <span class="text-red-500">- {{ formatRp(form.vendor_fee || 0) }}</span>
          </div>
          <div class="flex justify-between border-t border-slate-200 pt-1.5">
            <span class="text-slate-500 font-bold">Nilai Bersih</span>
            <span class="font-bold">{{ formatRp(form.total_price - (form.vendor_fee || 0)) }}</span>
          </div>
          <div class="flex justify-between text-primary">
            <span>Wavy Gets ({{ getWavyPctLabel(selectedMotor.type) }})</span>
            <span class="font-bold">{{ formatRp(calcWavy()) }}</span>
          </div>
          <div class="flex justify-between text-slate-600">
            <span>Bagian Mitra ({{ `${Math.round(getOwnerPct(selectedMotor.type) * 100)}%` }})</span>
            <span class="font-bold">{{ formatRp(calcOwner()) }}</span>
          </div>
        </div>

        <p v-if="rentalError" class="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{{ rentalError }}</p>
        <div class="flex justify-end gap-3 pt-2">
          <button type="button" @click="showModal = false" class="btn-secondary">Batal</button>
          <button type="submit" :disabled="!form.motor_id" class="btn-primary disabled:opacity-50">Simpan</button>
        </div>
      </form>
    </n-modal>

    <!-- Extend Rental Modal -->
    <n-modal v-model:show="showExtendModal" preset="card" :title="extendModalTitle" style="max-width: 520px" :auto-focus="false" :trap-focus="false">
      <form @submit.prevent="submitExtend" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Tgl</label>
            <input v-model="extendForm.date_time" type="datetime-local" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Nama Pelanggan</label>
            <input v-model="extendForm.customer_name" type="text" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-bold text-slate-500 mb-1">DK Motor</label>
            <div class="relative">
              <input
                v-model="extendMotorSearch"
                type="text"
                placeholder="Cari DK motor (plat/model)..."
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm pr-8"
                @focus="showExtendMotorDropdown = true"
                @blur="onExtendMotorBlur"
              />
              <span class="material-symbols-outlined absolute right-2 top-2 text-slate-400 text-base">search</span>
            </div>
            <div v-if="showExtendMotorDropdown && filteredExtendMotors.length"
              class="border border-slate-200 rounded-lg mt-1 max-h-48 overflow-y-auto bg-white shadow-lg z-50 relative">
              <div
                v-for="m in filteredExtendMotors" :key="m.id"
                @mousedown.prevent="selectExtendMotor(m)"
                class="px-3 py-2.5 hover:bg-slate-50 cursor-pointer text-sm flex justify-between items-center"
              >
                <span class="font-medium">{{ m.model }}</span>
                <div class="text-right">
                  <span class="text-slate-400 text-xs font-mono block">{{ m.plate_number }}</span>
                  <span v-if="m.owner_name" class="text-slate-400 text-xs block">{{ m.owner_name }}</span>
                </div>
              </div>
            </div>
            <div v-if="showExtendMotorDropdown && extendMotorSearch && !filteredExtendMotors.length"
              class="border border-slate-200 rounded-lg mt-1 px-3 py-2 text-sm text-slate-400 bg-white">
              Motor tidak ditemukan
            </div>
            <div v-if="selectedExtendMotor" class="mt-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-sm flex justify-between">
              <span class="font-semibold text-primary">{{ selectedExtendMotor.model }} - {{ selectedExtendMotor.plate_number }}</span>
              <span class="text-slate-500 text-xs">{{ getSplitLabel(selectedExtendMotor.type) }}{{ selectedExtendMotor.owner_name ? ' - ' + selectedExtendMotor.owner_name : '' }}</span>
            </div>
          </div>
          <div class="col-span-2">
            <p class="text-xs text-slate-400">Vendor hotel tidak perlu diisi untuk transaksi extend.</p>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Periode (hari)</label>
            <input v-model.number="extendForm.period_days" type="number" min="1" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Harga Kotor</label>
            <input v-model.number="extendForm.total_price" type="number" min="1" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-bold text-slate-500 mb-1">Metode Pembayaran</label>
            <div class="flex gap-3 flex-wrap">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="extendForm.payment_method" value="tunai" class="accent-primary" />
                <span class="text-sm font-medium">Tunai</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="extendForm.payment_method" value="transfer" class="accent-primary" />
                <span class="text-sm font-medium">Transfer</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="extendForm.payment_method" value="qris" class="accent-primary" />
                <span class="text-sm font-medium">QRIS</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="extendForm.payment_method" value="debit_card" class="accent-primary" />
                <span class="text-sm font-medium">Debit Card</span>
              </label>
            </div>
          </div>
        </div>

        <div v-if="selectedExtendMotor && extendForm.total_price"
          class="bg-slate-50 rounded-lg p-4 text-sm space-y-1.5 border border-slate-200">
          <div class="flex justify-between">
            <span class="text-slate-500">Harga Kotor</span>
            <span class="font-bold">{{ formatRp(extendForm.total_price) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Fee Vendor</span>
            <span class="text-red-500">- {{ formatRp(extendForm.vendor_fee || 0) }}</span>
          </div>
          <div class="flex justify-between border-t border-slate-200 pt-1.5">
            <span class="text-slate-500 font-bold">Nilai Bersih</span>
            <span class="font-bold">{{ formatRp(extendForm.total_price - (extendForm.vendor_fee || 0)) }}</span>
          </div>
          <div class="flex justify-between text-primary">
            <span>Wavy Gets ({{ getWavyPctLabel(selectedExtendMotor.type) }})</span>
            <span class="font-bold">{{ formatRp(calcExtendWavy()) }}</span>
          </div>
          <div class="flex justify-between text-slate-600">
            <span>Bagian Mitra ({{ `${Math.round(getOwnerPct(selectedExtendMotor.type) * 100)}%` }})</span>
            <span class="font-bold">{{ formatRp(calcExtendOwner()) }}</span>
          </div>
        </div>

        <p v-if="extendError" class="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{{ extendError }}</p>
        <div class="flex justify-end gap-3 pt-2">
          <button type="button" @click="showExtendModal = false" class="btn-secondary">Batal</button>
          <button type="submit" class="btn-primary" :disabled="!extendForm.motor_id">{{ extendSubmitLabel }}</button>
        </div>
      </form>
    </n-modal>

    <!-- Swap Unit Modal -->
    <n-modal v-model:show="showSwapModal" preset="card" title="Ganti Unit Rental" style="max-width: 680px" :auto-focus="false" :trap-focus="false">
      <form @submit.prevent="submitSwap" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div v-if="!swapSourceLocked" class="col-span-2">
            <label class="block text-xs font-bold text-slate-500 mb-1">Transaksi Sumber</label>
            <input
              v-model="swapSourceKeyword"
              type="text"
              placeholder="Cari pelanggan, plat, model, atau invoice..."
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2"
            />
            <select v-model.number="swapForm.source_rental_id" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required>
              <option :value="null" disabled>{{ filteredSwapSourceOptions.length ? 'Pilih transaksi sumber' : 'Tidak ada transaksi yang cocok' }}</option>
              <option v-for="r in filteredSwapSourceOptions" :key="r.id" :value="r.id">{{ formatSwapSourceLabel(r) }} · {{ r.period_days }} hari · {{ formatRp(r.total_price) }}</option>
            </select>
            <p v-if="filteredSwapSourceOptions.length" class="text-xs text-slate-400 mt-1">Menampilkan {{ filteredSwapSourceOptions.length }} transaksi (terbaru di atas)</p>
          </div>
          <div v-else class="col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <p class="text-xs font-bold text-slate-500 mb-1">Transaksi Sumber</p>
            <p class="font-semibold text-slate-700">
              {{ selectedSwapSource ? `${formatSwapSourceLabel(selectedSwapSource)} · ${selectedSwapSource.period_days} hari · ${formatRp(selectedSwapSource.total_price)}` : '-' }}
            </p>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Tanggal Ganti Unit</label>
            <input v-model="swapForm.switch_date_time" type="datetime-local" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Sisa Hari Dialihkan</label>
            <input v-model.number="swapForm.remaining_days" type="number" min="1" :max="swapMaxRemainingDays" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Motor Pengganti</label>
            <input
              v-model="swapMotorKeyword"
              type="text"
              placeholder="Cari plat, model, atau pemilik..."
              class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2"
            />
            <select v-model="swapForm.new_motor_id" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required>
              <option value="" disabled>{{ filteredSwapMotorOptions.length ? 'Pilih motor pengganti' : 'Tidak ada motor yang cocok' }}</option>
              <option v-for="m in filteredSwapMotorOptions" :key="m.id" :value="m.id">{{ m.plate_number }} — {{ m.model }}</option>
            </select>
            <p v-if="filteredSwapMotorOptions.length" class="text-xs text-slate-400 mt-1">Menampilkan {{ filteredSwapMotorOptions.length }} motor (pilih manual)</p>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Harga Total Motor Pengganti</label>
            <input v-model.number="swapForm.new_total_price" type="number" min="1" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
            <p class="text-[11px] text-slate-400 mt-1">Isi total harga untuk sisa hari setelah ganti unit (bukan tarif per hari).</p>
          </div>
        </div>

        <div v-if="selectedSwapSource" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm space-y-2">
          <div class="flex justify-between gap-4">
            <span class="text-slate-500">Segmen Motor Awal (dipakai)</span>
            <span class="font-semibold text-slate-700">{{ swapUsedDays }} hari · {{ formatRp(swapUsedTotal) }}</span>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-slate-500">Kredit Sisa Hari Motor Awal</span>
            <span class="font-semibold text-slate-700">{{ formatRp(swapOldRemainingCredit) }}</span>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-slate-500">Biaya Motor Pengganti</span>
            <span class="font-semibold text-slate-700">{{ formatRp(swapNewTotal) }}</span>
          </div>
          <div class="flex justify-between gap-4 border-t border-slate-200 pt-2">
            <span class="font-semibold text-slate-600">Selisih Customer</span>
            <span class="font-black" :class="swapDelta > 0 ? 'text-emerald-600' : swapDelta < 0 ? 'text-red-600' : 'text-slate-600'">
              {{ swapDelta > 0 ? '+ ' : swapDelta < 0 ? '- ' : '' }}{{ formatRp(Math.abs(swapDelta)) }}
              <span v-if="swapDelta > 0" class="font-medium text-xs ml-1">(Top Up)</span>
              <span v-else-if="swapDelta < 0" class="font-medium text-xs ml-1">(Refund)</span>
              <span v-else class="font-medium text-xs ml-1">(Pas)</span>
            </span>
          </div>
        </div>

        <div v-if="swapDelta !== 0">
          <label class="block text-xs font-bold text-slate-500 mb-1">Metode Bayar Selisih</label>
          <select v-model="swapForm.settlement_payment_method" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required>
            <option value="" disabled>Pilih metode bayar selisih</option>
            <option v-for="account in cashAccounts" :key="account.id" :value="account.type">{{ account.name }}</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Catatan (Opsional)</label>
          <input v-model="swapForm.settlement_note" type="text" placeholder="Contoh: Scoopy rusak, diganti NMAX" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>

        <p v-if="swapError" class="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{{ swapError }}</p>

        <div class="flex justify-end gap-3 pt-2">
          <button type="button" @click="showSwapModal = false" class="btn-secondary">Batal</button>
          <button type="submit" class="btn-primary" :disabled="!swapForm.source_rental_id || !swapForm.new_motor_id">
            Proses Ganti Unit
          </button>
        </div>
      </form>
    </n-modal>

    <!-- Refund Modal -->
    <n-modal v-model:show="showRefundModal" preset="card" title="Proses Refund" style="max-width: 420px" :auto-focus="false" :trap-focus="false">
      <div class="space-y-4">
        <div class="bg-slate-50 rounded-lg p-4 text-sm">
          <p class="font-bold">{{ selectedRental?.customer_name }}</p>
          <p class="text-slate-500">{{ selectedRental?.model }} · {{ selectedRental?.plate_number }} · {{ selectedRental?.period_days }} hari</p>
          <p class="text-slate-500">Total: {{ formatRp(selectedRental?.total_price) }}</p>
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Sisa Hari yang Direfund</label>
          <input v-model.number="refundForm.remaining_days" type="number" min="1"
            :max="selectedRental?.period_days"
            class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Skema Refund</label>
          <select v-model="refundForm.percentage" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
            <option :value="100">100% dari sisa hari</option>
            <option :value="50">50% dari sisa hari</option>
            <option :value="0">Custom (input manual)</option>
          </select>
        </div>
        <div v-if="refundForm.percentage === 0">
          <label class="block text-xs font-bold text-slate-500 mb-1">Jumlah Refund (Rp)</label>
          <input v-model.number="refundForm.custom_amount" type="number" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-1">Alasan</label>
          <input v-model="refundForm.reason" type="text" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Opsional" />
        </div>
        <div class="bg-red-50 border border-red-100 rounded-lg p-3 text-sm flex justify-between">
          <span class="text-slate-500">Jumlah Refund</span>
          <span class="font-black text-red-600">{{ formatRp(calcRefundAmount()) }}</span>
        </div>
        <p v-if="refundError" class="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{{ refundError }}</p>
        <div class="flex justify-end gap-3">
          <button @click="showRefundModal = false" class="btn-secondary">Batal</button>
          <button @click="submitRefund" class="btn-primary !bg-red-600 hover:!bg-red-700">Proses Refund</button>
        </div>
      </div>
    </n-modal>

    <!-- Modal Konfirmasi Hapus -->
    <n-modal v-model:show="showDeleteConfirm" preset="card" title="Hapus Rental" style="max-width: 520px" :auto-focus="false" :trap-focus="false">
      <p class="text-sm text-slate-600 whitespace-pre-line">
        Hapus rental "{{ pendingDeleteRental?.customer_name }} - {{ pendingDeleteRental?.model }} ({{ pendingDeleteRental?.invoice_number || 'no invoice' }})"?
        
        Saldo kas akan dikembalikan. Tindakan ini tidak bisa dibatalkan.
      </p>
      <div class="flex justify-end gap-3 pt-5">
        <button type="button" class="btn-secondary" @click="showDeleteConfirm = false">Batal</button>
        <button type="button" class="btn-primary bg-red-600 hover:bg-red-700 border-red-600" @click="confirmDeleteRental">Hapus</button>
      </div>
    </n-modal>

    <!-- Modal Error Hapus -->
    <n-modal v-model:show="showDeleteErrorModal" preset="card" title="Tidak Bisa Hapus" style="max-width: 520px" :auto-focus="false" :trap-focus="false">
      <p class="text-sm text-slate-600 whitespace-pre-line">{{ deleteErrorMessage }}</p>
      <div class="flex justify-end pt-5">
        <button type="button" class="btn-primary" @click="showDeleteErrorModal = false">Tutup</button>
      </div>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { formatRp, formatDate, nowDateTime } from '../utils/format'
import { getOwnerPct, getSplitLabel, getWavyPct, getWavyPctLabel } from '../utils/motorType'
import { createPeriodFilter, getAvailableYears, getRecentRestorePeriod, syncPeriodRange } from '../utils/periodFilter'

function formatTime(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

const rentals = ref([])
const loading = ref(false)
const allMotors = ref([])
const allVendors = ref([])
const cashAccounts = ref([])
const showModal = ref(false)
const showRefundModal = ref(false)
const showExtendModal = ref(false)
const showSwapModal = ref(false)
const showDeleteConfirm = ref(false)
const showDeleteErrorModal = ref(false)
const pendingDeleteRental = ref(null)
const deleteErrorMessage = ref('')
const rentalError = ref('')
const extendError = ref('')
const swapSourceLocked = ref(false)
const swapSourceKeyword = ref('')
const swapMotorKeyword = ref('')
const activeRecordTab = ref('rental')
const payoutFilter = ref('unpaid') // Default: 'unpaid' (Belum Payout)
const extendActionLabel = computed(() => 'Tambah Extend')
const extendModalTitle = computed(() => 'Tambah Extend')
const extendSubmitLabel = computed(() => 'Simpan Extend')
const editId = ref(null)
const selectedRental = ref(null)
const selectedMotor = ref(null)
const motorSearch = ref('')
const showMotorDropdown = ref(false)
const extendMotorSearch = ref('')
const showExtendMotorDropdown = ref(false)
const showVendorDropdown = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)
const sortOrder = ref('oldest')
const highlightedRentalId = ref(null)

const availableYears = getAvailableYears()
function createDefaultFilters() {
  const initialPeriodFilter = getRecentRestorePeriod() || createPeriodFilter('month')
  return {
    periodMode: initialPeriodFilter.mode,
    periodMonth: initialPeriodFilter.month,
    periodYear: initialPeriodFilter.year,
    startDate: initialPeriodFilter.startDate,
    endDate: initialPeriodFilter.endDate,
    status: '',
    keyword: ''
  }
}
const filters = ref(createDefaultFilters())
const form = ref({
  date_time: nowDateTime(),
  customer_name: '',
  hotel: '',
  hotel_id: null,
  motor_id: '',
  period_days: 1,
  total_price: 0,
  vendor_fee: 0,
  payment_method: 'tunai'
})
const refundForm = ref({ remaining_days: 1, percentage: 100, custom_amount: 0, reason: '' })
const extendForm = ref({
  date_time: nowDateTime(),
  customer_name: '',
  hotel: '',
  hotel_id: null,
  motor_id: '',
  period_days: 1,
  total_price: 0,
  vendor_fee: 0,
  payment_method: 'tunai'
})
const swapForm = ref({
  source_rental_id: null,
  switch_date_time: nowDateTime(),
  remaining_days: 1,
  new_motor_id: '',
  new_total_price: 0,
  settlement_payment_method: '',
  settlement_note: ''
})
const refundError = ref('')
const swapError = ref('')

function rentalRelation(rental) {
  if (rental?.relation_type) return String(rental.relation_type)
  return Number(rental?.is_extension || 0) === 1 ? 'extend' : 'rental'
}

function hasRelatedTransactions(rental) {
  // Cek apakah rental ini punya transaksi ganti unit.
  if (!rental || !rental.id) return false
  if (!rentals.value || rentals.value.length === 0) return false
  return rentals.value.some(r => 
    r.parent_rental_id === rental.id && 
    r.relation_type === 'swap'
  )
}

function canSwapRental(rental) {
  const relation = rentalRelation(rental)
  // payout_id = 0 adalah legacy (belum dibayar), payout_id > 0 adalah sudah dibayar
  const notPaidOut = !rental.payout_id || rental.payout_id === 0
  const notHotelPaidOut = !rental.hotel_payout_id || rental.hotel_payout_id === 0
  
  const canSwap = rental.status === 'completed' &&
    notPaidOut &&
    notHotelPaidOut &&
    Number(rental.period_days || 0) > 1 &&
    (relation === 'rental' || relation === 'swap')
  
  // Debug log
  if (!canSwap && rental.status === 'completed') {
    console.log('[canSwapRental] Rental tidak bisa swap:', {
      id: rental.id,
      customer: rental.customer_name,
      status: rental.status,
      payout_id: rental.payout_id,
      hotel_payout_id: rental.hotel_payout_id,
      period_days: rental.period_days,
      relation: relation,
      reason: notPaidOut ? '' : 'sudah payout',
      reason2: notHotelPaidOut ? '' : 'sudah hotel payout',
      reason3: Number(rental.period_days || 0) > 1 ? '' : 'periode <= 1 hari',
      reason4: (relation === 'rental' || relation === 'swap') ? '' : 'relation bukan rental/swap'
    })
  }
  
  return canSwap
}

function canDeleteRental(rental) {
  return !rental?.payout_id && !rental?.hotel_payout_id
}

const filteredRentals = computed(() => {
  const byTab = rentals.value.filter(r => {
    const relation = rentalRelation(r)
    if (activeRecordTab.value === 'extend') return relation === 'extend'
    if (activeRecordTab.value === 'swap') return relation === 'swap' || relation === 'swap_source'
    return relation !== 'extend' && relation !== 'swap' && relation !== 'swap_source'
  })

  // Filter by payout status (hanya untuk tab rental)
  const byPayout = activeRecordTab.value === 'rental' ? byTab.filter(r => {
    if (payoutFilter.value === 'unpaid') {
      // Belum payout: payout_id = NULL atau 0
      return !r.payout_id || r.payout_id === 0
    }
    if (payoutFilter.value === 'paid') {
      // Sudah payout: payout_id > 0
      return r.payout_id && r.payout_id > 0
    }
    return true // 'all'
  }) : byTab

  const keyword = String(filters.value.keyword || '').toLowerCase().trim()
  const byKeyword = !keyword ? byPayout : byPayout.filter(r => {
    const customer = String(r.customer_name || '').toLowerCase()
    const plate = String(r.plate_number || '').toLowerCase()
    const model = String(r.model || '').toLowerCase()
    const invoice = String(r.invoice_number || '').toLowerCase()
    return customer.includes(keyword) || plate.includes(keyword) || model.includes(keyword) || invoice.includes(keyword)
  })

  return [...byKeyword].sort((a, b) => {
    const aTime = new Date(a.date_time).getTime()
    const bTime = new Date(b.date_time).getTime()
    if (aTime === bTime) {
      return sortOrder.value === 'oldest' ? Number(a.id || 0) - Number(b.id || 0) : Number(b.id || 0) - Number(a.id || 0)
    }
    return sortOrder.value === 'oldest' ? aTime - bTime : bTime - aTime
  })
})
const selectedExtendMotor = computed(() =>
  allMotors.value.find((m) => Number(m.id) === Number(extendForm.value.motor_id))
)
const swapSourceOptions = computed(() => {
  const options = rentals.value
    .filter((r) => canSwapRental(r))
    .sort((a, b) => new Date(b.date_time) - new Date(a.date_time))
  console.log('[Swap Options]', options.length, 'rentals available')
  return options
})
const filteredSwapSourceOptions = computed(() => {
  const keyword = String(swapSourceKeyword.value || '').toLowerCase().trim()
  if (!keyword) return swapSourceOptions.value
  return swapSourceOptions.value.filter((r) => {
    const customer = String(r.customer_name || '').toLowerCase()
    const plate = String(r.plate_number || '').toLowerCase()
    const model = String(r.model || '').toLowerCase()
    const invoice = String(r.invoice_number || '').toLowerCase()
    return customer.includes(keyword) || plate.includes(keyword) || model.includes(keyword) || invoice.includes(keyword)
  })
})
const selectedSwapSource = computed(() =>
  rentals.value.find((r) => Number(r.id) === Number(swapForm.value.source_rental_id))
)
const swapMaxRemainingDays = computed(() => {
  const source = selectedSwapSource.value
  if (!source) return 1
  return Math.max(1, Number(source.period_days || 1) - 1)
})
const swapUsedDays = computed(() => {
  const source = selectedSwapSource.value
  if (!source) return 0
  return Math.max(0, Number(source.period_days || 0) - Number(swapForm.value.remaining_days || 0))
})
const swapOldRemainingCredit = computed(() => {
  const source = selectedSwapSource.value
  if (!source) return 0
  const period = Number(source.period_days || 0)
  if (!period) return 0
  return Math.round(Number(source.total_price || 0) * (Number(swapForm.value.remaining_days || 0) / period))
})
const swapUsedTotal = computed(() => {
  const source = selectedSwapSource.value
  if (!source) return 0
  return Math.max(0, Math.round(Number(source.total_price || 0) - swapOldRemainingCredit.value))
})
const swapNewTotal = computed(() => {
  const remaining = Number(swapForm.value.remaining_days || 0)
  const total = Number(swapForm.value.new_total_price || 0)
  if (!remaining || !total) return 0
  return Math.round(total)
})
const swapDelta = computed(() => Math.round(swapNewTotal.value - swapOldRemainingCredit.value))
const swapMotorOptions = computed(() => {
  const source = selectedSwapSource.value
  if (!source) return allMotors.value
  return allMotors.value.filter((m) => Number(m.id) !== Number(source.motor_id))
})
const filteredSwapMotorOptions = computed(() => {
  const keyword = String(swapMotorKeyword.value || '').toLowerCase().trim()
  if (!keyword) return swapMotorOptions.value
  return swapMotorOptions.value.filter((m) => {
    const model = String(m.model || '').toLowerCase()
    const plate = String(m.plate_number || '').toLowerCase()
    const owner = String(m.owner_name || '').toLowerCase()
    return model.includes(keyword) || plate.includes(keyword) || owner.includes(keyword)
  })
})

const showHotelColumn = computed(() => activeRecordTab.value !== 'extend')
const showVendorFeeColumn = computed(() => activeRecordTab.value === 'rental')
const tableColumnCount = computed(() => {
  const baseColumnCount = 10 // without Hotel/Vendor and Fee Vendor
  return baseColumnCount + (showHotelColumn.value ? 1 : 0) + (showVendorFeeColumn.value ? 1 : 0)
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRentals.value.length / pageSize.value)))
const pagedRentals = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredRentals.value.slice(start, start + pageSize.value)
})
const pageStart = computed(() => filteredRentals.value.length ? ((currentPage.value - 1) * pageSize.value) + 1 : 0)
const pageEnd = computed(() => Math.min(currentPage.value * pageSize.value, filteredRentals.value.length))
const filteredRevenueTotal = computed(() => filteredRentals.value
  .filter((r) => String(r?.status || '').toLowerCase() !== 'refunded')
  .reduce((sum, rental) => sum + transactionNetAmount(rental), 0))
const activeRecordTabLabel = computed(() => ({
  rental: 'Transaksi Rental',
  extend: 'Extend',
  swap: 'Ganti Unit'
}[activeRecordTab.value] || 'Transaksi Rental'))

watch(() => filters.value.keyword, () => {
  currentPage.value = 1
})

watch(sortOrder, () => {
  currentPage.value = 1
})

watch(activeRecordTab, () => {
  currentPage.value = 1
  payoutFilter.value = 'unpaid' // Reset ke "Belum Payout" saat ganti tab
})

watch(pageSize, () => {
  currentPage.value = 1
})

watch(totalPages, (value) => {
  if (currentPage.value > value) currentPage.value = value
})

watch(() => swapForm.value.source_rental_id, (value) => {
  if (!value) return
  const source = rentals.value.find((r) => Number(r.id) === Number(value))
  if (!source) return
  swapForm.value.remaining_days = Math.max(1, Number(source.period_days || 1) - 1)
  swapForm.value.new_motor_id = ''
  swapMotorKeyword.value = ''
  // Default: samakan dengan kredit sisa hari agar selisih awal "pas"
  swapForm.value.new_total_price = swapOldRemainingCredit.value
  swapForm.value.settlement_payment_method = source.payment_method || ''
  swapForm.value.settlement_note = ''
})

// Filter motor by search (model atau plat)
const filteredMotors = computed(() => {
  if (!motorSearch.value) return allMotors.value.slice(0, 20)
  const q = motorSearch.value.toLowerCase().replace(/\s+/g, '')
  return allMotors.value.filter(m => {
    const model = m.model.toLowerCase().replace(/\s+/g, '')
    const plate = m.plate_number.toLowerCase().replace(/\s+/g, '')
    return model.includes(q) || plate.includes(q)
  }).slice(0, 20)
})

const filteredExtendMotors = computed(() => {
  if (!extendMotorSearch.value) return allMotors.value.slice(0, 20)
  const q = extendMotorSearch.value.toLowerCase().replace(/\s+/g, '')
  return allMotors.value.filter((m) => {
    const model = String(m.model || '').toLowerCase().replace(/\s+/g, '')
    const plate = String(m.plate_number || '').toLowerCase().replace(/\s+/g, '')
    return model.includes(q) || plate.includes(q)
  }).slice(0, 20)
})

function selectMotor(m) {
  selectedMotor.value = m
  form.value.motor_id = m.id
  motorSearch.value = `${m.model} - ${m.plate_number}`
  showMotorDropdown.value = false
}

function selectExtendMotor(m) {
  extendForm.value.motor_id = m.id
  extendMotorSearch.value = `${m.model} - ${m.plate_number}`
  showExtendMotorDropdown.value = false
}

function onMotorBlur() {
  setTimeout(() => { showMotorDropdown.value = false }, 150)
}

function onExtendMotorBlur() {
  setTimeout(() => { showExtendMotorDropdown.value = false }, 150)
}

const filteredVendors = computed(() => {
  if (!form.value.hotel || form.value.hotel_id) return allVendors.value.slice(0, 10)
  const q = form.value.hotel.toLowerCase()
  return allVendors.value.filter(v => v.name.toLowerCase().includes(q)).slice(0, 10)
})

function selectVendor(v) {
  form.value.hotel_id = v.id
  form.value.hotel = v.name
  showVendorDropdown.value = false
}

function onVendorBlur() {
  // Jika search tidak kosong tapi belum ngeklik, abaikan atau reset ID
  setTimeout(() => { showVendorDropdown.value = false }, 150)
}

function openAdd() {
  editId.value = null
  selectedMotor.value = null
  motorSearch.value = ''
  form.value = {
    date_time: nowDateTime(),
    customer_name: '',
    hotel: '',
    hotel_id: null,
    motor_id: '',
    period_days: 1,
    total_price: 0,
    vendor_fee: 0,
    payment_method: 'tunai'
  }
  showModal.value = true
}

function openEdit(rental) {
  editId.value = rental.id
  // Cari motor yang sesuai
  const motor = allMotors.value.find(m => m.id === rental.motor_id)
  selectedMotor.value = motor || null
  motorSearch.value = motor ? `${motor.model} - ${motor.plate_number}` : ''
  form.value = {
    date_time: rental.date_time,
    customer_name: rental.customer_name,
    hotel: rental.hotel || '',
    hotel_id: rental.hotel_id || null,
    motor_id: rental.motor_id,
    period_days: rental.period_days,
    total_price: rental.total_price,
    vendor_fee: rental.vendor_fee || 0,
    payment_method: rental.payment_method
  }
  showModal.value = true
}

function openExtend(rental) {
  extendError.value = ''
  const motor = allMotors.value.find((m) => Number(m.id) === Number(rental.motor_id))
  extendMotorSearch.value = motor ? `${motor.model} - ${motor.plate_number}` : ''
  showExtendMotorDropdown.value = false
  showExtendModal.value = true
  extendForm.value = {
    date_time: nowDateTime(),
    customer_name: rental.customer_name || '',
    hotel: '',
    hotel_id: null,
    motor_id: rental.motor_id,
    period_days: 1,
    total_price: 0,
    vendor_fee: 0,
    payment_method: rental.payment_method || 'tunai'
  }
}

function openExtendFromTab() {
  extendError.value = ''
  extendMotorSearch.value = ''
  showExtendMotorDropdown.value = false
  showExtendModal.value = true
  extendForm.value = {
    date_time: nowDateTime(),
    customer_name: '',
    hotel: '',
    hotel_id: null,
    motor_id: '',
    period_days: 1,
    total_price: 0,
    vendor_fee: 0,
    payment_method: 'tunai'
  }
}

function openSwap(rental) {
  swapError.value = ''
  swapSourceLocked.value = true
  swapSourceKeyword.value = ''
  swapMotorKeyword.value = ''
  const maxRemaining = Math.max(1, Number(rental?.period_days || 1) - 1)
  showSwapModal.value = true
  swapForm.value = {
    source_rental_id: rental?.id || null,
    switch_date_time: nowDateTime(),
    remaining_days: maxRemaining,
    new_motor_id: '',
    new_total_price: swapOldRemainingCredit.value,
    settlement_payment_method: rental?.payment_method || '',
    settlement_note: ''
  }
}

function openSwapFromTab() {
  swapError.value = ''
  swapSourceLocked.value = false
  swapSourceKeyword.value = ''
  swapMotorKeyword.value = ''
  showSwapModal.value = true
  swapForm.value = {
    source_rental_id: null,
    switch_date_time: nowDateTime(),
    remaining_days: 1,
    new_motor_id: '',
    new_total_price: 0,
    settlement_payment_method: '',
    settlement_note: ''
  }
}

function formatSwapSourceLabel(rental) {
  return `${formatDate(rental.date_time)} - ${rental.customer_name} - ${rental.plate_number}`
}

function swapNote(rental) {
  const note = String(rental?.swap_note || '').trim()
  return note || ''
}

function transactionNetAmount(rental) {
  const total = Number(rental?.total_price || 0)
  const vendorFee = Number(rental?.vendor_fee || 0)
  return Math.max(total - vendorFee, 0)
}

function paymentMethodLabelShort(method) {
  return {
    tunai: 'Tunai',
    transfer: 'Transfer',
    qris: 'QRIS',
    debit_card: 'Debit Card'
  }[String(method || '').toLowerCase()] || '-'
}

function swapSettlementLabel(rental) {
  const type = String(rental?.swap_settlement_type || '').toLowerCase()
  const amount = Number(rental?.swap_settlement_amount || 0)
  if (!amount || type === 'none') return ''
  const method = paymentMethodLabelShort(rental?.swap_settlement_payment_method)
  if (type === 'topup') return `Selisih dibayar customer: +${formatRp(amount)} (${method})`
  if (type === 'refund') return `Selisih refund ke customer: -${formatRp(amount)} (${method})`
  return ''
}

function displayPaymentMethod(rental) {
  const relation = rentalRelation(rental)
  if (relation === 'swap') {
    return rental?.swap_settlement_payment_method || rental?.payment_method
  }
  return rental?.payment_method
}

function paymentSummary(rental) {
  const relation = rentalRelation(rental)
  const total = Number(rental?.total_price || 0)
  if (relation === 'extend') {
    return `Bayar extend ${formatRp(total)}`
  }
  if (relation === 'swap') {
    const type = String(rental?.swap_settlement_type || '').toLowerCase()
    const amount = Number(rental?.swap_settlement_amount || 0)
    if (!amount || type === 'none') return 'Tidak ada selisih bayar'
    if (type === 'topup') return `Top up ${formatRp(amount)}`
    if (type === 'refund') return `Refund ${formatRp(amount)}`
  }
  if (relation === 'swap_source') {
    const type = String(rental?.swap_settlement_type || '').toLowerCase()
    const amount = Number(rental?.swap_settlement_amount || 0)
    if (!amount || type === 'none') return 'Ganti unit tanpa selisih'
    if (type === 'topup') return `Customer tambah ${formatRp(amount)}`
    if (type === 'refund') return `Customer refund ${formatRp(amount)}`
  }
  return ''
}

function parentLabel(rental) {
  const invoice = rental.parent_invoice_number ? `#${rental.parent_invoice_number}` : ''
  const plate = rental.parent_plate_number || ''
  const customer = rental.parent_customer_name || ''
  return [invoice, plate, customer].filter(Boolean).join(' · ')
}

async function goToParentRental(rental) {
  const parentId = Number(rental.parent_rental_id || 0)
  if (!parentId) return

  highlightedRentalId.value = parentId
  const parentRelation = String(rental.parent_relation_type || '').toLowerCase()
  if (parentRelation === 'swap' || parentRelation === 'swap_source') {
    activeRecordTab.value = 'swap'
  } else {
    activeRecordTab.value = 'rental'
  }
  const suggestedKeyword = rental.parent_invoice_number || rental.parent_plate_number || rental.parent_customer_name || ''
  filters.value.keyword = suggestedKeyword

  await nextTick()

  const el = document.getElementById(`rental-row-${parentId}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  setTimeout(() => {
    if (highlightedRentalId.value === parentId) highlightedRentalId.value = null
  }, 2200)
}

function statusBadge(s) {
  return { completed: 'badge-neutral', refunded: 'badge-error' }[s] || 'badge-neutral'
}

function paymentMethodLabel(method) {
  return {
    tunai: 'Tunai',
    transfer: 'Transfer',
    qris: 'QRIS',
    debit_card: 'Debit Card'
  }[method] || method || '-'
}

function paymentMethodBadge(method) {
  return method === 'tunai' ? 'badge-neutral' : 'badge-success'
}

function calcWavy() {
  if (!selectedMotor.value) return 0
  const sisa = form.value.total_price - (form.value.vendor_fee || 0)
  return sisa * getWavyPct(selectedMotor.value.type)
}

function calcOwner() {
  if (!selectedMotor.value) return 0
  const sisa = form.value.total_price - (form.value.vendor_fee || 0)
  return sisa * getOwnerPct(selectedMotor.value.type)
}

function calcExtendWavy() {
  if (!selectedExtendMotor.value) return 0
  const sisa = extendForm.value.total_price - (extendForm.value.vendor_fee || 0)
  return sisa * getWavyPct(selectedExtendMotor.value.type)
}

function calcExtendOwner() {
  if (!selectedExtendMotor.value) return 0
  const sisa = extendForm.value.total_price - (extendForm.value.vendor_fee || 0)
  return sisa * getOwnerPct(selectedExtendMotor.value.type)
}

function calcRefundAmount() {
  if (!selectedRental.value) return 0
  // Harga per hari = total / periode, lalu kalikan sisa hari
  const pricePerDay = selectedRental.value.total_price / selectedRental.value.period_days
  const base = refundForm.value.remaining_days * pricePerDay
  if (refundForm.value.percentage === 0) return refundForm.value.custom_amount
  return base * (refundForm.value.percentage / 100)
}

function getRentalPeriodFilter() {
  return {
    mode: filters.value.periodMode,
    month: filters.value.periodMonth,
    year: filters.value.periodYear,
    startDate: filters.value.startDate,
    endDate: filters.value.endDate
  }
}

function syncRentalPeriod() {
  const period = getRentalPeriodFilter()
  const range = syncPeriodRange(period)
  filters.value.periodMonth = period.month
  filters.value.periodYear = period.year
  filters.value.startDate = range.startDate
  filters.value.endDate = range.endDate
}

function buildRentalQueryFilters() {
  syncRentalPeriod()
  return {
    startDate: filters.value.startDate ? `${filters.value.startDate}T00:00:00` : '',
    endDate: filters.value.endDate ? `${filters.value.endDate}T23:59:59` : '',
    status: filters.value.status
  }
}

async function loadRentals() {
  loading.value = true
  try {
    rentals.value = await window.api.getRentals(buildRentalQueryFilters())
    currentPage.value = 1
  } finally {
    loading.value = false
  }
}

async function resetFilters() {
  filters.value = createDefaultFilters()
  currentPage.value = 1
  await loadRentals()
}

async function submitRental() {
  const vendorFee = form.value.vendor_fee || 0
  if (vendorFee < 0) {
    rentalError.value = 'Vendor fee tidak boleh negatif'
    return
  }
  if (vendorFee > form.value.total_price) {
    rentalError.value = 'Vendor fee tidak boleh melebihi total harga sewa'
    return
  }

  rentalError.value = ''
  if (editId.value) {
    await window.api.updateRental({ id: editId.value, ...form.value })
  } else {
    await window.api.createRental({ ...form.value, status: 'completed' })
  }
  showModal.value = false
  await loadRentals()
}

async function submitExtend() {
  extendError.value = ''
  if (!extendForm.value.motor_id) {
    extendError.value = 'DK motor wajib dipilih'
    return
  }
  if (!extendForm.value.period_days || extendForm.value.period_days < 1) {
    extendError.value = 'Periode minimal 1 hari'
    return
  }
  if (!extendForm.value.total_price || extendForm.value.total_price <= 0) {
    extendError.value = 'Total price harus lebih dari 0'
    return
  }
  const vendorFee = Number(extendForm.value.vendor_fee || 0)
  if (vendorFee < 0) {
    extendError.value = 'Vendor fee tidak boleh negatif'
    return
  }
  if (vendorFee > Number(extendForm.value.total_price || 0)) {
    extendError.value = 'Vendor fee tidak boleh melebihi total harga sewa'
    return
  }

  await window.api.extendRental({
    ...extendForm.value,
    hotel: '',
    hotel_id: null,
    vendor_fee: 0
  })
  showExtendModal.value = false
  await loadRentals()
}

async function submitSwap() {
  swapError.value = ''
  try {
    const source = selectedSwapSource.value
    if (!source) throw new Error('Transaksi sumber tidak ditemukan')
    const remainingDays = Number(swapForm.value.remaining_days || 0)
    if (!remainingDays || remainingDays < 1) throw new Error('Sisa hari minimal 1')
    if (remainingDays >= Number(source.period_days || 0)) throw new Error('Sisa hari harus lebih kecil dari periode sewa awal')
    if (!swapForm.value.new_motor_id) throw new Error('Motor pengganti wajib dipilih')
    if (!swapForm.value.switch_date_time) throw new Error('Tanggal ganti unit wajib diisi')
    const newTotalPrice = Number(swapForm.value.new_total_price || 0)
    if (!newTotalPrice || newTotalPrice <= 0) throw new Error('Harga total motor pengganti wajib diisi')
    if (swapDelta.value !== 0 && !swapForm.value.settlement_payment_method) {
      throw new Error('Metode bayar selisih wajib dipilih')
    }

    await window.api.swapRentalUnit({
      source_rental_id: Number(swapForm.value.source_rental_id),
      switch_date_time: swapForm.value.switch_date_time,
      remaining_days: remainingDays,
      new_motor_id: Number(swapForm.value.new_motor_id),
      new_total_price: newTotalPrice,
      settlement_payment_method: swapDelta.value === 0 ? null : swapForm.value.settlement_payment_method,
      settlement_note: swapForm.value.settlement_note || null
    })

    showSwapModal.value = false
    await loadRentals()
  } catch (err) {
    swapError.value = String(err?.message || err).replace("Error invoking remote method 'rental:swap-unit': Error: ", '')
  }
}

async function deleteRental(rental) {
  if (!canDeleteRental(rental)) {
    const steps = []
    if (rental?.payout_id) steps.push('Batalkan dulu pencairan hak mitra untuk transaksi ini.')
    if (rental?.hotel_payout_id) steps.push('Batalkan dulu pencairan fee vendor untuk transaksi ini.')
    const numberedSteps = steps.map((item, index) => `${index + 1}. ${item}`).join('\n')
    deleteErrorMessage.value = `Transaksi ini belum bisa dihapus.\n\nSilakan selesaikan dulu:\n${numberedSteps}\n\nSetelah itu, baru hapus transaksi ini.`
    showDeleteErrorModal.value = true
    return
  }

  pendingDeleteRental.value = rental
  showDeleteConfirm.value = true
}

async function confirmDeleteRental() {
  if (!pendingDeleteRental.value) return
  try {
    await window.api.deleteRental(pendingDeleteRental.value.id)
    showDeleteConfirm.value = false
    pendingDeleteRental.value = null
    await loadRentals()
  } catch (err) {
    showDeleteConfirm.value = false
    deleteErrorMessage.value = err.message.replace("Error invoking remote method 'rental:delete': Error: ", '')
    showDeleteErrorModal.value = true
  }
}

function openRefund(rental) {
  selectedRental.value = rental
  refundForm.value = { remaining_days: 1, percentage: 100, custom_amount: 0, reason: '' }
  refundError.value = ''
  showRefundModal.value = true
}

async function submitRefund() {
  refundError.value = ''
  try {
    await window.api.createRefund({
      rental_id: selectedRental.value.id,
      refund_percentage: refundForm.value.percentage || null,
      refund_amount: calcRefundAmount(),
      remaining_days: refundForm.value.remaining_days,
      reason: refundForm.value.reason
    })
    showRefundModal.value = false
    await loadRentals()
  } catch (err) {
    refundError.value = err.message.replace("Error invoking remote method 'refund:create': Error: ", '')
  }
}

onMounted(async () => {
  await loadRentals()
  allMotors.value = await window.api.getMotors()
  allVendors.value = await window.api.getHotels()
  cashAccounts.value = await window.api.getCashAccounts()
})
</script>
