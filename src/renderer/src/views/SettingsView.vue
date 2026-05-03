<template>
  <div>
    <div class="mb-8">
      <h2 class="page-title">Pengaturan</h2>
      <p class="text-slate-500 text-sm mt-1">Konfigurasi akun, lisensi, dan sistem</p>
    </div>

    <div class="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 w-fit">
      <button
        @click="settingsTab = 'general'"
        :class="settingsTab === 'general' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'"
        class="rounded-lg px-4 py-2 text-sm font-bold transition-colors"
      >
        Umum
      </button>
      <button
        @click="settingsTab = 'activity-log'"
        :class="settingsTab === 'activity-log' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
        class="rounded-lg px-4 py-2 text-sm font-bold transition-colors"
      >
        Log Admin
      </button>
      <button
        v-if="transactionResetStatus.visible"
        @click="settingsTab = 'reset-transactions'"
        :class="settingsTab === 'reset-transactions' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
        class="rounded-lg px-4 py-2 text-sm font-bold transition-colors"
      >
        Reset Transaksi
      </button>
      <button
        v-if="isDev"
        @click="settingsTab = 'sandbox'"
        :class="settingsTab === 'sandbox' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
        class="rounded-lg px-4 py-2 text-sm font-bold transition-colors"
      >
        Sandbox Dev
      </button>
    </div>

    <div v-if="settingsTab === 'general'" class="grid grid-cols-2 gap-6">

      <!-- ── KOLOM KIRI ── -->
      <div class="space-y-6">

        <!-- Info Aplikasi -->
        <div class="card">
          <div class="flex items-center gap-3 mb-4">
            <img src="../assets/logo.png" class="w-10 h-10 rounded-lg object-cover" />
            <div>
              <p class="font-bold text-slate-800 text-sm leading-tight">The Wavy Rental</p>
              <p class="text-xs text-slate-400">PT. Artha Bali Wisata</p>
            </div>
          </div>
          <div class="space-y-2 text-xs border-t border-slate-100 pt-3">
            <div class="flex justify-between">
              <span class="text-slate-400">Versi Aplikasi</span>
              <span class="font-semibold text-slate-700">{{ appVersion }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Operator</span>
              <span class="font-semibold text-slate-700">{{ auth.user?.username }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Status Data</span>
              <span class="font-semibold text-emerald-600 flex items-center gap-1">
                <span class="material-symbols-outlined text-[12px]">check_circle</span> Tersimpan Aman
              </span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 class="font-bold text-slate-700 text-sm flex items-center gap-2">
                <span class="material-symbols-outlined text-base text-slate-400">health_metrics</span>
                Audit Data
              </h3>
              <p class="text-xs text-slate-400 mt-1">Cek cepat apakah saldo kas, mutasi, payout, refund, dan hitungan transaksi masih konsisten.</p>
            </div>
            <div class="flex gap-2 shrink-0">
              <button @click="runSystemAudit" :disabled="auditLoading || auditFixing" class="btn-secondary text-xs px-3 py-1.5">
                <span class="material-symbols-outlined text-sm">fact_check</span>
                {{ auditLoading ? 'Mengecek...' : 'Cek Sekarang' }}
              </button>
              <button v-if="isDev" @click="runAuditAutoFix" :disabled="auditFixing || auditLoading" class="btn-primary text-xs px-3 py-1.5">
                <span class="material-symbols-outlined text-sm">build_circle</span>
                {{ auditFixing ? 'Memperbaiki...' : 'Perbaiki Otomatis' }}
              </button>
            </div>
          </div>

          <div
            v-if="auditResult"
            :class="auditResult.summary.ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'"
            class="mb-4 rounded-xl border px-4 py-3"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <p :class="auditResult.summary.ok ? 'text-emerald-700' : 'text-amber-700'" class="text-sm font-black">
                  {{ auditResult.summary.ok ? 'Data terlihat konsisten' : 'Ditemukan hal yang perlu dicek' }}
                </p>
                <p class="mt-1 text-xs text-slate-500">
                  Dicek {{ formatFileDate(auditResult.summary.checkedAt) }}
                </p>
              </div>
              <div class="text-right text-xs font-bold">
                <p class="text-red-500">{{ auditResult.summary.errors }} error</p>
                <p class="text-amber-600">{{ auditResult.summary.warnings }} warning</p>
              </div>
            </div>
          </div>

          <div v-if="auditResult" class="grid grid-cols-2 gap-3 mb-4">
            <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Semua Data Dicek</p>
              <p class="mt-2 text-sm font-black text-slate-700">
                {{ auditCheckedLabel }}
              </p>
            </div>
            <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Temuan</p>
              <p class="mt-2 text-sm font-black text-slate-700">
                {{ auditResult.summary.totalFindings }} item
              </p>
            </div>
          </div>

          <div v-if="auditError" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 mb-4">
            {{ auditError }}
          </div>

          <div v-if="auditFixMessage" class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700 mb-4">
            {{ auditFixMessage }}
          </div>

          <div v-if="auditResult?.findings?.length" class="space-y-2 max-h-72 overflow-y-auto">
            <div
              v-for="(finding, index) in auditResult.findings"
              :key="`${finding.category}-${index}`"
              class="rounded-xl border px-3 py-3"
              :class="finding.severity === 'error' ? 'border-red-200 bg-red-50/70' : 'border-amber-200 bg-amber-50/70'"
            >
              <div class="flex items-center gap-2 mb-1">
                <span
                  class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  :class="finding.severity === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'"
                >
                  {{ finding.severity }}
                </span>
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">{{ finding.category }}</span>
              </div>
              <p class="text-xs text-slate-700 leading-relaxed">{{ finding.message }}</p>
            </div>
          </div>

          <div v-else-if="auditResult && !auditResult.findings.length" class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
            Tidak ada temuan. Alur kas dan data inti terlihat sinkron.
          </div>
        </div>

        <!-- Lisensi -->
        <div class="card">
          <h3 class="font-bold text-slate-700 text-sm mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-base text-slate-400">verified</span>
            Lisensi
          </h3>

          <!-- Status -->
          <div class="rounded-lg px-3 py-2.5 text-xs font-bold flex items-center gap-2 mb-4"
            :class="{
              'bg-amber-50 text-amber-700 border border-amber-200': license.isTrial,
              'bg-emerald-50 text-emerald-700 border border-emerald-200': license.isLicensed,
              'bg-red-50 text-red-700 border border-red-200': license.isExpired,
              'bg-slate-50 text-slate-500 border border-slate-200': !license.isTrial && !license.isLicensed && !license.isExpired
            }">
            <span class="material-symbols-outlined text-sm">
              {{ license.isLicensed ? 'verified' : license.isTrial ? 'timer' : 'lock' }}
            </span>
            <span v-if="license.isTrial">Trial aktif — sisa {{ license.daysLeft }} hari</span>
            <span v-else-if="license.isLicensed">
              Aktif {{ license.licensedUntil === 'LIFETIME' ? '(Selamanya)' : '· hingga ' + license.licensedUntil }}
            </span>
            <span v-else>Tidak aktif / Kadaluarsa</span>
          </div>

          <!-- Machine ID -->
          <div class="mb-4">
            <p class="text-xs text-slate-400 mb-1">ID Perangkat (hubungi developer untuk aktivasi)</p>
            <p class="font-mono text-xs font-bold text-primary bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 tracking-widest break-all">
              {{ license.machineId }}
            </p>
          </div>

          <!-- Input aktivasi (hanya jika belum licensed) -->
          <template v-if="!license.isLicensed">
            <div class="border-t border-slate-100 pt-4">
              <label class="block text-xs font-bold text-slate-500 mb-1">Kode Aktivasi</label>
              <textarea v-model="activationCode" rows="2"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:border-primary"
                placeholder="WAVY-XXXX-XXXX-XXXX-XXXX|YYYY-MM-DD" />
              <p class="text-[10px] text-slate-400 mt-1">Format: SERIAL|TANGGAL (contoh: WAVY-A1B2-...|2027-01-01)</p>
              <p v-if="licenseError" class="text-xs text-red-600 mt-1.5">{{ licenseError }}</p>
              <p v-if="licenseSuccess" class="text-xs text-emerald-600 mt-1.5">{{ licenseSuccess }}</p>
              <button @click="handleActivate" :disabled="!activationCode.trim()"
                class="btn-primary w-full justify-center text-sm mt-3 disabled:opacity-50">
                Aktifkan Lisensi
              </button>
            </div>
          </template>
        </div>

        <!-- Ganti Password -->
        <div class="card">
          <h3 class="font-bold text-slate-700 text-sm mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-base text-slate-400">lock</span>
            Ganti Password
          </h3>
          <form @submit.prevent="changePassword" class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-500 mb-1">Password Lama</label>
              <input v-model="pwForm.oldPassword" type="password"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 mb-1">Password Baru</label>
              <input v-model="pwForm.newPassword" type="password"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 mb-1">Konfirmasi Password Baru</label>
              <input v-model="pwForm.confirmPassword" type="password"
                class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" required />
            </div>
            <p v-if="pwMessage" :class="pwSuccess ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-red-500 bg-red-50 border-red-100'"
              class="text-xs border rounded-lg px-3 py-2">{{ pwMessage }}</p>
            <button type="submit" class="btn-primary w-full justify-center text-sm">Simpan Password</button>
          </form>
        </div>

        <!-- Danger Zone Reset -->
        <div v-if="isDev" class="card border border-red-200 bg-red-50/30">
          <h3 class="font-bold text-red-600 text-sm mb-2 flex items-center gap-2">
            <span class="material-symbols-outlined text-base">warning</span> Reset Database
          </h3>
          <p class="text-xs text-red-400 mb-3">
            {{ isDev
              ? 'Hanya muncul saat development. Hapus semua data permanen.'
              : 'Mode production: tombol reset hanya bisa dipakai 1 kali di instalasi ini.' }}
          </p>
          <button @click="handleReset" :disabled="isResetting"
            class="btn-primary !bg-red-600 hover:!bg-red-700 w-full justify-center text-sm">
            <span class="material-symbols-outlined text-sm">{{ isResetting ? 'hourglass_empty' : 'delete_forever' }}</span>
            {{ isResetting ? 'Mereset...' : (isDev ? 'Hapus Semua Data' : 'Reset Data (1x)') }}
          </button>
        </div>

      </div>

      <!-- ── KOLOM KANAN ── -->
      <div class="space-y-6">

        <!-- Backup & Restore -->
        <div class="card">
          <h3 class="font-bold text-slate-700 text-sm mb-1 flex items-center gap-2">
            <span class="material-symbols-outlined text-base text-slate-400">backup</span>
            Backup & Restore
          </h3>
          <p class="text-xs text-slate-400 mb-5">Simpan checkpoint data ke lokal atau Google Drive</p>

          <div v-if="backupMessage"
            :class="backupSuccess ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'"
            class="text-xs px-3 py-2 rounded-lg border mb-4">{{ backupMessage }}</div>

          <!-- Enkripsi & Google Drive -->
          <div class="grid grid-cols-2 gap-3 mb-5">
            <div class="rounded-xl border border-slate-200 p-3 bg-slate-50">
              <div class="flex items-center justify-between mb-1.5">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-slate-500 text-sm">lock</span>
                  <span class="text-xs font-bold text-slate-700">Enkripsi</span>
                  <span class="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded">AES-256</span>
                </div>
                <button @click="showPassphraseForm = !showPassphraseForm"
                  class="text-[10px] text-primary font-semibold hover:underline">Ubah</button>
              </div>
              <p class="text-[10px] text-slate-400 leading-relaxed">Semua backup dienkripsi otomatis.</p>
              <div v-if="showPassphraseForm" class="mt-2 flex gap-1.5">
                <input v-model="newPassphrase" type="password" placeholder="Passphrase baru..."
                  class="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white" />
                <button @click="savePassphrase" :disabled="newPassphrase.length < 6"
                  class="btn-primary text-xs px-2 py-1">OK</button>
              </div>
            </div>

            <div class="rounded-xl border border-slate-200 p-3">
              <div class="flex items-center justify-between mb-1.5">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-slate-500 text-sm">cloud</span>
                  <span class="text-xs font-bold text-slate-700">Google Drive</span>
                </div>
                <span v-if="gdriveConnected"
                  class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span class="material-symbols-outlined text-[10px]">check_circle</span> Aktif
                </span>
                <span v-else class="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Belum</span>
              </div>
              <div v-if="!gdriveConfigured" class="text-[10px] text-amber-600 mb-1.5">Credentials belum dikonfigurasi.</div>
              <div v-if="!gdriveConnected">
                <button @click="connectGdrive" :disabled="backupLoading || !gdriveConfigured"
                  class="btn-secondary w-full justify-center text-xs py-1.5 mt-1">
                  {{ backupLoading ? 'Menunggu...' : 'Hubungkan' }}
                </button>
              </div>
              <div v-else class="flex gap-1.5 mt-1">
                <button @click="uploadToGdrive" :disabled="backupLoading"
                  class="btn-primary flex-1 justify-center text-xs py-1.5">
                  <span class="material-symbols-outlined text-sm">cloud_upload</span>
                  {{ backupLoading ? 'Upload...' : 'Upload' }}
                </button>
                <button @click="disconnectGdrive" class="btn-secondary text-xs px-2 py-1.5" title="Putuskan">
                  <span class="material-symbols-outlined text-sm">logout</span>
                </button>
              </div>
              <div class="mt-3 pt-3 border-t border-slate-100">
                <button
                  :disabled="true"
                  type="button"
                  class="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left disabled:opacity-60"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0">
                      <p class="text-[11px] font-bold text-slate-700">Backup otomatis saat tutup app dimatikan</p>
                      <p class="mt-1 text-[10px] text-slate-400 leading-relaxed">
                        Upload ke Google Drive tetap manual dari tombol Upload agar saat app ditutup tidak mengubah file Drive.
                      </p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <span
                        class="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-bold text-slate-500"
                      >
                        NONAKTIF
                      </span>
                      <span
                        class="relative inline-flex h-7 w-12 items-center rounded-full bg-slate-300 shadow-inner"
                      >
                        <span
                          class="inline-block h-5 w-5 translate-x-1 rounded-full bg-white shadow-sm"
                        />
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <!-- Tombol backup lokal -->
          <div class="flex gap-2 mb-4">
            <button @click="createLocalBackup" :disabled="backupLoading"
              class="btn-secondary flex-1 justify-center text-xs">
              <span class="material-symbols-outlined text-sm">save</span>
              {{ backupLoading ? 'Menyimpan...' : 'Buat Checkpoint Lokal' }}
            </button>
            <button @click="importExternalBackup" :disabled="backupLoading"
              class="btn-secondary flex-1 justify-center text-xs">
              <span class="material-symbols-outlined text-sm">upload_file</span>
              Import dari File
            </button>
            <button @click="loadBackupList" class="btn-secondary text-xs px-3" title="Refresh">
              <span class="material-symbols-outlined text-sm">refresh</span>
            </button>
          </div>

          <!-- Tab lokal / drive -->
          <div class="flex gap-1 mb-3 bg-slate-100 rounded-lg p-1">
            <button @click="backupTab = 'local'"
              :class="['flex-1 text-xs py-1.5 rounded-md font-semibold transition-colors',
                backupTab==='local' ? 'bg-white text-primary shadow-sm' : 'text-slate-500']">
              Lokal ({{ localBackups.length }})
            </button>
            <button @click="backupTab = 'drive'; loadDriveBackups()"
              :class="['flex-1 text-xs py-1.5 rounded-md font-semibold transition-colors',
                backupTab==='drive' ? 'bg-white text-primary shadow-sm' : 'text-slate-500']"
              :disabled="!gdriveConnected">
              Google Drive ({{ driveBackups.length }})
            </button>
          </div>

          <!-- List backup lokal -->
          <div v-if="backupTab === 'local'" class="space-y-1.5 max-h-64 overflow-y-auto">
            <div v-if="!localBackups.length" class="text-center py-8 text-slate-400 text-xs">
              Belum ada checkpoint lokal
            </div>
            <div v-for="b in localBackups" :key="b.name"
              class="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
              <div>
                <p class="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  {{ b.name }}
                  <span v-if="b.encrypted"
                    class="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1 rounded flex items-center gap-0.5">
                    <span class="material-symbols-outlined text-[10px]">lock</span> Enkripsi
                  </span>
                </p>
                <p class="text-[10px] text-slate-400">{{ formatFileDate(b.modifiedTime) }} · {{ formatSize(b.size) }}</p>
              </div>
              <div class="flex gap-2">
                <button @click="restoreLocal(b)"
                  class="text-xs text-primary font-bold hover:underline flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm">restore</span> Restore
                </button>
                <button @click="inspectLocalBackup(b)"
                  class="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm">visibility</span> Lihat Isi
                </button>
                <button @click="showLocalBackupInFolder(b)"
                  class="text-xs text-slate-500 font-bold hover:text-slate-700 flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm">folder_open</span> Show in Folder
                </button>
              </div>
            </div>
          </div>

          <!-- List backup drive -->
          <div v-if="backupTab === 'drive'" class="space-y-1.5 max-h-64 overflow-y-auto">
            <div v-if="driveLoading" class="text-center py-8 text-slate-400 text-xs">Memuat dari Drive...</div>
            <div v-else-if="!driveBackups.length" class="text-center py-8 text-slate-400 text-xs">
              Belum ada backup di Google Drive
            </div>
            <div v-for="b in driveBackups" :key="b.id"
              class="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
              <div>
                <p class="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  {{ b.name }}
                  <span v-if="b.name.endsWith('.wavy')"
                    class="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1 rounded flex items-center gap-0.5">
                    <span class="material-symbols-outlined text-[10px]">lock</span> Enkripsi
                  </span>
                </p>
                <p class="text-[10px] text-slate-400">{{ formatFileDate(b.modifiedTime) }} · {{ formatSize(b.size) }}</p>
              </div>
              <div class="flex gap-2">
                <button @click="restoreDrive(b)"
                  class="text-xs text-primary font-bold hover:underline flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm">cloud_download</span> Restore
                </button>
                <button @click="inspectDriveBackup(b)"
                  class="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm">visibility</span> Lihat Isi
                </button>
                <button @click="deleteDriveBackup(b)" class="text-xs text-red-400 hover:text-red-600">
                  <span class="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>

    <div v-else-if="settingsTab === 'activity-log'" class="space-y-6">
      <div class="card">
        <div class="grid grid-cols-5 gap-3 mb-4">
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Dari Tanggal</label>
            <input v-model="activityFilters.dateFrom" type="date" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Sampai Tanggal</label>
            <input v-model="activityFilters.dateTo" type="date" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Cari</label>
            <input v-model="activityFilters.search" type="text" placeholder="aksi / username" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-1">Sumber Log</label>
            <select v-model="activityFilters.source" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="user">User saja</option>
              <option value="system">System saja</option>
              <option value="">Semua</option>
            </select>
          </div>
          <div class="flex items-end gap-2">
            <button @click="loadActivityLogs({ resetPage: true })" :disabled="activityLoading" class="btn-primary text-xs px-3 py-2">
              <span class="material-symbols-outlined text-sm">refresh</span>
              {{ activityLoading ? 'Memuat...' : 'Muat Log' }}
            </button>
            <button @click="resetActivityFilters" class="btn-secondary text-xs px-3 py-2">Reset</button>
          </div>
        </div>

        <div v-if="activityError" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 mb-3">
          {{ activityError }}
        </div>

        <div class="rounded-xl border border-slate-200 overflow-hidden">
          <div class="grid grid-cols-12 bg-slate-100 px-4 py-2 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            <div class="col-span-3">Tanggal & Jam</div>
            <div class="col-span-2">Admin</div>
            <div class="col-span-3">Aksi</div>
            <div class="col-span-4">Keterangan</div>
          </div>
          <div v-if="activityLoading" class="px-4 py-6 text-xs text-slate-400">Memuat log aktivitas...</div>
          <div v-else-if="!activityLogs.length" class="px-4 py-6 text-xs text-slate-400">Belum ada log aktivitas.</div>
          <div v-else class="max-h-[28rem] overflow-y-auto divide-y divide-slate-100">
            <div v-for="item in activityLogs" :key="item.id" class="grid grid-cols-12 px-4 py-3 text-xs text-slate-700">
              <div class="col-span-3 font-semibold">{{ formatFileDate(item.created_at) }}</div>
              <div class="col-span-2">{{ item.actor_username || '-' }}</div>
              <div class="col-span-3 font-semibold text-indigo-700">
                <span
                  class="mr-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                  :class="item.source === 'user' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'"
                >
                  {{ item.source === 'user' ? 'USER' : 'SYSTEM' }}
                </span>
                {{ item.action }}
              </div>
              <div class="col-span-4">{{ item.detail || '-' }}</div>
            </div>
          </div>
        </div>

        <TablePagination
          v-model:page="activityPage"
          v-model:pageSize="activityPageSize"
          :total="activityTotal"
          :pageSizeOptions="[10,20,30,50]"
          :showPageSize="true"
          :disabled="activityLoading"
        />
      </div>
    </div>

    <div v-else-if="settingsTab === 'reset-transactions'" class="space-y-6">
      <div class="rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
        <div class="flex items-center gap-2 text-red-700">
          <span class="material-symbols-outlined text-base">history</span>
          <p class="text-sm font-black">Reset Transaksi (Mode Testing Admin)</p>
        </div>
        <p class="mt-1 text-xs text-red-600">
          Fitur ini hanya menghapus data transaksi. Data master seperti motor, pemilik, dan hotel tidak ikut dihapus.
        </p>
      </div>

      <div
        v-if="transactionResetMessage"
        :class="transactionResetSuccess ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'"
        class="rounded-xl border px-4 py-3 text-sm"
      >
        {{ transactionResetMessage }}
      </div>

      <div class="card border border-red-200 bg-red-50/40">
        <h3 class="font-bold text-red-700 text-sm mb-2 flex items-center gap-2">
          <span class="material-symbols-outlined text-base">warning</span> Reset Transaksi Saja
        </h3>
        <p class="text-xs text-red-500 mb-2">
          Masa aktif sampai: <span class="font-bold">{{ transactionResetExpiresLabel }}</span>
        </p>
        <p class="text-xs text-red-500 mb-4">
          Sisa waktu: <span class="font-bold">{{ transactionResetRemainingLabel }}</span>
        </p>
        <button
          @click="openTransactionResetModal"
          :disabled="transactionResetLoading || !transactionResetStatus.visible"
          class="btn-primary !bg-red-600 hover:!bg-red-700 w-full justify-center text-sm"
        >
          <span class="material-symbols-outlined text-sm">{{ transactionResetLoading ? 'hourglass_empty' : 'delete_sweep' }}</span>
          {{ transactionResetLoading ? 'Mereset...' : 'Reset Semua Transaksi' }}
        </button>
      </div>
    </div>

    <div v-else-if="isDev" class="space-y-6">
      <div class="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
        <div class="flex items-center gap-2 text-amber-800">
          <span class="material-symbols-outlined text-base">science</span>
          <p class="text-sm font-black">Sandbox Development</p>
        </div>
        <p class="mt-1 text-xs text-amber-700">Area khusus development untuk seed data, stress test ringan, dan benchmark cepat. Tidak tampil di production.</p>
      </div>

      <div v-if="sandboxMessage" :class="sandboxSuccess ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'" class="rounded-xl border px-4 py-3 text-sm">
        {{ sandboxMessage }}
      </div>

      <div class="grid grid-cols-3 gap-4">
        <div class="rounded-2xl border border-slate-200 bg-white p-4" v-for="item in sandboxStatCards" :key="item.table">
          <p class="text-xs font-bold uppercase tracking-wider text-slate-400">{{ item.label }}</p>
          <p class="mt-2 text-3xl font-black text-primary font-headline">{{ item.count.toLocaleString('id-ID') }}</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-6">
        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="font-bold text-slate-700 text-sm">Seed Data</h3>
              <p class="text-xs text-slate-400 mt-1">Tambahkan data simulasi operasional untuk uji performa dan laporan.</p>
            </div>
            <button @click="loadSandboxStats" class="btn-secondary text-xs px-3 py-1.5">
              <span class="material-symbols-outlined text-sm">refresh</span>
              Refresh
            </button>
          </div>
          <div class="grid grid-cols-2 gap-3 mb-4">
            <button v-for="preset in seedPresets" :key="preset.label" @click="runSandboxSeed(preset)" :disabled="sandboxLoading" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-primary/30 hover:bg-primary/5 disabled:opacity-50">
              <p class="text-sm font-black text-slate-800">{{ preset.label }}</p>
              <p class="mt-1 text-xs text-slate-400">{{ preset.rentalCount.toLocaleString('id-ID') }} rental • {{ preset.daysBack }} hari</p>
            </button>
          </div>
          <button
            @click="runProductionSeed"
            :disabled="sandboxLoading || productionSeedLoading"
            class="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left transition hover:bg-amber-100 disabled:opacity-60 mb-4">
            <p class="text-sm font-black text-amber-800">Seed Simulasi Prod (Fixed)</p>
            <p class="mt-1 text-xs text-amber-700">Gunakan dataset simulasi internal (owner, motor, daily record, extend, ganti motor).</p>
          </button>
          <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            Ukuran database saat ini: <span class="font-bold text-slate-700">{{ formatSize(sandboxStats.dbSizeBytes) }}</span>
          </div>
        </div>

        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="font-bold text-slate-700 text-sm">Benchmark Cepat</h3>
              <p class="text-xs text-slate-400 mt-1">Ukur respons query utama dashboard dan laporan.</p>
            </div>
            <button @click="runSandboxBenchmarks" :disabled="sandboxBenchmarkLoading" class="btn-primary text-xs px-3 py-1.5">
              <span class="material-symbols-outlined text-sm">speed</span>
              {{ sandboxBenchmarkLoading ? 'Menjalankan...' : 'Jalankan' }}
            </button>
          </div>
          <div class="space-y-3">
            <div v-for="row in benchmarkRows" :key="row.key" class="rounded-xl border border-slate-200 px-4 py-3">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-bold text-slate-700">{{ row.label }}</p>
                  <p class="text-xs text-slate-400">{{ row.desc }}</p>
                </div>
                <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{{ row.ms === null ? '-' : `${row.ms} ms` }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="card border border-red-200 bg-red-50/40">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h3 class="font-bold text-red-700 text-sm">Danger Zone Sandbox</h3>
            <p class="text-xs text-red-400 mt-1">Reset seluruh data sandbox. Hanya gunakan saat development.</p>
          </div>
          <button @click="handleReset" :disabled="isResetting" class="btn-primary !bg-red-600 hover:!bg-red-700 text-sm">
            <span class="material-symbols-outlined text-sm">delete_forever</span>
            Reset Sandbox
          </button>
        </div>
      </div>
    </div>

    <!-- Reset Modal -->
    <n-modal v-model:show="showResetModal" preset="card" title="Konfirmasi Reset" class="max-w-sm"
      :auto-focus="false" :trap-focus="false">
      <div class="space-y-4">
        <div class="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-bold border border-red-200">
          BAHAYA! Semua data akan dihapus permanen dan tidak bisa dikembalikan!
        </div>
        <p class="text-sm text-slate-600">Ketik <strong>RESET</strong> untuk konfirmasi:</p>
        <input v-model="resetConfirmText" type="text" placeholder="Ketik RESET"
          class="w-full border border-red-200 rounded-lg px-3 py-2 text-sm" />
        <div class="flex justify-end gap-3">
          <button @click="showResetModal = false" class="btn-secondary">Batal</button>
          <button @click="executeReset" :disabled="isResetting || resetConfirmText !== 'RESET'"
            class="btn-primary !bg-red-600 hover:!bg-red-700 disabled:opacity-50">
            Hapus Data
          </button>
        </div>
      </div>
    </n-modal>

    <n-modal v-model:show="showTransactionResetModal" preset="card" title="Konfirmasi Reset Transaksi" class="max-w-sm"
      :auto-focus="false" :trap-focus="false">
      <div class="space-y-4">
        <div class="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-bold border border-red-200">
          Semua transaksi akan dihapus dan tidak bisa dikembalikan. Data motor, pemilik, dan hotel tetap aman.
        </div>
        <p class="text-sm text-slate-600">Ketik <strong>RESET TRANSAKSI</strong> untuk konfirmasi:</p>
        <input v-model="transactionResetConfirmText" type="text" placeholder="Ketik RESET TRANSAKSI"
          class="w-full border border-red-200 rounded-lg px-3 py-2 text-sm" />
        <div class="flex justify-end gap-3">
          <button @click="showTransactionResetModal = false" class="btn-secondary">Batal</button>
          <button @click="executeTransactionReset" :disabled="transactionResetLoading || transactionResetConfirmText !== 'RESET TRANSAKSI'"
            class="btn-primary !bg-red-600 hover:!bg-red-700 disabled:opacity-50">
            Reset Transaksi
          </button>
        </div>
      </div>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useLicenseStore } from '../stores/license'
import TablePagination from '../components/TablePagination.vue'
import { rememberRestorePeriod } from '../utils/periodFilter'

const auth = useAuthStore()
const license = useLicenseStore()
const isDev = import.meta.env.DEV
const appVersion = import.meta.env.VITE_APP_VERSION || '1.0.0'
const settingsTab = ref('general')
const transactionResetStatus = ref({ visible: false, startedAt: null, expiresAt: null })
const showTransactionResetModal = ref(false)
const transactionResetConfirmText = ref('')
const transactionResetLoading = ref(false)
const transactionResetMessage = ref('')
const transactionResetSuccess = ref(true)
const activityLogs = ref([])
const activityTotal = ref(0)
const activityLoading = ref(false)
const activityError = ref('')
const activityPage = ref(1)
const activityPageSize = ref(20)
const activityFilters = ref({
  dateFrom: '',
  dateTo: '',
  search: '',
  source: 'user'
})

// ── Lisensi ──────────────────────────────────────────────────────────────────
const activationCode = ref('')
const licenseError = ref('')
const licenseSuccess = ref('')

async function handleActivate() {
  licenseError.value = ''
  licenseSuccess.value = ''
  try {
    const result = await window.api.activateLicense({ activationCode: activationCode.value })
    if (!result.success) { licenseError.value = result.message; return }
    await license.load()
    licenseSuccess.value = 'Lisensi berhasil diaktifkan!'
    activationCode.value = ''
  } catch (e) {
    licenseError.value = e.message
  }
}

// ── Password ─────────────────────────────────────────────────────────────────
const pwForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })
const pwMessage = ref('')
const pwSuccess = ref(false)

async function changePassword() {
  pwMessage.value = ''
  if (pwForm.value.newPassword !== pwForm.value.confirmPassword) {
    pwMessage.value = 'Password baru tidak cocok'; pwSuccess.value = false; return
  }
  const result = await window.api.changePassword({
    userId: auth.user.id,
    oldPassword: pwForm.value.oldPassword,
    newPassword: pwForm.value.newPassword
  })
  pwSuccess.value = result.success
  pwMessage.value = result.success ? 'Password berhasil diubah' : result.message
  if (result.success) pwForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
}

// ── Reset DB ──────────────────────────────────────────────────────────────────
const isResetting = ref(false)
const showResetModal = ref(false)
const resetConfirmText = ref('')
const productionReset = ref({ visible: false, used: false })
const productionSeedLoading = ref(false)
const productionSeedMessage = ref('')
const productionSeedSuccess = ref(true)
const auditLoading = ref(false)
const auditFixing = ref(false)
const auditError = ref('')
const auditFixMessage = ref('')
const auditResult = ref(null)

function handleReset() { resetConfirmText.value = ''; showResetModal.value = true }

async function executeReset() {
  if (resetConfirmText.value !== 'RESET') return
  try {
    isResetting.value = true
    if (isDev) {
      await window.api.resetAllData()
    } else {
      await window.api.resetProductionDataOnce()
      productionReset.value = { visible: false, used: true }
    }
    window.location.reload()
  } catch (err) {
    alert('Gagal mereset: ' + err.message)
  } finally {
    isResetting.value = false
    showResetModal.value = false
  }
}

async function loadTransactionResetStatus() {
  try {
    const status = await window.api.getTransactionResetStatus()
    transactionResetStatus.value = status
    if (!status.visible && settingsTab.value === 'reset-transactions') {
      settingsTab.value = 'general'
    }
  } catch {
    transactionResetStatus.value = { visible: false, startedAt: null, expiresAt: null }
  }
}

function openTransactionResetModal() {
  transactionResetConfirmText.value = ''
  showTransactionResetModal.value = true
}

async function executeTransactionReset() {
  if (transactionResetConfirmText.value !== 'RESET TRANSAKSI') return
  transactionResetLoading.value = true
  try {
    await window.api.resetTransactionsOnly()
    setTransactionResetMsg('Reset transaksi berhasil. Data transaksi sudah kembali ke nol.', true)
    await loadTransactionResetStatus()
    setTimeout(() => window.location.reload(), 700)
  } catch (error) {
    setTransactionResetMsg(`Reset transaksi gagal: ${error.message}`, false)
    await loadTransactionResetStatus()
  } finally {
    transactionResetLoading.value = false
    showTransactionResetModal.value = false
  }
}

// ── Backup ────────────────────────────────────────────────────────────────────
async function loadActivityLogs({ resetPage = false } = {}) {
  if (resetPage && activityPage.value !== 1) {
    activityPage.value = 1
    return
  }
  activityLoading.value = true
  activityError.value = ''
  try {
    const result = await window.api.getActivityLogs({
      ...activityFilters.value,
      page: activityPage.value,
      pageSize: activityPageSize.value
    })
    if (Array.isArray(result)) {
      activityLogs.value = result
      activityTotal.value = result.length
    } else {
      activityLogs.value = Array.isArray(result?.items) ? result.items : []
      activityTotal.value = Number(result?.total || 0)
    }
  } catch (error) {
    activityLogs.value = []
    activityTotal.value = 0
    activityError.value = `Gagal memuat log aktivitas: ${error.message}`
  } finally {
    activityLoading.value = false
  }
}

function resetActivityFilters() {
  activityFilters.value = { dateFrom: '', dateTo: '', search: '', source: 'user' }
  loadActivityLogs({ resetPage: true })
}

watch([activityPage, activityPageSize], () => {
  loadActivityLogs()
})

const gdriveConnected = ref(false)
const gdriveConfigured = ref(false)
const backupLoading = ref(false)
const driveLoading = ref(false)
const backupMessage = ref('')
const backupSuccess = ref(false)
const backupTab = ref('local')
const localBackups = ref([])
const driveBackups = ref([])
const showPassphraseForm = ref(false)
const newPassphrase = ref('')
const sandboxLoading = ref(false)
const sandboxBenchmarkLoading = ref(false)
const sandboxMessage = ref('')
const sandboxSuccess = ref(true)
const sandboxStats = ref({ counts: [], dbSizeBytes: 0 })
const benchmarkRows = ref([
  { key: 'dashboardSummary', label: 'Dashboard Summary', desc: 'Ringkasan utama dashboard', ms: null },
  { key: 'dailyIncome', label: 'Grafik Pemasukan', desc: 'Dataset pemasukan harian', ms: null },
  { key: 'transactionsReport', label: 'Laporan Transaksi', desc: 'Semua transaksi periode 30 hari', ms: null },
  { key: 'motorIncomeReport', label: 'Pendapatan Motor', desc: 'Laporan pendapatan per motor 30 hari', ms: null }
])
const seedPresets = [
  { label: 'Seed 100', rentalCount: 100, daysBack: 60 },
  { label: 'Seed 1.000', rentalCount: 1000, daysBack: 365 },
  { label: 'Seed 5.000', rentalCount: 5000, daysBack: 730 },
  { label: 'Seed 10.000', rentalCount: 10000, daysBack: 1095 }
]

const sandboxStatCards = computed(() => sandboxStats.value.counts.slice(0, 6))

function setMsg(msg, ok = true) {
  backupMessage.value = msg; backupSuccess.value = ok
  setTimeout(() => { backupMessage.value = '' }, 5000)
}

function setSandboxMsg(msg, ok = true) {
  sandboxMessage.value = msg
  sandboxSuccess.value = ok
  setTimeout(() => { sandboxMessage.value = '' }, 5000)
}

function setTransactionResetMsg(msg, ok = true) {
  transactionResetMessage.value = msg
  transactionResetSuccess.value = ok
  setTimeout(() => { transactionResetMessage.value = '' }, 5000)
}

function formatFileDate(iso) {
  return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatSize(bytes) {
  if (!bytes) return '-'
  const kb = Number(bytes) / 1024
  return kb > 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb.toFixed(0) + ' KB'
}

function formatBackupCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(value || 0))
}

function buildBackupSummaryLines(name, summary) {
  const s = summary || {}
  return [
    `File: ${name}`,
    `Motor: ${s.motors ?? 0}`,
    `Mitra/Owner: ${s.owners ?? 0}`,
    `Hotel/Vendor: ${s.hotels ?? 0}`,
    `Rental: ${s.rentals ?? 0}`,
    `Ganti Unit: ${s.rentalSwaps ?? 0}`,
    `Refund: ${s.refunds ?? 0}`,
    `Payout Mitra: ${s.payouts ?? 0}`,
    `Payout Vendor: ${s.hotelPayouts ?? 0}`,
    `Pengeluaran: ${s.expenses ?? 0}`,
    `Mutasi Kas: ${s.cashTransactions ?? 0}`,
    `Periode Rental: ${s.rentalsMinDate || '-'} s/d ${s.rentalsMaxDate || '-'}`,
    `Total Rental: ${formatBackupCurrency(s.rentalTotal)}`,
    `Total Pengeluaran: ${formatBackupCurrency(s.expenseTotal)}`,
    `Total Payout Vendor: ${formatBackupCurrency(s.hotelPayoutTotal)}`,
    `Total Payout Mitra: ${formatBackupCurrency(s.payoutTotal)}`
  ]
}

const transactionResetExpiresLabel = computed(() => {
  if (!transactionResetStatus.value.expiresAt) return '-'
  return formatFileDate(transactionResetStatus.value.expiresAt)
})

const transactionResetRemainingLabel = computed(() => {
  const expiresAt = transactionResetStatus.value.expiresAt
  if (!expiresAt) return '-'
  const delta = new Date(expiresAt).getTime() - Date.now()
  if (delta <= 0) return 'Sudah berakhir'
  const totalHours = Math.floor(delta / (1000 * 60 * 60))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  if (days > 0) return `${days} hari ${hours} jam`
  return `${Math.max(1, hours)} jam`
})

const auditCheckedLabel = computed(() => {
  const checked = auditResult.value?.summary?.checked
  if (!checked) return '-'
  return [
    `${checked.cashAccounts || 0} akun kas`,
    `${checked.rentals || 0} rental`,
    `${checked.expenses || 0} pengeluaran`,
    `${checked.refunds || 0} refund`
  ].join(' · ')
})

async function runSystemAudit() {
  auditLoading.value = true
  auditError.value = ''
  auditFixMessage.value = ''
  try {
    auditResult.value = await window.api.runSystemAudit()
  } catch (error) {
    auditError.value = `Audit gagal dijalankan: ${error.message}`
  } finally {
    auditLoading.value = false
  }
}

function setProductionSeedMsg(message, ok = true) {
  productionSeedMessage.value = message
  productionSeedSuccess.value = ok
  setTimeout(() => {
    productionSeedMessage.value = ''
  }, 5000)
}

async function runProductionSeed() {
  productionSeedLoading.value = true
  try {
    const result = await window.api.seedProdSimulationData()
    const added = result.stats?.addedMasters || {}
    const successMsg = `Seed simulasi prod selesai: ${result.stats?.rentalSeeded?.toLocaleString('id-ID') || 0} rental, +${(added.owners || 0).toLocaleString('id-ID')} mitra, +${(added.hotels || 0).toLocaleString('id-ID')} hotel, +${(added.motors || 0).toLocaleString('id-ID')} motor.`
    setProductionSeedMsg(successMsg)
    if (isDev) setSandboxMsg(successMsg, true)
  } catch (error) {
    setProductionSeedMsg(`Seed simulasi prod gagal: ${error.message}`, false)
    if (isDev) setSandboxMsg(`Seed simulasi prod gagal: ${error.message}`, false)
  } finally {
    productionSeedLoading.value = false
  }
}

async function runAuditAutoFix() {
  if (!isDev) return
  auditFixing.value = true
  auditError.value = ''
  auditFixMessage.value = ''
  try {
    const result = await window.api.autoFixSystemAudit()
    auditResult.value = result.report
    auditFixMessage.value = result.fixedCount > 0
      ? `Perbaikan otomatis selesai. ${result.fixedCount} penyesuaian diterapkan.`
      : 'Perbaikan otomatis selesai. Tidak ada penyesuaian yang perlu diterapkan.'
  } catch (error) {
    auditError.value = `Perbaikan otomatis gagal: ${error.message}`
  } finally {
    auditFixing.value = false
  }
}

async function savePassphrase() {
  try {
    await window.api.backupSetPassphrase({ passphrase: newPassphrase.value })
    showPassphraseForm.value = false; newPassphrase.value = ''
    setMsg('Passphrase berhasil diperbarui.')
  } catch (e) { setMsg(e.message, false) }
}

async function checkGdriveStatus() {
  const status = await window.api.backupGdriveStatus()
  gdriveConnected.value = status.connected
  gdriveConfigured.value = status.configured
}

async function loadBackupList() {
  localBackups.value = await window.api.backupListLocal()
}

async function loadDriveBackups() {
  if (!gdriveConnected.value) return
  driveLoading.value = true
  try { driveBackups.value = await window.api.backupGdriveList() }
  catch (e) {
    if (String(e.message || '').includes('Sesi Google Drive')) {
      gdriveConnected.value = false
      driveBackups.value = []
    }
    setMsg('Gagal memuat dari Drive: ' + e.message, false)
  }
  finally { driveLoading.value = false }
}

async function connectGdrive() {
  backupLoading.value = true
  try { await window.api.backupGdriveConnect(); gdriveConnected.value = true; setMsg('Google Drive berhasil terhubung!') }
  catch (e) { setMsg('Gagal: ' + e.message, false) }
  finally { backupLoading.value = false }
}

async function disconnectGdrive() {
  await window.api.backupGdriveDisconnect()
  gdriveConnected.value = false; driveBackups.value = []
  setMsg('Google Drive diputus.')
}

async function createLocalBackup() {
  backupLoading.value = true
  try { const res = await window.api.backupCreateLocal(); await loadBackupList(); setMsg(`Checkpoint disimpan: ${res.filename}`) }
  catch (e) { setMsg(e.message, false) }
  finally { backupLoading.value = false }
}

async function importExternalBackup() {
  backupLoading.value = true
  try {
    const result = await window.api.backupImportLocal()
    if (result?.canceled) return
    await loadBackupList()
    const skippedCount = Array.isArray(result?.skipped) ? result.skipped.length : 0
    const importedCount = Array.isArray(result?.imported) ? result.imported.length : 0
    const suffix = skippedCount > 0 ? ` (${skippedCount} file dilewati)` : ''
    setMsg(`Import selesai: ${importedCount} file berhasil.${suffix}`)
  } catch (e) {
    setMsg('Import backup gagal: ' + e.message, false)
  } finally {
    backupLoading.value = false
  }
}

async function uploadToGdrive() {
  backupLoading.value = true
  try { const res = await window.api.backupGdriveUpload(); setMsg(`Berhasil upload: ${res.filename}`); if (backupTab.value === 'drive') await loadDriveBackups() }
  catch (e) { setMsg('Upload gagal: ' + e.message, false) }
  finally { backupLoading.value = false }
}

async function restoreLocal(backup) {
  backupLoading.value = true
  try {
    const inspect = await window.api.backupInspectLocal({ path: backup.path })
    const summaryText = buildBackupSummaryLines(backup.name, inspect?.summary).join('\n')
    if (!confirm(`${summaryText}\n\nRestore backup ini?\nData saat ini akan diganti, dan safety backup akan dibuat dulu.`)) return
    const result = await window.api.backupRestoreLocal({ path: backup.path })
    rememberRestorePeriod(result?.summary)
    await refreshAfterRestore()
    setMsg(`Restore berhasil. Safety backup: ${result.safetyBackupName || '-'}. Aplikasi akan memuat ulang data.`)
    scheduleReloadAfterRestore()
  }
  catch (e) { setMsg('Restore gagal: ' + e.message, false) }
  finally { backupLoading.value = false }
}

async function showLocalBackupInFolder(backup) {
  try {
    await window.api.backupShowLocalInFolder({ path: backup.path })
  } catch (e) {
    setMsg('Gagal membuka folder backup: ' + e.message, false)
  }
}

async function inspectLocalBackup(backup) {
  backupLoading.value = true
  try {
    const result = await window.api.backupInspectLocal({ path: backup.path })
    alert(buildBackupSummaryLines(backup.name, result?.summary).join('\n'))
  } catch (e) {
    setMsg('Gagal membaca isi backup: ' + e.message, false)
  } finally {
    backupLoading.value = false
  }
}

async function restoreDrive(backup) {
  backupLoading.value = true
  try {
    const inspect = await window.api.backupGdriveInspect({ fileId: backup.id, fileName: backup.name })
    const summaryText = buildBackupSummaryLines(backup.name, inspect?.summary).join('\n')
    if (!confirm(`${summaryText}\n\nRestore backup Drive ini?\nData saat ini akan diganti, dan safety backup akan dibuat dulu.`)) return
    const result = await window.api.backupGdriveRestore({ fileId: backup.id, fileName: backup.name })
    rememberRestorePeriod(result?.summary)
    await refreshAfterRestore()
    setMsg(`Restore berhasil. Safety backup: ${result.safetyBackupName || '-'}. Aplikasi akan memuat ulang data.`)
    scheduleReloadAfterRestore()
  }
  catch (e) { setMsg('Restore gagal: ' + e.message, false) }
  finally { backupLoading.value = false }
}

async function inspectDriveBackup(backup) {
  backupLoading.value = true
  try {
    const result = await window.api.backupGdriveInspect({ fileId: backup.id, fileName: backup.name })
    alert(buildBackupSummaryLines(backup.name, result?.summary).join('\n'))
  } catch (e) {
    setMsg('Gagal membaca isi backup Drive: ' + e.message, false)
  } finally {
    backupLoading.value = false
  }
}

async function refreshAfterRestore() {
  await loadBackupList()
  await loadActivityLogs({ resetPage: true })
  await runSystemAudit()
  if (gdriveConnected.value) {
    try {
      await loadDriveBackups()
    } catch {
      // ignore
    }
  }
}

function scheduleReloadAfterRestore() {
  setTimeout(() => window.location.reload(), 900)
}

async function deleteDriveBackup(backup) {
  if (!confirm(`Hapus backup "${backup.name}" dari Drive?`)) return
  try { await window.api.backupGdriveDelete({ fileId: backup.id, fileName: backup.name }); driveBackups.value = driveBackups.value.filter(b => b.id !== backup.id); setMsg('Backup dihapus.') }
  catch (e) { setMsg('Gagal hapus: ' + e.message, false) }
}

async function loadSandboxStats() {
  if (!isDev) return
  try {
    sandboxStats.value = await window.api.getDevSandboxStats()
  } catch (error) {
    setSandboxMsg(`Gagal memuat statistik sandbox: ${error.message}`, false)
  }
}

async function runSandboxSeed(preset) {
  sandboxLoading.value = true
  try {
    const result = await window.api.seedDevSandboxData(preset)
    sandboxStats.value = result.stats
    const added = result.stats?.addedMasters || {}
    setSandboxMsg(
      `Seed selesai: ${result.rentalCount.toLocaleString('id-ID')} rental, +${(added.owners || 0).toLocaleString('id-ID')} mitra, +${(added.hotels || 0).toLocaleString('id-ID')} hotel, +${(added.motors || 0).toLocaleString('id-ID')} motor.`
    )
  } catch (error) {
    setSandboxMsg(`Seed gagal: ${error.message}`, false)
  } finally {
    sandboxLoading.value = false
  }
}

function dateRangeDays(days) {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - days + 1)
  const toDate = (value) => value.toISOString().split('T')[0]
  return {
    short: { startDate: toDate(start), endDate: toDate(end) },
    full: { startDate: `${toDate(start)}T00:00:00`, endDate: `${toDate(end)}T23:59:59` }
  }
}

async function benchmark(labelKey, runner) {
  const startedAt = performance.now()
  await runner()
  const elapsed = Math.round(performance.now() - startedAt)
  benchmarkRows.value = benchmarkRows.value.map((row) => row.key === labelKey ? { ...row, ms: elapsed } : row)
}

async function runSandboxBenchmarks() {
  sandboxBenchmarkLoading.value = true
  const range = dateRangeDays(30)
  try {
    await benchmark('dashboardSummary', () => window.api.getDashboardSummary(range.full))
    await benchmark('dailyIncome', () => window.api.getDailyIncome(range.full))
    await benchmark('transactionsReport', () => window.api.getTransactionsReport(range.short))
    await benchmark('motorIncomeReport', () => window.api.getMotorIncomeReport(range.short))
    setSandboxMsg('Benchmark sandbox selesai dijalankan.')
  } catch (error) {
    setSandboxMsg(`Benchmark gagal: ${error.message}`, false)
  } finally {
    sandboxBenchmarkLoading.value = false
  }
}

onMounted(async () => {
  await license.load()
  await checkGdriveStatus()
  await loadBackupList()
  await runSystemAudit()
  await loadTransactionResetStatus()
  await loadActivityLogs()
  if (!isDev) {
    try {
      productionReset.value = await window.api.getProductionResetStatus()
    } catch {
      productionReset.value = { visible: false, used: false }
    }
  }
  if (isDev) await loadSandboxStats()
})
</script>
