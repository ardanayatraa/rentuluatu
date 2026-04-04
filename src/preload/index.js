import { contextBridge, ipcRenderer } from 'electron'

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args)

contextBridge.exposeInMainWorld('api', {
  login: (data) => invoke('auth:login', data),
  changePassword: (data) => invoke('auth:change-password', data),
  getMotors: () => invoke('motor:get-all'),
  getMotor: (id) => invoke('motor:get-by-id', id),
  createMotor: (data) => invoke('motor:create', data),
  updateMotor: (data) => invoke('motor:update', data),
  deleteMotor: (id) => invoke('motor:delete', id),
  getOwners: () => invoke('owner:get-all'),
  getOwner: (id) => invoke('owner:get-by-id', id),
  createOwner: (data) => invoke('owner:create', data),
  updateOwner: (data) => invoke('owner:update', data),
  deleteOwner: (id) => invoke('owner:delete', id),
  getOwnerCommission: (data) => invoke('owner:get-commission-summary', data),
  payoutOwner: (data) => invoke('owner:payout', data),
  getRentals: (filters) => invoke('rental:get-all', filters),
  getRental: (id) => invoke('rental:get-by-id', id),
  createRental: (data) => invoke('rental:create', data),
  updateRental: (data) => invoke('rental:update', data),
  completeRental: (id) => invoke('rental:complete', id),
  calculateRefund: (data) => invoke('refund:calculate', data),
  createRefund: (data) => invoke('refund:create', data),
  getExpenses: (filters) => invoke('expense:get-all', filters),
  createExpense: (data) => invoke('expense:create', data),
  deleteExpense: (id) => invoke('expense:delete', id),
  getCashAccounts: () => invoke('cash:get-accounts'),
  setCashOpeningBalance: (data) => invoke('cash:set-opening-balance', data),
  getCashTransactions: (filters) => invoke('cash:get-transactions', filters),
  getCashSummary: () => invoke('cash:get-summary'),
  addCashIncome: (data) => invoke('cash:add-income', data),
  addCashExpense: (data) => invoke('cash:add-expense', data),
  getReportSummary: (data) => invoke('report:summary', data),
  getMotorRanking: (data) => invoke('report:motor-ranking', data),
  getDailyReport: (data) => invoke('report:daily', data),
  // Dashboard
  getDashboardSummary: (data) => invoke('dashboard:summary', data),
  getDailyIncome: (data) => invoke('dashboard:daily-income', data),
  getDailyExpenses: (data) => invoke('dashboard:daily-expenses', data),
  getPaymentBreakdown: (data) => invoke('dashboard:payment-breakdown', data),
  getTopMotors: (data) => invoke('dashboard:top-motors', data),
  getExpenseCategories: (data) => invoke('dashboard:expense-categories', data),
  // System
  resetAllData: () => invoke('db:reset-all')
})
