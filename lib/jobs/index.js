import Scheduler from '../service/scheduler'
import notificationsTask from './notifications'

export default function initJobs() {
  // const notifications = new Scheduler(notificationsTask, 1000 * 30)
  const notifications = new Scheduler(notificationsTask, 1000 * 10)
  return {
    notifications,
  }
}
