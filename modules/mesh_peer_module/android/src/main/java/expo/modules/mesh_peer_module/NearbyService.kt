package expo.modules.mesh_peer_module

import android.app.Notification
import android.app.PendingIntent
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.nearby.Nearby



class NearbyService : Service() {

    private val CHANNEL_ID = "nearby_service_channel"
    private val TAG = "NearbyService"

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "NearbyService onCreate() called")
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, startFlags: Int, startId: Int): Int {
        Log.d(TAG, "NearbyService onStartCommand() called")

        // Make the app open when clicked
        val intent = packageManager.getLaunchIntentForPackage(applicationContext.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        }
        val pendingIntent: PendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Nearby Connections")
            .setContentText("Discovering nearby devices...")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setShowWhen(true)
            .setContentIntent(pendingIntent) // Open app when clicked
            .setAutoCancel(false) // Don't remove when user taps
            .build()

        try {
            // Must call startForeground() quickly
            startForeground(1, notification)
            Log.d(TAG, "Started foreground service with notification")
            
            // Start Nearby logic here
            startNearbyDiscovery()
            
        } catch (e: Exception) {
            Log.e(TAG, "Error starting foreground service: ${e.message}", e)
        }

        return START_STICKY
    }

    private fun startNearbyDiscovery() {
        Log.d(TAG, "Starting nearby discovery...")
        val connectionsClient = Nearby.getConnectionsClient(this)
        // Start advertising or discovery
        Log.d(TAG, "Nearby connections client initialized")
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Log.d(TAG, "Creating notification channel...")
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "Nearby Service Channel",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows status of nearby device connections"
                setShowBadge(true)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(serviceChannel)
            Log.d(TAG, "Notification channel created with IMPORTANCE_DEFAULT")
        } else {
            Log.d(TAG, "Android version < O, no notification channel needed")
        }
    }

    override fun onBind(intent: Intent?): IBinder? {
        Log.d(TAG, "NearbyService onBind() called")
        return null
    }
    
    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "NearbyService onDestroy() called")
    }
}