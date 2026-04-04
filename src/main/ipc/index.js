import { registerMotorHandlers } from './motors'
import { registerOwnerHandlers } from './owners'
import { registerRentalHandlers } from './rentals'
import { registerExpenseHandlers } from './expenses'
import { registerCashHandlers } from './cash'
import { registerRefundHandlers } from './refunds'
import { registerAuthHandlers } from './auth'
import { registerReportHandlers } from './reports'
import { registerDashboardHandlers } from './dashboard'
import { registerResetHandlers } from './reset'

export function registerAllHandlers() {
  registerAuthHandlers()
  registerMotorHandlers()
  registerOwnerHandlers()
  registerRentalHandlers()
  registerExpenseHandlers()
  registerCashHandlers()
  registerRefundHandlers()
  registerReportHandlers()
  registerDashboardHandlers()
  registerResetHandlers()
}
