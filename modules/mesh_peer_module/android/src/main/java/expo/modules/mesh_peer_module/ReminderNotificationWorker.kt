package expo.modules.mesh_peer_module

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.Worker
import androidx.work.WorkerParameters
import android.icu.util.Calendar
import android.util.Log

class ReminderNotificationWorker(context: Context,  params: WorkerParameters): Worker(context, params) {

    companion object {
        fun millisecondsUntilReminder(): Long {
            val targetCalendar = Calendar.getInstance().apply {
                set(Calendar.YEAR, 2025)
                set(Calendar.MONTH, Calendar.NOVEMBER)
                set(Calendar.DAY_OF_MONTH, 23)
                set(Calendar.HOUR_OF_DAY, 18)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
            }
            return targetCalendar.timeInMillis - System.currentTimeMillis()
        }
    }

    override fun doWork(): Result {
        Log.d("ReminderNotificationWorker", "Creating the reminder")
        val notificationManager =
            applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val channelId = "reminder_channel"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Reminders",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            notificationManager.createNotificationChannel(channel)
        }

        val notification = NotificationCompat.Builder(applicationContext, channelId)
            .setContentTitle("Cruise chat")
            .setContentText("Is the cruise starting? Turn the app on now!")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .build()

        notificationManager.notify(2001, notification)

        return Result.success()

    }

}