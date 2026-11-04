package in.censorislabs.readingtracker;

import android.content.Context;
import android.content.SharedPreferences;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ReadingWidget")
public class ReadingWidgetPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        Context context = getContext();
        JSObject value = call.getData();
        SharedPreferences.Editor editor = context.getSharedPreferences("reading_widget", Context.MODE_PRIVATE).edit();
        editor.putString("title", safe(value.getString("title"), "Choose your next book"));
        editor.putString("author", safe(value.getString("author"), ""));
        editor.putString("buddyName", safe(value.getString("buddyName"), "Page"));
        editor.putString("buddyAvatar", safe(value.getString("buddyAvatar"), "📚"));
        editor.putInt("progress", Math.max(0, Math.min(100, value.optInt("progress", 0))));
        editor.putInt("currentPage", Math.max(0, value.optInt("currentPage", 0)));
        editor.putInt("totalPages", Math.max(0, value.optInt("totalPages", 0)));
        editor.putInt("streak", Math.max(0, value.optInt("streak", 0)));
        editor.apply();

        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, ReadingTrackerWidgetProvider.class));
        new ReadingTrackerWidgetProvider().onUpdate(context, manager, ids);
        JSObject result = new JSObject();
        result.put("updated", true);
        call.resolve(result);
    }
    private String safe(String text, String fallback) {
        return text == null ? fallback : text;
    }
}
