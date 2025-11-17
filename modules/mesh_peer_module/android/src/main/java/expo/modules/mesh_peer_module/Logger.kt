package expo.modules.mesh_peer_module

import android.util.Log
import io.opentelemetry.api.GlobalOpenTelemetry
import io.opentelemetry.api.logs.Logger
import io.opentelemetry.api.logs.Severity

object Logger {
    private val logger: Logger by lazy {
        GlobalOpenTelemetry.get().logsBridge.get("com.raskitech.cruisechat")
    }

    fun info(tag: String, message: String) {
        logger.logRecordBuilder()
            .setSeverity(Severity.INFO)
            .setBody(message)
            .setAttribute("tag", tag)
            .emit()

        Log.d(tag, message)
    }

    fun error(tag: String, message: String, e: Exception, ) {
        logger.logRecordBuilder()
            .setSeverity(Severity.ERROR)
            .setBody(message)
            .setAttribute("tag", tag)
            .setAttribute("exception.type", e.javaClass.name)
            .setAttribute("exception.message", e.message)
            .setAttribute("exception.stacktrace", e.stackTrace.joinToString())
            .emit()

        Log.e(tag, "$message: ${e.message}")
    }
}